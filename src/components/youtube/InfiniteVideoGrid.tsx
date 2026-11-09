import React, { type FC, useCallback, useEffect, useRef, useState } from 'react';

import focusManager from 'components/focusManager';
import layoutManager from 'components/layoutManager';
import Button from 'elements/emby-button/Button';
import { getKeyName } from 'scripts/keyboardNavigation';
import { getErrorText } from 'utils/piratefin';
import { type YouTubeVideo, TV_MAX_LOADS } from 'utils/youtube';

import VideoTile from './VideoTile';

/** A page of videos and where the next one starts (null on the last page). */
export interface VideoPage {
    items: YouTubeVideo[];
    next: string | null;
}

interface InfiniteVideoGridProps {
    /** Loads the page starting at the cursor (null for the first). */
    loadPage: (cursor: string | null) => Promise<VideoPage>;
    /** Runs before reloading when Refresh is pressed (e.g. fetching new uploads on the server). */
    onRefresh?: () => Promise<void>;
    emptyText: string;
    firstLoadText: string;
    /** TVs: Up from the first row of videos goes to the search box. */
    topRowUpToSearch?: boolean;
    /** TVs: select the first video once it loads. */
    focusFirst?: boolean;
}

/** Adds a page of videos, skipping any already shown. */
const appendPage = (current: YouTubeVideo[], page: YouTubeVideo[]) => {
    const seen = new Set(current.map(v => v.Id));
    return current.concat(page.filter(v => !seen.has(v.Id)));
};

/**
 * One grid of videos that loads the next page as the bottom comes into view (on TVs, up to TV_MAX_LOADS pages).
 * Refresh sits at the end of the grid and goes back to the top.
 */
const InfiniteVideoGrid: FC<InfiniteVideoGridProps> = ({ loadPage, onRefresh, emptyText, firstLoadText, topRowUpToSearch, focusFirst }) => {
    const [ videos, setVideos ] = useState<YouTubeVideo[]>([]);
    const [ hasMore, setHasMore ] = useState(true);
    const [ loads, setLoads ] = useState(0);
    const [ busy, setBusy ] = useState(false);
    const [ refreshing, setRefreshing ] = useState(false);
    const [ error, setError ] = useState('');
    const grid = useRef<HTMLDivElement>(null);
    const sentinel = useRef<HTMLDivElement>(null);
    const cursor = useRef<string | null>(null);
    const loading = useRef(false);
    const focusedFirst = useRef(false);

    const tvLimitReached = layoutManager.tv && loads >= TV_MAX_LOADS;

    const load = useCallback(async (reset: boolean) => {
        if (loading.current) return;
        loading.current = true;
        setBusy(true);
        try {
            const page = await loadPage(reset ? null : cursor.current);
            cursor.current = page.next;
            setVideos(current => appendPage(reset ? [] : current, page.items));
            setHasMore(page.next !== null);
            setLoads(count => (reset ? 1 : count + 1));
            setError('');
        } catch (err) {
            setError(await getErrorText(err) || 'The videos couldn\'t be loaded.');
        } finally {
            loading.current = false;
            setBusy(false);
        }
    }, [ loadPage ]);

    useEffect(() => {
        void load(true);
    }, [ load ]);

    // TVs: the first video is selected when the page opens.
    useEffect(() => {
        if (!focusFirst || !layoutManager.tv || focusedFirst.current || videos.length === 0) return;
        const first = grid.current?.querySelector('.ytThumbButton');
        if (first) {
            focusedFirst.current = true;
            focusManager.focus(first);
        }
    }, [ focusFirst, videos.length ]);

    // The next page when the bottom comes into view.
    useEffect(() => {
        const element = sentinel.current;
        if (!element || !hasMore || tvLimitReached || error || videos.length === 0) return;
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) {
                void load(false);
            }
        }, { rootMargin: '800px 0px' });
        observer.observe(element);
        return () => observer.disconnect();
    }, [ error, hasMore, load, tvLimitReached, videos.length ]);

    // TVs: Up from the first row goes to the search box (the nearest thing above can be a button at the side).
    useEffect(() => {
        const element = grid.current;
        if (!element || !layoutManager.tv || !topRowUpToSearch) return;
        const onKeyDown = (e: KeyboardEvent) => {
            const tile = e.target as HTMLElement;
            const first = element.querySelector('.ytThumbButton');
            if (getKeyName(e) !== 'ArrowUp' || !first || !tile.classList?.contains('ytThumbButton')) return;
            if (Math.abs(tile.getBoundingClientRect().top - first.getBoundingClientRect().top) > 1) return;
            const search = element.closest('.ytHome')?.querySelector('.ytSearchInput');
            if (search) {
                e.preventDefault();
                e.stopPropagation();
                focusManager.focus(search);
            }
        };
        element.addEventListener('keydown', onKeyDown);
        return () => element.removeEventListener('keydown', onKeyDown);
    }, [ topRowUpToSearch ]);

    const onRefreshClick = useCallback(async () => {
        setRefreshing(true);
        try {
            await onRefresh?.();
        } catch (err) {
            console.error('[PirateFin] YouTube refresh failed', err);
        }
        await load(true);
        setRefreshing(false);
        window.scrollTo(0, 0);
        const first = grid.current?.querySelector('.ytThumbButton');
        if (first) {
            focusManager.focus(first);
        }
    }, [ load, onRefresh ]);

    const onRefreshButton = useCallback(() => {
        void onRefreshClick();
    }, [ onRefreshClick ]);

    return (
        <>
            {error && <p className='ytError padded-left padded-right'>{error}</p>}
            {!busy && !error && videos.length === 0 && <p className='ytEmpty padded-left padded-right'>{emptyText}</p>}
            <div ref={grid} className='ytGrid padded-left padded-right'>
                {videos.map(video => <VideoTile key={video.Id} video={video} />)}
            </div>
            {busy && <p className='ytLoading'>{videos.length === 0 ? firstLoadText : 'Loading more…'}</p>}
            <div ref={sentinel} className='ytSentinel' />
            {(tvLimitReached || !hasMore || error) && !busy && (
                <div className='ytRefresh'>
                    <Button
                        type='button'
                        className='ytButton'
                        onClick={onRefreshButton}
                        disabled={refreshing}
                        title={refreshing ? 'Refreshing…' : 'Refresh'}
                        icon='refresh'
                        iconPos='LEFT'
                    />
                </div>
            )}
        </>
    );
};

export default InfiniteVideoGrid;
