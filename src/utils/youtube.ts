import type { ApiClient } from 'jellyfin-apiclient';

/** A YouTube video, with the signed in user's watch state. Mirrors the server's YouTubeVideo. */
export interface YouTubeVideo {
    Id: string;
    Title: string;
    Description: string;
    ChannelId: string;
    ChannelTitle: string;
    ChannelAvatarUrl?: string | null;
    ThumbnailUrl?: string | null;
    PublishedUtc: string;
    DurationSeconds: number;
    ViewCount: number;
    MadeForKids: boolean;
    FromSubscription: boolean;
    PositionSeconds: number;
    Watched: boolean;
    Downloaded: boolean;
}

export interface YouTubeChannel {
    Id: string;
    Title: string;
    AvatarUrl?: string | null;
    SubscriberCount?: number | null;
    Handle?: string | null;
    Description?: string | null;
    BannerUrl?: string | null;
    VideoCount?: number | null;
    Subscribed: boolean;
}

export interface YouTubeChannelVideos {
    Items: YouTubeVideo[];
    NextPageToken?: string | null;
}

/** Whether the tab is on and how the user's YouTube is linked. */
export interface YouTubeStatus {
    Enabled: boolean;
    Linked: boolean;
    Mode?: 'Google' | 'Channel' | null;
    ChannelTitle?: string | null;
    GoogleAvailable: boolean;
    ChannelIdAvailable: boolean;
    LastRefreshUtc?: string | null;
    LastError?: string | null;
}

export interface YouTubeDeviceCode {
    UserCode: string;
    VerificationUrl: string;
    ExpiresInSeconds: number;
    IntervalSeconds: number;
}

export interface YouTubeFeedPage {
    Items: YouTubeVideo[];
    HasMore: boolean;
}

export interface YouTubeVideoDetails {
    Video: YouTubeVideo;
    Channel?: YouTubeChannel | null;
    UpNext: YouTubeVideo[];
}

export interface YouTubeSearchResult {
    /** The account whose name or @handle is the search, shown first. */
    Channel?: YouTubeChannel | null;
    /** Newest first. */
    Items: YouTubeVideo[];
    SearchesLeft: number;
    Message?: string | null;
}

export type YouTubeLinkState = 'pending' | 'linked' | 'denied' | 'expired';

/** Fired by the header's search button while the YouTube tab is shown. */
export const YOUTUBE_SEARCH_EVENT = 'piratefinyoutubesearch';

/** Videos asked for per page of the grid. */
export const FEED_PAGE_SIZE = 24;

/** On TVs, the grid stops loading more after this many pages and shows a Refresh button. */
export const TV_MAX_LOADS = 10;

let youTubeTabActive = false;

/** Set by the YouTube home tab while it's shown, so the header's search searches YouTube. */
export function setYouTubeTabActive(active: boolean) {
    youTubeTabActive = active;
}

export function isYouTubeTabActive(): boolean {
    return youTubeTabActive;
}

async function post<T>(apiClient: ApiClient, path: string, data?: unknown): Promise<T> {
    return apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl(`PirateFin/YouTube/${path}`),
        data: data === undefined ? undefined : JSON.stringify(data),
        contentType: data === undefined ? undefined : 'application/json',
        dataType: 'json'
    });
}

async function send(apiClient: ApiClient, type: 'POST' | 'DELETE', path: string, data?: unknown): Promise<void> {
    await apiClient.ajax({
        type,
        url: apiClient.getUrl(`PirateFin/YouTube/${path}`),
        data: data === undefined ? undefined : JSON.stringify(data),
        contentType: data === undefined ? undefined : 'application/json'
    });
}

export function getYouTubeStatus(apiClient: ApiClient): Promise<YouTubeStatus> {
    return apiClient.getJSON(apiClient.getUrl('PirateFin/YouTube/Status'));
}

export function startGoogleLink(apiClient: ApiClient): Promise<YouTubeDeviceCode> {
    return post(apiClient, 'Link/Google');
}

export async function pollGoogleLink(apiClient: ApiClient): Promise<YouTubeLinkState> {
    const result = await post<{ State: YouTubeLinkState }>(apiClient, 'Link/Google/Poll');
    return result.State;
}

export function linkChannel(apiClient: ApiClient, channel: string): Promise<void> {
    return send(apiClient, 'POST', 'Link/Channel', { Channel: channel });
}

export function unlinkYouTube(apiClient: ApiClient): Promise<void> {
    return send(apiClient, 'DELETE', 'Link');
}

export function refreshYouTube(apiClient: ApiClient): Promise<void> {
    return send(apiClient, 'POST', 'Refresh');
}

export function getYouTubeFeed(apiClient: ApiClient, startIndex: number, limit = FEED_PAGE_SIZE): Promise<YouTubeFeedPage> {
    return apiClient.getJSON(apiClient.getUrl('PirateFin/YouTube/Feed', { startIndex, limit }));
}

export function getYouTubeVideo(apiClient: ApiClient, videoId: string): Promise<YouTubeVideoDetails> {
    return apiClient.getJSON(apiClient.getUrl(`PirateFin/YouTube/Videos/${encodeURIComponent(videoId)}`));
}

// Results of this session's searches: going back to a results page doesn't spend another search.
const searchResults = new Map<string, YouTubeSearchResult>();

export async function searchYouTube(apiClient: ApiClient, query: string): Promise<YouTubeSearchResult> {
    const key = query.trim().toLowerCase();
    const known = searchResults.get(key);
    if (known) {
        return known;
    }
    const result: YouTubeSearchResult = await apiClient.getJSON(apiClient.getUrl('PirateFin/YouTube/Search', { query: query.trim() }));
    if (!result.Message) {
        searchResults.set(key, result);
    }
    return result;
}

export function getYouTubeChannel(apiClient: ApiClient, channelId: string): Promise<YouTubeChannel> {
    return apiClient.getJSON(apiClient.getUrl(`PirateFin/YouTube/Channels/${encodeURIComponent(channelId)}`));
}

export function getYouTubeChannelVideos(apiClient: ApiClient, channelId: string, pageToken?: string | null): Promise<YouTubeChannelVideos> {
    const query = pageToken ? { pageToken } : {};
    return apiClient.getJSON(apiClient.getUrl(`PirateFin/YouTube/Channels/${encodeURIComponent(channelId)}/Videos`, query));
}

/** The addresses of the YouTube pages. */
export const youTubePaths = {
    video: (videoId: string) => `youtube?v=${encodeURIComponent(videoId)}`,
    channel: (channelId: string) => `youtubechannel?id=${encodeURIComponent(channelId)}`,
    search: (query: string) => `youtubesearch?q=${encodeURIComponent(query.trim())}`
};

export function saveYouTubeProgress(apiClient: ApiClient, videoId: string, positionSeconds: number, durationSeconds: number): Promise<void> {
    return send(apiClient, 'POST', `Videos/${encodeURIComponent(videoId)}/Progress`, {
        PositionSeconds: positionSeconds,
        DurationSeconds: durationSeconds
    });
}

/** Starts streaming a video; resolves to the full address of its HLS playlist. */
export async function startYouTubeStream(apiClient: ApiClient, videoId: string): Promise<string> {
    const result = await post<{ Url: string }>(apiClient, `Videos/${encodeURIComponent(videoId)}/Stream`);
    return apiClient.getUrl(result.Url);
}

export function downloadYouTubeVideo(apiClient: ApiClient, videoId: string): Promise<void> {
    return send(apiClient, 'POST', `Videos/${encodeURIComponent(videoId)}/Download`);
}

export function deleteYouTubeDownload(apiClient: ApiClient, videoId: string): Promise<void> {
    return send(apiClient, 'DELETE', `Videos/${encodeURIComponent(videoId)}/Download`);
}

/** The user's downloads: video id → ready. */
export function getYouTubeDownloads(apiClient: ApiClient): Promise<Record<string, boolean>> {
    return apiClient.getJSON(apiClient.getUrl('PirateFin/YouTube/Downloads'));
}

/** 1234 → "1.2K", 3400000 → "3.4M", like YouTube. */
export function formatCount(count: number): string {
    const units: [number, string][] = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (const [size, suffix] of units) {
        if (count >= size) {
            const value = count / size;
            const text = value >= 10 ? Math.floor(value).toString() : (Math.floor(value * 10) / 10).toString();
            return text + suffix;
        }
    }
    return String(Math.max(0, Math.floor(count)));
}

/** "3 days ago", "1 year ago". */
export function formatAge(publishedUtc: string, now = new Date()): string {
    const seconds = Math.max(0, (now.getTime() - new Date(publishedUtc).getTime()) / 1000);
    const units: [number, string][] = [
        [365 * 86400, 'year'], [30 * 86400, 'month'], [7 * 86400, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']
    ];
    for (const [size, name] of units) {
        if (seconds >= size) {
            const value = Math.floor(seconds / size);
            return `${value} ${name}${value === 1 ? '' : 's'} ago`;
        }
    }
    return 'just now';
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatDuration(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = String(s % 60).padStart(2, '0');
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** How much of a video was watched, 0 to 100, for the red bar under a thumbnail. */
export function getProgressPercent(video: Pick<YouTubeVideo, 'PositionSeconds' | 'DurationSeconds'>): number {
    if (!video.DurationSeconds || video.PositionSeconds <= 0) {
        return 0;
    }
    return Math.min(100, (video.PositionSeconds / video.DurationSeconds) * 100);
}
