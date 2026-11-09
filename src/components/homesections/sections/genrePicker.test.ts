import { describe, expect, it } from 'vitest';

import type { RankedGenre } from 'utils/piratefin';

import { createGenreHistory, pickGenres, TOP_WINDOW } from './genrePicker';

const NAMES = [ 'Action', 'Comedy', 'Drama', 'Horror', 'Thriller', 'Romance', 'Sci-Fi', 'Mystery' ];
const library = NAMES.map(name => ({ Id: `id-${name}`, Name: name }));

const ranked = (...entries: [string, number][]): RankedGenre[] =>
    entries.map(([ name, titles ]) => ({ Id: `server-${name}`, Name: name, Titles: titles }));

// Always takes the first candidate.
const first = () => 0;

describe('pickGenres', () => {
    it('picks two top genres and one discovery genre', () => {
        const picked = pickGenres(library, ranked([ 'Drama', 5 ], [ 'Action', 3 ], [ 'Comedy', 1 ]), ranked([ 'Horror', 9 ]), createGenreHistory(), first);

        expect(picked.map(g => g.Name)).toEqual([ 'Drama', 'Action', 'Horror' ]);
        // Rows use the library's genre ids.
        expect(picked[0].Id).toBe('id-Drama');
    });

    it('weights the top picks by titles watched', () => {
        // 10 of 11 titles are Drama: a roll of 0.5 lands on it.
        const picked = pickGenres(library, ranked([ 'Comedy', 1 ], [ 'Drama', 10 ]), [], createGenreHistory(), () => 0.5);

        expect(picked[0].Name).toBe('Drama');
    });

    it('only chooses top rows from the next few genres of the ranking', () => {
        const all = ranked(...NAMES.map((name, i): [string, number] => [ name, 100 - i ]));
        // A roll near 1 picks the last genre of the window, never one below it.
        const picked = pickGenres(library, all, [], createGenreHistory(), () => 0.999);

        const window = NAMES.slice(0, TOP_WINDOW);
        expect(window).toContain(picked[0].Name);
        expect(window).toContain(picked[1].Name);
    });

    it('moves down the ranking on refresh, then starts over', () => {
        const history = createGenreHistory();
        const user = ranked([ 'Drama', 5 ], [ 'Action', 4 ], [ 'Comedy', 3 ], [ 'Horror', 2 ]);

        expect(pickGenres(library, user, [], history, first).slice(0, 2).map(g => g.Name)).toEqual([ 'Drama', 'Action' ]);
        expect(pickGenres(library, user, [], history, first).slice(0, 2).map(g => g.Name)).toEqual([ 'Comedy', 'Horror' ]);
        expect(pickGenres(library, user, [], history, first).slice(0, 2).map(g => g.Name)).toEqual([ 'Drama', 'Action' ]);
    });

    it('moves on to the next discovery genre on refresh', () => {
        const history = createGenreHistory();
        const discovery = ranked([ 'Horror', 9 ], [ 'Romance', 4 ]);
        const user = ranked([ 'Drama', 5 ], [ 'Action', 4 ]);

        expect(pickGenres(library, user, discovery, history, first)[2].Name).toBe('Horror');
        expect(pickGenres(library, user, discovery, history, first)[2].Name).toBe('Romance');
    });

    it('fills with random library genres for a new user', () => {
        const picked = pickGenres(library, [], [], createGenreHistory(), first);

        expect(picked).toHaveLength(3);
        expect(new Set(picked.map(g => g.Id)).size).toBe(3);
    });

    it('skips ranked genres the library has no titles for', () => {
        const picked = pickGenres(library, ranked([ 'Western', 9 ], [ 'Drama', 2 ]), [], createGenreHistory(), first);

        expect(picked.map(g => g.Name)).not.toContain('Western');
        expect(picked[0].Name).toBe('Drama');
    });

    it('never shows the same genre twice', () => {
        const picked = pickGenres(library, ranked([ 'Drama', 5 ], [ 'Horror', 4 ]), ranked([ 'Horror', 9 ], [ 'Sci-Fi', 3 ]), createGenreHistory(), first);

        expect(picked.map(g => g.Name)).toEqual([ 'Drama', 'Horror', 'Sci-Fi' ]);
    });
});
