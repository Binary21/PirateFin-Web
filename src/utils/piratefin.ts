import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import escapeHtml from 'escape-html';
import type { ApiClient } from 'jellyfin-apiclient';

import datetime from 'scripts/datetime';

import 'styles/piratefin.scss';

/** Where a PirateFin (internet sourced) item is in its release / download lifecycle. Mirrors the server enum. */
export enum ReleaseStatus {
    Unaired = 'Unaired',
    Searching = 'Searching',
    ChooseSource = 'ChooseSource',
    Available = 'Available',
    Downloading = 'Downloading',
    Downloaded = 'Downloaded',
    NotFound = 'NotFound'
}

/** The PirateFin libraries. */
export type PirateFinLibrary = 'Shows' | 'Anime' | 'Movies';

/** Server fields PirateFin adds to BaseItemDto. */
export interface PirateFinItem extends BaseItemDto {
    ReleaseStatus?: ReleaseStatus | null;
    FirstAiring?: string | null;
    SourceCount?: number | null;
    IsSubscribed?: boolean | null;
    IsInternet?: boolean;
    BackupImageUrl?: string | null;
    /** Episodes / movies: whether it can be played yet (downloaded, or far enough into its download). */
    IsReadyToPlay?: boolean | null;
    /** Seasons / episodes: anime asks Dub or Sub when subscribing. */
    IsAnime?: boolean | null;
    /** The language the user subscribed in, when they chose one. */
    SubscriptionLanguage?: SubscriptionLanguage | null;
}

/** The audio type an anime subscription downloads. Mirrors the server's ReleaseLanguage. */
export type SubscriptionLanguage = 'Dub' | 'Sub';

/** Whether a PirateFin episode or movie can't be played yet; regular items always can. */
export function isNotReadyToPlay(item: PirateFinItem): boolean {
    return item.IsReadyToPlay === false;
}

/** A Trakt / AniList search result; nothing exists in the library until it is opened. */
export interface InternetSearchResult {
    Key: string;
    Library: PirateFinLibrary;
    Title: string;
    Year?: number | null;
    Overview: string;
    ImageUrl: string;
    Genres: string[];
    ItemId?: string | null;
}

/** A fallback download source the user can choose. */
export interface TorrentSource {
    Index: number;
    Title: string;
    Seeders: number;
    SizeBytes: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let activeLibrary: PirateFinLibrary | null = null;

/** Set by the Movies / Shows / Anime home tabs while they are shown, so search can stay within that library. */
export function setActiveLibrary(library: PirateFinLibrary | null) {
    activeLibrary = library;
}

/** The library of the home tab currently shown, or null elsewhere. */
export function getActiveLibrary(): PirateFinLibrary | null {
    return activeLibrary;
}

const HOME_TAB_KEY = 'piratefin_home_tab';

/** Remembers the home tab (Movies / Shows / Anime) last shown, for this session. */
export function rememberHomeTab(index: number) {
    try {
        sessionStorage.setItem(HOME_TAB_KEY, String(index));
    } catch {
        // Private browsing: Home falls back to the first tab.
    }
}

/** The home tab last shown this session, or null. */
export function getLastHomeTab(): number | null {
    try {
        const value = Number.parseInt(sessionStorage.getItem(HOME_TAB_KEY) ?? '', 10);
        return Number.isNaN(value) ? null : value;
    } catch {
        return null;
    }
}

/** Parses a library name from a url parameter. */
export function parseLibrary(value: string | null | undefined): PirateFinLibrary | undefined {
    return (['Movies', 'Shows', 'Anime'] as const).find(l => l.toLowerCase() === value?.toLowerCase());
}

export function getReleaseStatus(item: PirateFinItem | null | undefined): ReleaseStatus | undefined {
    return item?.ReleaseStatus ?? undefined;
}

/** Whether the item can't be opened / played yet (not aired, still searching or nothing found). */
export function isWaiting(item: PirateFinItem): boolean {
    const status = getReleaseStatus(item);
    return status === ReleaseStatus.Unaired || status === ReleaseStatus.Searching || status === ReleaseStatus.NotFound;
}

/** Parses the server's UTC air time; returns undefined when missing. */
export function getAirDate(item: PirateFinItem): Date | undefined {
    if (!item.FirstAiring) {
        return undefined;
    }

    const date = new Date(item.FirstAiring);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Formats an air time in the viewer's time zone, e.g. "Today 9:00 PM" or "Fri, Oct 24, 9:00 PM". */
export function formatAirTime(date: Date): string {
    const time = datetime.toLocaleTimeString(date, { hour: 'numeric', minute: '2-digit' });
    if (datetime.isRelativeDay(date, 0)) {
        return `Today ${time}`;
    }
    if (datetime.isRelativeDay(date, 1)) {
        return `Tomorrow ${time}`;
    }
    if (datetime.isRelativeDay(date, -1)) {
        return `Yesterday ${time}`;
    }

    return datetime.toLocaleString(date, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** A short, user facing description of the status, or an empty string for regular items. */
export function getStatusText(item: PirateFinItem): string {
    const airDate = getAirDate(item);
    switch (getReleaseStatus(item)) {
        case ReleaseStatus.Unaired: {
            if (!airDate) {
                return 'Coming soon';
            }

            const remaining = airDate.getTime() - Date.now();
            return remaining > 0 && remaining < ONE_DAY_MS ?
                `Airs in ${datetime.getDisplayDuration(remaining * 10000)}` :
                `Airs ${formatAirTime(airDate)}`;
        }
        case ReleaseStatus.Searching:
            return 'Finding a release…';
        case ReleaseStatus.ChooseSource:
            return 'Choose a source';
        case ReleaseStatus.Available:
            return 'Ready';
        case ReleaseStatus.Downloading:
            return 'Downloading';
        case ReleaseStatus.NotFound:
            return 'No release found';
        default:
            return '';
    }
}

/**
 * A badge for cards / list items. Downloaded and regular items get none, and neither do downloading ones (their play
 * buttons show that instead).
 */
export function getStatusBadgeHtml(item: PirateFinItem): string {
    const status = getReleaseStatus(item);
    if (!status || status === ReleaseStatus.Downloaded || status === ReleaseStatus.Downloading) {
        return '';
    }

    return `<div class="pfStatusBadge pfStatusBadge-${status}">${escapeHtml(getStatusText(item))}</div>`;
}

/** The viewer's offset from UTC in minutes (e.g. -240 for EDT). */
export function getUtcOffsetMinutes(): number {
    return -new Date().getTimezoneOffset();
}

/** The poster to show until Jellyfin has fetched its own artwork. */
export function getFallbackImageUrl(item: PirateFinItem): string | undefined {
    return item.ImageTags?.Primary ? undefined : item.BackupImageUrl || undefined;
}

export function getNewest(apiClient: ApiClient, library: PirateFinLibrary, limit: number): Promise<PirateFinItem[]> {
    return apiClient.getJSON(apiClient.getUrl('PirateFin/Newest', {
        library,
        limit,
        utcOffsetMinutes: getUtcOffsetMinutes(),
        fields: 'PrimaryImageAspectRatio,Overview,BasicSyncInfo'
    }));
}

export function searchInternet(apiClient: ApiClient, library: PirateFinLibrary, query: string): Promise<InternetSearchResult[]> {
    return apiClient.getJSON(apiClient.getUrl('PirateFin/Search', { library, query }));
}

/** Adds a search result to the library; resolves with the new series id. */
export async function openSearchResult(apiClient: ApiClient, result: InternetSearchResult, query: string): Promise<string> {
    const response: { ItemId: string } = await apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl('PirateFin/Search/Open'),
        data: JSON.stringify({ Library: result.Library, Key: result.Key, Query: query }),
        contentType: 'application/json',
        dataType: 'json'
    });
    return response.ItemId;
}

/** What refreshing a series from Trakt / AniList added. */
export interface RefreshSeriesResult {
    SeasonsAdded: number;
    EpisodesAdded: number;
}

/** Looks the series (or the season's series) up on Trakt / AniList and adds the seasons and episodes it's missing. */
export function refreshSeries(apiClient: ApiClient, itemId: string): Promise<RefreshSeriesResult> {
    return apiClient.ajax({ type: 'POST', url: apiClient.getUrl(`PirateFin/Items/${itemId}/Refresh`), dataType: 'json' });
}

export function getSources(apiClient: ApiClient, itemId: string): Promise<TorrentSource[]> {
    return apiClient.getJSON(apiClient.getUrl(`PirateFin/Items/${itemId}/Sources`));
}

export function selectSource(apiClient: ApiClient, itemId: string, index: number): Promise<unknown> {
    return apiClient.ajax({ type: 'POST', url: apiClient.getUrl(`PirateFin/Items/${itemId}/Sources/${index}`) });
}

export async function setSubscribed(apiClient: ApiClient, itemId: string, subscribed: boolean, language?: SubscriptionLanguage): Promise<void> {
    const query = subscribed && language ? { language } : undefined;
    await apiClient.ajax({ type: subscribed ? 'POST' : 'DELETE', url: apiClient.getUrl(`PirateFin/Items/${itemId}/Subscription`, query) });

    // Subscribing queues the season's downloads; say so when they can't start yet.
    if (subscribed) {
        await warnIfStoragePaused(apiClient, itemId);
    }
}

/** The language the anime subscribe prompt preselects ("Prioritize Dub" in the Jackett settings). */
export function getDefaultSubscriptionLanguage(apiClient: ApiClient): Promise<SubscriptionLanguage> {
    return apiClient.getJSON(apiClient.getUrl('PirateFin/Subscriptions/DefaultLanguage'));
}

/**
 * The season bell. TV seasons toggle; anime asks "Dub if available" or Sub (preselected by "Prioritize Dub"), and
 * once subscribed offers to switch language or unsubscribe.
 * @returns what changed, or null when the prompt was dismissed.
 */
export async function toggleSubscription(apiClient: ApiClient, item: PirateFinItem, anchor?: Element | null): Promise<'subscribed' | 'unsubscribed' | null> {
    const subscribed = item.IsSubscribed === true;
    if (!item.IsAnime) {
        await setSubscribed(apiClient, item.Id!, !subscribed);
        return subscribed ? 'unsubscribed' : 'subscribed';
    }

    const { default: actionSheet } = await import('components/actionSheet/actionSheet');
    const current: SubscriptionLanguage = item.SubscriptionLanguage
        ?? await getDefaultSubscriptionLanguage(apiClient).catch(() => 'Sub' as const);

    const items = [
        { id: 'Dub', name: 'Dub if available', secondaryText: 'Downloads the sub until the dub is out, then swaps it in', selected: current === 'Dub' },
        { id: 'Sub', name: 'Sub', secondaryText: 'Original audio with subtitles', selected: current === 'Sub' }
    ];
    if (subscribed) {
        items.push({ id: 'unsubscribe', name: 'Unsubscribe', secondaryText: 'Stop downloading new episodes', selected: false });
    }

    const currentLabel = current === 'Dub' ? 'Dub if available' : 'Sub';
    const choice = await actionSheet.show({
        title: subscribed ? 'Change subscription' : 'Subscribe to season',
        text: subscribed ? `Subscribed: ${currentLabel}` : 'Download new episodes as:',
        items,
        showCancel: true,
        positionTo: anchor ?? null
    }).catch(() => null);

    if (choice == null || (subscribed && choice === current && item.SubscriptionLanguage)) {
        return null;
    }

    if (choice === 'unsubscribe') {
        await setSubscribed(apiClient, item.Id!, false);
        return 'unsubscribed';
    }

    await setSubscribed(apiClient, item.Id!, true, choice as SubscriptionLanguage);
    return 'subscribed';
}

/** How a series (title) or season (season number) is searched for on Jackett. */
export interface SearchOverride {
    Title: string;
    DefaultTitle: string;
    IsTitleOverridden: boolean;
    SeasonNumber?: number | null;
    DefaultSeasonNumber?: number | null;
    IsSeasonNumberOverridden: boolean;
}

function getSearchOverride(apiClient: ApiClient, itemId: string): Promise<SearchOverride> {
    return apiClient.getJSON(apiClient.getUrl(`PirateFin/Items/${itemId}/SearchOverride`));
}

function saveSearchOverride(apiClient: ApiClient, itemId: string, value: { Title?: string; SeasonNumber?: number }): Promise<unknown> {
    return apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl(`PirateFin/Items/${itemId}/SearchOverride`),
        data: JSON.stringify(value),
        contentType: 'application/json'
    });
}

function resetSearchOverride(apiClient: ApiClient, itemId: string): Promise<unknown> {
    return apiClient.ajax({ type: 'DELETE', url: apiClient.getUrl(`PirateFin/Items/${itemId}/SearchOverride`) });
}

interface ResearchResult {
    Searching: number;
    Replaced: number;
    SkippedDownloading: number;
}

async function research(apiClient: ApiClient, itemId: string, replaceDownloaded: boolean): Promise<ResearchResult> {
    const response: Response = await apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl(`PirateFin/Items/${itemId}/Research`, { replaceDownloaded }),
        dataType: 'json'
    });
    return response as unknown as ResearchResult;
}

/** Whether the admin's "Search settings" entry applies: PirateFin series and seasons. */
export function supportsSearchOverride(item: PirateFinItem, isAdmin: boolean): boolean {
    return isAdmin && (item.Type === 'Series' || item.Type === 'Season') && item.IsInternet === true;
}

type SearchSettingsAction = 'save' | 'reset' | null;

function showSearchSettingsDialog(item: PirateFinItem, current: SearchOverride): Promise<{ action: SearchSettingsAction; value: string }> {
    return Promise.all([
        import('components/dialogHelper/dialogHelper'),
        import('elements/emby-input/emby-input'),
        import('elements/emby-button/emby-button'),
        import('elements/emby-button/paper-icon-button-light')
    ]).then(([{ default: dialogHelper }]) => new Promise(resolve => {
        const isSeason = item.Type === 'Season';
        const dlg = dialogHelper.createDialog({ removeOnClose: true, scrollY: false, size: 'small' });
        dlg.classList.add('formDialog');

        const value = isSeason ? String(current.SeasonNumber ?? '') : current.Title;
        const fallback = isSeason ?
            `Default: season ${current.DefaultSeasonNumber ?? 1}.` :
            `Default: "${current.DefaultTitle}".`;
        const seasonTitle = isSeason ?
            `<p class="fieldDescription">Searched with the series title "${escapeHtml(current.Title)}" (set on the series page).</p>` :
            '';
        const overridden = isSeason ? current.IsSeasonNumberOverridden : current.IsTitleOverridden;

        dlg.innerHTML = `
            <div class="formDialogHeader">
                <button is="paper-icon-button-light" class="btnCancel autoSize" title="Cancel">
                    <span class="material-icons arrow_back" aria-hidden="true"></span>
                </button>
                <h3 class="formDialogHeaderTitle">Search settings</h3>
            </div>
            <div class="formDialogContent smoothScrollY">
                <div class="dialogContentInner dialog-content-centered" style="padding-top:1.5em;">
                    <form>
                        <div class="inputContainer">
                            <input is="emby-input" id="txtSearchValue" required
                                type="${isSeason ? 'number' : 'text'}" ${isSeason ? 'min="0" max="999" step="1"' : ''}
                                label="${isSeason ? 'Search season number' : 'Search title'}" />
                            <div class="fieldDescription">
                                Only the Jackett search uses this; the ${isSeason ? 'displayed season number' : 'displayed name'} doesn't change.
                                ${escapeHtml(fallback)}${overridden ? '' : ' (in use now)'}
                            </div>
                            ${seasonTitle}
                        </div>
                        <div class="formDialogFooter" style="display:flex;gap:.5em;flex-wrap:wrap;">
                            <button is="emby-button" type="submit" class="raised button-submit formDialogFooterItem" style="flex:1;">
                                <span>Save</span>
                            </button>
                            <button is="emby-button" type="button" class="raised btnReset formDialogFooterItem" style="flex:1;" ${overridden ? '' : 'disabled'}>
                                <span>Reset to default</span>
                            </button>
                            <button is="emby-button" type="button" class="raised button-cancel btnCancelFooter formDialogFooterItem" style="flex:1;">
                                <span>Cancel</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>`;

        const input = dlg.querySelector<HTMLInputElement>('#txtSearchValue')!;
        input.value = value;

        let result: { action: SearchSettingsAction; value: string } = { action: null, value: '' };
        const close = () => dialogHelper.close(dlg);
        dlg.querySelector('.btnCancel')!.addEventListener('click', close);
        dlg.querySelector('.btnCancelFooter')!.addEventListener('click', close);
        dlg.querySelector('.btnReset')!.addEventListener('click', () => {
            result = { action: 'reset', value: '' };
            close();
        });
        dlg.querySelector('form')!.addEventListener('submit', e => {
            e.preventDefault();
            result = { action: 'save', value: input.value.trim() };
            close();
        });

        dialogHelper.open(dlg).then(() => resolve(result), () => resolve(result));
    }));
}

/**
 * Admin: the ⋮ "Search settings" of a series (Jackett search title) or season (search season number). Opens with
 * what the search uses now; after saving or resetting, asks whether to search the episodes again.
 * @returns whether anything was saved.
 */
export async function showSearchSettings(apiClient: ApiClient, item: PirateFinItem, anchor?: Element | null): Promise<boolean> {
    const [{ default: actionSheet }, { default: toast }] = await Promise.all([
        import('components/actionSheet/actionSheet'),
        import('components/toast/toast')
    ]);

    const current = await getSearchOverride(apiClient, item.Id!);
    const { action, value } = await showSearchSettingsDialog(item, current);
    if (!action) {
        return false;
    }

    try {
        await applySearchSettings(apiClient, item, action, value);
    } catch (err) {
        console.error('[PirateFin] saving the search settings failed', err);
        toast('Could not save the search settings');
        return false;
    }

    const choice = await actionSheet.show({
        title: action === 'reset' ? 'Search reset to default' : 'Search settings saved',
        text: 'Search this ' + (item.Type === 'Season' ? 'season' : 'series') + '\'s episodes again with the new settings?',
        items: [
            { id: 'missing', name: 'Re-search missing episodes', secondaryText: 'Episodes not downloaded yet' },
            { id: 'all', name: 'Also replace downloaded episodes', secondaryText: 'Deletes their files and downloads them again' },
            { id: 'none', name: 'Not now', secondaryText: 'The next scheduled search uses the new settings' }
        ],
        positionTo: anchor ?? null
    }).catch(() => 'none');

    if (choice === 'missing' || choice === 'all') {
        toast(describeResearch(await research(apiClient, item.Id!, choice === 'all')));
    } else {
        toast(action === 'reset' ? 'Search reset to default' : 'Search settings saved');
    }

    return true;
}

function applySearchSettings(apiClient: ApiClient, item: PirateFinItem, action: 'save' | 'reset', value: string): Promise<unknown> {
    if (action === 'reset') {
        return resetSearchOverride(apiClient, item.Id!);
    }
    return saveSearchOverride(apiClient, item.Id!, item.Type === 'Season' ? { SeasonNumber: Number(value) } : { Title: value });
}

function describeResearch(result: ResearchResult): string {
    const parts = [`Searching ${result.Searching} episode${result.Searching === 1 ? '' : 's'} again`];
    if (result.Replaced) {
        parts.push(`${result.Replaced} downloaded replaced`);
    }
    if (result.SkippedDownloading) {
        parts.push(`${result.SkippedDownloading} downloading left alone`);
    }
    return parts.join(' · ');
}

/** Fingerprints that change whenever the item itself, or its list of children, was saved on the server. */
export interface ChangeToken {
    Item: string;
    Children: string;
}

export function getChangeToken(apiClient: ApiClient, itemId: string): Promise<ChangeToken> {
    return apiClient.getJSON(apiClient.getUrl(`PirateFin/Items/${itemId}/ChangeToken`));
}

/** Whether the item's downloads are paused because no drive of its library has room. */
export async function isStoragePaused(apiClient: ApiClient, itemId: string): Promise<boolean> {
    try {
        const status: { Paused: boolean } = await apiClient.getJSON(apiClient.getUrl(`PirateFin/Items/${itemId}/StorageStatus`));
        return status.Paused;
    } catch (err) {
        console.error('[PirateFin] storage status check failed', err);
        return false;
    }
}

/**
 * Tells the user their download won't start yet when the item's library storage is full (it starts on its own once
 * there's room). Resolves true when the popup was shown.
 */
export async function warnIfStoragePaused(apiClient: ApiClient, itemId: string): Promise<boolean> {
    if (!await isStoragePaused(apiClient, itemId)) {
        return false;
    }

    const { default: alert } = await import('components/alert');
    await alert({
        title: 'Downloads paused',
        text: 'Library storage is nearly full so downloads have been paused. Please contact your administrator to expand the storage on the server.'
    });
    return true;
}

export type DownloadRequestStatus = 'Open' | 'Fulfilled' | 'NotFound' | 'Cancelled';

/** A user's request that an admin finds episodes PirateFin couldn't. */
export interface DownloadRequest {
    Id: string;
    UserName: string;
    ItemId: string;
    SeriesName: string;
    /** e.g. "Season 2" or "S02E05: The Return". */
    Title: string;
    CreatedUtc: string;
    Status: DownloadRequestStatus;
    ClosedUtc?: string | null;
    AdminNote?: string | null;
    Episodes: { EpisodeId: string; Label: string; MagnetUrl?: string | null }[];
}

/** The signed in user's requests and how many more they may make (-1 = no limit). */
export interface MyRequests {
    Requests: DownloadRequest[];
    Limit: number;
    Open: number;
    Remaining: number;
}

/** Fired on document when the user's requests change, so the header bell updates. */
export const REQUESTS_CHANGED_EVENT = 'piratefinrequestschanged';

export function getMyRequests(apiClient: ApiClient): Promise<MyRequests> {
    return apiClient.getJSON(apiClient.getUrl('PirateFin/Requests/Mine'));
}

/** Asks an admin to find an episode PirateFin gave up on, or a season's missing episodes. */
export async function createRequest(apiClient: ApiClient, itemId: string): Promise<DownloadRequest> {
    const request: DownloadRequest = await apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl('PirateFin/Requests'),
        data: JSON.stringify({ ItemId: itemId }),
        contentType: 'application/json',
        dataType: 'json'
    });
    document.dispatchEvent(new CustomEvent(REQUESTS_CHANGED_EVENT));
    return request;
}

export async function cancelRequest(apiClient: ApiClient, requestId: string): Promise<void> {
    await apiClient.ajax({ type: 'POST', url: apiClient.getUrl(`PirateFin/Requests/${requestId}/Cancel`) });
    document.dispatchEvent(new CustomEvent(REQUESTS_CHANGED_EVENT));
}

/** A notification in the user's bell: an admin's reply to a request, or a new episode ready to watch. */
export interface UserNotification {
    Id: string;
    Kind: 'EpisodeReady' | 'RequestClosed' | 'DownloadReady';
    Title: string;
    Text?: string | null;
    ItemId?: string | null;
    CreatedUtc: string;
    Seen: boolean;
}

export interface Inbox {
    Notifications: UserNotification[];
    Unseen: number;
}

export function getInbox(apiClient: ApiClient): Promise<Inbox> {
    return apiClient.getJSON(apiClient.getUrl('PirateFin/Inbox'));
}

/** The user opened the bell: their notifications are seen, so the dot goes away. */
export async function markInboxSeen(apiClient: ApiClient): Promise<void> {
    await apiClient.ajax({ type: 'POST', url: apiClient.getUrl('PirateFin/Inbox/Seen') });
}

export async function deleteNotification(apiClient: ApiClient, notificationId: string): Promise<void> {
    await apiClient.ajax({ type: 'DELETE', url: apiClient.getUrl(`PirateFin/Inbox/${notificationId}`) });
    document.dispatchEvent(new CustomEvent(REQUESTS_CHANGED_EVENT));
}

export async function clearInbox(apiClient: ApiClient): Promise<void> {
    await apiClient.ajax({ type: 'DELETE', url: apiClient.getUrl('PirateFin/Inbox') });
    document.dispatchEvent(new CustomEvent(REQUESTS_CHANGED_EVENT));
}

/** A user's own request limit (admins); null when they get the default, -1 for no limit. */
export async function getUserRequestLimit(apiClient: ApiClient, userId: string): Promise<number | null> {
    const result: { Limit?: number | null } = await apiClient.getJSON(apiClient.getUrl(`PirateFin/Users/${userId}/RequestLimit`));
    return result.Limit ?? null;
}

export async function setUserRequestLimit(apiClient: ApiClient, userId: string, limit: number | null): Promise<void> {
    await apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl(`PirateFin/Users/${userId}/RequestLimit`),
        data: JSON.stringify({ Limit: limit }),
        contentType: 'application/json'
    });
}

/** The text of an error response from the server (it explains refused requests), or an empty string. */
export async function getErrorText(err: unknown): Promise<string> {
    return err instanceof Response ? (await err.text()).replace(/(^")|("$)/g, '') : '';
}

/** A user's email address and email preferences. */
export interface NotificationSettings {
    Email?: string | null;
    /** Email when a new episode of a season they follow is ready. */
    NewEpisodeEmails: boolean;
}

export function getNotificationSettings(apiClient: ApiClient, userId: string): Promise<NotificationSettings> {
    return apiClient.getJSON(apiClient.getUrl(`PirateFin/Users/${userId}/Notifications`));
}

export function saveNotificationSettings(apiClient: ApiClient, userId: string, settings: NotificationSettings): Promise<unknown> {
    return apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl(`PirateFin/Users/${userId}/Notifications`),
        data: JSON.stringify(settings),
        contentType: 'application/json'
    });
}

export interface RankedGenre {
    Id: string;
    Name: string;
    /** Titles watched in this genre (for a discovery genre: by the other users). */
    Titles: number;
}

/** A user's genres in a library, most watched first, and genres the other users watch that this user rarely does. */
export interface GenreRanking {
    Library: PirateFinLibrary;
    Genres: RankedGenre[];
    Discovery: RankedGenre[];
}

export function getGenreRanking(apiClient: ApiClient, userId: string, library: PirateFinLibrary): Promise<GenreRanking> {
    return apiClient.getJSON(apiClient.getUrl(`PirateFin/Users/${userId}/Genres`, { library }));
}

/**
 * One set of a library's Popular row (the most popular recent titles, refreshed daily on the server). The sets loop;
 * TotalRecordCount is how many sets there are.
 */
export function getPopular(apiClient: ApiClient, library: PirateFinLibrary, set: number, fields: string): Promise<{ Items: BaseItemDto[]; TotalRecordCount: number }> {
    return apiClient.getJSON(apiClient.getUrl('PirateFin/Popular', { library, set, setSize: 10, fields }));
}

/** The newest unwatched, playable episode of each series the user follows that aired in the last 7 days. */
export function getNewSubscribedEpisodes(apiClient: ApiClient, library: PirateFinLibrary, fields: string, limit = 8): Promise<BaseItemDto[]> {
    return apiClient.getJSON(apiClient.getUrl('PirateFin/NewSubscribedEpisodes', { library, fields, limit }));
}

/** Where a download stands (qBittorrent's states, as the Play button shows them). */
export type DownloadState = 'None' | 'Queued' | 'Downloading' | 'Stalled' | 'Paused' | 'Failed';

export interface DownloadStatus {
    ItemId?: string;
    /** Whether enough is on disk to start playing (season / series: any episode). */
    Playable: boolean;
    State?: DownloadState;
    /** 0-1, or null when the item isn't downloading. */
    Progress: number | null;
    /** 0-1: how much is downloaded without a gap from the start; null when the item isn't downloading. */
    ContiguousProgress?: number | null;
    /** Roughly how far into the video (seconds) the data reaches without a gap; null when downloaded or unknown. */
    PlayableSeconds?: number | null;
    /** Whether the whole file is on disk. */
    Downloaded?: boolean;
    /** 0-1: the progress at which it becomes playable. */
    PlayableProgress?: number;
    /** 0-1: how far the download is towards being playable (how much of the Play button is filled). */
    PlayableFill: number;
    /** Whether the download is expected to take more than an hour. */
    Slow?: boolean;
}

/** What Play says while the download isn't playable yet; null keeps its own label. */
export function getDownloadStateText(state: DownloadState | undefined): string | null {
    switch (state) {
        case 'Queued':
            return 'Queued';
        case 'Downloading':
            return 'Downloading';
        case 'Stalled':
            return 'Stalled';
        case 'Paused':
            return 'Paused';
        case 'Failed':
            return 'Download failed';
        default:
            return null;
    }
}

export async function getDownloadStatus(apiClient: ApiClient, itemId: string): Promise<DownloadStatus> {
    try {
        return await apiClient.getJSON(apiClient.getUrl(`PirateFin/Items/${itemId}/DownloadStatus`));
    } catch (err) {
        console.error('[PirateFin] download status check failed', err);
        return { Playable: false, Progress: null, PlayableFill: 0 };
    }
}

function formatSize(bytes: number): string {
    if (!bytes) {
        return '';
    }

    const gb = bytes / 1024 ** 3;
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

/**
 * Lets the user pick one of an episode's fallback sources (offered when none of the configured release
 * authors released it in time) and starts the download. Resolves true when a source was chosen.
 * @param apiClient The api client.
 * @param item The episode.
 * @param anchor The element the dropdown opens next to (centered when not given).
 */
export async function showSourcePicker(apiClient: ApiClient, item: PirateFinItem, anchor?: Element | null): Promise<boolean> {
    const [{ default: actionSheet }, { default: toast }] = await Promise.all([
        import('components/actionSheet/actionSheet'),
        import('components/toast/toast')
    ]);

    const sources = await getSources(apiClient, item.Id!);
    if (!sources.length) {
        toast('No sources found yet. PirateFin keeps searching.');
        return false;
    }

    const selected = await actionSheet.show({
        title: 'Choose a source',
        text: 'None of your preferred release groups has this episode yet. Pick one of the best seeded releases:',
        items: sources.map(source => ({
            id: String(source.Index),
            name: source.Title,
            secondaryText: [`${source.Seeders} seeders`, formatSize(source.SizeBytes)].filter(Boolean).join(' · ')
        })),
        showCancel: true,
        inline: true,
        positionTo: anchor ?? null
    }).catch(() => null);

    if (selected == null) {
        return false;
    }

    await selectSource(apiClient, item.Id!, Number(selected));
    if (!await warnIfStoragePaused(apiClient, item.Id!)) {
        toast('Download started');
    }
    return true;
}

/** A profile's PIN and kids settings. */
export interface ProfileSettings {
    HasPin: boolean;
    IsKids: boolean;
    MaxParentalRating?: number | null;
}

export function getProfileSettings(apiClient: ApiClient, userId: string): Promise<ProfileSettings> {
    return apiClient.getJSON(apiClient.getUrl(`PirateFin/Users/${userId}/Profile`));
}

export function setProfilePin(apiClient: ApiClient, userId: string, pin: string): Promise<unknown> {
    return apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl(`PirateFin/Users/${userId}/Pin`),
        data: JSON.stringify({ Pin: pin }),
        contentType: 'application/json'
    });
}

export function removeProfilePin(apiClient: ApiClient, userId: string): Promise<unknown> {
    return apiClient.ajax({ type: 'DELETE', url: apiClient.getUrl(`PirateFin/Users/${userId}/Pin`) });
}

/**
 * Makes a profile a kids profile or a regular one (after its parental rating limit was saved), optionally setting the
 * kids profile's PIN (empty keeps the current one).
 */
export function setKidsProfile(apiClient: ApiClient, userId: string, isKids: boolean, pin?: string): Promise<unknown> {
    return apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl(`PirateFin/Users/${userId}/Kids`),
        data: JSON.stringify({ IsKids: isKids, Pin: pin || null }),
        contentType: 'application/json'
    });
}

let kidsProfile = false;

/** Whether the signed in profile is a kids profile (no requests, no adding titles, the kids look). */
export function isKidsProfile(): boolean {
    return kidsProfile;
}

/** Applies the kids look and limits for the signed in profile. */
export function applyKidsProfile(isKids: boolean) {
    const changed = document.documentElement.classList.contains('pfKids') !== isKids;
    kidsProfile = isKids;
    document.documentElement.classList.toggle('pfKids', isKids);

    // Kids profiles get the Purple Haze theme (themeManager checks the class); switching back restores the chosen one.
    if (changed) {
        Promise.all([ import('scripts/themeManager'), import('scripts/settings/userSettings') ])
            .then(([ { default: themeManager }, userSettings ]) => themeManager.setTheme(userSettings.theme()))
            .catch(err => console.error('[PirateFin] could not apply the kids theme', err));
    }
}

/** The movies and series the signed in user removed from Continue Watching / Next Up. */
export function getHiddenFromContinueWatching(apiClient: ApiClient): Promise<string[]> {
    return apiClient.getJSON(apiClient.getUrl('PirateFin/Users/Me/ContinueWatching/Hidden'))
        .then((ids: string[]) => ids.map(id => id.replace(/-/g, '').toLowerCase()), () => []);
}

/** Removes a movie or series (or an episode's series) from Continue Watching and Next Up until it's played again. */
export function hideFromContinueWatching(apiClient: ApiClient, itemId: string): Promise<unknown> {
    return apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl('PirateFin/Users/Me/ContinueWatching/Hide'),
        data: JSON.stringify({ ItemId: itemId }),
        contentType: 'application/json'
    });
}

export { isHiddenFromContinueWatching } from './continueWatchingFilter';
