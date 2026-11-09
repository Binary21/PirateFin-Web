import TabbedView from '../components/tabbedview/tabbedview';
import * as mainTabsManager from '../components/maintabsmanager';
import globalize from '../lib/globalize';
import { ServerConnections } from '../lib/jellyfin-apiclient';
import '../elements/emby-tabs/emby-tabs';
import '../elements/emby-button/emby-button';
import '../elements/emby-scroller/emby-scroller';
import LibraryMenu from '../scripts/libraryMenu';
import { rememberHomeTab } from '../utils/piratefin';
import { getYouTubeStatus } from '../utils/youtube';

/** The library of each tab, by tab index. */
const TAB_LIBRARIES = ['Movies', 'Shows', 'Anime'];

/** The YouTube tab: shown when an admin turned YouTube on. */
const YOUTUBE_TAB = 3;

/** Promise that never settles: stops a tab from loading while another one is selected instead. */
const NEVER = new Promise(() => { /* never settles */ });

class HomeView extends TabbedView {
    setTitle() {
        LibraryMenu.setTitle(null);
    }

    onPause() {
        super.onPause(this);
        document.querySelector('.skinHeader').classList.remove('noHomeButtonHeader');
    }

    onResume(options) {
        super.onResume(this, options);
        document.querySelector('.skinHeader').classList.add('noHomeButtonHeader');

        // Access can change while the page is cached (an admin edits the user): check again each time it's shown.
        this.accessPromise = null;
        this.getAccessibleTabs()
            .then(accessible => this.applyAccess(accessible))
            .catch(err => console.error('[PirateFin] failed to check library access', err));
    }

    /** The indexes of the tabs whose library the user can open. */
    getAccessibleTabs() {
        if (!this.accessPromise) {
            const apiClient = ServerConnections.currentApiClient();
            const youTube = getYouTubeStatus(apiClient).then(status => status.Enabled).catch(() => false);
            this.accessPromise = Promise.all([apiClient.getUserViews({}, apiClient.getCurrentUserId()), youTube]).then(([result, youTubeEnabled]) => {
                const names = new Set((result.Items || []).map(view => (view.Name || '').toLowerCase()));
                const tabs = TAB_LIBRARIES
                    .map((library, index) => (names.has(library.toLowerCase()) ? index : -1))
                    .filter(index => index >= 0);
                return youTubeEnabled ? tabs.concat(YOUTUBE_TAB) : tabs;
            });
        }
        return this.accessPromise;
    }

    /** Hides the tabs of libraries the user can't open (the others stay centred); with none, a message instead. */
    applyAccess(accessible) {
        const tabs = mainTabsManager.getTabsElement();
        for (const button of tabs?.querySelectorAll('.emby-tab-button') || []) {
            button.classList.toggle('hide', !accessible.includes(parseInt(button.getAttribute('data-index'), 10)));
        }

        const none = accessible.length === 0;
        tabs?.classList.toggle('hide', none);
        for (const content of this.view.querySelectorAll('.tabContent')) {
            content.classList.toggle('pfNoAccess', none);
        }

        let message = this.view.querySelector('.pfNoLibraries');
        if (none && !message) {
            message = document.createElement('div');
            message.className = 'pfNoLibraries padded-left padded-right';
            message.innerHTML = '<h1>Nothing to watch yet</h1><p>You don\'t have access to any libraries yet. Ask your admin to give you access to Movies, Shows or Anime.</p>';
            this.view.appendChild(message);
        }
        message?.classList.toggle('hide', !none);
    }

    /** Only tabs the user has access to load; asking for another one selects the first they do have. */
    validateTabLoad(index) {
        return this.getAccessibleTabs().then(accessible => {
            this.applyAccess(accessible);
            if (accessible.includes(index)) {
                return undefined;
            }

            if (accessible.length) {
                mainTabsManager.selectedTabIndex(accessible[0]);
            }
            return NEVER;
        });
    }

    getDefaultTabIndex() {
        return 0;
    }

    getTabs() {
        return [{
            name: globalize.translate('Movies')
        }, {
            name: globalize.translate('Shows')
        }, {
            name: globalize.translate('Anime')
        }, {
            name: 'YouTube'
        }];
    }

    getTabController(index) {
        if (index == null) {
            throw new Error('index cannot be null');
        }

        // The header's Home button comes back to this tab.
        rememberHomeTab(index);

        let depends = '';

        switch (index) {
            case 0:
                depends = 'moviestab';
                break;

            case 1:
                depends = 'showstab';
                break;

            case 2:
                depends = 'animetab';
                break;

            case 3:
                depends = 'youtubetab';
                break;
        }

        const instance = this;
        return import(/* webpackChunkName: "[request]" */ `../controllers/${depends}`).then(({ default: ControllerFactory }) => {
            let controller = instance.tabControllers[index];

            if (!controller) {
                controller = new ControllerFactory(instance.view.querySelector(".tabContent[data-index='" + index + "']"), instance.params);
                instance.tabControllers[index] = controller;
            }

            return controller;
        });
    }
}

export default HomeView;
