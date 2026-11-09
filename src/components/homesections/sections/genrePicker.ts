import type { RankedGenre } from 'utils/piratefin';

export interface GenreOption {
    Id: string;
    Name: string;
}

/** The genres shown so far on a tab, so Refresh moves on to others. */
export interface GenreHistory {
    top: Set<string>;
    discovery: Set<string>;
}

/** How many top genres one pick chooses from, so the two top rows vary a little between visits. */
export const TOP_WINDOW = 4;

const TOP_ROWS = 2;

export function createGenreHistory(): GenreHistory {
    return { top: new Set(), discovery: new Set() };
}

const key = (name: string) => name.toLowerCase();

/** Picks one entry, weighted by its title count. */
function pickWeighted<T extends { weight: number }>(values: T[], random: () => number): T {
    const total = values.reduce((sum, v) => sum + v.weight, 0);
    let roll = random() * total;
    for (const value of values) {
        roll -= value.weight;
        if (roll < 0) {
            return value;
        }
    }
    return values[values.length - 1];
}

function pickRandom<T>(values: T[], random: () => number): T | undefined {
    return values.length ? values[Math.floor(random() * values.length)] : undefined;
}

/**
 * Picks the genre rows of a tab: two from the user's most watched genres (weighted by titles watched, from the next
 * {@link TOP_WINDOW} not shown yet, so each Refresh moves down the ranking) and one discovery genre that the other
 * users watch a lot. Genres the user hasn't watched enough to rank, or with no discovery data, fall back to random
 * genres of the library. Only genres the library has titles for are picked.
 * @param libraryGenres The library's genres (for the tab's item type).
 * @param ranked The user's genres, most watched first.
 * @param discovery Discovery genres, most popular first.
 * @param history What was shown before; updated with the picks. Starts over once a list is used up.
 * @param random A random number source in [0, 1).
 * @returns Up to three genres: the top rows first, then the discovery row.
 */
export function pickGenres(
    libraryGenres: GenreOption[],
    ranked: RankedGenre[],
    discovery: RankedGenre[],
    history: GenreHistory,
    random: () => number = Math.random
): GenreOption[] {
    const byName = new Map(libraryGenres.map(g => [ key(g.Name), g ]));
    const inLibrary = (genres: RankedGenre[]) => genres.flatMap(g => {
        const option = byName.get(key(g.Name));
        return option ? [ { option, weight: Math.max(g.Titles, 1) } ] : [];
    });

    const picked: GenreOption[] = [];
    const isPicked = (g: GenreOption) => picked.some(p => p.Id === g.Id);

    // Top rows: the next genres down the ranking.
    const rankedOptions = inLibrary(ranked);
    let remaining = rankedOptions.filter(r => !history.top.has(r.option.Id));
    if (remaining.length < TOP_ROWS && rankedOptions.length >= TOP_ROWS) {
        history.top.clear();
        remaining = rankedOptions;
    }
    const window = remaining.slice(0, TOP_WINDOW);
    while (picked.length < TOP_ROWS && window.length) {
        const choice = pickWeighted(window, random);
        window.splice(window.indexOf(choice), 1);
        picked.push(choice.option);
        history.top.add(choice.option.Id);
    }

    // Discovery row: the most popular genre with the others not shown yet.
    const discoveryOptions = inLibrary(discovery).map(d => d.option).filter(g => !isPicked(g));
    let nextDiscovery = discoveryOptions.find(g => !history.discovery.has(g.Id));
    if (!nextDiscovery && discoveryOptions.length) {
        history.discovery.clear();
        nextDiscovery = discoveryOptions[0];
    }
    if (nextDiscovery) {
        picked.push(nextDiscovery);
        history.discovery.add(nextDiscovery.Id);
    }

    // Not enough history: random genres, preferring ones not shown before.
    while (picked.length < TOP_ROWS + 1) {
        const unused = libraryGenres.filter(g => !isPicked(g));
        const fresh = unused.filter(g => !history.top.has(g.Id) && !history.discovery.has(g.Id));
        const choice = pickRandom(fresh.length ? fresh : unused, random);
        if (!choice) {
            break;
        }
        picked.push(choice);
        history.discovery.add(choice.Id);
    }

    return picked;
}
