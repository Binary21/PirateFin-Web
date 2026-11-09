import { TICKS_PER_MINUTE, TICKS_PER_SECOND } from '../../../../../constants/time';

/** Without detected credits, the countdown starts this long before the end. */
export const FALLBACK_SECONDS = 60;

/** The countdown isn't started this close to the end (it would barely show). */
const MIN_REMAINING_TICKS = 5 * TICKS_PER_SECOND;

/** Episodes shorter than this get no countdown. */
const MIN_RUNTIME_TICKS = 2 * TICKS_PER_MINUTE;

/**
 * When the next-episode countdown starts: when the credits begin, if they were detected (and fall in the second half
 * of the episode), otherwise {@link FALLBACK_SECONDS} before the end.
 * @param runtimeTicks The episode's length.
 * @param creditsStartTicks Where its credits (outro segment) start, when known.
 * @returns The position to start the countdown at.
 */
export function getUpNextStartTicks(runtimeTicks: number, creditsStartTicks?: number | null): number {
    if (creditsStartTicks != null
        && creditsStartTicks > runtimeTicks / 2
        && creditsStartTicks < runtimeTicks - MIN_REMAINING_TICKS) {
        return creditsStartTicks;
    }
    return Math.max(0, runtimeTicks - FALLBACK_SECONDS * TICKS_PER_SECOND);
}

/**
 * Whether the countdown should show now. It shows any time from its start until 5 seconds before the end, so it
 * still comes up if the player controls were open when it was due.
 * @param currentTicks The playback position.
 * @param runtimeTicks The episode's length.
 * @param creditsStartTicks Where its credits start, when known.
 * @returns True when it should show.
 */
export function shouldShowUpNext(currentTicks: number, runtimeTicks: number, creditsStartTicks?: number | null): boolean {
    if (!runtimeTicks || runtimeTicks < MIN_RUNTIME_TICKS) {
        return false;
    }
    return currentTicks >= getUpNextStartTicks(runtimeTicks, creditsStartTicks)
        && runtimeTicks - currentTicks >= MIN_REMAINING_TICKS;
}

/** Checks whether the next episode can play start this long before the countdown is due… */
export const READINESS_LEAD_TICKS = 2 * TICKS_PER_MINUTE;

/** …and are repeated this often (of playback) until it can, or the countdown is due. */
export const READINESS_INTERVAL_TICKS = 30 * TICKS_PER_SECOND;

/**
 * Whether to check now if the next episode can play: `check` from 2 minutes before the countdown is due, every 30
 * seconds of playback; `final` once the countdown is due, which decides it (no countdown, no autoplay if it can't);
 * `none` otherwise. Episodes too short for a countdown aren't checked.
 * @param currentTicks The playback position.
 * @param runtimeTicks The episode's length.
 * @param creditsStartTicks Where its credits start, when known.
 * @param lastCheckTicks The position of the last check, if any.
 * @returns What to do.
 */
export function getReadinessCheck(
    currentTicks: number,
    runtimeTicks: number,
    creditsStartTicks?: number | null,
    lastCheckTicks?: number | null
): 'none' | 'check' | 'final' {
    if (!runtimeTicks || runtimeTicks < MIN_RUNTIME_TICKS) {
        return 'none';
    }

    const countdownTicks = getUpNextStartTicks(runtimeTicks, creditsStartTicks);
    if (currentTicks >= countdownTicks) {
        return 'final';
    }
    if (currentTicks < countdownTicks - READINESS_LEAD_TICKS) {
        return 'none';
    }
    const checkAgain = lastCheckTicks == null || currentTicks < lastCheckTicks || currentTicks - lastCheckTicks >= READINESS_INTERVAL_TICKS;
    return checkAgain ? 'check' : 'none';
}
