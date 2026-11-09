import serverNotifications from 'scripts/serverNotifications';
import Events from 'utils/events';
import { getDownloadStatus } from 'utils/piratefin';

/** While the WebSocket isn't connected, the status is fetched this often instead. */
const FALLBACK_POLL_MS = 10000;

const sameId = (a, b) => String(a).replace(/-/g, '').toLowerCase() === String(b).replace(/-/g, '').toLowerCase();

/**
 * Follows an episode or movie's download until it's playable (or, for the player, until it's fully downloaded). The server pushes its status over the WebSocket the
 * app already has open, only to the pages following the item and only when it changes; it answers straight away when
 * asked. Without a connection the status is fetched every 10 s; on reconnecting the page asks again.
 */
export class DownloadWatcher {
    /**
     * @param {Object} apiClient The api client.
     * @param {string} itemId The episode or movie.
     * @param {function(Object): void} onStatus Gets each status (a DownloadProgressInfo).
     * @param {Object} [options] Options.
     * @param {boolean} [options.untilDownloaded] Keep following once it's playable, until the whole file is there.
     */
    constructor(apiClient, itemId, onStatus, options = {}) {
        this.apiClient = apiClient;
        this.itemId = itemId;
        this.onStatus = onStatus;
        this.untilDownloaded = !!options.untilDownloaded;
        this.timer = null;
        this.stopped = true;

        this.onPush = (_e, _apiClient, status) => {
            if (status && sameId(status.ItemId, this.itemId)) {
                this.deliver(status);
            }
        };
        this.onOpen = () => this.subscribe();
        this.onFallback = () => {
            if (!this.apiClient.isMessageChannelOpen()) {
                this.fetch();
            }
        };
    }

    start() {
        this.stopped = false;
        Events.on(serverNotifications, 'PirateFinDownloadProgress', this.onPush);
        Events.on(this.apiClient, 'websocketopen', this.onOpen);
        this.timer = setInterval(this.onFallback, FALLBACK_POLL_MS);
        if (this.apiClient.isMessageChannelOpen()) {
            this.subscribe();
        } else {
            this.fetch();
        }
    }

    subscribe() {
        if (!this.stopped) {
            this.apiClient.sendMessage(this.untilDownloaded ? 'PirateFinDownloadFollow' : 'PirateFinDownloadStart', this.itemId);
        }
    }

    async fetch() {
        const status = await getDownloadStatus(this.apiClient, this.itemId);
        if (!this.stopped) {
            this.deliver(status);
        }
    }

    deliver(status) {
        this.onStatus(status);
        if (this.untilDownloaded ? status.Downloaded : status.Playable) {
            // The server stops sending then; nothing to say goodbye to.
            this.detach();
        }
    }

    stop() {
        if (!this.stopped) {
            this.apiClient.sendMessage('PirateFinDownloadStop', this.itemId);
            this.detach();
        }
    }

    detach() {
        this.stopped = true;
        clearInterval(this.timer);
        this.timer = null;
        Events.off(serverNotifications, 'PirateFinDownloadProgress', this.onPush);
        Events.off(this.apiClient, 'websocketopen', this.onOpen);
    }
}
