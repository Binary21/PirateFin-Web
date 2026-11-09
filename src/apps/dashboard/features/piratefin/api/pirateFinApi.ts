import type { Api } from '@jellyfin/sdk';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';
import { queryClient } from 'utils/query/queryClient';

/** providers.json */
export interface ProvidersSettings {
    AniListGraphQlUrl: string;
    AniListPageSize: number;
    ExcludedAnimeCountries?: string[] | null;
    TraktApiUrl: string;
    TraktApiKey: string;
    TraktApiUser: string;
    YtsApiUrl: string;
    MovieMinimumRating: number;
    AllowedShowGenres: string[];
    BannedShowGenres: string[];
    AllowedShowNetworks: string[];
    AllowedLanguages: string[];
}

/** jackett.json */
export interface JackettSettings {
    BaseUrl: string;
    ApiKey: string;
    Indexer: Record<string, string>;
    AnimeCategory: string;
    ShowCategory: string;
    /** Old single anime list; the server moves it into AnimeSubGroups. */
    AnimeAuthors: string[];
    AnimeDubGroups: ReleaseGroup[];
    AnimeSubGroups: ReleaseGroup[];
    PrioritizeDub: boolean;
    ShowAuthors: string[];
}

/** A preferred anime release group and the words added to its search for the audio / subtitle type. */
export interface ReleaseGroup {
    Name: string;
    Indicator: string;
}

/** qbittorrent.json */
export interface QBitTorrentSettings {
    Url: string;
    Username: string;
    Password: string;
    ExecutablePath: string;
    MonitorPollSeconds: number;
    PlayableProgress: number;
    /** Downloads don't go to a drive with less free space than this (GB). */
    MinimumFreeSpaceGb: number;
    /** When (server time, "HH:mm") series split across drives start being moved back together. */
    StorageMoveStart: string;
    /** When (server time, "HH:mm") moving split series stops. */
    StorageMoveEnd: string;
}

/** A series whose files are on more than one drive. */
export interface SplitSeries {
    Name: string;
    Path: string;
    /** Bytes per drive, e.g. { "C:\\": 1234 }. */
    BytesPerDrive: Record<string, number>;
    /** No single drive can hold it and keep the minimum free space. */
    CannotFit: boolean;
    LastAttempt?: string | null;
}

/** A folder of a PirateFin library and the free space of its drive. */
export interface StorageLocation {
    Library: string;
    Path: string;
    FreeBytes: number;
    TotalBytes: number;
    IsFull: boolean;
}

/** gmail.json as the server shows it; the app password is never sent back. */
export interface GmailSettings {
    Address: string;
    FromName: string;
    HasAppPassword: boolean;
    /** The saved app password was encrypted by another Windows account or machine and must be entered again. */
    AppPasswordUnreadable: boolean;
    /** Where the buttons in emails link to, e.g. https://piratefin.com; empty for no buttons. */
    PublicAddress: string;
}

/** The Gmail account to save; an empty app password keeps the saved one, an empty address turns email off. */
export interface SaveGmailSettings {
    Address: string;
    FromName: string;
    AppPassword?: string;
}

export type SettingsKind = 'Providers' | 'Jackett' | 'QBitTorrent';

interface SettingsByKind {
    Providers: ProvidersSettings;
    Jackett: JackettSettings;
    QBitTorrent: QBitTorrentSettings;
}

export type PirateFinLibrary = 'Movies' | 'Shows' | 'Anime';

export interface PlaceholderRemovalResult {
    Movies: number;
    Episodes: number;
    Seasons: number;
    Series: number;
}

const QUERY_KEY = 'PirateFinSettings';

async function request<T>(api: Api, method: 'GET' | 'POST', path: string, data?: unknown): Promise<T> {
    const response = await api.axiosInstance.request<T>({
        method,
        url: `${api.basePath}/PirateFin/${path}`,
        data,
        headers: { Authorization: api.authorizationHeader }
    });
    return response.data;
}

/** Reads a PirateFin settings file. */
export const usePirateFinSettings = <K extends SettingsKind>(kind: K) => {
    const { api } = useApi();

    return useQuery({
        queryKey: [ QUERY_KEY, kind ],
        queryFn: () => request<SettingsByKind[K]>(api!, 'GET', `Configuration/${kind}`),
        enabled: !!api
    });
};

/** Writes a PirateFin settings file; the server applies it without a restart. */
export const useSavePirateFinSettings = <K extends SettingsKind>(kind: K) => {
    const { api } = useApi();

    return useMutation({
        mutationFn: (settings: SettingsByKind[K]) => request<void>(api!, 'POST', `Configuration/${kind}`, settings),
        onSuccess: (_, settings) => {
            queryClient.setQueryData([ QUERY_KEY, kind ], settings);
            // Which drives count as full depends on the minimum free space.
            void queryClient.invalidateQueries({ queryKey: [ QUERY_KEY, 'Storage' ] });
        }
    });
};

/** The PirateFin library folders and the free space of their drives. */
export const useLibraryStorage = () => {
    const { api } = useApi();

    return useQuery({
        queryKey: [ QUERY_KEY, 'Storage' ],
        queryFn: () => request<StorageLocation[]>(api!, 'GET', 'Storage'),
        enabled: !!api
    });
};

/** The series split across drives (moved back together in the night window). */
export const useSplitSeries = () => {
    const { api } = useApi();

    return useQuery({
        queryKey: [ QUERY_KEY, 'Storage', 'Split' ],
        queryFn: () => request<SplitSeries[]>(api!, 'GET', 'Storage/Split'),
        enabled: !!api
    });
};

/** The Gmail account emails are sent from. */
export const useGmailSettings = () => {
    const { api } = useApi();

    return useQuery({
        queryKey: [ QUERY_KEY, 'Gmail' ],
        queryFn: () => request<GmailSettings>(api!, 'GET', 'Configuration/Gmail'),
        enabled: !!api
    });
};

/** Saves the Gmail account; the server encrypts the app password. */
export const useSaveGmailSettings = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: (settings: SaveGmailSettings) => request<void>(api!, 'POST', 'Configuration/Gmail', settings),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [ QUERY_KEY, 'Gmail' ] })
    });
};

/** Saves the address the buttons in emails link to. */
export const useSaveEmailPublicAddress = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: (publicAddress: string) => request<void>(api!, 'POST', 'Configuration/Email/PublicAddress', { PublicAddress: publicAddress }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [ QUERY_KEY, 'Gmail' ] })
    });
};

/** Sends a test email from the saved Gmail account. */
export const useSendTestEmail = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: (to: string) => request<void>(api!, 'POST', 'Email/Test', { To: to })
    });
};

/** A user's request that an admin finds episodes PirateFin couldn't. */
export interface DownloadRequest {
    Id: string;
    UserName: string;
    ItemId: string;
    SeriesName: string;
    Title: string;
    CreatedUtc: string;
    Status: 'Open' | 'Fulfilled' | 'NotFound' | 'Cancelled';
    ClosedUtc?: string | null;
    AdminNote?: string | null;
    Episodes: { EpisodeId: string; Label: string; MagnetUrl?: string | null }[];
}

const REQUESTS_KEY = 'PirateFinRequests';

/** The download requests; open ones only unless includeClosed. */
export const useDownloadRequests = (includeClosed: boolean) => {
    const { api } = useApi();

    return useQuery({
        queryKey: [ REQUESTS_KEY, includeClosed ],
        queryFn: () => request<DownloadRequest[]>(api!, 'GET', `Requests?includeClosed=${includeClosed}`),
        enabled: !!api
    });
};

/** The number of open requests, for the drawer badge. */
export const useOpenRequestCount = () => {
    const { api } = useApi();

    return useQuery({
        queryKey: [ REQUESTS_KEY, 'OpenCount' ],
        queryFn: () => request<number>(api!, 'GET', 'Requests/OpenCount'),
        enabled: !!api,
        refetchInterval: 2 * 60 * 1000
    });
};

const invalidateRequests = () => queryClient.invalidateQueries({ queryKey: [ REQUESTS_KEY ] });

/** Filling in the Shows / Anime libraries (the nightly run, or a full run started here). */
export interface PopulateStatus {
    Running: boolean;
    Kind?: 'Full' | 'Nightly' | null;
    Total: number;
    Done: number;
    Failed: number;
    Current?: string | null;
    StartedUtc?: string | null;
    FinishedUtc?: string | null;
    /** Until when the spaced-out release searches go on, if later than now. */
    ReleaseSearchesUntilUtc?: string | null;
}

const POPULATE_KEY = 'PirateFinPopulate';

/** Where filling in the libraries stands; checked every 5 s while a run goes on. */
export const usePopulateStatus = () => {
    const { api } = useApi();

    return useQuery({
        queryKey: [ POPULATE_KEY ],
        queryFn: () => request<PopulateStatus>(api!, 'GET', 'Libraries/Populate'),
        enabled: !!api,
        refetchInterval: query => (query.state.data?.Running ? 5000 : 60000)
    });
};

/** Starts filling in every series in the Shows and Anime libraries. */
export const useStartPopulate = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: () => request<void>(api!, 'POST', 'Libraries/Populate'),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [ POPULATE_KEY ] })
    });
};

export interface ReleaseSearchStatus {
    CalculatedUtc: string;
    SearchingNow: { SeriesName: string; Episode: string; Name: string }[];
    /** Aired in the last week, retried until a release turns up. */
    NewEpisodes: number;
    /** Older episodes waiting for their one search (the back catalogue pass). */
    OldEpisodes: number;
    DueNow: number;
    WaitingToAir: number;
    /** The old searches of every show are paused. */
    OldPaused: boolean;
    OldPassEndsUtc?: string | null;
    Shows: {
        SeriesId: string;
        SeriesName: string;
        NewEpisodes: number;
        OldEpisodes: number;
        /** Its old searches are paused on their own. */
        Paused: boolean;
        /** Null when all that's left of it is paused. */
        NextSearchUtc?: string | null;
    }[];
    FoundPreferred: number;
    FoundFallbackOnly: number;
    FoundNothing: number;
    ResultsSinceUtc: string;
}

const RELEASE_SEARCH_KEY = 'PirateFinReleaseSearches';

/** What the episode release searches are doing; loaded when the page opens (and on Refresh). */
export const useReleaseSearchStatus = () => {
    const { api } = useApi();

    return useQuery({
        queryKey: [ RELEASE_SEARCH_KEY ],
        queryFn: () => request<ReleaseSearchStatus>(api!, 'GET', 'ReleaseSearches'),
        enabled: !!api,
        staleTime: Infinity,
        refetchOnWindowFocus: false
    });
};

/** Stops the older episodes' searches (the back catalogue pass). */
export const useStopOldSearches = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: () => request<{ Stopped: number }>(api!, 'POST', 'ReleaseSearches/StopOld'),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [ RELEASE_SEARCH_KEY ] })
    });
};

/** Pauses or resumes the old (back catalogue) searches of every show, or of one show when a series id is given. */
export const useSetOldSearchesPaused = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: ({ seriesId, paused }: { seriesId?: string; paused: boolean }) => {
            const scope = seriesId ? 'ReleaseSearches/Shows/' + seriesId : 'ReleaseSearches';
            return request<void>(api!, 'POST', `${scope}/${paused ? 'PauseOld' : 'ResumeOld'}`);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [ RELEASE_SEARCH_KEY ] })
    });
};

/** Stops one show's old searches; its new episodes keep being searched. */
export const useStopShowOldSearches = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: (seriesId: string) => request<{ Stopped: number }>(api!, 'POST', `ReleaseSearches/Shows/${seriesId}/StopOld`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [ RELEASE_SEARCH_KEY ] })
    });
};

/** Gives a requested episode the release the admin found; it starts downloading. */
export const useSetRequestMagnet = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: ({ requestId, episodeId, magnetUrl }: { requestId: string; episodeId: string; magnetUrl: string }) =>
            request<void>(api!, 'POST', `Requests/${requestId}/Episodes/${episodeId}/Magnet`, { MagnetUrl: magnetUrl }),
        onSuccess: invalidateRequests
    });
};

/** Closes a request as fulfilled or not found; the user is emailed. */
export const useCloseRequest = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: ({ requestId, status, note }: { requestId: string; status: 'Fulfilled' | 'NotFound'; note: string }) =>
            request<void>(api!, 'POST', `Requests/${requestId}/Close`, { Status: status, Note: note }),
        onSuccess: invalidateRequests
    });
};

/** The request limit users get unless they have their own (-1 = no limit). */
export const useDefaultRequestLimit = () => {
    const { api } = useApi();

    return useQuery({
        queryKey: [ REQUESTS_KEY, 'DefaultLimit' ],
        queryFn: () => request<{ Limit: number }>(api!, 'GET', 'Requests/DefaultLimit'),
        enabled: !!api
    });
};

export const useSaveDefaultRequestLimit = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: (limit: number) => request<void>(api!, 'POST', 'Requests/DefaultLimit', { Limit: limit }),
        onSuccess: invalidateRequests
    });
};

/** Removes a library's placeholders and fetches its newest items again. */
export const useResetPirateFinLibrary = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: (library: PirateFinLibrary) => request<PlaceholderRemovalResult>(api!, 'POST', `Libraries/${library}/Reset`)
    });
};

/** Reads the error message the server returns for a rejected request. */
export const getErrorMessage = (error: unknown): string => {
    const data = (error as { response?: { data?: unknown } })?.response?.data;
    if (typeof data === 'string' && data) {
        return data;
    }
    if (data && typeof data === 'object' && 'title' in data) {
        return String((data as { title: unknown }).title);
    }
    return error instanceof Error ? error.message : 'Request failed';
};

/** A genre and the titles watched in it. */
export interface RankedGenre {
    Id: string;
    Name: string;
    Titles: number;
}

/** A series, movie or episode in one of the insight lists. */
export interface InsightTitle {
    ItemId: string;
    Name: string;
    Type: 'Series' | 'Movie' | 'Episode';
    Library?: string | null;
    Genres: string[];
    Progress?: string | null;
    PlayCount: number;
    LastPlayedUtc?: string | null;
}

/** What a user watches and asks for. Watch time is only recorded since the playback log was installed. */
export interface UserInsights {
    UserId: string;
    Activity: {
        LastActiveUtc?: string | null;
        LastWatchedUtc?: string | null;
        StreakDays: number;
        ActiveDays30: number;
        Seconds7: number;
        Seconds30: number;
        Seconds90: number;
        Libraries: { Library: string; Seconds: number }[];
    };
    /** 90 days, oldest first, in the viewer's time zone. */
    Daily: { Date: string; Seconds: number }[];
    /** [weekday 0 = Sunday][hour] seconds over the last 90 days. */
    Heatmap: number[][];
    Genres: { Library: string; Genres: RankedGenre[]; Discovery: RankedGenre[] }[];
    TopTitles: { ItemId: string; Name: string; Type: 'Series' | 'Movie'; Library?: string | null; Seconds: number; Episodes: number; LastWatchedUtc: string }[];
    Rewatches: InsightTitle[];
    CurrentlyWatching: InsightTitle[];
    DropOffs: InsightTitle[];
    Subscriptions: { SeasonId: string; SeriesId: string; SeriesName: string; SeasonName: string; Library?: string | null; SinceUtc: string }[];
    Requests: DownloadRequest[];
    FailedSearches: { Library: string; Query: string; Utc: string }[];
    Suggestions: { Kind: string; Text: string }[];
}

/** A user's line on the Users list. */
export interface UserInsightSummary {
    UserId: string;
    Seconds7: number;
    TopGenre?: string | null;
}

const INSIGHTS_KEY = 'PirateFinInsights';

/** Everything the Insights tab shows for a user; days and hours in the viewer's time zone. */
export const useUserInsights = (userId: string | null) => {
    const { api } = useApi();

    return useQuery({
        queryKey: [ INSIGHTS_KEY, userId ],
        queryFn: () => request<UserInsights>(api!, 'GET', `Users/${userId}/Insights?utcOffsetMinutes=${-new Date().getTimezoneOffset()}`),
        enabled: !!api && !!userId
    });
};

/** Each user's watch time this week and top genre. */
export const useUserInsightSummaries = () => {
    const { api } = useApi();

    return useQuery({
        queryKey: [ INSIGHTS_KEY, 'Summary' ],
        queryFn: () => request<UserInsightSummary[]>(api!, 'GET', 'Insights/Summary'),
        enabled: !!api,
        staleTime: 5 * 60 * 1000
    });
};

/** Trailers saved next to downloaded movies and series. */
export interface TrailerSettings {
    /** Whether trailers are downloaded; saved ones keep playing when off. */
    Enabled: boolean;
    Count: number;
    Bytes: number;
    /** Whether missing trailers are being saved right now. */
    IsSaving: boolean;
}

const TRAILERS_KEY = 'PirateFinTrailers';

export const useTrailerSettings = () => {
    const { api } = useApi();

    return useQuery({
        queryKey: [ TRAILERS_KEY ],
        queryFn: () => request<TrailerSettings>(api!, 'GET', 'Trailers/Settings'),
        enabled: !!api,
        // While trailers are being saved, the count and size go up.
        refetchInterval: query => (query.state.data?.IsSaving ? 5000 : false)
    });
};

const invalidateTrailers = () => queryClient.invalidateQueries({ queryKey: [ TRAILERS_KEY ] });

export const useSaveTrailerSettings = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: (enabled: boolean) => request<void>(api!, 'POST', 'Trailers/Settings', { Enabled: enabled }),
        onSuccess: invalidateTrailers
    });
};

/** Deletes every trailer PirateFin saved; resolves with how many. */
export const useDeleteAllTrailers = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: () => request<number>(api!, 'POST', 'Trailers/DeleteAll'),
        onSuccess: invalidateTrailers
    });
};

/** Starts saving the missing trailers now. */
export const useSaveMissingTrailers = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: () => request<void>(api!, 'POST', 'Trailers/SaveMissing'),
        onSuccess: invalidateTrailers
    });
};

/** youtube.json, as the dashboard sees it (the client secret is never sent back). */
export interface YouTubeSettings {
    Enabled: boolean;
    ApiKey: string;
    ClientId: string;
    /** A new client secret; empty keeps the saved one. */
    ClientSecret?: string;
    HasClientSecret: boolean;
    DailySearchCap: number;
    RegionCode: string;
    UnitsUsedToday: number;
    SearchesLeftToday: number;
}

const YOUTUBE_KEY = 'PirateFinYouTube';

/** The YouTube tab's settings and today's quota use. */
export const useYouTubeSettings = () => {
    const { api } = useApi();

    return useQuery({
        queryKey: [ YOUTUBE_KEY ],
        queryFn: () => request<YouTubeSettings>(api!, 'GET', 'YouTube/Settings'),
        enabled: !!api
    });
};

/** Saves the YouTube tab's settings; the server encrypts the client secret. */
export const useSaveYouTubeSettings = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: (settings: YouTubeSettings) => request<void>(api!, 'POST', 'YouTube/Settings', settings),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [ YOUTUBE_KEY ] })
    });
};
