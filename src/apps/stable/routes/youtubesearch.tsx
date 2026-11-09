import React, { type FC, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import Page from 'components/Page';
import { appRouter } from 'components/router/appRouter';
import VideoTile from 'components/youtube/VideoTile';
import YouTubeSearchBar from 'components/youtube/YouTubeSearchBar';
import { useHideHeaderSearch } from 'components/youtube/useHideHeaderSearch';
import { useApi } from 'hooks/useApi';
import { getErrorText } from 'utils/piratefin';
import { type YouTubeChannel, type YouTubeSearchResult, formatCount, searchYouTube, youTubePaths } from 'utils/youtube';

import 'components/youtube/youtube.scss';

/** The account the search names, shown first; opens its page. */
const ChannelResult: FC<{ channel: YouTubeChannel }> = ({ channel }) => {
    const onClick = useCallback(() => {
        void appRouter.show(youTubePaths.channel(channel.Id));
    }, [ channel.Id ]);
    const counts = [
        channel.Handle,
        channel.SubscriberCount ? `${formatCount(channel.SubscriberCount)} subscribers` : null,
        channel.VideoCount ? `${formatCount(channel.VideoCount)} videos` : null
    ].filter(Boolean).join(' · ');

    return (
        <button type='button' className='ytChannelResult focusable' onClick={onClick}>
            {channel.AvatarUrl ?
                <img className='ytChannelAvatar' src={channel.AvatarUrl} alt='' /> :
                <span className='ytChannelAvatar ytAvatar-empty'>{channel.Title.charAt(0)}</span>}
            <div className='ytChannelText'>
                <div className='ytChannelResultName'>{channel.Title}</div>
                {counts && <div className='ytSub'>{counts}</div>}
                {channel.Subscribed && (
                    <span className='ytSubscribed'>
                        <span className='material-icons check' aria-hidden='true' />Subscribed
                    </span>
                )}
            </div>
        </button>
    );
};

/** YouTube search results: the matching account first, then videos newest first. */
const YouTubeSearchPage: FC = () => {
    const { __legacyApiClient__: apiClient } = useApi();
    const [ searchParams ] = useSearchParams();
    const query = searchParams.get('q') ?? '';
    const [ result, setResult ] = useState<YouTubeSearchResult | null>(null);
    const [ error, setError ] = useState('');
    useHideHeaderSearch();

    useEffect(() => {
        if (!apiClient || !query.trim()) return;
        setResult(null);
        setError('');
        searchYouTube(apiClient, query)
            .then(setResult)
            .catch(async err => setError(await getErrorText(err) || 'Search failed.'));
    }, [ apiClient, query ]);

    let content;
    if (error) {
        content = <p className='ytError padded-left padded-right'>{error}</p>;
    } else if (!result) {
        content = query.trim() ? <p className='ytLoading'>Searching…</p> : null;
    } else {
        content = (
            <>
                {result.Message && <p className='ytNotice padded-left padded-right'>{result.Message}</p>}
                {result.Channel && (
                    <div className='padded-left padded-right'>
                        <ChannelResult channel={result.Channel} />
                    </div>
                )}
                {!result.Message && result.Items.length === 0 && !result.Channel && (
                    <p className='ytEmpty'>No results.</p>
                )}
                <div className='ytGrid padded-left padded-right'>
                    {result.Items.map(video => <VideoTile key={video.Id} video={video} />)}
                </div>
                <p className='ytSearchesLeft'>
                    {result.SearchesLeft} {result.SearchesLeft === 1 ? 'search' : 'searches'} left today
                </p>
            </>
        );
    }

    return (
        <Page id='youTubeSearchPage' title='YouTube search' className='mainAnimatedPage libraryPage noSecondaryNavPage'>
            <div className='ytHome'>
                <YouTubeSearchBar initialQuery={query} up='back' />
                {content}
            </div>
        </Page>
    );
};

export default YouTubeSearchPage;
