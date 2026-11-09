import { describe, expect, it } from 'vitest';

import { IDLE_MS, noteInteraction, shouldAskStillWatching } from './stillWatchingCount';

describe('shouldAskStillWatching', () => {
    it('asks at the start of the 4th episode in a row without a button press', () => {
        noteInteraction(0);
        expect(shouldAskStillWatching('Episode', 1)).toBe(false);
        expect(shouldAskStillWatching('Episode', 2)).toBe(false);
        expect(shouldAskStillWatching('Episode', 3)).toBe(false);
        expect(shouldAskStillWatching('Episode', 4)).toBe(true);
    });

    it('starts counting again after a button press', () => {
        noteInteraction(0);
        shouldAskStillWatching('Episode', 1);
        shouldAskStillWatching('Episode', 2);
        noteInteraction(3);
        expect(shouldAskStillWatching('Episode', 4)).toBe(false);
    });

    it('asks after 90 minutes without a button press', () => {
        noteInteraction(0);
        expect(shouldAskStillWatching('Episode', IDLE_MS)).toBe(true);
    });

    it('never asks for movies', () => {
        noteInteraction(0);
        expect(shouldAskStillWatching('Movie', IDLE_MS * 2)).toBe(false);
    });
});
