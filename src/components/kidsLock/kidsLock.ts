import ProfilePinDialog from 'apps/stable/routes/session/profiles/ProfilePinDialog';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';
import { getProfileSettings } from 'utils/piratefin';
import type { SavedProfile } from 'utils/profiles';
import { renderComponent } from 'utils/reactUtils';

import 'apps/stable/routes/session/profiles/profiles.scss';

/**
 * The pages a kids profile is left through: "Who's watching?" (also shown when the app starts), the settings and the
 * pages they lead to, and changing servers.
 */
const LEAVING_PAGES = /^\/(profiles|mypreferences\w*|userprofile|changepassword|quickconnect|profileicon|iconpacks?|selectserver|addserver)$/i;

// Unlocked while those pages are shown, so moving between settings pages doesn't ask again; showing any other page
// locks it again.
let unlocked = false;

function getCurrentPath(): string {
    return window.location.hash.replace(/^#!?/, '').split('?')[0].toLowerCase();
}

/** Whether the signed in profile is a kids profile with a PIN (one without a PIN can be left until it gets one). */
async function isLocked(): Promise<boolean> {
    const apiClient = ServerConnections.currentApiClient();
    const userId = apiClient?.getCurrentUserId();
    if (!apiClient || !userId) {
        return false;
    }

    try {
        const profile = await getProfileSettings(apiClient, userId);
        return profile.IsKids && profile.HasPin;
    } catch (err) {
        console.error('[PirateFin] could not check the kids profile lock', err);
        return false;
    }
}

function askForPin(): Promise<boolean> {
    const apiClient = ServerConnections.currentApiClient();
    const userId = apiClient?.getCurrentUserId();
    const token = apiClient?.accessToken();
    if (!apiClient || !userId || !token) {
        return Promise.resolve(false);
    }

    const profile: SavedProfile = {
        ServerId: apiClient.serverId(),
        ServerAddress: apiClient.serverAddress(),
        UserId: userId,
        Name: '',
        AccessToken: token,
        LastUsed: 0
    };

    return new Promise(resolve => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const dialog: { unmount?: () => void } = {};
        const close = (result: boolean) => {
            dialog.unmount?.();
            host.remove();
            resolve(result);
        };

        dialog.unmount = renderComponent(ProfilePinDialog, {
            profile,
            title: 'Enter the PIN to leave the kids profile',
            onUnlocked: () => close(true),
            onCancel: () => close(false)
        }, host);
    });
}

/**
 * Leaving a kids profile (Switch Profile, Settings, Exit) needs its PIN: asks for it when the signed in profile is a
 * kids profile with a PIN.
 * @returns Whether the profile may be left.
 */
export async function askToLeaveKidsProfile(): Promise<boolean> {
    if (unlocked || !await isLocked()) {
        return true;
    }

    unlocked = await askForPin();
    return unlocked;
}

// Every page shown: other pages lock again; the leaving pages ask (also when reached by address or at app start), and
// without the PIN go back home.
document.addEventListener('viewshow', () => {
    if (!LEAVING_PAGES.test(getCurrentPath())) {
        unlocked = false;
        return;
    }

    askToLeaveKidsProfile().then(allowed => {
        if (!allowed) {
            window.location.hash = '#/home';
        }
    }).catch(err => console.error('[PirateFin] kids profile lock failed', err));
}, true);
