import './downloadWait.scss';

let overlay: HTMLElement | null = null;

/**
 * Shows (or updates) "Waiting for the download" over the player held at the downloaded edge.
 * @param detail The second line, e.g. how much is downloaded.
 */
export function showDownloadWait(detail: string): void {
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'pfDownloadWait';
        overlay.setAttribute('role', 'status');
        overlay.innerHTML = `
            <div class="pfDownloadWait-title">
                <span class="material-icons autorenew" aria-hidden="true"></span>
                <span>Waiting for the download</span>
            </div>
            <div class="pfDownloadWait-detail"></div>`;
        document.body.appendChild(overlay);
    }

    overlay.querySelector('.pfDownloadWait-detail')!.textContent = detail;
}

/** Removes the overlay. */
export function hideDownloadWait(): void {
    overlay?.remove();
    overlay = null;
}
