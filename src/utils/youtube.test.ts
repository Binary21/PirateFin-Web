import { describe, expect, it } from 'vitest';

import { formatAge, formatCount, formatDuration, getProgressPercent } from './youtube';

describe('formatCount', () => {
    it('shortens like YouTube', () => {
        expect(formatCount(999)).toBe('999');
        expect(formatCount(1234)).toBe('1.2K');
        expect(formatCount(15600)).toBe('15K');
        expect(formatCount(3_400_000)).toBe('3.4M');
        expect(formatCount(2_000_000_000)).toBe('2B');
    });
});

describe('formatAge', () => {
    const now = new Date('2026-10-26T12:00:00Z');

    it('says how long ago', () => {
        expect(formatAge('2026-10-26T11:59:30Z', now)).toBe('just now');
        expect(formatAge('2026-10-26T11:00:00Z', now)).toBe('1 hour ago');
        expect(formatAge('2026-10-23T12:00:00Z', now)).toBe('3 days ago');
        expect(formatAge('2025-10-01T12:00:00Z', now)).toBe('1 year ago');
    });
});

describe('formatDuration', () => {
    it('formats minutes and hours', () => {
        expect(formatDuration(75)).toBe('1:15');
        expect(formatDuration(3725)).toBe('1:02:05');
    });
});

describe('getProgressPercent', () => {
    it('is 0 without a position and capped at 100', () => {
        expect(getProgressPercent({ PositionSeconds: 0, DurationSeconds: 100 })).toBe(0);
        expect(getProgressPercent({ PositionSeconds: 25, DurationSeconds: 100 })).toBe(25);
        expect(getProgressPercent({ PositionSeconds: 150, DurationSeconds: 100 })).toBe(100);
    });
});
