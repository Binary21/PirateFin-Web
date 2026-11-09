import type Hls from 'hls.js';
import React, {
    type ChangeEvent,
    type FC,
    type KeyboardEvent,
    type PointerEvent,
    useCallback,
    useEffect,
    useRef,
    useState
} from 'react';

import focusManager from 'components/focusManager';
import layoutManager from 'components/layoutManager';
import scrollManager from 'components/scrollManager';
import Button from 'elements/emby-button/Button';
import { useApi } from 'hooks/useApi';
import { getKeyName } from 'scripts/keyboardNavigation';
import { getErrorText } from 'utils/piratefin';
import { type YouTubeVideo, formatDuration, saveYouTubeProgress, startYouTubeStream } from 'utils/youtube';

const PROGRESS_INTERVAL_MS = 10000;
const HIDE_CONTROLS_MS = 3000;
const SEEK_SECONDS = 10;

interface FullscreenDocument extends Document {
    fullscreenEnabled: boolean;
    webkitFullscreenElement?: Element | null;
    webkitFullscreenEnabled?: boolean;
    webkitExitFullscreen?: () => void;
}

interface FullscreenElement extends HTMLElement {
    webkitRequestFullscreen?: () => void;
}

interface IosVideo extends HTMLVideoElement {
    webkitEnterFullscreen?: () => void;
}

const fullscreenDocument = document as FullscreenDocument;

const getFullscreenElement = () => fullscreenDocument.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null;

/** Plays a stream's HLS playlist: natively where the browser can (Safari, iOS), otherwise with hls.js. */
async function attachStream(video: HTMLVideoElement, url: string, startSeconds: number): Promise<Hls | null> {
    const { default: HlsPlayer } = await import('hls.js/dist/hls.js');
    if (HlsPlayer.isSupported()) {
        // The playlist grows while ffmpeg copies the video; start at the beginning (or the resume point), not the end.
        const hls = new HlsPlayer({ startPosition: startSeconds, liveDurationInfinity: false });
        hls.loadSource(url);
        hls.attachMedia(video);
        return hls;
    }

    video.src = url;
    if (startSeconds > 0) {
        video.addEventListener('loadedmetadata', () => {
            video.currentTime = startSeconds;
        }, { once: true });
    }
    return null;
}

/**
 * The YouTube player, in PirateFin's look: red progress bar, the player's icons, controls that fade out while
 * playing, and full screen. Starts streaming when the page opens, resumes where the user left off and saves progress.
 * TVs: only the seek bar and the buttons can be selected (focus starts on Play); while the controls are faded the first
 * press only brings them back. Media keys always act.
 */
const YouTubePlayer: FC<{ video: YouTubeVideo }> = ({ video }) => {
    const { __legacyApiClient__: apiClient } = useApi();
    const container = useRef<HTMLDivElement>(null);
    const media = useRef<HTMLVideoElement>(null);
    const playButton = useRef<HTMLButtonElement>(null);
    const hideTimer = useRef<number>();
    const dragging = useRef(false);

    const [ state, setState ] = useState<'starting' | 'playing' | 'error'>('starting');
    const [ error, setError ] = useState('');
    const [ attempt, setAttempt ] = useState(0);
    const [ paused, setPaused ] = useState(true);
    const [ waiting, setWaiting ] = useState(false);
    const [ time, setTime ] = useState(0);
    const [ buffered, setBuffered ] = useState(0);
    const [ muted, setMuted ] = useState(false);
    const [ volume, setVolume ] = useState(1);
    const [ controlsShown, setControlsShown ] = useState(true);
    const [ fullscreen, setFullscreen ] = useState(false);

    const getDuration = useCallback(() => {
        const element = media.current;
        return video.DurationSeconds || (element && Number.isFinite(element.duration) ? element.duration : 0);
    }, [ video.DurationSeconds ]);
    const duration = getDuration();

    const canFullscreen = !!(fullscreenDocument.fullscreenEnabled || fullscreenDocument.webkitFullscreenEnabled
        || (media.current as IosVideo | null)?.webkitEnterFullscreen);

    // Controls show on any activity and fade out after a few seconds of playing.
    const showControls = useCallback(() => {
        setControlsShown(true);
        window.clearTimeout(hideTimer.current);
        hideTimer.current = window.setTimeout(() => {
            if (media.current && !media.current.paused && !dragging.current) {
                setControlsShown(false);
            }
        }, HIDE_CONTROLS_MS);
    }, []);

    useEffect(() => () => window.clearTimeout(hideTimer.current), []);

    const saveProgress = useCallback((ended = false) => {
        const element = media.current;
        if (!apiClient || !element || state !== 'playing') return;
        const total = getDuration();
        const position = ended ? total : element.currentTime;
        if (position > 0 && total > 0) {
            saveYouTubeProgress(apiClient, video.Id, position, total)
                .catch(err => console.error('[PirateFin] saving YouTube progress failed', err));
        }
    }, [ apiClient, getDuration, state, video.Id ]);

    // Start the stream.
    useEffect(() => {
        const element = media.current;
        if (!apiClient || !element) return;
        let cancelled = false;
        let hls: Hls | null = null;
        const resume = !video.Watched && video.PositionSeconds > 10 ? video.PositionSeconds : 0;

        setState('starting');
        startYouTubeStream(apiClient, video.Id)
            .then(url => attachStream(element, url, resume))
            .then(player => {
                hls = player;
                if (cancelled) {
                    hls?.destroy();
                    return;
                }
                setState('playing');
                if (!layoutManager.tv) container.current?.focus();
                element.play().catch(() => { /* autoplay blocked: the play button is there */ });
            })
            .catch(async err => {
                if (!cancelled) {
                    setError(await getErrorText(err) || 'The video couldn\'t be started.');
                    setState('error');
                }
            });

        return () => {
            cancelled = true;
            hls?.destroy();
            element.removeAttribute('src');
            element.load();
        };
    }, [ apiClient, attempt, video.Id, video.PositionSeconds, video.Watched ]);

    // TVs: start on Play.
    useEffect(() => {
        if (state === 'playing' && layoutManager.tv && playButton.current) {
            focusManager.focus(playButton.current);
        }
    }, [ state ]);

    // TVs: selecting anything in the player scrolls the page back to the top, so the header, the search bar and the
    // whole player are in view (instead of centring the selected button). Runs after the TV layout's own scrolling.
    useEffect(() => {
        const element = container.current;
        if (!element || !layoutManager.tv) return;
        const onFocus = () => {
            setTimeout(() => scrollManager.scrollTo(0, 0, false), 0);
        };
        element.addEventListener('focusin', onFocus);
        return () => element.removeEventListener('focusin', onFocus);
    }, []);

    // TVs: the remote moves along the controls row, Down from the seek bar goes to Play and Up from the row to the
    // seek bar (rather than whatever is nearest on the page).
    useEffect(() => {
        const element = container.current;
        if (!element || !layoutManager.tv) return;
        const onKeyDown = (e: globalThis.KeyboardEvent) => {
            // While the controls are faded the first press only brings them back (handled below).
            if (element.classList.contains('ytPlayer-idle')) return;
            const key = getKeyName(e);
            const target = e.target as HTMLElement;
            let next: HTMLElement | null | undefined;
            if (target.classList.contains('ytSeek') && key === 'ArrowDown') {
                next = playButton.current;
            } else if (target.classList.contains('ytControl')) {
                const buttons = Array.from(element.querySelectorAll<HTMLElement>('.ytControlRow .ytControl'));
                const index = buttons.indexOf(target);
                if (key === 'ArrowRight' || key === 'ArrowLeft') {
                    // Stay in the row at either end.
                    next = buttons[index + (key === 'ArrowRight' ? 1 : -1)] ?? target;
                } else if (key === 'ArrowUp') {
                    next = element.querySelector<HTMLElement>('.ytSeek');
                }
            }
            if (next) {
                e.preventDefault();
                e.stopPropagation();
                if (next !== target) focusManager.focus(next);
            }
        };
        element.addEventListener('keydown', onKeyDown);
        return () => element.removeEventListener('keydown', onKeyDown);
    }, [ state ]);

    // Follow the video's state.
    useEffect(() => {
        const element = media.current;
        if (!element) return;
        const onPlay = () => {
            setPaused(false);
            showControls();
        };
        const onPause = () => {
            setPaused(true);
            setControlsShown(true);
        };
        const onTime = () => {
            if (!dragging.current) setTime(element.currentTime);
            const ranges = element.buffered;
            setBuffered(ranges.length ? ranges.end(ranges.length - 1) : 0);
        };
        const onWaiting = () => setWaiting(true);
        const onPlaying = () => setWaiting(false);
        const onVolume = () => {
            setMuted(element.muted);
            setVolume(element.volume);
        };
        const events: [string, () => void][] = [
            [ 'play', onPlay ], [ 'pause', onPause ], [ 'timeupdate', onTime ], [ 'progress', onTime ],
            [ 'waiting', onWaiting ], [ 'playing', onPlaying ], [ 'volumechange', onVolume ]
        ];
        for (const [ name, handler ] of events) {
            element.addEventListener(name, handler);
        }
        return () => {
            for (const [ name, handler ] of events) {
                element.removeEventListener(name, handler);
            }
        };
    }, [ showControls ]);

    // Save progress while playing, on pause, at the end and when leaving.
    useEffect(() => {
        const element = media.current;
        if (!element || state !== 'playing') return;
        const timer = setInterval(() => {
            if (!element.paused) saveProgress();
        }, PROGRESS_INTERVAL_MS);
        const onPause = () => saveProgress();
        const onEnded = () => saveProgress(true);
        element.addEventListener('pause', onPause);
        element.addEventListener('ended', onEnded);
        return () => {
            clearInterval(timer);
            element.removeEventListener('pause', onPause);
            element.removeEventListener('ended', onEnded);
            if (!element.ended) saveProgress();
        };
    }, [ saveProgress, state ]);

    useEffect(() => {
        const onChange = () => setFullscreen(getFullscreenElement() === container.current);
        document.addEventListener('fullscreenchange', onChange);
        document.addEventListener('webkitfullscreenchange', onChange);
        return () => {
            document.removeEventListener('fullscreenchange', onChange);
            document.removeEventListener('webkitfullscreenchange', onChange);
        };
    }, []);

    const togglePlay = useCallback(() => {
        const element = media.current;
        if (!element || state !== 'playing') return;
        if (element.paused) {
            void element.play();
        } else {
            element.pause();
        }
        showControls();
    }, [ showControls, state ]);

    const seekBy = useCallback((seconds: number) => {
        const element = media.current;
        if (!element) return;
        const total = getDuration();
        element.currentTime = Math.max(0, Math.min(total || Infinity, element.currentTime + seconds));
        setTime(element.currentTime);
        showControls();
    }, [ getDuration, showControls ]);

    const onRewind = useCallback(() => seekBy(-SEEK_SECONDS), [ seekBy ]);
    const onForward = useCallback(() => seekBy(SEEK_SECONDS), [ seekBy ]);

    const toggleMute = useCallback(() => {
        if (media.current) media.current.muted = !media.current.muted;
    }, []);

    const onVolumeChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const element = media.current;
        if (!element) return;
        element.volume = Number(e.target.value);
        element.muted = element.volume === 0;
    }, []);

    const toggleFullscreen = useCallback(() => {
        const element = container.current as FullscreenElement | null;
        if (!element) return;
        if (getFullscreenElement()) {
            if (document.exitFullscreen) {
                void document.exitFullscreen();
            } else {
                fullscreenDocument.webkitExitFullscreen?.();
            }
        } else if (element.requestFullscreen) {
            void element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else {
            (media.current as IosVideo | null)?.webkitEnterFullscreen?.();
        }
    }, []);

    // Clicking the picture plays / pauses (on phones the first tap shows the controls); double click is full screen.
    useEffect(() => {
        const element = media.current;
        if (!element) return;
        const onClick = () => {
            if (layoutManager.mobile && !controlsShown) {
                showControls();
            } else {
                togglePlay();
            }
        };
        element.addEventListener('click', onClick);
        element.addEventListener('dblclick', toggleFullscreen);
        return () => {
            element.removeEventListener('click', onClick);
            element.removeEventListener('dblclick', toggleFullscreen);
        };
    }, [ controlsShown, showControls, toggleFullscreen, togglePlay ]);

    // Remote and keyboard while the player itself has focus (buttons keep their normal behaviour).
    useEffect(() => {
        const element = container.current;
        if (!element) return;
        const onKeyDown = (e: globalThis.KeyboardEvent) => {
            const key = getKeyName(e);
            const onPlayer = e.target === element;
            const isMediaKey = key.startsWith('Media');
            if (layoutManager.tv && !controlsShown && !isMediaKey) {
                // The first press only brings the controls back.
                showControls();
            } else if (key === 'MediaPlayPause' || key === 'MediaPlay' || key === 'MediaPause') {
                togglePlay();
            } else if (key === 'MediaFastForward') {
                seekBy(SEEK_SECONDS);
            } else if (key === 'MediaRewind') {
                seekBy(-SEEK_SECONDS);
            } else if (onPlayer && (key === 'Enter' || key === 'Space' || key === ' ')) {
                togglePlay();
            } else if (onPlayer && key === 'ArrowRight') {
                seekBy(SEEK_SECONDS);
            } else if (onPlayer && key === 'ArrowLeft') {
                seekBy(-SEEK_SECONDS);
            } else if (onPlayer && (key === 'ArrowUp' || key === 'ArrowDown') && !controlsShown) {
                showControls();
                playButton.current?.focus();
            } else {
                showControls();
                return;
            }
            e.preventDefault();
            e.stopPropagation();
        };
        const onActivity = () => showControls();
        // Browsers: focusable for the keyboard (set here: the lint rules only allow tabIndex on controls). TVs: only
        // the controls can be selected.
        if (!layoutManager.tv) element.tabIndex = 0;
        element.addEventListener('keydown', onKeyDown);
        element.addEventListener('pointermove', onActivity);
        return () => {
            element.removeEventListener('keydown', onKeyDown);
            element.removeEventListener('pointermove', onActivity);
        };
    }, [ controlsShown, seekBy, showControls, togglePlay ]);

    // The progress bar: click or drag to seek; left / right when it has focus.
    const seekToPointer = useCallback((e: PointerEvent<HTMLDivElement>) => {
        const total = getDuration();
        if (!total) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        setTime(fraction * total);
        return fraction * total;
    }, [ getDuration ]);

    const onBarDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        seekToPointer(e);
        showControls();
    }, [ seekToPointer, showControls ]);

    const onBarMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
        if (dragging.current) seekToPointer(e);
    }, [ seekToPointer ]);

    const onBarUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
        if (!dragging.current) return;
        dragging.current = false;
        const target = seekToPointer(e);
        if (target !== undefined && media.current) media.current.currentTime = target;
        showControls();
    }, [ seekToPointer, showControls ]);

    const onBarKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
        const key = getKeyName(e.nativeEvent);
        if (key === 'ArrowRight' || key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            seekBy(key === 'ArrowRight' ? SEEK_SECONDS : -SEEK_SECONDS);
        } else if (key === 'Enter') {
            e.preventDefault();
            togglePlay();
        }
    }, [ seekBy, togglePlay ]);

    const onRetry = useCallback(() => {
        setError('');
        setAttempt(count => count + 1);
    }, []);

    const played = duration ? Math.min(100, (time / duration) * 100) : 0;
    const loaded = duration ? Math.min(100, (buffered / duration) * 100) : 0;
    const hidden = state === 'playing' && !paused && !controlsShown;

    return (
        <div
            ref={container}
            className={`ytPlayer${hidden ? ' ytPlayer-idle' : ''}${fullscreen ? ' ytPlayer-fullscreen' : ''}`}
            role='group'
            aria-label='Video player'
        >
            <video ref={media} playsInline poster={video.ThumbnailUrl ?? undefined}>
                <track kind='captions' />
            </video>

            {(state === 'starting' || (waiting && state === 'playing')) && <div className='ytSpinner' aria-label='Loading' />}

            {state === 'error' && (
                <div className='ytPlayerOverlay'>
                    <span>{error}</span>
                    <Button type='button' className='raised button-submit' onClick={onRetry} title='Try again' />
                </div>
            )}

            {state === 'playing' && (
                <div className='ytControls'>
                    <div
                        className='ytSeek focusable'
                        role='slider'
                        tabIndex={0}
                        aria-label='Seek'
                        aria-valuemin={0}
                        aria-valuemax={Math.round(duration)}
                        aria-valuenow={Math.round(time)}
                        aria-valuetext={formatDuration(time)}
                        onPointerDown={onBarDown}
                        onPointerMove={onBarMove}
                        onPointerUp={onBarUp}
                        onKeyDown={onBarKeyDown}
                    >
                        <div className='ytSeekTrack'>
                            <div className='ytSeekBuffered' style={{ width: `${loaded}%` }} />
                            <div className='ytSeekPlayed' style={{ width: `${played}%` }} />
                            <div className='ytSeekKnob' style={{ left: `${played}%` }} />
                        </div>
                    </div>
                    <div className='ytControlRow'>
                        <button ref={playButton} type='button' className='ytControl focusable' onClick={togglePlay} aria-label={paused ? 'Play' : 'Pause'}>
                            <span className={`material-icons ${paused ? 'play_arrow' : 'pause'}`} aria-hidden='true' />
                        </button>
                        <button type='button' className='ytControl focusable' onClick={onRewind} aria-label='Back 10 seconds'>
                            <span className='material-icons replay_10' aria-hidden='true' />
                        </button>
                        <button type='button' className='ytControl focusable' onClick={onForward} aria-label='Forward 10 seconds'>
                            <span className='material-icons forward_10' aria-hidden='true' />
                        </button>
                        {/* TVs use the remote's own volume keys. */}
                        {!layoutManager.tv && (
                            <button type='button' className='ytControl focusable' onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
                                <span className={`material-icons ${muted || volume === 0 ? 'volume_off' : 'volume_up'}`} aria-hidden='true' />
                            </button>
                        )}
                        {!layoutManager.tv && !layoutManager.mobile && (
                            <input
                                className='ytVolume'
                                type='range'
                                min={0}
                                max={1}
                                step={0.05}
                                value={muted ? 0 : volume}
                                onChange={onVolumeChange}
                                aria-label='Volume'
                            />
                        )}
                        <span className='ytTime'>{formatDuration(time)} / {formatDuration(duration)}</span>
                        <span className='ytControlSpacer' />
                        {canFullscreen && (
                            <button type='button' className='ytControl focusable' onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
                                <span className={`material-icons ${fullscreen ? 'fullscreen_exit' : 'fullscreen'}`} aria-hidden='true' />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default YouTubePlayer;
