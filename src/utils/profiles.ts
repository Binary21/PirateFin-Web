/**
 * PirateFin profiles: every user who signs in on this browser is remembered (with their access token) so they can
 * be switched to from the profile picker without signing in again, also after the app is restarted.
 */

const STORAGE_KEY = 'piratefin_profiles';
const CHOSEN_KEY = 'piratefin_profile_chosen';

/** A remembered, signed in profile. */
export interface SavedProfile {
    ServerId: string;
    ServerAddress: string;
    UserId: string;
    Name: string;
    AccessToken: string;
    PrimaryImageTag?: string | null;
    LastUsed: number;
}

interface SignedInUser {
    Id?: string | null;
    Name?: string | null;
    ServerId?: string | null;
    PrimaryImageTag?: string | null;
}

interface AuthenticatedClient {
    accessToken(): string;
    serverAddress(): string;
    serverId(): string;
}

function read(): SavedProfile[] {
    try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function write(profiles: SavedProfile[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch (err) {
        console.error('[Profiles] could not save profiles', err);
    }
}

/** The remembered profiles, most recently used first. */
export function getProfiles(): SavedProfile[] {
    return read().sort((a, b) => b.LastUsed - a.LastUsed);
}

/** Remembers (or refreshes) the user that just signed in. */
export function rememberProfile(user: SignedInUser, apiClient: AuthenticatedClient) {
    const token = apiClient.accessToken();
    if (!user.Id || !token) {
        return;
    }

    const profiles = read().filter(p => !(p.UserId === user.Id && p.ServerId === apiClient.serverId()));
    profiles.push({
        ServerId: apiClient.serverId(),
        ServerAddress: apiClient.serverAddress(),
        UserId: user.Id,
        Name: user.Name || 'Profile',
        AccessToken: token,
        PrimaryImageTag: user.PrimaryImageTag,
        LastUsed: Date.now()
    });
    write(profiles);
}

/** Forgets a profile (the user stays signed in on the server until their session expires or is revoked). */
export function forgetProfile(serverId: string, userId: string) {
    write(read().filter(p => !(p.UserId === userId && p.ServerId === serverId)));
}

/** Whether a profile was picked since the app was opened (the picker is shown once per launch). */
export function isProfileChosen(): boolean {
    try {
        return sessionStorage.getItem(CHOSEN_KEY) === 'true';
    } catch {
        return true;
    }
}

/** Marks that a profile was picked for this launch. */
export function markProfileChosen() {
    try {
        sessionStorage.setItem(CHOSEN_KEY, 'true');
    } catch {
        // Private browsing: the picker is simply shown again.
    }
}

/** The url of a profile's avatar, or undefined when it has none. */
export function getProfileImageUrl(profile: SavedProfile): string | undefined {
    return profile.PrimaryImageTag ?
        `${profile.ServerAddress}/Users/${profile.UserId}/Images/Primary?tag=${profile.PrimaryImageTag}&quality=90&maxWidth=200` :
        undefined;
}

/** Updates a remembered profile's avatar, e.g. after its icon was changed. */
export function updateProfileImageTag(serverId: string, userId: string, imageTag: string | null | undefined) {
    const profiles = read();
    const profile = profiles.find(p => p.UserId === userId && p.ServerId === serverId);
    if (profile && profile.PrimaryImageTag !== imageTag) {
        profile.PrimaryImageTag = imageTag;
        write(profiles);
    }
}

/**
 * Fetches the current avatar of every remembered profile (it may have been changed on another device, or the
 * server gave it its default icon after it was remembered). Resolves with the updated profiles.
 */
export async function refreshProfileImages(): Promise<SavedProfile[]> {
    await Promise.all(read().map(async profile => {
        try {
            const response = await fetch(`${profile.ServerAddress}/Users/Me`, {
                headers: { Authorization: `MediaBrowser Token="${profile.AccessToken}"` },
                cache: 'no-cache'
            });
            if (response.ok) {
                const user: SignedInUser = await response.json();
                updateProfileImageTag(profile.ServerId, profile.UserId, user.PrimaryImageTag);
            }
        } catch {
            // Server unreachable: keep the avatar we have.
        }
    }));

    return getProfiles();
}

/** Checks the profile's token is still accepted by the server. */
export async function isProfileValid(profile: SavedProfile): Promise<boolean> {
    try {
        const response = await fetch(`${profile.ServerAddress}/Users/Me`, {
            headers: { Authorization: `MediaBrowser Token="${profile.AccessToken}"` },
            cache: 'no-cache'
        });
        return response.ok;
    } catch {
        // Server unreachable: let the normal connection flow report it.
        return true;
    }
}
