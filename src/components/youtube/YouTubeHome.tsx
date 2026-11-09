import React, { type FC, useCallback, useEffect, useRef, useState } from 'react';

import confirm from 'components/confirm/confirm';
import Button from 'elements/emby-button/Button';
import { useApi } from 'hooks/useApi';
import {
    type YouTubeStatus,
    YOUTUBE_SEARCH_EVENT,
    getYouTubeFeed,
    getYouTubeStatus,
    refreshYouTube,
    unlinkYouTube
} from 'utils/youtube';

import InfiniteVideoGrid, { type VideoPage } from './InfiniteVideoGrid';
import YouTubeLink from './YouTubeLink';
import YouTubeSearchBar from './YouTubeSearchBar';

import './youtube.scss';

/** The YouTube tab: linking, then the search bar and the grid. */
const YouTubeHome: FC = () => {
    const { __legacyApiClient__: apiClient } = useApi();
    const [ status, setStatus ] = useState<YouTubeStatus | null>(null);
    const [ feedKey, setFeedKey ] = useState(0);
    const searchInput = useRef<HTMLInputElement>(null);

    const loadStatus = useCallback(() => {
        if (!apiClient) return;
        getYouTubeStatus(apiClient).then(setStatus).catch(err => console.error('[PirateFin] YouTube status failed', err));
    }, [ apiClient ]);

    useEffect(loadStatus, [ loadStatus ]);

    // The header's search button focuses the search box.
    useEffect(() => {
        const onSearch = () => searchInput.current?.focus();
        document.addEventListener(YOUTUBE_SEARCH_EVENT, onSearch);
        return () => document.removeEventListener(YOUTUBE_SEARCH_EVENT, onSearch);
    }, []);

    const loadPage = useCallback(async (cursor: string | null): Promise<VideoPage> => {
        if (!apiClient) return { items: [], next: null };
        const start = cursor ? Number.parseInt(cursor, 10) : 0;
        const page = await getYouTubeFeed(apiClient, start);
        return { items: page.Items, next: page.HasMore ? String(start + page.Items.length) : null };
    }, [ apiClient ]);

    // Refresh fetches new uploads first.
    const onRefresh = useCallback(async () => {
        if (!apiClient) return;
        await refreshYouTube(apiClient);
        loadStatus();
    }, [ apiClient, loadStatus ]);

    const onUnlink = useCallback(() => {
        if (!apiClient) return;
        confirm({
            title: 'Unlink YouTube',
            text: 'Your YouTube tab will be empty until you link it again. Your downloads are kept.',
            confirmText: 'Unlink',
            primary: 'delete'
        }).then(() => unlinkYouTube(apiClient))
            .then(loadStatus)
            .catch(() => { /* cancelled */ });
    }, [ apiClient, loadStatus ]);

    const onLinked = useCallback(() => {
        loadStatus();
        setFeedKey(key => key + 1);
    }, [ loadStatus ]);

    if (!status?.Enabled) {
        return null;
    }

    if (!status.Linked) {
        return <YouTubeLink status={status} onLinked={onLinked} />;
    }

    const unlink = (
        <Button type='button' className='ytButton' onClick={onUnlink} title='Unlink' icon='link_off' iconPos='LEFT' />
    );

    return (
        <div className='ytHome'>
            <YouTubeSearchBar inputRef={searchInput} trailing={unlink} up='tabs' />
            {status.LastError && <p className='ytNotice padded-left padded-right'>{status.LastError}</p>}
            <InfiniteVideoGrid
                key={feedKey}
                loadPage={loadPage}
                onRefresh={onRefresh}
                emptyText='Nothing new to watch. Videos from your subscriptions show here as they come out.'
                firstLoadText='Fetching your subscriptions…'
                topRowUpToSearch
            />
        </div>
    );
};

export default YouTubeHome;
