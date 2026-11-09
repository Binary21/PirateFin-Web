import focusManager from 'components/focusManager';
import { getKeyName } from 'scripts/keyboardNavigation';

import { noteInteraction } from './stillWatchingCount';

import 'styles/piratefin.scss';
import './stillWatching.scss';

export { IDLE_MS, MAX_EPISODES_IN_A_ROW, noteInteraction, shouldAskStillWatching } from './stillWatchingCount';

/**
 * Shows "Are you still watching?" over the paused player.
 * @param title What's playing, e.g. the series name.
 * @returns True to keep watching, false to stop.
 */
export function askStillWatching(title: string): Promise<boolean> {
    return new Promise(resolve => {
        const dialog = document.createElement('div');
        dialog.className = 'pfStillWatching';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.innerHTML = `
            <div class="pfStillWatching-panel">
                <h2 class="pfStillWatching-title"></h2>
                <div class="pfStillWatching-buttons">
                    <button type="button" class="pfButton pfButton-primary pfStillWatching-continue">Continue Watching</button>
                    <button type="button" class="pfButton pfButton-secondary pfStillWatching-stop">Stop</button>
                </div>
            </div>`;
        dialog.querySelector('.pfStillWatching-title')!.textContent = title ? `Are you still watching ${title}?` : 'Are you still watching?';
        document.body.appendChild(dialog);

        const continueButton = dialog.querySelector<HTMLElement>('.pfStillWatching-continue')!;
        const stopButton = dialog.querySelector<HTMLElement>('.pfStillWatching-stop')!;
        const close = (keepWatching: boolean) => {
            dialog.remove();
            noteInteraction();
            resolve(keepWatching);
        };

        continueButton.addEventListener('click', () => close(true));
        stopButton.addEventListener('click', () => close(false));

        // Arrow keys stay on the two buttons (the player behind mustn't react).
        dialog.addEventListener('keydown', e => {
            const key = getKeyName(e);
            if (key === 'ArrowLeft' || key === 'ArrowUp') {
                focusManager.focus(continueButton);
            } else if (key === 'ArrowRight' || key === 'ArrowDown') {
                focusManager.focus(stopButton);
            } else {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
        });

        focusManager.focus(continueButton);
    });
}
