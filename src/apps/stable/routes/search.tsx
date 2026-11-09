import type { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import React, { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounceValue } from 'usehooks-ts';

import InternetSearchResults from 'apps/stable/features/search/components/InternetSearchResults';
import SearchFields from 'apps/stable/features/search/components/SearchFields';
import SearchResults from 'apps/stable/features/search/components/SearchResults';
import SearchSuggestions from 'apps/stable/features/search/components/SearchSuggestions';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import useSearchParam from 'hooks/useSearchParam';
import { useUserViews } from 'hooks/useUserViews';
import globalize from 'lib/globalize';
import { parseLibrary } from 'utils/piratefin';

const COLLECTION_TYPE_PARAM = 'collectionType';
const LIBRARY_PARAM = 'library';
const PARENT_ID_PARAM = 'parentId';
const QUERY_PARAM = 'query';

const Search: FC = () => {
    const [searchParams] = useSearchParams();
    const [ query, setQuery ] = useSearchParam(QUERY_PARAM);
    const [debouncedQuery] = useDebounceValue(query, 500);

    // Opened from the Movies / Shows / Anime tab: search only that library, locally and in Deep Search.
    const library = parseLibrary(searchParams.get(LIBRARY_PARAM));
    const { user } = useApi();
    const { data: userViews } = useUserViews(user?.Id);
    const libraryView = useMemo(
        () => (library ? userViews?.Items?.find(view => view.Name?.toLowerCase() === library.toLowerCase()) : undefined),
        [ library, userViews ]
    );
    const parentIdQuery = libraryView?.Id ?? searchParams.get(PARENT_ID_PARAM) ?? undefined;
    const collectionTypeQuery = (libraryView?.CollectionType ?? searchParams.get(COLLECTION_TYPE_PARAM) ?? undefined) as CollectionType | undefined;

    // Deep Search (Trakt / AniList / YTS) only runs on request (Enter or the button) to stay within their rate limits.
    const [ internetQuery, setInternetQuery ] = useState('');
    const searchInternet = useCallback((text: string) => setInternetQuery(text.trim()), []);

    useEffect(() => {
        if (!query.trim()) {
            setInternetQuery('');
        }
    }, [ query ]);

    const trimmedQuery = debouncedQuery.trim();
    const onSearchInternetClick = useCallback(() => searchInternet(trimmedQuery), [ searchInternet, trimmedQuery ]);
    const title = library ? `${globalize.translate('Search')} ${library}` : globalize.translate('Search');

    return (
        <Page
            id='searchPage'
            title={title}
            className='mainAnimatedPage libraryPage allLibraryPage noSecondaryNavPage'
        >
            <SearchFields query={query} onSearch={setQuery} onEnter={searchInternet} />
            {!trimmedQuery ? (
                <SearchSuggestions
                    parentId={parentIdQuery}
                />
            ) : (
                <>
                    {internetQuery !== trimmedQuery && (
                        <div className='padded-left padded-right pfSearchInternetPrompt'>
                            <button
                                type='button'
                                className='pfButton pfButton-secondary'
                                onClick={onSearchInternetClick}
                            >
                                <span className='material-icons travel_explore' aria-hidden='true' />
                                <span>Deep Search for &lsquo;{trimmedQuery}&rsquo;</span>
                            </button>
                        </div>
                    )}
                    {internetQuery && <InternetSearchResults query={internetQuery} library={library} />}
                    <SearchResults
                        parentId={parentIdQuery}
                        collectionType={collectionTypeQuery}
                        query={trimmedQuery}
                    />
                </>
            )}
        </Page>
    );
};

export default Search;
