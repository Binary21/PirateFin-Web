import type { ApiClient } from 'jellyfin-apiclient';

/** How long the sound takes to rise to full volume when a trailer starts or resumes with sound, or is unmuted. */
export const VOLUME_FADE_MS = 2_000;

const VOLUME_STEP_MS = 50;

export interface TrailerEvents {
    /** The video started or resumed playing. */
    onPlaying: () => void;
    /** The video ended. */
    onEnded: () => void;
    /** The video can't be played (the title has no trailer after all, or the device can't play it). */
    onError: () => void;
}

/**
 * One video element for a billboard, reused for each slide's trailer. A trailer is the title's own Jellyfin trailer
 * (PirateFin saves the first 30 seconds of the YouTube trailer next to each downloaded movie and series), streamed by
 * Jellyfin as a normal video file, so it plays on every device, including TV apps. It fills its container like a cover
 * image and ignores the pointer.
 */
export class HeroTrailer {
    private readonly video: HTMLVideoElement;
    private itemId: string | undefined;
    // Sound held silent until the billboard shows the video (see fadeInSound).
    private fadePending = false;
    private fadeTimer: ReturnType<typeof setInterval> | undefined;

    constructor(container: HTMLElement, private readonly apiClient: ApiClient, private readonly events: TrailerEvents) {
        const video = document.createElement('video');
        video.className = 'pfHero-trailerVideo';
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.setAttribute('playsinline', '');
        video.setAttribute('aria-hidden', 'true');
        video.addEventListener('playing', () => {
            if (this.itemId) {
                this.events.onPlaying();
            }
        });
        video.addEventListener('ended', () => {
            if (this.itemId) {
                this.events.onEnded();
            }
        });
        video.addEventListener('error', () => {
            if (this.itemId) {
                this.itemId = undefined;
                this.events.onError();
            }
        });
        container.appendChild(video);
        this.video = video;
    }

    /** Starts the trailer of a movie or series from the beginning. */
    async play(itemId: string, muted: boolean): Promise<void> {
        this.itemId = itemId;
        const trailers = await this.apiClient.getLocalTrailers(this.apiClient.getCurrentUserId(), itemId).catch(() => []);
        if (this.itemId !== itemId) {
            // Another trailer (or stop) was asked for meanwhile.
            return;
        }

        const trailerId = trailers[0]?.Id;
        if (!trailerId) {
            this.itemId = undefined;
            this.events.onError();
            return;
        }

        this.stopFade();
        this.video.muted = muted;
        if (!muted) {
            this.prepareFade();
        }
        // The file as it is (saved as H.264 / AAC, which every device plays), no transcoding.
        this.video.src = this.apiClient.getUrl(`Videos/${trailerId}/stream.mp4`, {
            Static: true,
            MediaSourceId: trailerId,
            ApiKey: this.apiClient.accessToken()
        });
        this.start(muted);
    }

    /** Pauses the current trailer, keeping its position. */
    pause() {
        this.video.pause();
    }

    /** Continues the current trailer, silent until {@link fadeInSound}. */
    resume() {
        if (!this.itemId) {
            return;
        }
        if (!this.video.muted) {
            this.prepareFade();
        }
        this.start(this.video.muted);
    }

    /** Stops the current trailer. */
    stop() {
        this.stopFade();
        this.itemId = undefined;
        this.video.pause();
        if (this.video.getAttribute('src')) {
            this.video.removeAttribute('src');
            this.video.load();
        }
    }

    /** Mutes, or unmutes with the sound fading in. */
    setMuted(muted: boolean) {
        this.stopFade();
        this.video.muted = muted;
        if (!muted) {
            this.fadeIn();
        }
    }

    isMuted(): boolean {
        return this.video.muted;
    }

    /** Seconds into the current trailer. */
    getCurrentTime(): number {
        return this.video.currentTime;
    }

    /**
     * Fades in the sound of a trailer started (or resumed) with sound, once the billboard shows it, so the sound never
     * comes before the picture.
     */
    fadeInSound() {
        if (this.fadePending && !this.video.muted) {
            this.fadeIn();
        }
    }

    destroy() {
        this.stop();
        this.video.remove();
    }

    /** Plays; a device that refuses to play with sound gets it muted, and one that refuses anyway reports an error. */
    private start(muted: boolean) {
        this.video.play().catch(() => {
            if (!this.itemId) {
                return;
            }
            if (!muted) {
                this.stopFade();
                this.video.muted = true;
                this.video.play().catch(() => this.events.onError());
            } else {
                this.events.onError();
            }
        });
    }

    /** Starts the next playback silent, until fadeInSound. */
    private prepareFade() {
        this.stopFade();
        this.video.volume = 0;
        this.fadePending = true;
    }

    /** Raises the volume from 0 to full over {@link VOLUME_FADE_MS}. */
    private fadeIn() {
        this.stopFade();
        const started = Date.now();
        this.video.volume = 0;
        this.fadeTimer = setInterval(() => {
            const progress = Math.min(1, (Date.now() - started) / VOLUME_FADE_MS);
            this.video.volume = progress;
            if (progress >= 1) {
                this.stopFade();
            }
        }, VOLUME_STEP_MS);
    }

    private stopFade() {
        clearInterval(this.fadeTimer);
        this.fadeTimer = undefined;
        this.fadePending = false;
    }
}
