import React, { type ChangeEvent, type FC, type FormEvent, type ReactNode, useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';

import focusManager from 'components/focusManager';
import layoutManager from 'components/layoutManager';
import { appRouter } from 'components/router/appRouter';
import { getKeyName } from 'scripts/keyboardNavigation';
import { youTubePaths } from 'utils/youtube';

interface YouTubeSearchBarProps {
    /** The search shown in the box (on the results page). */
    initialQuery?: string;
    /** Shown at the right end of the same row (the YouTube tab's Unlink). */
    trailing?: ReactNode;
    inputRef?: Ref<HTMLInputElement | null>;
    /** Where Up goes on TVs: the home tabs (the YouTube tab) or the header's Back button (other YouTube pages). */
    up: 'tabs' | 'back';
}

/** Where Up from the search box goes on TVs. */
function getUpTarget(up: 'tabs' | 'back'): HTMLElement | null {
    if (up === 'tabs') {
        const tabs = document.querySelector('.tabs-viewmenubar');
        return tabs?.querySelector<HTMLElement>('.emby-tab-button-active') ?? tabs?.querySelector<HTMLElement>('.emby-tab-button[data-index="3"]') ?? null;
    }
    const back = document.querySelector<HTMLElement>('.headerBackButton');
    return back && !back.classList.contains('hide') ? back : null;
}

/** The YouTube search box, centred at the top of every YouTube screen; searching opens the results page. */
const YouTubeSearchBar: FC<YouTubeSearchBarProps> = ({ initialQuery = '', trailing, inputRef, up }) => {
    const [ query, setQuery ] = useState(initialQuery);
    const input = useRef<HTMLInputElement>(null);
    const end = useRef<HTMLDivElement>(null);

    useImperativeHandle(inputRef, () => input.current, []);
    useEffect(() => setQuery(initialQuery), [ initialQuery ]);

    // TVs: Up goes to the tabs / Back, Right to the button at the end of the row (Left and Right would otherwise
    // only move the cursor in the text).
    useEffect(() => {
        const element = input.current;
        if (!element || !layoutManager.tv) return;
        const onKeyDown = (e: KeyboardEvent) => {
            const key = getKeyName(e);
            let target: Element | null = null;
            if (key === 'ArrowUp') {
                target = getUpTarget(up);
            } else if (key === 'ArrowRight') {
                target = end.current?.querySelector('button') ?? null;
            }
            if (target) {
                e.preventDefault();
                e.stopPropagation();
                focusManager.focus(target);
            }
        };
        element.addEventListener('keydown', onKeyDown);
        return () => element.removeEventListener('keydown', onKeyDown);
    }, [ up ]);

    // TVs: Left from the button at the end of the row comes back to the box.
    useEffect(() => {
        const element = end.current;
        if (!element || !layoutManager.tv) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (getKeyName(e) === 'ArrowLeft' && input.current) {
                e.preventDefault();
                e.stopPropagation();
                focusManager.focus(input.current);
            }
        };
        element.addEventListener('keydown', onKeyDown);
        return () => element.removeEventListener('keydown', onKeyDown);
    }, [ trailing ]);

    // TVs: Down from anything in the header (Back, Home, the tabs, ...) comes to the search box first.
    useEffect(() => {
        if (!layoutManager.tv) return;
        const onKeyDown = (e: KeyboardEvent) => {
            const box = input.current;
            const active = document.activeElement;
            // Only the search bar of the page being shown (cached pages and other tabs are hidden).
            if (getKeyName(e) !== 'ArrowDown' || !box || box.offsetParent === null || !active?.closest('.skinHeader')) return;
            e.preventDefault();
            e.stopPropagation();
            focusManager.focus(box);
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, []);

    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value), []);
    const onSubmit = useCallback((e: FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            void appRouter.show(youTubePaths.search(query));
        }
    }, [ query ]);

    return (
        <div className='ytTopBar padded-left padded-right'>
            <form className='ytSearch' onSubmit={onSubmit} role='search'>
                <input
                    ref={input}
                    type='search'
                    className='ytSearchInput'
                    value={query}
                    onChange={onChange}
                    placeholder='Search YouTube'
                    aria-label='Search YouTube'
                />
                {/* On TVs OK in the box searches, so the button isn't a stop of its own. */}
                <button
                    type='submit'
                    className={`ytSearchButton${layoutManager.tv ? '' : ' focusable'}`}
                    tabIndex={layoutManager.tv ? -1 : undefined}
                    disabled={!query.trim()}
                    aria-label='Search'
                >
                    <span className='material-icons search' aria-hidden='true' />
                </button>
            </form>
            {trailing && <div ref={end} className='ytTopBarEnd'>{trailing}</div>}
        </div>
    );
};

export default YouTubeSearchBar;
