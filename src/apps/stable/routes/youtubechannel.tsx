import React, { type FC, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import Page from 'components/Page';
import InfiniteVideoGrid, { type VideoPage } from 'components/youtube/InfiniteVideoGrid';
import YouTubeSearchBar from 'components/youtube/YouTubeSearchBar';
import { useHideHeaderSearch } from 'components/youtube/useHideHeaderSearch';
import { useApi } from 'hooks/useApi';
import { type YouTubeChannel, formatCount, getYouTubeChannel, getYouTubeChannelVideos } from 'utils/youtube';

import 'components/youtube/youtube.scss';

/** The channel's description, two lines until opened. */
const About: FC<{ text: string }> = ({ text }) => {
    const [ open, setOpen ] = useState(false);
    const toggle = useCallback(() => setOpen(value => !value), []);

    return (
        <button type='button' className={`ytAbout focusable${open ? '' : ' ytDescription-collapsed'}`} onClick={toggle} aria-expanded={open}>
            <div className='ytDescriptionText'>{text}</div>
            <div><strong>{open ? 'Show less' : '...more'}</strong></div>
        </button>
    );
};

/** Banner, avatar, name, @handle, counts, About and whether the user subscribes. */
const ChannelHeader: FC<{ channel: YouTubeChannel }> = ({ channel }) => {
    const counts = [
        channel.Handle,
        channel.SubscriberCount ? `${formatCount(channel.SubscriberCount)} subscribers` : null,
        channel.VideoCount ? `${formatCount(channel.VideoCount)} videos` : null
    ].filter(Boolean).join(' · ');

    return (
        <div className='ytChannelHeader padded-left padded-right'>
            {channel.BannerUrl && <img className='ytBanner' src={channel.BannerUrl} alt='' />}
            <div className='ytChannelInfo'>
                {channel.AvatarUrl ?
                    <img className='ytChannelAvatar' src={channel.AvatarUrl} alt='' /> :
                    <span className='ytChannelAvatar ytAvatar-empty'>{channel.Title.charAt(0)}</span>}
                <div className='ytChannelText'>
                    <h1>{channel.Title}</h1>
                    {counts && <div className='ytSub'>{counts}</div>}
                    {channel.Subscribed && (
                        <span className='ytSubscribed'>
                            <span className='material-icons check' aria-hidden='true' />Subscribed
                        </span>
                    )}
                    {channel.Description && <About text={channel.Description} />}
                </div>
            </div>
        </div>
    );
};

/** A YouTube channel's page, like YouTube's: its header, then its videos newest first. */
const YouTubeChannelPage: FC = () => {
    const { __legacyApiClient__: apiClient } = useApi();
    const [ searchParams ] = useSearchParams();
    const channelId = searchParams.get('id') ?? '';
    const [ channel, setChannel ] = useState<YouTubeChannel | null>(null);
    const [ missing, setMissing ] = useState(false);
    useHideHeaderSearch();

    useEffect(() => {
        if (!apiClient || !channelId) return;
        setChannel(null);
        setMissing(false);
        getYouTubeChannel(apiClient, channelId).then(setChannel).catch(() => setMissing(true));
    }, [ apiClient, channelId ]);

    const loadPage = useCallback(async (cursor: string | null): Promise<VideoPage> => {
        if (!apiClient) return { items: [], next: null };
        const page = await getYouTubeChannelVideos(apiClient, channelId, cursor);
        return { items: page.Items, next: page.NextPageToken ?? null };
    }, [ apiClient, channelId ]);

    let content;
    if (missing) {
        content = <p className='ytEmpty'>This channel isn&apos;t available.</p>;
    } else if (!channel) {
        content = <p className='ytLoading'>Loading…</p>;
    } else {
        content = (
            <>
                <ChannelHeader channel={channel} />
                <InfiniteVideoGrid
                    key={channelId}
                    loadPage={loadPage}
                    emptyText='No videos to show.'
                    firstLoadText='Loading videos…'
                    focusFirst
                />
            </>
        );
    }

    return (
        <Page id='youTubeChannelPage' title={channel?.Title ?? 'YouTube'} className='mainAnimatedPage libraryPage noSecondaryNavPage'>
            <div className='ytHome'>
                <YouTubeSearchBar up='back' />
                {content}
            </div>
        </Page>
    );
};

export default YouTubeChannelPage;
