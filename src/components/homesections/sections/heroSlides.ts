import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

/** How many slides the billboard rotates through. */
export const SLIDE_COUNT = 8;

const TICKS_PER_MINUTE = 600_000_000;

export type SlideKind = 'continue' | 'nextEpisode' | 'newEpisode' | 'newest';

/** One billboard slide: the title shown (a series or movie) and what Play starts. */
export interface HeroSlide {
    kind: SlideKind;
    /** The series or movie whose art, logo and details are shown. */
    item: BaseItemDto;
    /** The episode or movie Play starts (the item itself for a newly added series or movie). */
    playItem: BaseItemDto;
    /** E.g. "New Episode · S2:E5 – Title"; empty for a newly added title. */
    badge: string;
}

/** The candidates for each kind of slide, most important first within each list. */
export interface SlideCandidates {
    /** Episodes and movies the user stopped part way through. */
    resume: BaseItemDto[];
    /** The next episode of series the user is watching. */
    nextUp: BaseItemDto[];
    /** New episodes of seasons the user follows. */
    newEpisodes: BaseItemDto[];
    /** The library's newest series and movies. */
    newest: BaseItemDto[];
}

/** "S2:E5", or "" when the episode isn't numbered. */
export function formatEpisodeNumber(episode: BaseItemDto): string {
    if (episode.ParentIndexNumber == null || episode.IndexNumber == null) {
        return '';
    }
    return `S${episode.ParentIndexNumber}:E${episode.IndexNumber}`;
}

/** "23 min left" / "1 h 5 min left", or "" when the progress isn't known. */
export function formatTimeLeft(item: BaseItemDto): string {
    const runTime = item.RunTimeTicks ?? 0;
    const position = item.UserData?.PlaybackPositionTicks ?? 0;
    if (runTime <= 0 || position <= 0 || position >= runTime) {
        return '';
    }

    const minutes = Math.max(1, Math.round((runTime - position) / TICKS_PER_MINUTE));
    const hours = Math.floor(minutes / 60);
    if (hours === 0) {
        return `${minutes} min left`;
    }
    return minutes % 60 ? `${hours} h ${minutes % 60} min left` : `${hours} h left`;
}

const LABELS: Record<Exclude<SlideKind, 'newest'>, string> = {
    continue: 'Continue',
    nextEpisode: 'Next Episode',
    newEpisode: 'New Episode'
};

/** The badge of a slide, e.g. "Continue · S1:E3 – Pilot · 23 min left". */
export function getBadge(kind: SlideKind, playItem: BaseItemDto): string {
    if (kind === 'newest') {
        return '';
    }

    const parts = [ LABELS[kind] ];
    if (playItem.Type === 'Episode') {
        const number = formatEpisodeNumber(playItem);
        const name = playItem.Name ? ` – ${playItem.Name}` : '';
        parts.push(number ? `${number}${name}` : (playItem.Name ?? ''));
    }
    if (kind === 'continue') {
        parts.push(formatTimeLeft(playItem));
    }
    return parts.filter(Boolean).join(' · ');
}

/** The series (for an episode) or the item itself; slides are unique per this id. */
function titleId(item: BaseItemDto): string {
    return (item.Type === 'Episode' ? item.SeriesId : item.Id) ?? '';
}

/**
 * Orders the billboard: what the user is watching (in progress, then next episodes), then new episodes of seasons
 * they follow, then the newest titles, one slide per series, up to {@link SLIDE_COUNT}.
 * @param candidates The candidates.
 * @param seriesById The series of the candidate episodes, whose art the slides show.
 * @returns The slides.
 */
export function buildSlides(candidates: SlideCandidates, seriesById: Map<string, BaseItemDto>): HeroSlide[] {
    const slides: HeroSlide[] = [];
    const seen = new Set<string>();

    const add = (kind: SlideKind, playItem: BaseItemDto) => {
        const id = titleId(playItem);
        if (!id || seen.has(id) || slides.length >= SLIDE_COUNT) {
            return;
        }

        const item = playItem.Type === 'Episode' ? seriesById.get(id) : playItem;
        if (!item) {
            return;
        }

        seen.add(id);
        slides.push({ kind, item, playItem, badge: getBadge(kind, playItem) });
    };

    const ordered: [SlideKind, BaseItemDto[]][] = [
        [ 'continue', candidates.resume ],
        [ 'nextEpisode', candidates.nextUp ],
        [ 'newEpisode', candidates.newEpisodes ],
        [ 'newest', candidates.newest ]
    ];
    for (const [ kind, items ] of ordered) {
        for (const item of items) {
            add(kind, item);
        }
    }
    return slides;
}
