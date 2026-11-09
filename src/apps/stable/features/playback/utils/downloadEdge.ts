/**
 * PirateFin: while a video is still downloading, the player pauses before it reaches data that isn't downloaded yet
 * (reading it shows a frozen picture with the sound going on) and carries on once enough more has arrived.
 *
 * The server says how far into the video the data reaches without a gap ("PlayableSeconds"): the last keyframe before
 * the downloaded edge, found through the file's index. It's refreshed every few seconds and only ever lags behind the
 * real edge, so a short margin covers it.
 */

/** The player stops this many seconds before the downloaded edge. */
export const MARGIN_SECONDS = 15;

/** It carries on once this many seconds beyond the stop point are downloaded, so it doesn't stop again straight away. */
export const RESUME_LEAD_SECONDS = 60;

export interface DownloadEdgeInput {
    /** The playback position, in seconds. */
    positionSeconds: number;
    /** How far into the video the data reaches without a gap; null when unknown. */
    playableSeconds: number | null | undefined;
    /** The video's length in seconds; 0 when unknown. */
    runtimeSeconds: number;
    /** Whether the whole file is on disk. */
    downloaded: boolean;
    /** Whether the player is currently held at the edge. */
    waiting: boolean;
}

/** What to do: hold the player at the edge, let it carry on, or nothing. */
export type DownloadEdgeAction = 'wait' | 'resume' | 'none';

/**
 * Decides whether the player should stop at the downloaded edge, or carry on after stopping there.
 * @param input Where playback and the download are.
 * @returns The action.
 */
export function getDownloadEdgeAction(input: DownloadEdgeInput): DownloadEdgeAction {
    const { positionSeconds, playableSeconds, runtimeSeconds, downloaded, waiting } = input;
    if (downloaded || playableSeconds == null) {
        return waiting ? 'resume' : 'none';
    }

    const margin = MARGIN_SECONDS;

    // Close enough to the end that everything left is there (within the margin of error).
    const nearlyAll = runtimeSeconds > 0 && playableSeconds >= runtimeSeconds - 1;

    if (!waiting) {
        return !nearlyAll && positionSeconds >= playableSeconds - margin ? 'wait' : 'none';
    }

    return nearlyAll || playableSeconds - positionSeconds >= margin + RESUME_LEAD_SECONDS ? 'resume' : 'none';
}
