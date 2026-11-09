import { useQuery } from '@tanstack/react-query';
import React, { type FC, useCallback, useState } from 'react';

import loading from 'components/loading/loading';
import { appRouter } from 'components/router/appRouter';
import toast from 'components/toast/toast';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { type InternetSearchResult, isKidsProfile, openSearchResult, type PirateFinLibrary, searchInternet } from 'utils/piratefin';

import './internetSearchResults.scss';

const ROW_TITLES: Record<PirateFinLibrary, string> = {
    Movies: 'Movies',
    Shows: 'TV Shows',
    Anime: 'Anime'
};

const ALL_LIBRARIES: PirateFinLibrary[] = [ 'Movies', 'Shows', 'Anime' ];

interface InternetSearchCardProps {
    result: InternetSearchResult;
    onOpen: (result: InternetSearchResult) => void;
}

const InternetSearchCard: FC<InternetSearchCardProps> = ({ result, onOpen }) => {
    const onClick = useCallback(() => onOpen(result), [ onOpen, result ]);

    return (
        <button
            type='button'
            className='pfSearchCard'
            title={result.Overview}
            onClick={onClick}
        >
            <div className='pfSearchCard-image'>
                {result.ImageUrl ? (
                    <img src={result.ImageUrl} alt='' loading='lazy' />
                ) : (
                    <div className='pfSearchCard-noImage'>{result.Title}</div>
                )}
                {result.ItemId && <div className='pfSearchCard-badge'>In library</div>}
            </div>
            <div className='pfSearchCard-title'>{result.Title}</div>
            {result.Year && <div className='pfSearchCard-year'>{result.Year}</div>}
        </button>
    );
};

interface InternetSearchRowProps {
    library: PirateFinLibrary;
    title: string;
    query: string;
    onOpen: (result: InternetSearchResult) => void;
}

const InternetSearchRow: FC<InternetSearchRowProps> = ({ library, title, query, onOpen }) => {
    const { data, isPending, isError } = useQuery({
        queryKey: ['PirateFin', 'InternetSearch', library, query],
        queryFn: () => searchInternet(ServerConnections.currentApiClient()!, library, query),
        staleTime: 15 * 60 * 1000
    });

    let content;
    if (isPending) {
        content = <div className='pfSearchRow-message'>Searching…</div>;
    } else if (isError) {
        content = <div className='pfSearchRow-message'>Search failed. Is the provider reachable?</div>;
    } else if (!data.length) {
        content = <div className='pfSearchRow-message'>No results</div>;
    } else {
        content = (
            <div className='pfSearchRow-items focuscontainer-x'>
                {data.map(result => (
                    <InternetSearchCard key={result.Key} result={result} onOpen={onOpen} />
                ))}
            </div>
        );
    }

    return (
        <div className='verticalSection pfSearchRow'>
            <h2 className='sectionTitle sectionTitle-cards padded-left'>{title}</h2>
            {content}
        </div>
    );
};

interface InternetSearchResultsProps {
    query: string;
    /** The library to search; all of them when not set. */
    library?: PirateFinLibrary;
}

/**
 * Trakt / AniList results for the search text. Results are only added to the library (series, seasons and
 * placeholder episodes) when one is opened.
 */
const InternetSearchResults: FC<InternetSearchResultsProps> = ({ query, library }) => {
    const [ opening, setOpening ] = useState(false);

    const onOpen = useCallback((result: InternetSearchResult) => {
        const apiClient = ServerConnections.currentApiClient()!;
        if (result.ItemId) {
            // Already in the library: open it right away, and add any seasons / episodes it's missing in the background
            // (the series page picks them up as they're created).
            appRouter.showItem(result.ItemId, apiClient.serverId());
            openSearchResult(apiClient, result, query).catch(err => {
                console.error('[PirateFin] failed to complete', result.Title, err);
            });
            return;
        }

        if (opening) {
            return;
        }

        setOpening(true);
        loading.show();
        openSearchResult(apiClient, result, query)
            .then(itemId => appRouter.showItem(itemId, apiClient.serverId()))
            .catch(err => {
                console.error('[PirateFin] failed to add search result', err);
                toast(`Could not add ${result.Title}`);
            })
            .finally(() => {
                loading.hide();
                setOpening(false);
            });
    }, [ opening, query ]);

    // Kids profiles can't add titles to the library.
    if (isKidsProfile()) {
        return null;
    }

    return (
        <div className='pfInternetSearch'>
            {(library ? [ library ] : ALL_LIBRARIES).map(rowLibrary => (
                <InternetSearchRow
                    key={rowLibrary}
                    library={rowLibrary}
                    title={`${ROW_TITLES[rowLibrary]} — Deep Search`}
                    query={query}
                    onOpen={onOpen}
                />
            ))}
        </div>
    );
};

export default InternetSearchResults;
