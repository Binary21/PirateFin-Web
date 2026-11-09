import type { UserDto } from '@jellyfin/sdk/lib/generated-client';
import React, { FunctionComponent, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import Dashboard from '../../../../utils/dashboard';
import globalize from '../../../../lib/globalize';
import Button from '../../../../elements/emby-button/Button';
import UserPasswordForm from '../../../../components/dashboard/users/UserPasswordForm';
import loading from '../../../../components/loading/loading';
import Page from '../../../../components/Page';
import NotificationSettingsForm from './NotificationSettingsForm';
import ProfilePinForm from './ProfilePinForm';

const UserProfile: FunctionComponent = () => {
    const [ searchParams ] = useSearchParams();
    const navigate = useNavigate();
    const userId = searchParams.get('userId');
    const [ userName, setUserName ] = useState('');
    const libraryMenu = useMemo(async () => ((await import('../../../../scripts/libraryMenu')).default), []);

    const element = useRef<HTMLDivElement>(null);

    const reloadUser = useCallback(() => {
        const page = element.current;

        if (!page) {
            console.error('[userprofile] Unexpected null page reference');
            return;
        }

        if (!userId) {
            console.error('[userprofile] missing user id');
            return;
        }

        loading.show();
        window.ApiClient.getUser(userId).then(function (user) {
            if (!user.Name || !user.Id) {
                throw new Error('Unexpected null user name or id');
            }

            setUserName(user.Name);
            void libraryMenu.then(menu => menu.setTitle(user.Name));

            let imageUrl = 'assets/img/avatar.png';
            if (user.PrimaryImageTag) {
                imageUrl = window.ApiClient.getUserImageUrl(user.Id, {
                    tag: user.PrimaryImageTag,
                    type: 'Primary'
                });
            }
            const userImage = (page.querySelector('#image') as HTMLDivElement);
            userImage.style.backgroundImage = 'url(' + imageUrl + ')';

            Dashboard.getCurrentUser().then(function (loggedInUser: UserDto) {
                if (!user.Policy) {
                    throw new Error('Unexpected null user.Policy');
                }

                // PirateFin: the profile image is chosen from the icon packs.
                const canChange = !!(loggedInUser?.Policy?.IsAdministrator || user.Policy.EnableUserPreferenceAccess);
                (page.querySelector('#btnChangeIcon') as HTMLButtonElement).classList.toggle('hide', !canChange);
            }).catch(err => {
                console.error('[userprofile] failed to get current user', err);
            });
            loading.hide();
        }).catch(err => {
            console.error('[userprofile] failed to load data', err);
        });
    }, [userId]);

    const onChangeIcon = useCallback(() => {
        navigate(`/profileicon?userId=${userId}`);
    }, [navigate, userId]);

    useEffect(() => {
        const page = element.current;

        if (!page) {
            console.error('[userprofile] Unexpected null page reference');
            return;
        }

        reloadUser();
    }, [reloadUser, userId]);

    return (
        <Page
            id='userProfilePage'
            title={globalize.translate('Profile')}
            className='mainAnimatedPage libraryPage userPreferencesPage userPasswordPage noSecondaryNavPage'
        >
            <div ref={element} className='padded-left padded-right padded-bottom-page'>
                <div
                    className='readOnlyContent'
                    style={{ margin: '0 auto', marginBottom: '1.8em', padding: '0 1em', display: 'flex', flexDirection: 'row', alignItems: 'center' }}
                >
                    <div
                        className='imagePlaceHolder'
                        style={{ position: 'relative', display: 'inline-block', maxWidth: 200 }}
                    >
                        <div
                            id='image'
                            style={{ width: 200, height: 200, backgroundRepeat: 'no-repeat', backgroundPosition: 'center', borderRadius: '0.3em', backgroundSize: 'cover' }}
                        />
                    </div>
                    <div style={{ verticalAlign: 'top', margin: '1em 2em', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h2 className='username' style={{ margin: 0, fontSize: 'xx-large' }}>
                            {userName}
                        </h2>
                        <br />
                        <Button
                            type='button'
                            id='btnChangeIcon'
                            className='raised button-submit hide'
                            title='Change profile icon'
                            onClick={onChangeIcon}
                        />
                    </div>
                </div>
                {userId && <NotificationSettingsForm userId={userId} />}
                {userId && <ProfilePinForm userId={userId} />}
                <UserPasswordForm
                    userId={userId}
                />
            </div>
        </Page>

    );
};

export default UserProfile;
