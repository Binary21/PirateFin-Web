import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { describe, expect, it } from 'vitest';

import { buildSlides, formatTimeLeft, getBadge, SLIDE_COUNT } from './heroSlides';

const MINUTE = 600_000_000;

const series = (id: string): BaseItemDto => ({ Id: id, Type: 'Series', Name: `Series ${id}` });
const movie = (id: string): BaseItemDto => ({ Id: id, Type: 'Movie', Name: `Movie ${id}` });
const episode = (seriesId: string, season: number, number: number, extra: Partial<BaseItemDto> = {}): BaseItemDto => ({
    Id: `${seriesId}-${season}-${number}`,
    Type: 'Episode',
    Name: `Episode ${number}`,
    SeriesId: seriesId,
    ParentIndexNumber: season,
    IndexNumber: number,
    ...extra
});

const seriesMap = (...ids: string[]) => new Map(ids.map(id => [ id, series(id) ]));
const empty = { resume: [], nextUp: [], newEpisodes: [], newest: [] };

describe('getBadge', () => {
    it('labels new episodes with their number and name', () => {
        expect(getBadge('newEpisode', episode('a', 2, 5))).toBe('New Episode · S2:E5 – Episode 5');
    });

    it('adds the time left to an episode being watched', () => {
        const watching = episode('a', 1, 3, { RunTimeTicks: 45 * MINUTE, UserData: { PlaybackPositionTicks: 22 * MINUTE } });
        expect(getBadge('continue', watching)).toBe('Continue · S1:E3 – Episode 3 · 23 min left');
    });

    it('shows only the time left for a movie being watched', () => {
        const watching = { ...movie('m'), RunTimeTicks: 120 * MINUTE, UserData: { PlaybackPositionTicks: 15 * MINUTE } };
        expect(getBadge('continue', watching)).toBe('Continue · 1 h 45 min left');
    });

    it('has no badge for a newly added title', () => {
        expect(getBadge('newest', series('a'))).toBe('');
    });
});

describe('formatTimeLeft', () => {
    it('is empty without progress', () => {
        expect(formatTimeLeft({ RunTimeTicks: 10 * MINUTE })).toBe('');
    });

    it('rounds whole hours', () => {
        expect(formatTimeLeft({ RunTimeTicks: 150 * MINUTE, UserData: { PlaybackPositionTicks: 30 * MINUTE } })).toBe('2 h left');
    });
});

describe('buildSlides', () => {
    it('puts watching first, then new followed episodes, then the newest titles', () => {
        const slides = buildSlides({
            resume: [ episode('a', 1, 3) ],
            nextUp: [ episode('b', 1, 2) ],
            newEpisodes: [ episode('c', 2, 1) ],
            newest: [ series('d') ]
        }, seriesMap('a', 'b', 'c'));

        expect(slides.map(s => s.kind)).toEqual([ 'continue', 'nextEpisode', 'newEpisode', 'newest' ]);
        expect(slides.map(s => s.item.Id)).toEqual([ 'a', 'b', 'c', 'd' ]);
    });

    it('shows the series of an episode and plays the episode', () => {
        const [ slide ] = buildSlides({ ...empty, newEpisodes: [ episode('a', 2, 5) ] }, seriesMap('a'));

        expect(slide.item.Type).toBe('Series');
        expect(slide.playItem.Id).toBe('a-2-5');
    });

    it('keeps one slide per series, the most important one', () => {
        const slides = buildSlides({
            ...empty,
            resume: [ episode('a', 1, 3) ],
            newEpisodes: [ episode('a', 2, 1) ],
            newest: [ series('a'), series('b') ]
        }, seriesMap('a'));

        expect(slides.map(s => [ s.kind, s.item.Id ])).toEqual([ [ 'continue', 'a' ], [ 'newest', 'b' ] ]);
    });

    it(`stops at ${SLIDE_COUNT} slides`, () => {
        const newest = Array.from({ length: 20 }, (_, i) => movie(`m${i}`));
        expect(buildSlides({ ...empty, newest }, new Map())).toHaveLength(SLIDE_COUNT);
    });

    it('skips episodes whose series could not be loaded', () => {
        expect(buildSlides({ ...empty, resume: [ episode('gone', 1, 1) ] }, new Map())).toEqual([]);
    });
});
