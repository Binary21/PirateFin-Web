import React, { type ChangeEvent, type FC, type FormEvent, useCallback, useEffect, useState } from 'react';

import loading from 'components/loading/loading';
import toast from 'components/toast/toast';
import Button from 'elements/emby-button/Button';
import Input from 'elements/emby-input/Input';
import { getProfileSettings, removeProfilePin, setProfilePin } from 'utils/piratefin';

interface ProfilePinFormProps {
    userId: string;
}

/** The profile's optional 4-digit PIN, asked on "Who's watching?" before switching to it. */
const ProfilePinForm: FC<ProfilePinFormProps> = ({ userId }) => {
    const [ hasPin, setHasPin ] = useState<boolean | null>(null);
    const [ isKids, setIsKids ] = useState(false);
    const [ pin, setPin ] = useState('');
    const isSelf = window.ApiClient.getCurrentUserId() === userId;

    useEffect(() => {
        getProfileSettings(window.ApiClient, userId)
            .then(profile => {
                setHasPin(profile.HasPin);
                setIsKids(profile.IsKids);
            })
            .catch(err => console.error('[PirateFin] could not load the profile settings', err));
    }, [ userId ]);

    // Digits only, at most four.
    const onPinChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4)), []);

    const onSubmit = useCallback((e: FormEvent) => {
        e.preventDefault();
        if (pin.length !== 4) {
            toast('A PIN is 4 digits.');
            return;
        }

        loading.show();
        setProfilePin(window.ApiClient, userId, pin)
            .then(() => {
                setHasPin(true);
                setPin('');
                toast('Profile PIN saved');
            })
            .catch(() => toast('Could not save the PIN.'))
            .finally(() => loading.hide());
    }, [ pin, userId ]);

    const onRemove = useCallback(() => {
        loading.show();
        removeProfilePin(window.ApiClient, userId)
            .then(() => {
                setHasPin(false);
                toast('Profile PIN removed');
            })
            .catch(() => toast('Could not remove the PIN.'))
            .finally(() => loading.hide());
    }, [ userId ]);

    if (hasPin === null) {
        return null;
    }

    // A kids profile's PIN guards leaving it; it's changed on "Who's watching?" > Manage profiles or by an admin.
    if (isKids) {
        return (
            <div className='detailSection' style={{ margin: '0 auto 2em' }}>
                <h2 className='sectionTitle'>Profile lock</h2>
                <p>
                    {hasPin ?
                        'This kids profile has a PIN, asked when leaving it. Change it on "Who\'s watching?" > Manage profiles.' :
                        'This kids profile has no PIN yet. Ask an admin to set one in Parental Control.'}
                </p>
            </div>
        );
    }

    return (
        <form style={{ margin: '0 auto 2em' }} onSubmit={onSubmit}>
            <div className='detailSection'>
                <h2 className='sectionTitle'>Profile lock</h2>
                {isSelf && (
                    <div className='inputContainer'>
                        <Input
                            type='password'
                            id='txtProfilePin'
                            label={hasPin ? 'New 4-digit PIN' : '4-digit PIN'}
                            inputMode='numeric'
                            autoComplete='off'
                            value={pin}
                            onChange={onPinChange}
                        />
                        <div className='fieldDescription'>
                            Asked on &quot;Who&apos;s watching?&quot; before anyone can switch to this profile.
                            {hasPin ? ' This profile has a PIN.' : ''}
                        </div>
                    </div>
                )}
                {!isSelf && <p>{hasPin ? 'This profile has a PIN.' : 'This profile has no PIN.'}</p>}
                {isSelf && <Button type='submit' className='raised button-submit block' title={hasPin ? 'Change PIN' : 'Set PIN'} />}
                {hasPin && <Button type='button' className='raised block' title='Remove PIN' onClick={onRemove} />}
            </div>
        </form>
    );
};

export default ProfilePinForm;
