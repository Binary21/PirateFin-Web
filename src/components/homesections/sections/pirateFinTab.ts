import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import escapeHtml from 'escape-html';
import type { ApiClient } from 'jellyfin-apiclient';

import cardBuilder from 'components/cardbuilder/cardBuilder';
import focusManager from 'components/focusManager';
import layoutManager from 'components/layoutManager';
import globalize from 'lib/globalize';
import * as userSettings from 'scripts/settings/userSettings';
import { getPortraitShape } from 'utils/card';
import {
    type GenreRanking,
    getGenreRanking,
    getHiddenFromContinueWatching,
    getPopular,
    isHiddenFromContinueWatching,
    parseLibrary
} from 'utils/piratefin';

import { createGenreHistory, type GenreHistory, type GenreOption, pickGenres } from './genrePicker';
import { loadHero } from './hero';
import { loadNewestAdded } from './newestMedia';
import { loadRecentlyAdded } from './recentlyAdded';
import type { SectionContainerElement } from './section';

import 'elements/emby-button/emby-button';
import 'elements/emby-itemscontainer/emby-itemscontainer';
import 'elements/emby-scroller/emby-scroller';

const ROW_LIMIT = 24;
const FIELDS = 'PrimaryImageAspectRatio,DateCreated,MediaSourceCount';
const IMAGE_TYPES = 'Primary,Backdrop,Thumb';
const SECTION_OPTIONS = { enableOverflow: true };

type FetchFn = SectionContainerElement['fetchData'];

interface TabContext {
    apiClient: ApiClient;
    userId: string;
    view: BaseItemDto;
    isMovies: boolean;
    itemType: string;
}

/** Every row uses posters; episodes show their series' poster and the series name above the episode. */
function getPosterCardsHtml(items: BaseItemDto[]) {
    return cardBuilder.getCardsHtml({
        items,
        shape: getPortraitShape(true),
        preferSeriesPoster: true,
        showTitle: true,
        showParentTitle: items.some(item => item.Type === 'Episode'),
        showYear: !items.some(item => item.Type === 'Episode'),
        centerText: true,
        overlayPlayButton: false,
        context: 'home',
        lazy: true,
        allowBottomPadding: false
    });
}

function getItems(result: Awaited<ReturnType<FetchFn>>): BaseItemDto[] {
    return Array.isArray(result) ? result : (result.Items || []);
}

/** Keeps one item per series (the first one, so sort before calling); movies are kept as they are. */
function onePerSeries(items: BaseItemDto[]): BaseItemDto[] {
    const seen = new Set<string>();
    return items.filter(item => {
        const key = item.SeriesId || item.Id || '';
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/**
 * Renders a horizontal row; it stays hidden until the items container finds something to show. Continue Watching
 * and Next Up rows get "Remove from Continue Watching" in their cards' menus.
 */
function renderRow(elem: HTMLElement, title: string, fetchData: FetchFn, getItemsHtml: (items: BaseItemDto[]) => string, monitor = '', isContinue = false) {
    const monitorAttribute = (monitor ? ` data-monitor="${monitor}"` : '') + (isContinue ? ' data-pf-continue="true"' : '');
    elem.classList.add('verticalSection', 'hide');
    elem.innerHTML = `
        <div class="sectionTitleContainer sectionTitleContainer-cards padded-left">
            <h2 class="sectionTitle sectionTitle-cards">${escapeHtml(title)}</h2>
        </div>
        <div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">
            <div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x"${monitorAttribute}></div>
        </div>`;

    const itemsContainer: SectionContainerElement | null = elem.querySelector('.itemsContainer');
    if (itemsContainer) {
        itemsContainer.fetchData = fetchData;
        itemsContainer.getItemsHtml = getItemsHtml;
        itemsContainer.parentContainer = elem;
    }
}

function getNextUpFn({ apiClient, userId, view }: TabContext): FetchFn {
    return () => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - userSettings.maxDaysForNextUp());
        return apiClient.getNextUpEpisodes({
            ParentId: view.Id,
            UserId: userId,
            Limit: ROW_LIMIT,
            Fields: FIELDS,
            ImageTypeLimit: 1,
            EnableImageTypes: IMAGE_TYPES,
            EnableTotalRecordCount: false,
            DisableFirstEpisode: false,
            NextUpDateCutoff: cutoff.toISOString(),
            EnableResumable: false,
            EnableRewatching: userSettings.enableRewatchingInNextUp()
        }).then(async result => {
            const hidden = await getHiddenFromContinueWatching(apiClient);
            return onePerSeries(getItems(result)).filter(item => !isHiddenFromContinueWatching(item, hidden));
        });
    };
}

/** Continue Watching: one card per series, for its most recently played episode. */
function getResumeFn({ apiClient, userId, view }: TabContext): FetchFn {
    return () => apiClient.getResumableItems(userId, {
        ParentId: view.Id,
        Recursive: true,
        MediaTypes: 'Video',
        // Fetch extra: several episodes of one series collapse into a single card.
        Limit: ROW_LIMIT * 3,
        Fields: FIELDS,
        ImageTypeLimit: 1,
        EnableImageTypes: IMAGE_TYPES,
        EnableTotalRecordCount: false
    }).then(async result => {
        const hidden = await getHiddenFromContinueWatching(apiClient);
        const lastPlayed = (item: BaseItemDto) => Date.parse(item.UserData?.LastPlayedDate || '') || 0;
        const items = [...getItems(result)]
            .filter(item => !isHiddenFromContinueWatching(item, hidden))
            .sort((a, b) => lastPlayed(b) - lastPlayed(a));
        return onePerSeries(items).slice(0, ROW_LIMIT);
    });
}

function getLibraryItemsFn({ apiClient, userId, view, itemType }: TabContext, query: Record<string, unknown>): FetchFn {
    return () => apiClient.getItems(userId, {
        ParentId: view.Id,
        Recursive: true,
        IncludeItemTypes: itemType,
        Limit: ROW_LIMIT,
        Fields: FIELDS,
        ImageTypeLimit: 1,
        EnableImageTypes: IMAGE_TYPES,
        EnableTotalRecordCount: false,
        ...query
    });
}

/** Which set of 10 the Popular row shows; Refresh moves to the next one, looping after the last. */
interface PopularState {
    set: number;
    sets: number;
}

function getPopularFn({ apiClient, view }: TabContext, state: PopularState, onLoaded: () => void): FetchFn {
    const library = parseLibrary(view.Name);
    return async () => {
        if (!library) {
            return [];
        }

        const result = await getPopular(apiClient, library, state.set, FIELDS);
        state.sets = result.TotalRecordCount;
        onLoaded();
        return result.Items;
    };
}

/** Back to where the tab starts: the top of the page, with the selector on the billboard's first button (TV). */
function returnToStart(elem: HTMLElement) {
    const hero = elem.querySelector<HTMLElement>('.pfHeroContainer');
    hero?.scrollIntoView({ block: 'start' });

    const firstButton = hero?.querySelector<HTMLElement>('.pfHero-buttons .pfButton');
    if (layoutManager.tv && firstButton) {
        focusManager.focus(firstButton);
    }
}

/** The library's genres with titles of the tab's type, and the user's genre ranking (empty when it can't be loaded). */
async function loadGenres(context: TabContext): Promise<{ genres: GenreOption[]; ranking: Pick<GenreRanking, 'Genres' | 'Discovery'> }> {
    const library = parseLibrary(context.view.Name);
    const [ result, ranking ] = await Promise.all([
        context.apiClient.getGenres(context.userId, {
            ParentId: context.view.Id,
            IncludeItemTypes: context.itemType,
            SortBy: 'SortName'
        }),
        library ?
            getGenreRanking(context.apiClient, context.userId, library).catch((err: unknown) => {
                // Without the ranking the rows are random genres, as before.
                console.error('[PirateFin] failed to load the genre ranking', err);
                return { Genres: [], Discovery: [] };
            }) :
            Promise.resolve({ Genres: [], Discovery: [] })
    ]);

    const genres = (result.Items || []).flatMap(g => (g.Id && g.Name ? [ { Id: g.Id, Name: g.Name } ] : []));
    return { genres, ranking };
}

/** Replaces the genre rows: two of the user's top genres and one they might like (see {@link pickGenres}). */
function renderGenreRows(
    container: HTMLElement,
    context: TabContext,
    genres: GenreOption[],
    ranking: Pick<GenreRanking, 'Genres' | 'Discovery'>,
    history: GenreHistory
): number {
    const picked = pickGenres(genres, ranking.Genres, ranking.Discovery, history);

    container.innerHTML = '';
    for (const genre of picked) {
        const row = document.createElement('div');
        container.appendChild(row);
        renderRow(row, genre.Name, getLibraryItemsFn(context, { GenreIds: genre.Id, SortBy: 'Random' }), getPosterCardsHtml);
    }
    return picked.length;
}

async function resumeRows(container: HTMLElement) {
    // emby-itemscontainer elements fetch and render their items on resume.
    const rows = container.querySelectorAll<HTMLElement & { resume?: (options: { refresh: boolean }) => Promise<void> }>('.itemsContainer');
    await Promise.all(Array.from(rows, row => row.resume?.({ refresh: true })));
}

/**
 * Builds a Movies / Shows / Anime home tab: billboard, Recently Released (New for movies), Popular {library} (the most
 * popular recent titles, 10 at a time), Recently Added, Next Up, Continue Watching, three genre rows (two the user
 * watches most, one to discover) and a Refresh button that moves on to the next 10 popular titles and other genres.
 * Every row only shows items of the tab's library.
 * @param elem The tab's sections container.
 * @param apiClient The api client.
 * @param user The user.
 * @param userViews The user's libraries.
 * @param type The tab type: movies, shows or anime.
 */
export async function loadPirateFinTab(elem: HTMLElement, apiClient: ApiClient, user: UserDto, userViews: BaseItemDto[], type: string) {
    const view = userViews.find(v => v.Name?.toLowerCase() === type);
    const isMovies = type === 'movies';

    elem.innerHTML = `
        <div class="pfHeroContainer"></div>
        <div class="pfRow-newest"></div>
        <div class="pfRow-popular"></div>
        <div class="pfRow-recent"></div>
        <div class="pfRow-nextUp"></div>
        <div class="pfRow-resume"></div>
        <div class="pfGenreRows"></div>
        <div class="pfGenreRefresh padded-left padded-right hide">
            <button is="emby-button" type="button" class="pfButton pfButton-secondary btnRefreshGenres">
                <span class="material-icons refresh" aria-hidden="true"></span>
                <span>${globalize.translate('ButtonRefresh')}</span>
            </button>
        </div>`;

    if (!view?.Id) {
        return;
    }

    const context: TabContext = { apiClient, userId: user.Id || apiClient.getCurrentUserId(), view, isMovies, itemType: isMovies ? 'Movie' : 'Series' };
    const section = (name: string) => elem.querySelector<HTMLElement>(`.pfRow-${name}`)!;

    const heroPromise = loadHero(elem.querySelector('.pfHeroContainer')!, apiClient, userViews, type);
    loadNewestAdded(section('newest'), apiClient, user, userViews, SECTION_OPTIONS, type);
    loadRecentlyAdded(section('recent'), apiClient, user, userViews, SECTION_OPTIONS, type);

    if (isMovies) {
        // Movies have no Next Up; it shows the movies being watched (so there's no separate Continue Watching row).
        renderRow(section('nextUp'), globalize.translate('NextUp'), getResumeFn(context), getPosterCardsHtml, 'videoplayback,markplayed', true);
    } else {
        renderRow(section('nextUp'), globalize.translate('NextUp'), getNextUpFn(context), getPosterCardsHtml, 'videoplayback,markplayed', true);
        renderRow(section('resume'), globalize.translate('HeaderContinueWatching'), getResumeFn(context), getPosterCardsHtml, 'videoplayback,markplayed', true);
    }

    const genreRows = elem.querySelector<HTMLElement>('.pfGenreRows')!;
    const refresh = elem.querySelector<HTMLElement>('.pfGenreRefresh')!;
    const popularRow = section('popular');
    const popular: PopularState = { set: 0, sets: 0 };
    let genresShown = 0;
    // Refresh is there when it has something to move on to: other popular titles or genres.
    const updateRefresh = () => refresh.classList.toggle('hide', genresShown === 0 && popular.sets < 2);

    renderRow(popularRow, `Popular ${view.Name}`, getPopularFn(context, popular, updateRefresh), getPosterCardsHtml);

    const history = createGenreHistory();
    let genreData: Awaited<ReturnType<typeof loadGenres>> | null = null;
    try {
        genreData = await loadGenres(context);
        genresShown = renderGenreRows(genreRows, context, genreData.genres, genreData.ranking, history);
        updateRefresh();
    } catch (err) {
        console.error('[PirateFin] failed to load genres', err);
    }

    // Refresh: the next 10 popular titles (5 sets, then the first again) and the next genres down the ranking, then
    // back to where the tab starts.
    refresh.querySelector('.btnRefreshGenres')?.addEventListener('click', () => {
        if (popular.sets > 0) {
            popular.set = (popular.set + 1) % popular.sets;
        }
        if (genreData) {
            renderGenreRows(genreRows, context, genreData.genres, genreData.ranking, history);
        }
        Promise.all([ resumeRows(popularRow), resumeRows(genreRows) ])
            .then(() => returnToStart(elem))
            .catch(err => console.error('[PirateFin] failed to refresh the rows', err));
    });

    await heroPromise;
}
