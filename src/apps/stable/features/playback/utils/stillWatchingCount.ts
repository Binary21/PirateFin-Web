/** Episodes in a row without a button press before asking. */
export const MAX_EPISODES_IN_A_ROW = 3;

/** Time without a button press before asking (at the start of the next episode). */
export const IDLE_MS = 90 * 60 * 1000;

let episodesInARow = 0;
let lastInteraction = Date.now();
let listening = false;

/** Someone pressed a button, clicked or touched: they're watching. */
export function noteInteraction(now = Date.now()) {
    episodesInARow = 0;
    lastInteraction = now;
}

function listen() {
    if (listening) {
        return;
    }
    listening = true;
    const onInput = () => noteInteraction();
    document.addEventListener('keydown', onInput, true);
    document.addEventListener('pointerdown', onInput, true);
    document.addEventListener('touchstart', onInput, { capture: true, passive: true });
}

/**
 * Counts an episode starting and tells whether to ask "Are you still watching?" first: after
 * {@link MAX_EPISODES_IN_A_ROW} episodes in a row, or {@link IDLE_MS}, without anyone touching the controls.
 * @param itemType The type of what's starting; only episodes count.
 * @param now The current time.
 * @returns True to ask before this episode plays on.
 */
export function shouldAskStillWatching(itemType: string | null | undefined, now = Date.now()): boolean {
    listen();
    if (itemType !== 'Episode') {
        episodesInARow = 0;
        return false;
    }

    episodesInARow++;
    return episodesInARow > MAX_EPISODES_IN_A_ROW || now - lastInteraction >= IDLE_MS;
}
