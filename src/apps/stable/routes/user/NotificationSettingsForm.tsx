import React, { type ChangeEvent, type FC, type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import loading from 'components/loading/loading';
import toast from 'components/toast/toast';
import Button from 'elements/emby-button/Button';
import Input from 'elements/emby-input/Input';
import { getNotificationSettings, saveNotificationSettings } from 'utils/piratefin';

import 'elements/emby-checkbox/emby-checkbox';

// The checkbox is markup, not JSX: React creates `is` elements with createElement(tag, { is }), which the
// web components polyfill rejects ("typeExtension.toLowerCase is not a function").
const NEW_EPISODES_CHECKBOX = {
    __html: '<label><input is="emby-checkbox" type="checkbox" class="chkNewEpisodeEmails" />'
        + '<span>Email me when a new episode of a season I follow is ready</span></label>'
};

interface NotificationSettingsFormProps {
    userId: string;
}

/**
 * The user's email address and whether they want an email when a new episode of a season they follow (the bell) is
 * ready. Request updates go to the address too.
 */
const NotificationSettingsForm: FC<NotificationSettingsFormProps> = ({ userId }) => {
    const [ email, setEmail ] = useState('');
    const [ newEpisodeEmails, setNewEpisodeEmails ] = useState<boolean | null>(null);
    const checkboxContainer = useRef<HTMLDivElement>(null);

    useEffect(() => {
        getNotificationSettings(window.ApiClient, userId).then(settings => {
            setEmail(settings.Email ?? '');
            setNewEpisodeEmails(settings.NewEpisodeEmails);
        }).catch(err => {
            console.error('[PirateFin] could not load the email settings', err);
        });
    }, [ userId ]);

    const getCheckbox = () => checkboxContainer.current?.querySelector<HTMLInputElement>('.chkNewEpisodeEmails');

    // Shows the loaded setting in the (uncontrolled) checkbox once it's rendered.
    useEffect(() => {
        const checkbox = getCheckbox();
        if (checkbox && newEpisodeEmails !== null) {
            checkbox.checked = newEpisodeEmails;
        }
    }, [ newEpisodeEmails ]);

    const onEmailChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value), []);

    const onSubmit = useCallback((e: FormEvent) => {
        e.preventDefault();
        loading.show();
        saveNotificationSettings(window.ApiClient, userId, { Email: email.trim() || null, NewEpisodeEmails: getCheckbox()?.checked ?? true })
            .then(() => toast('Email settings saved'))
            .catch(async (err: unknown) => {
                // The server explains what's wrong with the address.
                const message = err instanceof Response ? await err.text() : '';
                toast(message || 'Could not save the email settings.');
            })
            .finally(() => loading.hide());
    }, [ email, userId ]);

    if (newEpisodeEmails === null) {
        return null;
    }

    return (
        <form style={{ margin: '0 auto 2em' }} onSubmit={onSubmit}>
            <div className='detailSection'>
                <h2 className='sectionTitle'>Email</h2>
                <div className='inputContainer'>
                    <Input
                        type='email'
                        id='txtPirateFinEmail'
                        label='Email address'
                        autoComplete='email'
                        value={email}
                        onChange={onEmailChange}
                    />
                    <div className='fieldDescription'>Used to tell you about new episodes and your download requests.</div>
                </div>
                <div className='checkboxContainer' ref={checkboxContainer} dangerouslySetInnerHTML={NEW_EPISODES_CHECKBOX} />
                <br />
                <Button type='submit' className='raised button-submit block' title='Save' />
            </div>
        </form>
    );
};

export default NotificationSettingsForm;
