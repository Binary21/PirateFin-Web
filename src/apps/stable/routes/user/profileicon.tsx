import type { UserDto } from '@jellyfin/sdk/lib/generated-client';
import React, { type FC, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import loading from 'components/loading/loading';
import Page from 'components/Page';
import toast from 'components/toast/toast';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';
import libraryMenu from 'scripts/libraryMenu';
import {
    getIconPacks,
    getIconUrl,
    getUserIcon,
    setUserIcon,
    type IconPack,
    type IconRef,
    type ProfileIcon
} from 'utils/profileIcons';
import { updateProfileImageTag } from 'utils/profiles';

import 'styles/piratefin.scss';
import 'styles/profileIcons.scss';

interface IconButtonProps {
    pack: IconPack;
    icon: ProfileIcon;
    label: string;
    isCurrent: boolean;
    url: string;
    onPick: (pack: IconPack, icon: ProfileIcon) => void;
}

const IconButton: FC<IconButtonProps> = ({ pack, icon, label, isCurrent, url, onPick }) => {
    const onClick = useCallback(() => onPick(pack, icon), [ icon, onPick, pack ]);

    return (
        <button type='button' className={isCurrent ? 'pfIcon pfIcon-current' : 'pfIcon'} title={label} aria-label={label} onClick={onClick}>
            <img src={url} alt='' loading='lazy' />
        </button>
    );
};

interface IconRowProps {
    pack: IconPack;
    current: IconRef | null;
    getUrl: (packId: string, file: string) => string;
    onPick: (pack: IconPack, icon: ProfileIcon) => void;
}

/** One pack: 10 icons visible, scrolled a page at a time with the arrows (or by focusing icons with the remote). */
const IconRow: FC<IconRowProps> = ({ pack, current, getUrl, onPick }) => {
    const scroller = useRef<HTMLDivElement>(null);
    const [ canScrollBack, setCanScrollBack ] = useState(false);
    const [ canScrollForward, setCanScrollForward ] = useState(false);
    const hasSeasons = pack.Icons.some(i => i.Season);

    const updateArrows = useCallback(() => {
        const elem = scroller.current;
        if (elem) {
            setCanScrollBack(elem.scrollLeft > 1);
            setCanScrollForward(elem.scrollLeft + elem.clientWidth < elem.scrollWidth - 1);
        }
    }, []);

    useEffect(() => {
        updateArrows();
        window.addEventListener('resize', updateArrows);
        return () => window.removeEventListener('resize', updateArrows);
    }, [ updateArrows ]);

    const scrollBy = useCallback((direction: number) => {
        const elem = scroller.current;
        elem?.scrollBy({ left: direction * elem.clientWidth * 0.92, behavior: 'smooth' });
    }, []);
    const scrollBack = useCallback(() => scrollBy(-1), [ scrollBy ]);
    const scrollForward = useCallback(() => scrollBy(1), [ scrollBy ]);

    return (
        <section className='pfIconRow'>
            <h2 className='pfIconRowTitle'>{pack.Name}</h2>
            <div className='pfIconRowTrack'>
                {canScrollBack && (
                    <button type='button' className='pfIconRowArrow pfIconRowArrow-prev' onClick={scrollBack} aria-label='Previous icons' tabIndex={-1}>
                        <span className='material-icons chevron_left' aria-hidden='true' />
                    </button>
                )}
                <div className='pfIconRowScroller focuscontainer-x' ref={scroller} onScroll={updateArrows}>
                    {pack.Icons.map((icon, index) => {
                        const isCurrent = current?.PackId === pack.Id && current.File === icon.File;
                        const seasonStarts = !!icon.Season && icon.Season !== pack.Icons[index - 1]?.Season;
                        const label = icon.Season ? `${icon.Title} · ${icon.Season}` : icon.Title;
                        return (
                            <div className='pfIconCell' key={icon.File}>
                                {hasSeasons && <span className='pfIconSeason'>{seasonStarts ? icon.Season : ''}</span>}
                                <IconButton
                                    pack={pack}
                                    icon={icon}
                                    label={label}
                                    isCurrent={isCurrent}
                                    url={getUrl(pack.Id, icon.File)}
                                    onPick={onPick}
                                />
                            </div>
                        );
                    })}
                </div>
                {canScrollForward && (
                    <button type='button' className='pfIconRowArrow pfIconRowArrow-next' onClick={scrollForward} aria-label='More icons' tabIndex={-1}>
                        <span className='material-icons chevron_right' aria-hidden='true' />
                    </button>
                )}
            </div>
        </section>
    );
};

interface ConfirmDialogProps {
    currentUrl?: string;
    newUrl: string;
    onConfirm: () => void;
    onCancel: () => void;
}

/** Netflix's "Change profile icon?" with the current and the new icon side by side. */
const ConfirmDialog: FC<ConfirmDialogProps> = ({ currentUrl, newUrl, onConfirm, onCancel }) => {
    const confirmButton = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        confirmButton.current?.focus();
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack') {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
            }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [ onCancel ]);

    return (
        <div className='pfIconDialogBackdrop' role='dialog' aria-modal='true' aria-labelledby='pfIconDialogTitle'>
            <div className='pfIconDialog'>
                <h2 id='pfIconDialogTitle' className='pfIconDialogTitle'>Change profile icon?</h2>
                <div className='pfIconDialogCompare'>
                    {currentUrl && (
                        <>
                            <figure className='pfIconDialogFigure'>
                                <img src={currentUrl} alt='' />
                                <figcaption>Current</figcaption>
                            </figure>
                            <span className='material-icons arrow_forward_ios' aria-hidden='true' />
                        </>
                    )}
                    <figure className='pfIconDialogFigure'>
                        <img src={newUrl} alt='' />
                        <figcaption>New</figcaption>
                    </figure>
                </div>
                <div className='pfIconDialogButtons focuscontainer-x'>
                    <button type='button' className='pfButton pfButton-primary' onClick={onConfirm} ref={confirmButton}>Let’s do it</button>
                    <button type='button' className='pfButton pfButton-secondary' onClick={onCancel}>Not yet</button>
                </div>
            </div>
        </div>
    );
};

/**
 * "Choose profile icon": every icon pack as a row of icons. Users can only pick their profile image from these;
 * admins manage the packs from here.
 */
export const Component: FC = () => {
    const navigate = useNavigate();
    const [ searchParams ] = useSearchParams();
    const apiClient = ServerConnections.currentApiClient();
    const userId = searchParams.get('userId') || apiClient?.getCurrentUserId();

    const [ packs, setPacks ] = useState<IconPack[] | null>(null);
    const [ user, setUser ] = useState<UserDto | null>(null);
    const [ current, setCurrent ] = useState<IconRef | null>(null);
    const [ isAdmin, setIsAdmin ] = useState(false);
    const [ pending, setPending ] = useState<{ pack: IconPack; icon: ProfileIcon } | null>(null);

    useEffect(() => {
        if (!apiClient || !userId) {
            return;
        }

        loading.show();
        Promise.all([
            getIconPacks(apiClient),
            apiClient.getUser(userId),
            getUserIcon(apiClient, userId).catch(() => null),
            apiClient.getCurrentUser()
        ]).then(([ loadedPacks, loadedUser, icon, signedIn ]) => {
            setPacks(loadedPacks.filter(p => p.Icons.length));
            setUser(loadedUser);
            setCurrent(icon);
            setIsAdmin(!!signedIn.Policy?.IsAdministrator);
        }).catch(err => {
            console.error('[ProfileIcons] failed to load the icons', err);
            toast('Could not load the profile icons.');
        }).finally(() => {
            loading.hide();
        });
    }, [ apiClient, userId ]);

    const getUrl = useCallback((packId: string, file: string) => (apiClient ? getIconUrl(apiClient, packId, file) : ''), [ apiClient ]);

    const currentUrl = user?.Id && user.PrimaryImageTag && apiClient ?
        apiClient.getUserImageUrl(user.Id, { type: 'Primary', tag: user.PrimaryImageTag, maxWidth: 320 }) :
        undefined;

    const goBack = useCallback(() => navigate(-1), [ navigate ]);
    const onPick = useCallback((pack: IconPack, icon: ProfileIcon) => setPending({ pack, icon }), []);
    const onCancel = useCallback(() => setPending(null), []);

    const onConfirm = useCallback(async () => {
        if (!apiClient || !userId || !pending) {
            return;
        }

        loading.show();
        try {
            await setUserIcon(apiClient, userId, { PackId: pending.pack.Id, File: pending.icon.File });
            const updated = await apiClient.getUser(userId);
            updateProfileImageTag(apiClient.serverId(), userId, updated.PrimaryImageTag);
            if (userId === apiClient.getCurrentUserId()) {
                await libraryMenu.refreshUser();
            }

            toast('Profile icon updated');
            navigate(-1);
        } catch (err) {
            console.error('[ProfileIcons] failed to change the icon', err);
            toast('Could not change the profile icon.');
            setPending(null);
        } finally {
            loading.hide();
        }
    }, [ apiClient, navigate, pending, userId ]);

    const onManage = useCallback(() => navigate('/iconpacks'), [ navigate ]);

    return (
        <Page id='pirateFinProfileIconPage' className='mainAnimatedPage libraryPage noSecondaryNavPage pfIconPage' title='Choose profile icon'>
            <div className='pfIconPageContent'>
                <header className='pfIconHeader'>
                    <div>
                        <button type='button' className='pfIconBack' onClick={goBack}>
                            <span className='material-icons arrow_back' aria-hidden='true' />
                            Edit Profile
                        </button>
                        <h1 className='pfIconTitle'>Choose profile icon</h1>
                    </div>
                    {user && (
                        <div className='pfIconCurrent'>
                            <span>{user.Name}</span>
                            {currentUrl && <img className='pfIconCurrentImage' src={currentUrl} alt='' />}
                        </div>
                    )}
                </header>

                {packs?.length === 0 && <p className='pfIconEmpty'>There are no profile icons yet.</p>}
                {packs?.map(pack => (
                    <IconRow key={pack.Id} pack={pack} current={current} getUrl={getUrl} onPick={onPick} />
                ))}

                {packs && (isAdmin ? (
                    <div className='pfIconFooter'>
                        <button type='button' className='pfButton pfButton-secondary' onClick={onManage}>
                            <span className='material-icons collections' aria-hidden='true' />
                            Manage icon packs
                        </button>
                    </div>
                ) : (
                    <p className='pfIconFooter'>Please contact your admin to add more icons</p>
                ))}
            </div>

            {pending && (
                <ConfirmDialog
                    currentUrl={currentUrl}
                    newUrl={getUrl(pending.pack.Id, pending.icon.File)}
                    onConfirm={onConfirm}
                    onCancel={onCancel}
                />
            )}
        </Page>
    );
};

Component.displayName = 'PirateFinProfileIconPage';

export default Component;
