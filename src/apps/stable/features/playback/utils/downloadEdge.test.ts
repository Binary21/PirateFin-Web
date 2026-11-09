import { describe, expect, it } from 'vitest';

import { getDownloadEdgeAction, MARGIN_SECONDS as MARGIN, RESUME_LEAD_SECONDS } from './downloadEdge';

const RUNTIME = 45 * 60;

const input = (positionSeconds: number, playableSeconds: number | null, waiting = false, downloaded = false) => ({
    positionSeconds, playableSeconds, runtimeSeconds: RUNTIME, downloaded, waiting
});

describe('getDownloadEdgeAction', () => {
    it('plays on well before the downloaded edge', () => {
        expect(getDownloadEdgeAction(input(600, 900))).toBe('none');
    });

    it('stops a margin short of the downloaded edge', () => {
        expect(getDownloadEdgeAction(input(900 - MARGIN - 1, 900))).toBe('none');
        expect(getDownloadEdgeAction(input(900 - MARGIN, 900))).toBe('wait');
    });

    it('stops straight away when started or sought past the edge', () => {
        expect(getDownloadEdgeAction(input(1500, 900))).toBe('wait');
    });

    it('carries on once enough more has arrived', () => {
        const position = 900 - MARGIN;
        expect(getDownloadEdgeAction(input(position, 900 + 30, true))).toBe('none');
        expect(getDownloadEdgeAction(input(position, position + MARGIN + RESUME_LEAD_SECONDS, true))).toBe('resume');
    });

    it('carries on when the download completes, and never stops a downloaded video', () => {
        expect(getDownloadEdgeAction(input(900, 900, true, true))).toBe('resume');
        expect(getDownloadEdgeAction(input(900, 900, false, true))).toBe('none');
    });

    it('carries on when everything left is there', () => {
        expect(getDownloadEdgeAction(input(RUNTIME - 30, RUNTIME - 0.5, true))).toBe('resume');
        expect(getDownloadEdgeAction(input(RUNTIME - 30, RUNTIME - 0.5))).toBe('none');
    });

    it('does nothing without a known edge', () => {
        expect(getDownloadEdgeAction(input(900, null))).toBe('none');
        expect(getDownloadEdgeAction(input(900, null, true))).toBe('resume');
    });
});
