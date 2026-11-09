import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

/** Whether an item in Continue Watching / Next Up was removed by the user (by its own id or its series'). */
export function isHiddenFromContinueWatching(item: BaseItemDto, hidden: string[]): boolean {
    const normalize = (id: string | null | undefined) => (id ?? '').replace(/-/g, '').toLowerCase();
    return hidden.includes(normalize(item.SeriesId)) || hidden.includes(normalize(item.Id));
}
