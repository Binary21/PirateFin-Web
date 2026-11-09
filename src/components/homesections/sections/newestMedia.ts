import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import escapeHtml from 'escape-html';
import type { ApiClient } from 'jellyfin-apiclient';

import cardBuilder from 'components/cardbuilder/cardBuilder';
import layoutManager from 'components/layoutManager';
import globalize from 'lib/globalize';
import { getPortraitShape } from 'utils/card';
import { getNewest, getStatusBadgeHtml, type PirateFinItem, type PirateFinLibrary } from 'utils/piratefin';

import type { SectionContainerElement, SectionOptions } from './section';

const COUNTDOWN_REFRESH_MS = 60 * 1000;

/** The home tab types ("movies" / "shows" / "anime") map onto the PirateFin library names. */
const LIBRARIES: Record<string, PirateFinLibrary> = {
    movies: 'Movies',
    shows: 'Shows',
    anime: 'Anime'
};

function getItemsHtmlFn(library: PirateFinLibrary) {
    return function (items: BaseItemDto[]) {
        const isMovies = library === 'Movies';
        // Posters for every library; episodes show their series' poster.
        return cardBuilder.getCardsHtml({
            items,
            shape: getPortraitShape(true),
            preferSeriesPoster: true,
            showUnplayedIndicator: false,
            context: 'home',
            overlayText: false,
            centerText: true,
            overlayPlayButton: false,
            allowBottomPadding: false,
            showTitle: true,
            showParentTitle: !isMovies,
            showYear: isMovies,
            lines: 2
        });
    };
}

/** Re-renders the status badges ("Airs in 2h 10m") every minute without refetching. */
function wireCountdown(itemsContainer: SectionContainerElement) {
    let items: PirateFinItem[] = [];
    let timer: ReturnType<typeof setInterval> | null = null;

    itemsContainer.afterRefresh = (result: BaseItemDto[] | { Items?: BaseItemDto[] }) => {
        items = Array.isArray(result) ? result : (result.Items || []);
        if (timer) {
            return;
        }

        timer = setInterval(() => {
            if (!itemsContainer.isConnected) {
                clearInterval(timer!);
                timer = null;
                return;
            }

            for (const item of items) {
                const badge = itemsContainer.querySelector(`[data-id="${item.Id}"] .pfStatusBadge`);
                if (badge) {
                    badge.outerHTML = getStatusBadgeHtml(item);
                }
            }
        }, COUNTDOWN_REFRESH_MS);
    };
}

function renderSection(elem: HTMLElement, apiClient: ApiClient, view: BaseItemDto, library: PirateFinLibrary, options: SectionOptions) {
    const title = library === 'Movies' ?
        globalize.translate('NewReleasesFromInternet', escapeHtml(view.Name || library)) :
        globalize.translate('NewestFromInternet', escapeHtml(view.Name || library));

    let html = `<div class="sectionTitleContainer sectionTitleContainer-cards padded-left"><h2 class="sectionTitle sectionTitle-cards">${title}</h2></div>`;
    if (options.enableOverflow) {
        html += '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">';
        html += '<div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x"></div>';
        html += '</div>';
    } else {
        html += '<div is="emby-itemscontainer" class="itemsContainer focuscontainer-x padded-left padded-right vertical-wrap"></div>';
    }

    elem.innerHTML = html;

    const itemsContainer: SectionContainerElement | null = elem.querySelector('.itemsContainer');
    if (!itemsContainer) {
        return;
    }

    const limit = layoutManager.tv || options.enableOverflow ? 20 : 12;
    itemsContainer.fetchData = () => getNewest(apiClient, library, limit);
    itemsContainer.getItemsHtml = getItemsHtmlFn(library);
    itemsContainer.parentContainer = elem;
    wireCountdown(itemsContainer);
}

/**
 * Loads the "Airing Today" (Shows / Anime) or "New" (Movies) row for the home tab's library.
 * @param elem The section element.
 * @param apiClient The api client.
 * @param user The user.
 * @param userViews The user's libraries.
 * @param options The section options.
 * @param type The home tab type: movies, shows or anime.
 */
export function loadNewestAdded(
    elem: HTMLElement,
    apiClient: ApiClient,
    user: UserDto,
    userViews: BaseItemDto[],
    options: SectionOptions,
    type: string
) {
    elem.classList.remove('verticalSection');
    const library = LIBRARIES[type];
    const view = userViews.find(v => v.Name?.toLowerCase() === type);
    if (!library || !view?.Id || user.Configuration?.LatestItemsExcludes?.includes(view.Id)) {
        return;
    }

    const frag = document.createElement('div');
    frag.classList.add('verticalSection', 'hide');
    elem.appendChild(frag);
    renderSection(frag, apiClient, view, library, options);
}
