import React, { type FC, type KeyboardEvent, type MouseEvent, useCallback, useEffect, useRef } from 'react';

import layoutManager from 'components/layoutManager';
import { appRouter } from 'components/router/appRouter';
import { getKeyName } from 'scripts/keyboardNavigation';
import { type YouTubeVideo, formatAge, formatCount, formatDuration, getProgressPercent, youTubePaths } from 'utils/youtube';

/** How long OK is held on a TV before the options panel opens. */
const LONG_PRESS_MS = 600;

interface VideoTileProps {
    video: YouTubeVideo;
    /** Opens the video; by default its watch page. */
    onOpen?: (video: YouTubeVideo) => void;
    /** Up next on the watch page: thumbnail beside the text instead of above it. */
    compact?: boolean;
}

const openWatchPage = (video: YouTubeVideo) => {
    void appRouter.show(youTubePaths.video(video.Id));
};

/** The small panel with "View channel" (TV: hold OK; elsewhere: right click or long touch). */
async function showOptions(video: YouTubeVideo, anchor: Element) {
    const { default: actionSheet } = await import('components/actionSheet/actionSheet');
    const id = await actionSheet.show({
        items: [{ name: 'View channel', id: 'channel', icon: 'account_circle' }],
        positionTo: anchor,
        inline: true
    }).catch(() => null);
    if (id === 'channel') {
        void appRouter.show(youTubePaths.channel(video.ChannelId));
    }
}

/**
 * A video as YouTube shows it: 16:9 thumbnail with the length, then the channel's avatar, title, channel and views.
 * In browsers the avatar and channel name open the channel; on phones only the avatar; on TVs the whole tile is one
 * stop and holding OK opens the options panel.
 */
const VideoTile: FC<VideoTileProps> = ({ video, onOpen = openWatchPage, compact }) => {
    const progress = getProgressPercent(video);
    const isTv = layoutManager.tv;
    const isMobile = layoutManager.mobile;
    const pressTimer = useRef<number>();
    const longPressed = useRef(false);

    useEffect(() => () => window.clearTimeout(pressTimer.current), []);

    const onClick = useCallback(() => onOpen(video), [ onOpen, video ]);
    const openChannel = useCallback((e: MouseEvent) => {
        e.stopPropagation();
        void appRouter.show(youTubePaths.channel(video.ChannelId));
    }, [ video.ChannelId ]);

    const onContextMenu = useCallback((e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        void showOptions(video, e.currentTarget);
    }, [ video ]);

    // TV: a short press of OK opens the video, holding it opens the options.
    const onKeyDown = useCallback((e: KeyboardEvent<HTMLButtonElement>) => {
        const key = getKeyName(e.nativeEvent);
        if (key === 'ContextMenu') {
            e.preventDefault();
            void showOptions(video, e.currentTarget);
            return;
        }
        if (!isTv || key !== 'Enter') return;
        e.preventDefault();
        if (e.repeat || pressTimer.current) return;
        longPressed.current = false;
        const anchor = e.currentTarget;
        pressTimer.current = window.setTimeout(() => {
            longPressed.current = true;
            void showOptions(video, anchor);
        }, LONG_PRESS_MS);
    }, [ isTv, video ]);

    const onKeyUp = useCallback((e: KeyboardEvent<HTMLButtonElement>) => {
        if (!isTv || getKeyName(e.nativeEvent) !== 'Enter' || !pressTimer.current) return;
        e.preventDefault();
        window.clearTimeout(pressTimer.current);
        pressTimer.current = undefined;
        if (!longPressed.current) {
            onOpen(video);
        }
    }, [ isTv, onOpen, video ]);

    const avatarImage = video.ChannelAvatarUrl ?
        <img className='ytAvatar' src={video.ChannelAvatarUrl} alt='' loading='lazy' /> :
        <span className='ytAvatar ytAvatar-empty'>{video.ChannelTitle.charAt(0)}</span>;

    let avatar = null;
    if (!compact) {
        avatar = isTv ? avatarImage : (
            <button type='button' className='ytAvatarButton' onClick={openChannel} aria-label={video.ChannelTitle} tabIndex={-1}>
                {avatarImage}
            </button>
        );
    }

    // Phones and TVs: the channel name is plain text; browsers: a link to the channel.
    const channelName = isTv || isMobile ?
        <div className='ytSub'>{video.ChannelTitle}</div> :
        <button type='button' className='ytSub ytChannelLink' onClick={openChannel} tabIndex={-1}>{video.ChannelTitle}</button>;

    const title = isTv ?
        <div className='ytTitle'>{video.Title}</div> :
        <button type='button' className='ytTitle ytTitleButton' onClick={onClick} tabIndex={-1}>{video.Title}</button>;

    return (
        <div className={`ytTile${compact ? ' ytTile-compact' : ''}`}>
            <button
                type='button'
                className='ytThumbButton focusable'
                onClick={onClick}
                onKeyDown={onKeyDown}
                onKeyUp={onKeyUp}
                onContextMenu={onContextMenu}
                title={video.Title}
            >
                <div className='ytThumb'>
                    {video.ThumbnailUrl && <img src={video.ThumbnailUrl} alt='' loading='lazy' />}
                    {video.DurationSeconds > 0 && <span className='ytDuration'>{formatDuration(video.DurationSeconds)}</span>}
                    {video.Downloaded && <span className='ytBadge material-icons download_done' aria-label='Downloaded' />}
                    {progress > 0 && (
                        <div className='ytProgress'><div style={{ width: `${progress}%` }} /></div>
                    )}
                </div>
            </button>
            <div className='ytMeta'>
                {avatar}
                <div className='ytText'>
                    {title}
                    {channelName}
                    <div className='ytSub'>
                        {video.ViewCount > 0 && `${formatCount(video.ViewCount)} views · `}{formatAge(video.PublishedUtc)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoTile;
