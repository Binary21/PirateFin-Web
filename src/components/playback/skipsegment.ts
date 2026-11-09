import { PlaybackManager } from './playbackmanager';
import { TICKS_PER_MILLISECOND, TICKS_PER_SECOND } from 'constants/time';
import type { MediaSegmentDto } from '@jellyfin/sdk/lib/generated-client/models/media-segment-dto';
import type { MediaSegmentType } from '@jellyfin/sdk/lib/generated-client/models/media-segment-type';
import type { PlaybackStopInfo } from 'types/playbackStopInfo';
import { PlaybackSubscriber } from 'apps/stable/features/playback/utils/playbackSubscriber';
import { isInSegment } from 'apps/stable/features/playback/utils/mediaSegments';
import { isAutoSkipped, SERIES_SKIP_TYPES, setAutoSkipped } from 'apps/stable/features/playback/utils/autoSkipSeries';
import Events, { type Event } from 'utils/events';
import { EventType } from 'constants/eventType';
import './skipbutton.scss';
import dom from 'utils/dom';
import globalize from 'lib/globalize';
import * as userSettings from 'scripts/settings/userSettings';
import focusManager from 'components/focusManager';
import layoutManager from 'components/layoutManager';
import { getKeyName } from 'scripts/keyboardNavigation';

/** How much of an intro / recap plays, with "Don't Skip", before it's skipped automatically. */
const AUTO_SKIP_DELAY_MS = 5000;

interface ShowOptions {
    animate?: boolean;
    keep?: boolean;
    focus?: boolean;
}

/**
 * plain: "Skip Outro" etc. ask: "Skip Intro" with ^ for "Skip all future intros". auto: the user skips this series'
 * intros; "Don't Skip Intro" for 5 s, with ^ for "Stop skipping intros".
 */
type SkipMode = 'plain' | 'ask' | 'auto';

const PLURALS: Partial<Record<MediaSegmentType, string>> = {
    Intro: 'intros',
    Recap: 'recaps'
};

function onHideComplete(this: HTMLElement) {
    if (this) {
        // Handle focus after the hide transition completes
        if (this.contains(document.activeElement)) {
            (document.activeElement as HTMLElement).blur();
            const pauseButton = document.querySelector('.btnPause');
            if (pauseButton && focusManager.isCurrentlyFocusable(pauseButton)) {
                focusManager.focus(pauseButton);
            }
        }

        this.classList.add('hide');
    }
}

class SkipSegment extends PlaybackSubscriber {
    /** The whole skip control (the buttons, the ^ and the outline), shown and hidden as one. */
    private skipElement: HTMLElement | null;
    private mainButton: HTMLButtonElement | null = null;
    private secondaryButton: HTMLButtonElement | null = null;
    private arrowButton: HTMLButtonElement | null = null;
    private currentSegment: MediaSegmentDto | null | undefined;
    private mode: SkipMode = 'plain';
    private hideTimeout: ReturnType<typeof setTimeout> | null | undefined;
    private autoSkipTimeout: ReturnType<typeof setTimeout> | null | undefined;

    constructor(playbackManager: PlaybackManager) {
        super(playbackManager);

        this.skipElement = null;
        this.onOsdChanged = this.onOsdChanged.bind(this);
    }

    private get seriesId(): string | undefined {
        return this.player ? this.playbackManager.currentItem(this.player)?.SeriesId ?? undefined : undefined;
    }

    createSkipElement() {
        if (this.skipElement) {
            return;
        }

        // FIXME: Move skip button to the video OSD
        const html = '<div class="skip-button-container"><div class="pfSkip hide skip-button-hidden">'
            + '<div class="pfSkip-box">'
            + '<button is="emby-button" type="button" class="pfSkip-secondary"></button>'
            + '<button type="button" class="pfSkip-arrow" aria-label="More options"><span class="material-icons expand_less" aria-hidden="true"></span></button>'
            + '<button is="emby-button" type="button" class="skip-button"></button>'
            + '</div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);

        this.skipElement = document.body.querySelector('.pfSkip');
        this.mainButton = document.body.querySelector('.pfSkip .skip-button');
        this.secondaryButton = document.body.querySelector('.pfSkip-secondary');
        this.arrowButton = document.body.querySelector('.pfSkip-arrow');

        // TV: only reachable by pressing Up on the main button.
        if (layoutManager.tv) {
            this.secondaryButton?.setAttribute('tabindex', '-1');
            this.arrowButton?.setAttribute('tabindex', '-1');
        }

        this.mainButton?.addEventListener('click', () => this.onMain());
        this.secondaryButton?.addEventListener('click', () => this.onSecondary());
        this.arrowButton?.addEventListener('click', () => this.expand(true));

        this.mainButton?.addEventListener('keydown', e => {
            if (getKeyName(e) === 'ArrowUp' && this.mode !== 'plain') {
                e.preventDefault();
                e.stopPropagation();
                this.expand(true);
            }
        });
        this.secondaryButton?.addEventListener('keydown', e => {
            const key = getKeyName(e);
            if (key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                if (this.mainButton) {
                    focusManager.focus(this.mainButton);
                }
            } else if (key === 'ArrowUp' || key === 'ArrowLeft' || key === 'ArrowRight') {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        // Leaving the control closes the second option.
        this.skipElement?.addEventListener('focusout', (e: FocusEvent) => {
            if (!this.skipElement?.contains(e.relatedTarget as Node | null)) {
                this.collapse();
            }
        });
    }

    /** Shows the second option (in an outline around both buttons). */
    private expand(focusSecondary: boolean) {
        if (!this.skipElement || this.mode === 'plain') {
            return;
        }
        this.clearHideTimeout();
        this.skipElement.classList.add('pfSkip-expanded');
        if (focusSecondary && this.secondaryButton) {
            focusManager.focus(this.secondaryButton);
        }
    }

    private collapse() {
        this.skipElement?.classList.remove('pfSkip-expanded');
    }

    private onMain() {
        if (this.mode === 'auto') {
            // "Don't Skip": watch this one.
            this.clearAutoSkip();
            this.hideSkipButton();
            return;
        }
        this.skipCurrent();
    }

    private onSecondary() {
        const type = this.currentSegment?.Type;
        const seriesId = this.seriesId;
        if (!type || !seriesId) {
            return;
        }

        if (this.mode === 'ask') {
            // Skip this one and every later one of the series.
            setAutoSkipped(type, seriesId, true);
            this.skipCurrent();
        } else if (this.mode === 'auto') {
            // Stop skipping: later episodes ask again, and so does this one.
            setAutoSkipped(type, seriesId, false);
            this.clearAutoSkip();
            this.mode = 'ask';
            this.collapse();
            this.setButtonText();
            if (this.mainButton) {
                focusManager.focus(this.mainButton);
            }
        }
    }

    /** Seeks past the current segment. */
    private skipCurrent() {
        const time = this.playbackManager.currentTime() * TICKS_PER_MILLISECOND;
        if (this.currentSegment?.EndTicks && time < this.currentSegment.EndTicks - TICKS_PER_SECOND) {
            this.playbackManager.seek(this.currentSegment.EndTicks);
        } else {
            this.hideSkipButton();
        }
    }

    setButtonText() {
        if (!this.mainButton || !this.secondaryButton || !this.arrowButton || !this.currentSegment) {
            return;
        }

        const typeName = globalize.translate(`MediaSegmentType.${this.currentSegment.Type}`);
        const plural = (this.currentSegment.Type && PLURALS[this.currentSegment.Type]) || typeName.toLowerCase();

        if (this.mode === 'auto') {
            this.mainButton.innerHTML = `Don't Skip ${typeName}`;
            this.secondaryButton.textContent = `Stop skipping ${plural}`;
        } else {
            this.mainButton.innerHTML = globalize.translate('MediaSegmentSkipPrompt', typeName)
                + '<span class="material-icons skip_next" aria-hidden="true"></span>';
            this.secondaryButton.textContent = `Skip all future ${plural}`;
        }

        this.arrowButton.classList.toggle('hide', this.mode === 'plain');
        this.secondaryButton.classList.toggle('hide', this.mode === 'plain');
    }

    showSkipButton(options: ShowOptions) {
        const elem = this.skipElement;
        if (elem) {
            this.clearHideTimeout();
            dom.removeEventListener(elem, dom.whichTransitionEvent(), onHideComplete, {
                once: true
            });
            elem.classList.remove('hide');
            if (!options.animate) {
                elem.classList.add('no-transition');
            } else {
                elem.classList.remove('no-transition');
            }

            // eslint-disable-next-line sonarjs/void-use
            void elem.offsetWidth;

            const hasFocus = document.activeElement && focusManager.isCurrentlyFocusable(document.activeElement);
            if (options.focus && !hasFocus && this.mainButton) {
                focusManager.focus(this.mainButton);
            }

            requestAnimationFrame(() => {
                elem.classList.remove('skip-button-hidden');

                if (!options.keep) {
                    this.hideTimeout = setTimeout(() => {
                        // Not while the second option is open.
                        if (!elem.classList.contains('pfSkip-expanded')) {
                            this.hideSkipButton();
                        }
                    }, 8000);
                }
            });
        }
    }

    hideSkipButton() {
        const elem = this.skipElement;
        if (elem) {
            this.collapse();
            elem.classList.remove('no-transition');
            // eslint-disable-next-line sonarjs/void-use
            void elem.offsetWidth;

            requestAnimationFrame(() => {
                elem.classList.add('skip-button-hidden');

                dom.addEventListener(elem, dom.whichTransitionEvent(), onHideComplete, {
                    once: true
                });
            });
        }
    }

    clearHideTimeout() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
    }

    private clearAutoSkip() {
        if (this.autoSkipTimeout) {
            clearTimeout(this.autoSkipTimeout);
            this.autoSkipTimeout = null;
        }
    }

    onOsdChanged(_e: Event, isOpen: boolean) {
        if (this.currentSegment) {
            if (isOpen) {
                this.showSkipButton({
                    animate: false,
                    keep: true,
                    focus: false
                });
            } else if (!this.hideTimeout && this.mode !== 'auto') {
                this.hideSkipButton();
            }
        }
    }

    onPromptSkip(e: Event, segment: MediaSegmentDto) {
        if (this.player && segment.EndTicks != null
            && segment.EndTicks >= this.playbackManager.currentItem(this.player).RunTimeTicks
            && this.playbackManager.getNextItem()
            && userSettings.enableNextVideoInfoOverlay()
        ) {
            // Don't display button when UpNextDialog is expected.
            return;
        }
        if (!this.currentSegment) {
            this.currentSegment = segment;

            const seriesSkippable = !!segment.Type && SERIES_SKIP_TYPES.includes(segment.Type) && !!this.seriesId;
            if (!seriesSkippable) {
                this.mode = 'plain';
            } else {
                this.mode = isAutoSkipped(segment.Type, this.seriesId) ? 'auto' : 'ask';
            }

            this.createSkipElement();
            this.collapse();
            this.setButtonText();

            this.showSkipButton({
                animate: true,
                focus: layoutManager.tv,
                keep: this.mode === 'auto'
            });

            if (this.mode === 'auto') {
                // The first seconds play, then it's skipped unless the user chose to watch it.
                const skipping = segment;
                this.autoSkipTimeout = setTimeout(() => {
                    this.autoSkipTimeout = null;
                    if (this.currentSegment === skipping && this.mode === 'auto') {
                        this.skipCurrent();
                    }
                }, AUTO_SKIP_DELAY_MS);
            }
        }
    }

    onPlayerTimeUpdate() {
        if (this.currentSegment) {
            const time = this.playbackManager.currentTime(this.player) * TICKS_PER_MILLISECOND;

            if (!isInSegment(this.currentSegment, time)) {
                this.currentSegment = null;
                this.clearAutoSkip();
                this.hideSkipButton();
            }
        }
    }

    onPlayerChange(): void {
        if (this.playbackManager.getCurrentPlayer()) {
            Events.off(document, EventType.SHOW_VIDEO_OSD, this.onOsdChanged);
            Events.on(document, EventType.SHOW_VIDEO_OSD, this.onOsdChanged);
        }
    }

    onPlaybackStop(_e: Event, playbackStopInfo: PlaybackStopInfo) {
        this.currentSegment = null;
        this.clearAutoSkip();
        this.hideSkipButton();
        if (!playbackStopInfo.nextItem) {
            Events.off(document, EventType.SHOW_VIDEO_OSD, this.onOsdChanged);
        }
    }
}

export const bindSkipSegment = (playbackManager: PlaybackManager) => new SkipSegment(playbackManager);
