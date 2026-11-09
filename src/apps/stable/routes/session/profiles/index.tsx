import React, { type FC, type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import actionSheet from 'components/actionSheet/actionSheet';
import focusManager from 'components/focusManager';
import layoutManager from 'components/layoutManager';
import loading from 'components/loading/loading';
import Page from 'components/Page';
import { getPirateFinLogoSvg } from 'components/piratefinLogo';
import toast from 'components/toast/toast';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';
import { getKeyName } from 'scripts/keyboardNavigation';
import appSettings from 'scripts/settings/appSettings';
import {
    forgetProfile,
    getProfileImageUrl,
    getProfiles,
    isProfileValid,
    markProfileChosen,
    refreshProfileImages,
    type SavedProfile
} from 'utils/profiles';

import ChangePinDialog from './ChangePinDialog';
import ProfilePinDialog, { getProfileLock, type ProfileLock } from './ProfilePinDialog';

import './profiles.scss';

const AVATAR_COLORS = [ '#e50914', '#2c7be5', '#00a86b', '#f5a623', '#8e44ad', '#16a085' ];

const getAvatarColor = (name: string) => AVATAR_COLORS[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

/** Makes the profile the signed in user on its server and reloads into the home page. */
const switchToProfile = (profile: SavedProfile) => {
    const credentialProvider = ServerConnections.credentialProvider();
    const credentials = credentialProvider.credentials();
    const server = credentials.Servers.find((s: { Id: string }) => s.Id === profile.ServerId);
    if (server) {
        server.AccessToken = profile.AccessToken;
        server.UserId = profile.UserId;
        credentialProvider.addOrUpdateServer(credentials.Servers, server);
        credentialProvider.credentials(credentials);
    }

    // A remembered profile always signs in automatically.
    appSettings.enableAutoLogin(true);
    markProfileChosen();

    // Reload so every cached query, websocket and setting belongs to the new profile.
    window.location.hash = '#/home';
    window.location.reload();
};

const lockKey = (profile: SavedProfile) => `${profile.ServerId}:${profile.UserId}`;

/** Whether the profile is the one signed in right now. */
const isCurrentProfile = (profile: SavedProfile) => {
    const apiClient = ServerConnections.currentApiClient();
    return !!apiClient && apiClient.serverId() === profile.ServerId && apiClient.getCurrentUserId() === profile.UserId;
};

interface ProfileRowProps {
    profile: SavedProfile;
    current: boolean;
    managing: boolean;
    lock?: ProfileLock | null;
    onSelect: (profile: SavedProfile) => void;
    onRemove: (profile: SavedProfile) => void;
}

const ProfileRow: FC<ProfileRowProps> = ({ profile, current, managing, lock, onSelect, onRemove }) => {
    const imageUrl = getProfileImageUrl(profile);
    const onClick = useCallback(() => (managing ? onRemove(profile) : onSelect(profile)), [ managing, onRemove, onSelect, profile ]);

    return (
        <button type='button' className={current ? 'pfProfileRow pfProfileRow-current' : 'pfProfileRow'} onClick={onClick}>
            {imageUrl ? (
                <img className='pfProfileAvatar' src={imageUrl} alt='' />
            ) : (
                <span className='pfProfileAvatar' style={{ background: getAvatarColor(profile.Name) }}>
                    {profile.Name.charAt(0).toUpperCase()}
                </span>
            )}
            <span className='pfProfileText'>
                <span className='pfProfileName'>
                    {profile.Name}
                    {lock?.IsKids && <span className='pfKidsBadge'>Kids</span>}
                    {lock?.HasPin && <span className='material-icons pfProfileLockIcon lock' aria-label='Has a PIN' />}
                </span>
                <span className='pfProfileServer'>{profile.ServerAddress.replace(/^https?:\/\//, '')}</span>
            </span>
            {managing && <span className='material-icons pfProfileRemove remove_circle_outline' aria-label='Remove' />}
        </button>
    );
};

/**
 * "Who's watching?": the profiles signed in on this browser, to switch between without signing in again,
 * and the way to add another one.
 */
export const Component: FC = () => {
    const navigate = useNavigate();
    const [ profiles, setProfiles ] = useState(getProfiles);
    const [ managing, setManaging ] = useState(false);
    const [ locks, setLocks ] = useState<Record<string, ProfileLock | null>>({});
    const [ pinFor, setPinFor ] = useState<SavedProfile | null>(null);
    const [ changePinFor, setChangePinFor ] = useState<SavedProfile | null>(null);

    // Which profiles have a PIN or are kids profiles, each read with the profile's own sign in.
    useEffect(() => {
        let cancelled = false;
        Promise.all(profiles.map(async profile => [ lockKey(profile), await getProfileLock(profile) ] as const))
            .then(entries => {
                if (!cancelled) {
                    setLocks(Object.fromEntries(entries));
                }
            })
            .catch(err => console.error('[Profiles] could not read the profile locks', err));
        return () => {
            cancelled = true;
        };
    }, [ profiles ]);

    // TV: the selector starts on the first profile.
    const list = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const first = list.current?.querySelector<HTMLElement>('.pfProfileRow');
        if (layoutManager.tv && first) {
            focusManager.focus(first);
        }
    }, []);

    // Avatars are remembered at sign in; show the icons the profiles have now.
    useEffect(() => {
        let cancelled = false;
        refreshProfileImages().then(updated => {
            if (!cancelled) {
                setProfiles(updated);
            }
        }).catch(err => {
            console.error('[Profiles] could not refresh the avatars', err);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const onSelect = useCallback(async (profile: SavedProfile) => {
        loading.show();
        try {
            if (await isProfileValid(profile)) {
                // A profile with a PIN asks for it first; a kids profile's PIN is for leaving it, not entering.
                const lock = locks[lockKey(profile)] ?? await getProfileLock(profile);
                if (lock?.HasPin && !lock.IsKids) {
                    setPinFor(profile);
                    return;
                }
                switchToProfile(profile);
                return;
            }

            // Signed out elsewhere (or the token was revoked): it has to sign in again.
            forgetProfile(profile.ServerId, profile.UserId);
            setProfiles(getProfiles());
            toast(`${profile.Name} was signed out. Please sign in again.`);
            markProfileChosen();
            navigate(`/login?serverid=${profile.ServerId}`);
        } finally {
            loading.hide();
        }
    }, [ locks, navigate ]);

    const onPinCancel = useCallback(() => setPinFor(null), []);

    const forget = useCallback((profile: SavedProfile) => {
        forgetProfile(profile.ServerId, profile.UserId);
        const remaining = getProfiles();
        setProfiles(remaining);
        if (!remaining.length) {
            setManaging(false);
        }
    }, []);

    // Managing: a kids profile offers changing its PIN (any parent can, with the current PIN) besides removing it.
    const onRemove = useCallback((profile: SavedProfile) => {
        const lock = locks[lockKey(profile)];
        if (!lock?.IsKids) {
            forget(profile);
            return;
        }

        actionSheet.show({
            title: profile.Name,
            items: [
                { id: 'pin', name: lock.HasPin ? 'Change PIN' : 'Set PIN', icon: 'pin' },
                { id: 'remove', name: 'Remove from this device', icon: 'remove_circle_outline' }
            ]
        }).then(id => {
            if (id === 'pin') {
                setChangePinFor(profile);
            } else if (id === 'remove') {
                forget(profile);
            }
        }).catch(() => {
            // Closed.
        });
    }, [ forget, locks ]);

    const onChangePinDone = useCallback(() => {
        const profile = changePinFor;
        setChangePinFor(null);
        toast('The PIN was changed.');
        if (profile) {
            getProfileLock(profile)
                .then(lock => setLocks(current => ({ ...current, [lockKey(profile)]: lock })))
                .catch(err => console.error('[Profiles] could not read the profile lock', err));
        }
    }, [ changePinFor ]);

    const onChangePinCancel = useCallback(() => setChangePinFor(null), []);

    const onAdd = useCallback(() => {
        markProfileChosen();
        const serverId = ServerConnections.currentApiClient()?.serverId() ?? profiles[0]?.ServerId;
        navigate(serverId ? `/login?serverid=${serverId}` : '/login');
    }, [ navigate, profiles ]);

    const toggleManaging = useCallback(() => setManaging(value => !value), []);

    // The list keeps Up / Down inside it (so the selector can't wander into the header). Down from its last row goes
    // to Manage profiles and Up from there comes back; Up from its first row goes to Home and Down from there comes back.
    const manageButton = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const listElement = list.current;
        const homeButton = document.querySelector<HTMLElement>('.skinHeader .headerHomeButton');
        const getRows = () => Array.from(listElement?.querySelectorAll<HTMLElement>('.pfProfileRow') ?? []);
        const moveTo = (e: globalThis.KeyboardEvent, target: HTMLElement | null | undefined) => {
            e.preventDefault();
            e.stopPropagation();
            if (target) {
                focusManager.focus(target);
            }
        };

        // Up from the first row goes to Home; Left / Right have nowhere to go (the rows fill the width).
        const onListKeyDown = (e: globalThis.KeyboardEvent) => {
            const rows = getRows();
            const key = getKeyName(e);
            if (key === 'ArrowDown' && rows[rows.length - 1]?.contains(e.target as Node) && manageButton.current) {
                moveTo(e, manageButton.current);
            } else if (key === 'ArrowUp' && rows[0]?.contains(e.target as Node) && homeButton && focusManager.isCurrentlyFocusable(homeButton)) {
                moveTo(e, homeButton);
            } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
                moveTo(e, null);
            }
        };

        // Down from Home comes back to the first row.
        const onHomeKeyDown = (e: globalThis.KeyboardEvent) => {
            if (getKeyName(e) === 'ArrowDown') {
                moveTo(e, getRows()[0]);
            }
        };

        listElement?.addEventListener('keydown', onListKeyDown);
        homeButton?.addEventListener('keydown', onHomeKeyDown);
        return () => {
            listElement?.removeEventListener('keydown', onListKeyDown);
            homeButton?.removeEventListener('keydown', onHomeKeyDown);
        };
    }, []);
    const onManageKeyDown = useCallback((e: KeyboardEvent<HTMLButtonElement>) => {
        const rows = list.current?.querySelectorAll<HTMLElement>('.pfProfileRow');
        const last = rows?.[rows.length - 1];
        if (getKeyName(e.nativeEvent) === 'ArrowUp' && last) {
            e.preventDefault();
            e.stopPropagation();
            focusManager.focus(last);
        }
    }, []);

    return (
        <Page id='pirateFinProfilesPage' className='mainAnimatedPage standalonePage pfProfilesPage' isBackButtonEnabled={false}>
            <div className='pfProfilesPanel'>
                { }
                <div className='pfProfilesLogo' dangerouslySetInnerHTML={{ __html: getPirateFinLogoSvg() }} />
                <h1 className='pfProfilesTitle'>{managing ? 'Manage profiles' : 'Who’s watching?'}</h1>

                <div className='pfProfilesList focuscontainer-y' ref={list}>
                    {profiles.map(profile => (
                        <ProfileRow
                            key={`${profile.ServerId}:${profile.UserId}`}
                            profile={profile}
                            current={isCurrentProfile(profile)}
                            managing={managing}
                            lock={locks[lockKey(profile)]}
                            onSelect={onSelect}
                            onRemove={onRemove}
                        />
                    ))}

                    {!managing && (
                        <button type='button' className='pfProfileRow pfProfileRow-add' onClick={onAdd}>
                            <span className='pfProfileAvatar pfProfileAvatar-add material-icons person_add' aria-hidden='true' />
                            <span className='pfProfileText'>
                                <span className='pfProfileName'>Add profile</span>
                            </span>
                        </button>
                    )}
                </div>

                {profiles.length > 0 && (
                    <button type='button' className='pfButton pfButton-secondary pfProfilesManage' onClick={toggleManaging} onKeyDown={onManageKeyDown} ref={manageButton}>
                        {managing ? 'Done' : 'Manage profiles'}
                    </button>
                )}
            </div>
            {pinFor && <ProfilePinDialog profile={pinFor} onUnlocked={switchToProfile} onCancel={onPinCancel} />}
            {changePinFor && (
                <ChangePinDialog
                    profile={changePinFor}
                    hasPin={locks[lockKey(changePinFor)]?.HasPin ?? false}
                    onDone={onChangePinDone}
                    onCancel={onChangePinCancel}
                />
            )}
        </Page>
    );
};

Component.displayName = 'PirateFinProfilesPage';

export default Component;
