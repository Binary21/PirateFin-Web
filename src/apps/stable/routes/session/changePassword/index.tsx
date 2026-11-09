import React, { useCallback, useState } from 'react';

import Page from 'components/Page';
import toast from 'components/toast/toast';
import Button from 'elements/emby-button/Button';
import Input from 'elements/emby-input/Input';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';
import Dashboard from 'utils/dashboard';

/**
 * "Choose a new password", shown after signing in with an emailed temporary password, before Home.
 */
export const ChangePasswordPage = () => {
    const [ password, setPassword ] = useState('');
    const [ confirm, setConfirm ] = useState('');
    const [ error, setError ] = useState('');
    const [ saving, setSaving ] = useState(false);

    const onPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value), []);
    const onConfirmChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setConfirm(e.target.value), []);

    const onSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) {
            setError('Enter a new password.');
            return;
        }
        if (password !== confirm) {
            setError('The passwords don\'t match.');
            return;
        }

        const apiClient = ServerConnections.currentApiClient();
        if (!apiClient) {
            return;
        }

        setSaving(true);
        setError('');
        apiClient.ajax({
            type: 'POST',
            url: apiClient.getUrl('PirateFin/Users/Me/Password'),
            data: JSON.stringify({ NewPassword: password }),
            contentType: 'application/json'
        }).then(() => {
            toast('Your new password is saved.');
            return Dashboard.navigate('home');
        }).catch((err: unknown) => {
            console.error('[ChangePassword] failed to save the new password', err);
            setError('Your new password couldn\'t be saved. Please try again.');
            setSaving(false);
        });
    }, [ confirm, password ]);

    return (
        <Page
            id='pirateFinChangePasswordPage'
            className='standalonePage mainAnimatedPage'
            isBackButtonEnabled={false}
            shouldAutoFocus
        >
            <div className='padded-left padded-right padded-bottom-page'>
                <form style={{ textAlign: 'center', margin: '0 auto', maxWidth: '30em' }} onSubmit={onSubmit}>
                    <div style={{ textAlign: 'left' }}>
                        <h1>Choose a new password</h1>
                        <p>You signed in with a temporary password. Choose your own password to continue.</p>

                        <div className='inputContainer'>
                            <Input
                                type='password'
                                id='txtNewPassword'
                                label='New password'
                                autoComplete='new-password'
                                value={password}
                                onChange={onPasswordChange}
                            />
                        </div>
                        <div className='inputContainer'>
                            <Input
                                type='password'
                                id='txtConfirmPassword'
                                label='Confirm new password'
                                autoComplete='new-password'
                                value={confirm}
                                onChange={onConfirmChange}
                            />
                        </div>

                        {error && <p className='fieldDescription' style={{ color: '#e50914' }}>{error}</p>}

                        <Button
                            type='submit'
                            className='raised submit block'
                            title='Save password'
                            disabled={saving}
                        />
                    </div>
                </form>
            </div>
        </Page>
    );
};

export default ChangePasswordPage;
