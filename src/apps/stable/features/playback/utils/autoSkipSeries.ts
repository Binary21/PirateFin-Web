import { MediaSegmentType } from '@jellyfin/sdk/lib/generated-client/models/media-segment-type';

import { currentSettings as userSettings } from 'scripts/settings/userSettings';

/** Segment types a user can choose to skip for the rest of a series: intros and recaps. */
export const SERIES_SKIP_TYPES: MediaSegmentType[] = [ MediaSegmentType.Intro, MediaSegmentType.Recap ];

const SETTING = 'pfAutoSkipSeries';

type AutoSkipSeries = Partial<Record<MediaSegmentType, string[]>>;

function read(): AutoSkipSeries {
    try {
        return JSON.parse(userSettings.get(SETTING) || '{}') as AutoSkipSeries;
    } catch {
        return {};
    }
}

/** Whether the user chose to skip this kind of segment for every episode of the series. */
export function isAutoSkipped(type: MediaSegmentType | undefined, seriesId: string | null | undefined): boolean {
    return !!type && !!seriesId && (read()[type] ?? []).includes(seriesId);
}

/** Turns skipping this kind of segment for the rest of a series on or off; saved with the account. */
export function setAutoSkipped(type: MediaSegmentType, seriesId: string, skip: boolean) {
    const settings = read();
    const series = new Set(settings[type] ?? []);
    if (skip) {
        series.add(seriesId);
    } else {
        series.delete(seriesId);
    }
    settings[type] = [ ...series ];
    userSettings.set(SETTING, JSON.stringify(settings));
}
