import { useEffect } from 'react';

const HIDE_CLASS = 'ytHideHeaderSearch';

/** Hides the header's library search while a YouTube page with its own search bar is shown. */
export function useHideHeaderSearch() {
    useEffect(() => {
        document.documentElement.classList.add(HIDE_CLASS);
        return () => document.documentElement.classList.remove(HIDE_CLASS);
    }, []);
}
