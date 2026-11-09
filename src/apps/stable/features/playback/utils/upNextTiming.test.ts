import { describe, expect, it } from 'vitest';

import { TICKS_PER_MINUTE, TICKS_PER_SECOND } from '../../../../../constants/time';

import { getReadinessCheck, getUpNextStartTicks, shouldShowUpNext } from './upNextTiming';

const RUNTIME = 24 * TICKS_PER_MINUTE;

describe('getUpNextStartTicks', () => {
    it('starts when the credits begin', () => {
        const credits = 22 * TICKS_PER_MINUTE;
        expect(getUpNextStartTicks(RUNTIME, credits)).toBe(credits);
    });

    it('starts 60 seconds before the end without credits', () => {
        expect(getUpNextStartTicks(RUNTIME)).toBe(RUNTIME - 60 * TICKS_PER_SECOND);
    });

    it('ignores credits detected implausibly early or at the very end', () => {
        expect(getUpNextStartTicks(RUNTIME, 2 * TICKS_PER_MINUTE)).toBe(RUNTIME - 60 * TICKS_PER_SECOND);
        expect(getUpNextStartTicks(RUNTIME, RUNTIME - TICKS_PER_SECOND)).toBe(RUNTIME - 60 * TICKS_PER_SECOND);
    });
});

describe('shouldShowUpNext', () => {
    it('shows from the start until 5 seconds before the end', () => {
        expect(shouldShowUpNext(RUNTIME - 61 * TICKS_PER_SECOND, RUNTIME)).toBe(false);
        expect(shouldShowUpNext(RUNTIME - 60 * TICKS_PER_SECOND, RUNTIME)).toBe(true);
        // Still comes up late, e.g. when the controls were open when it was due.
        expect(shouldShowUpNext(RUNTIME - 10 * TICKS_PER_SECOND, RUNTIME)).toBe(true);
        expect(shouldShowUpNext(RUNTIME - 4 * TICKS_PER_SECOND, RUNTIME)).toBe(false);
    });

    it('never shows for very short videos', () => {
        expect(shouldShowUpNext(80 * TICKS_PER_SECOND, 90 * TICKS_PER_SECOND)).toBe(false);
    });
});

describe('getReadinessCheck', () => {
    // Without credits the countdown is due at 23:00; checks start at 21:00.
    const due = RUNTIME - 60 * TICKS_PER_SECOND;

    it('does nothing before 2 minutes ahead of the countdown', () => {
        expect(getReadinessCheck(due - 121 * TICKS_PER_SECOND, RUNTIME)).toBe('none');
    });

    it('checks every 30 seconds of playback in the 2 minutes before', () => {
        const first = due - 120 * TICKS_PER_SECOND;
        expect(getReadinessCheck(first, RUNTIME)).toBe('check');
        expect(getReadinessCheck(first + 29 * TICKS_PER_SECOND, RUNTIME, null, first)).toBe('none');
        expect(getReadinessCheck(first + 30 * TICKS_PER_SECOND, RUNTIME, null, first)).toBe('check');
    });

    it('checks again after seeking back', () => {
        expect(getReadinessCheck(due - 100 * TICKS_PER_SECOND, RUNTIME, null, due - 90 * TICKS_PER_SECOND)).toBe('check');
    });

    it('decides when the countdown is due (credits when detected)', () => {
        expect(getReadinessCheck(due, RUNTIME, null, due - TICKS_PER_SECOND)).toBe('final');
        const credits = 20 * TICKS_PER_MINUTE;
        expect(getReadinessCheck(credits, RUNTIME, credits)).toBe('final');
        expect(getReadinessCheck(credits - 2 * TICKS_PER_MINUTE, RUNTIME, credits)).toBe('check');
    });

    it('skips episodes too short for a countdown', () => {
        expect(getReadinessCheck(TICKS_PER_MINUTE, TICKS_PER_MINUTE)).toBe('none');
    });
});
