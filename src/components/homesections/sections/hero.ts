import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import escapeHtml from 'escape-html';
import type { ApiClient } from 'jellyfin-apiclient';

import focusManager from 'components/focusManager';
import layoutManager from 'components/layoutManager';
import { playbackManager } from 'components/playback/playbackmanager';
import { appRouter } from 'components/router/appRouter';
import globalize from 'lib/globalize';
import { getKeyName } from 'scripts/keyboardNavigation';
import { enableHeroTrailers } from 'scripts/settings/userSettings';
import {
    getDownloadStatus,
    getHiddenFromContinueWatching,
    getNewSubscribedEpisodes,
    isHiddenFromContinueWatching,
    isNotReadyToPlay,
    isWaiting,
    parseLibrary,
    type PirateFinItem
} from 'utils/piratefin';

import { buildSlides, type HeroSlide, SLIDE_COUNT } from './heroSlides';
import { HeroTrailer } from './heroTrailer';

import 'elements/emby-button/emby-button';
import 'styles/piratefin.scss';

/** How long each slide shows. */
const SLIDE_MS = 12_000;

/** The small, quickly loaded backdrop shown blurred while the full one loads. */
const PREVIEW_WIDTH = 400;

/** A full backdrop that loads within this time (e.g. it was cached) is shown without the blurred preview. */
const FULL_IMAGE_GRACE_MS = 150;

/** How long the details fade out before the next slide's are put in. */
const DETAILS_FADE_MS = 300;

/** How long a slide shows its backdrop before its trailer starts. */
const TRAILER_DELAY_MS = 3_000;

/** How much of a trailer plays before the next slide. */
const TRAILER_MAX_SECONDS = 30;

/** TV plays trailers with sound for this long, then mutes them (unless the user picked sound on or off). */
const TV_SOUND_SECONDS = 10;

/** How long a trailer may take to start playing before it's tried muted, then given up. */
const TRAILER_START_TIMEOUT_MS = 6_000;

/** How long a trailer plays before it fades in, so its first frame is on screen rather than a blank video. */
const TRAILER_REVEAL_MS = 300;

/** Whether the user turned trailer sound on (true) or off (false) with the mute button; kept for the session. */
let userWantsSound: boolean | undefined;

const NEXT_UP_DAYS = 30;

const FIELDS = 'Overview,Genres,ChildCount,PrimaryImageAspectRatio,LocalTrailerCount';
const IMAGE_TYPES = 'Backdrop,Logo,Primary,Thumb';

const ITEM_TYPES: Record<string, string> = {
    movies: 'Movie',
    shows: 'Series',
    anime: 'Series'
};

/** Stops the rotation of the billboard previously rendered into a container. */
const disposers = new WeakMap<HTMLElement, () => void>();

/** The billboards on the page (one per Shows / Anime / Movies tab); only the one on the shown tab is visible. */
const billboards = new Set<HTMLElement>();

function getVisibleBillboard(): HTMLElement | undefined {
    for (const elem of billboards) {
        if (elem.isConnected && elem.offsetParent !== null) {
            return elem;
        }
    }
    return undefined;
}

/**
 * Pulls a billboard up to the top of the page, under the header. It's measured against something that scrolls with it
 * (the page, or on TV the header, which is part of the page there), so the result doesn't depend on the scroll
 * position or on which element scrolls.
 */
function alignToTop(elem: HTMLElement) {
    const header = document.querySelector<HTMLElement>('.skinHeader');
    const headerScrolls = !!header && window.getComputedStyle(header).position !== 'fixed';
    const anchor = headerScrolls ? header : elem.closest<HTMLElement>('.page');
    if (!anchor) {
        return;
    }

    const current = parseFloat(elem.style.marginTop) || 0;
    const offset = elem.getBoundingClientRect().top - anchor.getBoundingClientRect().top - current;
    if (Math.abs(offset + current) > 0.5) {
        elem.style.marginTop = `${-offset}px`;
    }
}

function getScrollTop(): number {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

/** The header is solid again once the page is scrolled. */
function updateHeaderScrolled() {
    const header = document.querySelector('.skinHeader');
    header?.classList.toggle('pfHeader-scrolled', header.classList.contains('pfHeader-overHero') && getScrollTop() > 0);
}

/**
 * Over a billboard the header is a black gradient on the image instead of a solid bar, until the page is scrolled;
 * then it's solid again. Called when a billboard's tab is shown or hidden and on resize, never while scrolling.
 */
function updateHeader() {
    const header = document.querySelector('.skinHeader');
    const billboard = getVisibleBillboard();
    if (billboard) {
        alignToTop(billboard);
    }
    header?.classList.toggle('pfHeader-overHero', !!billboard);
    updateHeaderScrolled();
}

/** TV: Down from the header (the Shows / Anime / Movies tabs, the profile icon) goes to the billboard's first button. */
function onHeaderKeyDown(e: KeyboardEvent) {
    if (!layoutManager.tv || getKeyName(e) !== 'ArrowDown' || !(e.target as HTMLElement | null)?.closest?.('.skinHeader')) {
        return;
    }

    const button = getVisibleBillboard()?.querySelector<HTMLElement>('.pfHero-buttons .pfButton:not(.hide)');
    if (button) {
        e.preventDefault();
        e.stopPropagation();
        focusManager.focus(button);
    }
}

let listening = false;

function listenOnce() {
    if (listening) {
        return;
    }
    listening = true;
    // Capture: the scrolling element isn't always the window (some TVs scroll the body).
    window.addEventListener('scroll', updateHeaderScrolled, { passive: true, capture: true });
    window.addEventListener('resize', updateHeader);
    // Before the app's own arrow key handling, which listens on window.
    document.addEventListener('keydown', onHeaderKeyDown);
}

function getItems(result: { Items?: BaseItemDto[] | null } | BaseItemDto[]): BaseItemDto[] {
    return Array.isArray(result) ? result : (result.Items || []);
}

/** Series backdrop, else its thumb, else the episode's own image (a 16:9 still). */
function getBackdropUrl(apiClient: ApiClient, slide: HeroSlide, maxWidth = 1920, quality = 90) {
    const { item, playItem } = slide;
    const backdrop = item.BackdropImageTags?.[0];
    if (backdrop) {
        return apiClient.getScaledImageUrl(item.Id!, { type: 'Backdrop', tag: backdrop, maxWidth, quality });
    }
    if (item.ImageTags?.Thumb) {
        return apiClient.getScaledImageUrl(item.Id!, { type: 'Thumb', tag: item.ImageTags.Thumb, maxWidth, quality });
    }
    if (playItem !== item && playItem.ImageTags?.Primary) {
        return apiClient.getScaledImageUrl(playItem.Id!, { type: 'Primary', tag: playItem.ImageTags.Primary, maxWidth, quality });
    }
    return '';
}

/** Loads an image; resolves once it's fully downloaded (or failed: the caller shows what it has). */
function loadImage(url: string): Promise<boolean> {
    return new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = url;
    });
}

function getLogoUrl(apiClient: ApiClient, item: BaseItemDto) {
    const tag = item.ImageTags?.Logo;
    return tag ? apiClient.getScaledImageUrl(item.Id!, { type: 'Logo', tag, maxWidth: 720, quality: 90 }) : '';
}

function getMetaHtml(item: BaseItemDto) {
    const parts: string[] = [];
    if (item.ProductionYear) {
        parts.push(String(item.ProductionYear));
    }
    if (item.OfficialRating) {
        parts.push(`<span class="pfHero-rating">${escapeHtml(item.OfficialRating)}</span>`);
    }
    if (item.Type === 'Series' && item.ChildCount) {
        parts.push(item.ChildCount === 1 ? '1 Season' : `${item.ChildCount} Seasons`);
    }
    if (item.Genres?.length) {
        parts.push(item.Genres.slice(0, 3).map(g => escapeHtml(g)).join(' • '));
    }

    return parts.join('<span class="pfHero-dot"></span>');
}

function getDetailsHtml(apiClient: ApiClient, slide: HeroSlide) {
    const { item } = slide;
    const logoUrl = getLogoUrl(apiClient, item);
    const title = logoUrl ?
        `<img class="pfHero-logo" src="${logoUrl}" alt="${escapeHtml(item.Name || '')}">` :
        `<h1 class="pfHero-title">${escapeHtml(item.Name || '')}</h1>`;
    const badge = slide.badge ? `<div class="pfHero-badge pfHero-badge-${slide.kind}">${escapeHtml(slide.badge)}</div>` : '';

    return `
        ${title}
        ${badge}
        <div class="pfHero-meta">${getMetaHtml(item)}</div>
        <p class="pfHero-overview">${escapeHtml(item.Overview || '')}</p>`;
}

/** Plays (resuming) the slide's episode or movie; one still downloading opens on its page, which waits for it. */
async function play(apiClient: ApiClient, slide: HeroSlide) {
    const { playItem } = slide;
    if (playItem.Type === 'Episode' || playItem.Type === 'Movie') {
        const status = await getDownloadStatus(apiClient, playItem.Id!);
        if (!status.Playable) {
            appRouter.showItem(playItem);
            return;
        }
    }

    await playbackManager.play({
        items: [ playItem ],
        startPositionTicks: slide.kind === 'continue' ? playItem.UserData?.PlaybackPositionTicks ?? 0 : 0,
        serverId: playItem.ServerId
    });
}

/**
 * TV: Up from the billboard goes to the selected tab (Home / Shows / Anime / Movies) rather than to the closest header
 * button, the profile icon; and the billboard's first button is where the page starts.
 */
function setUpTvFocus(buttons: HTMLElement, infoButton: HTMLElement, muteButton: HTMLElement) {
    const focusActiveTab = (e: KeyboardEvent) => {
        const activeTab = document.querySelector<HTMLElement>('.skinHeader .headerTabs .emby-tab-button-active');
        if (activeTab && focusManager.isCurrentlyFocusable(activeTab)) {
            e.preventDefault();
            e.stopPropagation();
            focusManager.focus(activeTab);
        }
    };

    buttons.addEventListener('keydown', e => {
        const key = getKeyName(e);
        if (key === 'ArrowUp') {
            focusActiveTab(e);
        } else if (key === 'ArrowRight' && e.target === infoButton && !muteButton.classList.contains('hide')) {
            // The mute button is at the top right, but navigates as the next button in the row.
            e.preventDefault();
            e.stopPropagation();
            focusManager.focus(muteButton);
        }
    });

    // Only reachable from More Info, so Up from the rows never lands on it.
    muteButton.setAttribute('tabindex', '-1');
    muteButton.addEventListener('keydown', e => {
        const key = getKeyName(e);
        if (key === 'ArrowUp') {
            focusActiveTab(e);
        } else if (key === 'ArrowLeft' || key === 'ArrowDown' || key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            if (key !== 'ArrowRight') {
                focusManager.focus(infoButton);
            }
        }
    });

    // Only take focus while nothing meaningful has it yet (the page start), not while the user is on the tabs.
    const focused = document.activeElement;
    const isUnset = !focused || focused === document.body || !focused.isConnected || focused.classList.contains('headerUserButton');
    const firstButton = buttons.querySelector<HTMLElement>('.pfButton:not(.hide)');
    if (isUnset && firstButton) {
        focusManager.focus(firstButton);
    }
}

/**
 * Shows the slides one after another, crossfading the backdrop and fading the details. It only runs while the
 * billboard is in view (desktop / mobile) or the selector is on it (TV).
 *
 * A slide whose title has a trailer (unless the user turned trailers off) fades to it
 * {@link TRAILER_DELAY_MS} after it shows, once the video is playing: muted on desktop / mobile; on TV with sound, muted
 * after
 * {@link TV_SOUND_SECONDS}. The slide then moves on when the trailer ends or after {@link TRAILER_MAX_SECONDS}. When
 * the billboard stops running the trailer pauses and fades back to the backdrop, and continues when it runs again.
 */
function render(elem: HTMLElement, apiClient: ApiClient, slides: HeroSlide[]) {
    elem.innerHTML = `
        <div class="pfHero">
            <div class="pfHero-backdrop pfHero-backdrop-active"></div>
            <div class="pfHero-backdrop"></div>
            <div class="pfHero-trailer"></div>
            <div class="pfHero-vignette"></div>
            <button is="emby-button" type="button" class="pfHeroMute hide" title="Unmute" aria-label="Unmute"><span class="material-icons volume_off" aria-hidden="true"></span></button>
            <div class="pfHero-content padded-left">
                <div class="pfHero-details"></div>
                <div class="pfHero-buttons focuscontainer-x">
                    <button is="emby-button" type="button" class="pfButton pfButton-primary btnHeroPlay"><span class="material-icons play_arrow" aria-hidden="true"></span><span class="btnHeroPlayText">${globalize.translate('Play')}</span></button>
                    <button is="emby-button" type="button" class="pfButton pfButton-secondary btnHeroInfo"><span class="material-icons info_outline" aria-hidden="true"></span><span>More Info</span></button>
                </div>
            </div>
        </div>`;

    const hero = elem.querySelector<HTMLElement>('.pfHero')!;
    const layers = Array.from(elem.querySelectorAll<HTMLElement>('.pfHero-backdrop'));
    const trailerContainer = elem.querySelector<HTMLElement>('.pfHero-trailer')!;
    const muteButton = elem.querySelector<HTMLElement>('.pfHeroMute')!;
    const muteIcon = muteButton.querySelector<HTMLElement>('.material-icons')!;
    const details = elem.querySelector<HTMLElement>('.pfHero-details')!;
    const buttons = elem.querySelector<HTMLElement>('.pfHero-buttons')!;
    const playButton = elem.querySelector<HTMLElement>('.btnHeroPlay')!;
    const playText = elem.querySelector<HTMLElement>('.btnHeroPlayText')!;
    const infoButton = elem.querySelector<HTMLElement>('.btnHeroInfo')!;

    let index = 0;
    let activeLayer = 0;
    let slideTimer: ReturnType<typeof setTimeout> | undefined;
    let inView = !layoutManager.tv;
    let focused = false;
    let running = false;

    // The current slide's trailer: its id, whether it has played yet, and its timers.
    let trailerId: string | undefined;
    let trailerStarted = false;
    let trailerStartTimer: ReturnType<typeof setTimeout> | undefined;
    let trailerWatch: ReturnType<typeof setInterval> | undefined;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    let trailer: HeroTrailer | undefined;

    const isActive = () => elem.isConnected && (layoutManager.tv ? focused : inView);

    const updateMuteButton = () => {
        const muted = trailer?.isMuted() ?? true;
        const label = muted ? 'Unmute' : 'Mute';
        muteIcon.classList.toggle('volume_off', muted);
        muteIcon.classList.toggle('volume_up', !muted);
        muteButton.title = label;
        muteButton.setAttribute('aria-label', label);
    };

    const setTrailerVisible = (visible: boolean) => {
        trailerContainer.classList.toggle('pfHero-trailer-visible', visible);
        if (!visible && document.activeElement === muteButton) {
            focusManager.focus(buttons.querySelector<HTMLElement>('.pfButton:not(.hide)') ?? infoButton);
        }
        muteButton.classList.toggle('hide', !visible);
        if (visible) {
            updateMuteButton();
        }
    };

    const stopTrailerTimers = () => {
        clearTimeout(trailerStartTimer);
        clearInterval(trailerWatch);
        clearTimeout(revealTimer);
        trailerStartTimer = undefined;
        trailerWatch = undefined;
        revealTimer = undefined;
    };

    const scheduleSlide = () => {
        clearTimeout(slideTimer);
        slideTimer = undefined;
        // Once a trailer plays, it decides when the slide moves on.
        if (slides.length > 1 && running && !trailerStarted) {
            slideTimer = setTimeout(next, SLIDE_MS);
        }
    };

    const showDetails = (slide: HeroSlide) => {
        details.innerHTML = getDetailsHtml(apiClient, slide);
        playText.textContent = slide.kind === 'continue' ? globalize.translate('ButtonResume') : globalize.translate('Play');

        const canPlay = playbackManager.canPlay(slide.playItem);
        // Grey and disabled while the episode / movie is downloading and can't play yet.
        const notReady = isNotReadyToPlay(slide.playItem);
        if ((!canPlay || notReady) && document.activeElement === playButton) {
            focusManager.focus(infoButton);
        }
        playButton.classList.toggle('hide', !canPlay);
        playButton.classList.toggle('pfPlay-notReady', notReady);
        (playButton as HTMLButtonElement).disabled = notReady;
    };

    // Each backdrop change gets a number, so a slow image of an earlier slide can't replace a newer one.
    let backdropRequest = 0;

    /**
     * Shows a slide's backdrop on the hidden layer and crossfades to it. An image is never shown half loaded: while the
     * full size image loads, a small one is shown blurred, and sharpens when the full one is ready.
     */
    const showBackdrop = async (slide: HeroSlide, immediate: boolean) => {
        const request = ++backdropRequest;
        const full = getBackdropUrl(apiClient, slide);
        const preview = getBackdropUrl(apiClient, slide, PREVIEW_WIDTH, 60);
        const layer = layers[1 - activeLayer];
        const isCurrent = () => request === backdropRequest;

        const paint = (url: string, blurred: boolean) => {
            layer.style.backgroundImage = url ? `url('${url}')` : '';
            layer.classList.toggle('pfHero-backdrop-blurred', blurred);
        };
        const activate = () => {
            layers[activeLayer].classList.remove('pfHero-backdrop-active');
            layer.classList.add('pfHero-backdrop-active');
            activeLayer = 1 - activeLayer;
        };

        if (!full) {
            paint('', false);
            activate();
            return;
        }

        const fullLoaded = loadImage(full);
        const quick = await Promise.race([ fullLoaded, new Promise<null>(resolve => setTimeout(resolve, immediate ? 0 : FULL_IMAGE_GRACE_MS, null)) ]);
        if (!isCurrent()) {
            return;
        }

        if (quick !== null) {
            // Loaded straight away (cached): no preview needed.
            paint(full, false);
            activate();
            return;
        }

        // The small preview first, blurred; it loads much faster.
        await loadImage(preview);
        if (!isCurrent()) {
            return;
        }
        paint(preview, true);
        activate();

        await fullLoaded;
        if (isCurrent()) {
            paint(full, false);
        }
    };

    const preload = (slide: HeroSlide | undefined) => {
        const url = slide && getBackdropUrl(apiClient, slide);
        if (url) {
            new Image().src = url;
        }
    };

    // A trailer that hasn't started after a while: first try it muted (TVs may block sound), then go on without it.
    const onTrailerSlow = (player: HeroTrailer, id: string, triedMuted: boolean) => {
        trailerStartTimer = undefined;
        if (trailerStarted || trailerId !== id) {
            return;
        }

        if (!triedMuted && !player.isMuted()) {
            player.setMuted(true);
            player.resume();
            trailerStartTimer = setTimeout(onTrailerSlow, TRAILER_START_TIMEOUT_MS, player, id, true);
            return;
        }

        player.stop();
        trailerId = undefined;
        scheduleSlide();
    };

    const startTrailer = () => {
        const id = trailerId;
        const player = trailer;
        if (!player || !id || trailerStarted || trailerStartTimer) {
            return;
        }

        trailerStartTimer = setTimeout(() => {
            const withSound = userWantsSound ?? layoutManager.tv;
            player.play(id, !withSound).catch((err: unknown) => {
                console.error('[PirateFin] failed to start the trailer', err);
            });
            trailerStartTimer = setTimeout(onTrailerSlow, TRAILER_START_TIMEOUT_MS, player, id, false);
        }, TRAILER_DELAY_MS);
    };

    const show = (i: number, immediate = false) => {
        index = i;
        const slide = slides[index];

        // The previous trailer fades out over the new backdrop; one still loading is dropped, so it can't start late.
        stopTrailerTimers();
        if (trailerStarted) {
            trailer?.pause();
        } else {
            trailer?.stop();
        }
        setTrailerVisible(false);
        trailerStarted = false;
        // Movies and series with a trailer (PirateFin saves one next to each downloaded title).
        trailerId = trailer && slide.item.LocalTrailerCount ? slide.item.Id : undefined;

        void showBackdrop(slide, immediate);
        preload(slides[(index + 1) % slides.length]);

        if (immediate) {
            showDetails(slide);
        } else {
            details.classList.add('pfHero-details-hidden');
            setTimeout(() => {
                showDetails(slide);
                details.classList.remove('pfHero-details-hidden');
            }, DETAILS_FADE_MS);
        }

        scheduleSlide();
        if (running) {
            startTrailer();
        }
    };

    const next = () => {
        if (slides.length > 1) {
            show((index + 1) % slides.length);
            return;
        }

        // Nothing to move on to: back to the backdrop.
        stopTrailerTimers();
        trailerId = undefined;
        setTrailerVisible(false);
        trailer?.pause();
    };

    // While a trailer plays: the time limit, on TV the switch to muted, and the mute icon kept in step with the player
    // (which can also mute itself).
    const watchTrailer = () => {
        clearInterval(trailerWatch);
        trailerWatch = setInterval(() => {
            if (!trailer) {
                return;
            }
            const seconds = trailer.getCurrentTime();
            if (seconds >= TRAILER_MAX_SECONDS) {
                next();
                return;
            }
            if (layoutManager.tv && userWantsSound === undefined && seconds >= TV_SOUND_SECONDS && !trailer.isMuted()) {
                trailer.setMuted(true);
            }
            updateMuteButton();
        }, 500);
    };

    if (enableHeroTrailers()) {
        trailer = new HeroTrailer(trailerContainer, apiClient, {
            onPlaying: () => {
                if (!running) {
                    trailer?.pause();
                    return;
                }
                trailerStarted = true;
                clearTimeout(trailerStartTimer);
                trailerStartTimer = undefined;
                scheduleSlide();
                watchTrailer();

                // Fade in with its first frame showing; the sound comes up with the picture.
                clearTimeout(revealTimer);
                revealTimer = setTimeout(() => {
                    revealTimer = undefined;
                    if (running && trailerStarted) {
                        setTrailerVisible(true);
                        trailer?.fadeInSound();
                    }
                }, TRAILER_REVEAL_MS);
            },
            onEnded: next,
            onError: () => {
                // No trailer for this slide after all: it shows its backdrop for the usual time. Before the trailer
                // started, the slide's own timer is still running.
                const wasStarted = trailerStarted;
                stopTrailerTimers();
                trailerId = undefined;
                trailerStarted = false;
                setTrailerVisible(false);
                if (wasStarted) {
                    scheduleSlide();
                }
            }
        });
    }

    // Starts or stops the rotation (and the trailer) when the billboard comes into or leaves view / focus.
    const updateRunning = () => {
        const active = isActive();
        if (active === running) {
            return;
        }
        running = active;

        if (running) {
            if (trailerStarted) {
                // Fades back in once it's playing again.
                trailer?.resume();
            } else {
                startTrailer();
            }
        } else {
            stopTrailerTimers();
            if (trailerStarted) {
                trailer?.pause();
                setTrailerVisible(false);
            } else {
                // Not playing yet: it starts over when the billboard runs again.
                trailer?.stop();
            }
        }
        scheduleSlide();
    };

    playButton.addEventListener('click', () => {
        play(apiClient, slides[index]).catch((err: unknown) => {
            console.error('[PirateFin] failed to play billboard item', err);
        });
    });
    infoButton.addEventListener('click', () => {
        appRouter.showItem(slides[index].item);
    });
    muteButton.addEventListener('click', () => {
        if (!trailer) {
            return;
        }
        // The choice holds for the following trailers too.
        userWantsSound = trailer.isMuted();
        trailer.setMuted(!userWantsSound);
        updateMuteButton();
    });

    // TV: run while the selector is on the billboard (its buttons or the mute button).
    hero.addEventListener('focusin', () => {
        focused = true;
        updateRunning();
    });
    hero.addEventListener('focusout', (e: FocusEvent) => {
        if (!hero.contains(e.relatedTarget as Node | null)) {
            focused = false;
            updateRunning();
        }
    });

    // Desktop / mobile: run while at least half of the billboard is on screen (a hidden page counts as off screen).
    // Also tells the header when this tab is shown or hidden (not merely scrolled).
    let shown = false;
    const observer = new IntersectionObserver(entries => {
        inView = entries.some(entry => entry.intersectionRatio >= 0.5);
        updateRunning();
        const isShown = elem.offsetParent !== null;
        if (isShown !== shown) {
            shown = isShown;
            updateHeader();
        }
    }, { threshold: [ 0, 0.5 ] });
    observer.observe(hero);

    billboards.add(elem);
    listenOnce();

    disposers.set(elem, () => {
        running = false;
        clearTimeout(slideTimer);
        stopTrailerTimers();
        observer.disconnect();
        trailer?.destroy();
        billboards.delete(elem);
        elem.style.marginTop = '';
        updateHeader();
    });

    show(0, true);
    if (layoutManager.tv) {
        setUpTvFocus(buttons, infoButton, muteButton);
    }
    updateRunning();
    updateHeader();
}

async function loadCandidates(apiClient: ApiClient, userId: string, view: BaseItemDto, itemType: string) {
    const isSeries = itemType === 'Series';
    const library = parseLibrary(view.Name);
    const common = { Fields: FIELDS, EnableImageTypes: IMAGE_TYPES, ImageTypeLimit: 1, EnableTotalRecordCount: false };
    const nextUpCutoff = new Date();
    nextUpCutoff.setDate(nextUpCutoff.getDate() - NEXT_UP_DAYS);

    const [ resume, nextUp, newEpisodes, newest, hidden ] = await Promise.all([
        apiClient.getResumableItems(userId, { ParentId: view.Id, Recursive: true, MediaTypes: 'Video', Limit: SLIDE_COUNT * 3, ...common })
            .then(getItems)
            .then(items => {
                const lastPlayed = (item: BaseItemDto) => Date.parse(item.UserData?.LastPlayedDate || '') || 0;
                return [ ...items ].sort((a, b) => lastPlayed(b) - lastPlayed(a));
            }),
        isSeries ?
            apiClient.getNextUpEpisodes({
                ParentId: view.Id,
                UserId: userId,
                Limit: SLIDE_COUNT,
                NextUpDateCutoff: nextUpCutoff.toISOString(),
                EnableResumable: false,
                DisableFirstEpisode: true,
                ...common
            }).then(getItems).then(items => items.filter(i => !isWaiting(i as PirateFinItem))) :
            Promise.resolve([]),
        isSeries && library ?
            getNewSubscribedEpisodes(apiClient, library, FIELDS, SLIDE_COUNT).catch((err: unknown) => {
                console.error('[PirateFin] failed to load new episodes for the billboard', err);
                return [];
            }) :
            Promise.resolve([]),
        apiClient.getItems(userId, {
            ParentId: view.Id,
            Recursive: true,
            IncludeItemTypes: itemType,
            ImageTypes: 'Backdrop',
            SortBy: 'DateCreated',
            SortOrder: 'Descending',
            Limit: SLIDE_COUNT * 2,
            ...common
        }).then(getItems),
        getHiddenFromContinueWatching(apiClient)
    ]);

    // Titles the user removed from Continue Watching aren't billboarded as being watched either.
    const shown = (item: BaseItemDto) => !isHiddenFromContinueWatching(item, hidden);
    return { resume: resume.filter(shown), nextUp: nextUp.filter(shown), newEpisodes, newest };
}

/** Fetches the series of the candidate episodes, which the slides show. */
async function loadSeries(apiClient: ApiClient, userId: string, episodes: BaseItemDto[]) {
    const ids = [ ...new Set(episodes.map(e => e.SeriesId).filter((id): id is string => !!id)) ];
    if (!ids.length) {
        return new Map<string, BaseItemDto>();
    }

    const result = await apiClient.getItems(userId, { Ids: ids.join(','), Fields: FIELDS, EnableImageTypes: IMAGE_TYPES });
    return new Map(getItems(result).map(series => [ series.Id!, series ]));
}

/**
 * Renders the Netflix style billboard for a home tab: up to eight slides, rotating every 12 seconds. First what the
 * user is watching (in progress, then the next episode), then new episodes of seasons they follow (aired in the last
 * 7 days, ready and unwatched), then the library's newest titles.
 * @param elem The container.
 * @param apiClient The api client.
 * @param userViews The user's libraries.
 * @param type The home tab type: movies, shows or anime.
 */
export async function loadHero(elem: HTMLElement, apiClient: ApiClient, userViews: BaseItemDto[], type: string) {
    disposers.get(elem)?.();
    disposers.delete(elem);

    const view = userViews.find(v => v.Name?.toLowerCase() === type);
    const itemType = ITEM_TYPES[type];
    if (!view?.Id || !itemType) {
        elem.innerHTML = '';
        return;
    }

    try {
        const userId = apiClient.getCurrentUserId();
        const candidates = await loadCandidates(apiClient, userId, view, itemType);
        const episodes = [ ...candidates.resume, ...candidates.nextUp, ...candidates.newEpisodes ].filter(i => i.Type === 'Episode');
        const slides = buildSlides(candidates, await loadSeries(apiClient, userId, episodes));
        if (!slides.length) {
            elem.innerHTML = '';
            return;
        }

        render(elem, apiClient, slides);
    } catch (err) {
        console.error('[PirateFin] failed to load hero', err);
        elem.innerHTML = '';
    }
}
