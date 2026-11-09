import React, { type FC, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import confirm from 'components/confirm/confirm';
import layoutManager from 'components/layoutManager';
import Page from 'components/Page';
import { appRouter } from 'components/router/appRouter';
import VideoTile from 'components/youtube/VideoTile';
import YouTubePlayer from 'components/youtube/YouTubePlayer';
import YouTubeSearchBar from 'components/youtube/YouTubeSearchBar';
import { useHideHeaderSearch } from 'components/youtube/useHideHeaderSearch';
import Button from 'elements/emby-button/Button';
import { useApi } from 'hooks/useApi';
import {
    type YouTubeChannel,
    type YouTubeVideo,
    type YouTubeVideoDetails,
    deleteYouTubeDownload,
    downloadYouTubeVideo,
    formatAge,
    formatCount,
    getYouTubeDownloads,
    getYouTubeVideo,
    youTubePaths
} from 'utils/youtube';

import 'components/youtube/youtube.scss';

const DOWNLOAD_POLL_MS = 10000;

/** Download (kept until deleted), with its progress. */
const DownloadButton: FC<{ videoId: string }> = ({ videoId }) => {
    const { __legacyApiClient__: apiClient } = useApi();
    const [ ready, setReady ] = useState<boolean | undefined>();

    const check = useCallback(() => {
        if (!apiClient) return;
        getYouTubeDownloads(apiClient)
            .then(downloads => setReady(downloads[videoId]))
            .catch(err => console.error('[PirateFin] YouTube downloads failed', err));
    }, [ apiClient, videoId ]);

    useEffect(check, [ check ]);

    // While downloading, check every few seconds.
    useEffect(() => {
        if (ready !== false) return;
        const timer = setInterval(check, DOWNLOAD_POLL_MS);
        return () => clearInterval(timer);
    }, [ check, ready ]);

    const onClick = useCallback(() => {
        if (!apiClient) return;
        if (ready === undefined) {
            downloadYouTubeVideo(apiClient, videoId).then(() => setReady(false)).catch(err => console.error(err));
            return;
        }
        confirm({
            title: ready ? 'Delete download' : 'Cancel download',
            text: 'The video will be streamed from YouTube again.',
            confirmText: ready ? 'Delete' : 'Cancel download',
            primary: 'delete'
        }).then(() => deleteYouTubeDownload(apiClient, videoId))
            .then(() => setReady(undefined))
            .catch(() => { /* cancelled */ });
    }, [ apiClient, ready, videoId ]);

    let title = 'Download';
    let icon = 'download';
    if (ready === true) {
        title = 'Downloaded';
        icon = 'download_done';
    } else if (ready === false) {
        title = 'Downloading…';
        icon = 'downloading';
    }
    return <Button type='button' className='ytButton' onClick={onClick} title={title} icon={icon} iconPos='LEFT' />;
};

/** The description, two lines until opened. */
const Description: FC<{ video: YouTubeVideo }> = ({ video }) => {
    const [ open, setOpen ] = useState(false);
    const toggle = useCallback(() => setOpen(value => !value), []);

    return (
        <button type='button' className={`ytDescription focusable${open ? '' : ' ytDescription-collapsed'}`} onClick={toggle} aria-expanded={open}>
            <strong>
                {video.ViewCount > 0 && `${formatCount(video.ViewCount)} views · `}
                {formatAge(video.PublishedUtc)}
            </strong>
            {video.Description && <div className='ytDescriptionText'>{video.Description}</div>}
            <div><strong>{open ? 'Show less' : '...more'}</strong></div>
        </button>
    );
};

/**
 * The channel under the video. Browsers: the avatar and the name open the channel; phones: the avatar; TVs: the
 * whole row is one button.
 */
const ChannelRow: FC<{ video: YouTubeVideo; channel?: YouTubeChannel | null }> = ({ video, channel }) => {
    const openChannel = useCallback(() => {
        void appRouter.show(youTubePaths.channel(video.ChannelId));
    }, [ video.ChannelId ]);

    const avatarUrl = channel?.AvatarUrl ?? video.ChannelAvatarUrl;
    const avatar = avatarUrl ?
        <img className='ytAvatar' src={avatarUrl} alt='' /> :
        <span className='ytAvatar ytAvatar-empty'>{video.ChannelTitle.charAt(0)}</span>;
    const name = channel?.Title ?? video.ChannelTitle;
    const subscribers = channel?.SubscriberCount ? <div className='ytSub'>{formatCount(channel.SubscriberCount)} subscribers</div> : null;

    if (layoutManager.tv) {
        return (
            <button type='button' className='ytChannel ytChannelButton focusable' onClick={openChannel}>
                {avatar}
                <div>
                    <div className='ytChannelName'>{name}</div>
                    {subscribers}
                </div>
            </button>
        );
    }

    return (
        <div className='ytChannel'>
            <button type='button' className='ytAvatarButton' onClick={openChannel} aria-label={name}>{avatar}</button>
            <div>
                {layoutManager.mobile ?
                    <div className='ytChannelName'>{name}</div> :
                    <button type='button' className='ytChannelName ytChannelLink' onClick={openChannel}>{name}</button>}
                {subscribers}
            </div>
        </div>
    );
};

const Watch: FC<{ videoId: string }> = ({ videoId }) => {
    const { __legacyApiClient__: apiClient } = useApi();
    const [ details, setDetails ] = useState<YouTubeVideoDetails | null>(null);
    const [ missing, setMissing ] = useState(false);

    useEffect(() => {
        if (!apiClient) return;
        getYouTubeVideo(apiClient, videoId)
            .then(setDetails)
            .catch(() => setMissing(true));
    }, [ apiClient, videoId ]);

    if (missing) {
        return <p className='ytEmpty'>This video isn&apos;t available.</p>;
    }
    if (!details) {
        return <p className='ytLoading'>Loading…</p>;
    }

    const { Video: video, Channel: channel, UpNext: upNext } = details;
    return (
        <div className={`ytWatch padded-left padded-right${layoutManager.tv ? ' ytWatch-tv' : ''}`}>
            <div>
                <YouTubePlayer video={video} />
                <h1 className='ytWatchTitle'>{video.Title}</h1>
                <div className='ytChannelRow'>
                    <ChannelRow video={video} channel={channel} />
                    <div className='ytActions'>
                        <DownloadButton videoId={video.Id} />
                    </div>
                </div>
                <Description video={video} />
            </div>
            {upNext.length > 0 && (
                <div className='ytUpNext'>
                    <h2>Up next</h2>
                    {upNext.map(next => <VideoTile key={next.Id} video={next} compact />)}
                </div>
            )}
        </div>
    );
};

/** A YouTube video's page, like YouTube's watch page: the player, its details, Download and Up next. */
const YouTubeWatch: FC = () => {
    const [ searchParams ] = useSearchParams();
    const videoId = searchParams.get('v') ?? '';
    useHideHeaderSearch();

    return (
        <Page id='youTubeWatchPage' title='YouTube' className='mainAnimatedPage libraryPage noSecondaryNavPage'>
            <YouTubeSearchBar up='back' />
            <Watch key={videoId} videoId={videoId} />
        </Page>
    );
};

export default YouTubeWatch;
