import { describe, expect, it } from 'vitest';

import { isHiddenFromContinueWatching } from './continueWatchingFilter';

describe('isHiddenFromContinueWatching', () => {
    const hidden = [ '0d06d9caf1c14a0e86d9aba25dd5f28f' ];

    it('hides a removed movie by its id, whatever the id format', () => {
        expect(isHiddenFromContinueWatching({ Id: '0d06d9ca-f1c1-4a0e-86d9-aba25dd5f28f' }, hidden)).toBe(true);
    });

    it('hides every episode of a removed series', () => {
        expect(isHiddenFromContinueWatching({ Id: 'episode', SeriesId: '0D06D9CAF1C14A0E86D9ABA25DD5F28F' }, hidden)).toBe(true);
    });

    it('keeps everything else', () => {
        expect(isHiddenFromContinueWatching({ Id: 'other', SeriesId: 'another' }, hidden)).toBe(false);
    });
});
