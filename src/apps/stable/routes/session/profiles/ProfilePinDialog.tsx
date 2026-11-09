import React, { type ChangeEvent, type FC, type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import focusManager from 'components/focusManager';
import type { SavedProfile } from 'utils/profiles';

/** A profile's PIN settings, read with that profile's own sign in (the picker may be showing other users). */
export interface ProfileLock {
    HasPin: boolean;
    IsKids: boolean;
}

function authHeaders(profile: SavedProfile): Record<string, string> {
    return {
        'Authorization': `MediaBrowser Token="${profile.AccessToken}"`,
        'Content-Type': 'application/json'
    };
}

export async function getProfileLock(profile: SavedProfile): Promise<ProfileLock | null> {
    try {
        const response = await fetch(`${profile.ServerAddress}/PirateFin/Users/${profile.UserId}/Profile`, { headers: authHeaders(profile) });
        return response.ok ? await response.json() as ProfileLock : null;
    } catch {
        return null;
    }
}

async function verifyPin(profile: SavedProfile, pin: string): Promise<{ Valid: boolean; LockedOut: boolean }> {
    const response = await fetch(`${profile.ServerAddress}/PirateFin/Users/${profile.UserId}/Pin/Verify`, {
        method: 'POST',
        headers: authHeaders(profile),
        body: JSON.stringify({ Pin: pin })
    });
    if (!response.ok) {
        throw new Error(`PIN check failed: ${response.status}`);
    }
    return await response.json() as { Valid: boolean; LockedOut: boolean };
}

interface ProfilePinDialogProps {
    profile: SavedProfile;
    onUnlocked: (profile: SavedProfile) => void;
    onCancel: () => void;
    /** Defaults to "Enter {name}'s PIN". */
    title?: string;
}

/** Asks for a profile's 4-digit PIN: before switching to it, or (kids) before leaving it. */
const ProfilePinDialog: FC<ProfilePinDialogProps> = ({ profile, onUnlocked, onCancel, title }) => {
    const [ pin, setPin ] = useState('');
    const [ message, setMessage ] = useState('');
    const [ checking, setChecking ] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (input.current) {
            focusManager.focus(input.current);
        }
    }, []);

    const check = useCallback((value: string) => {
        setChecking(true);
        verifyPin(profile, value)
            .then(result => {
                if (result.Valid) {
                    onUnlocked(profile);
                    return;
                }
                setPin('');
                setMessage(result.LockedOut ? 'Too many wrong tries. Try again in 5 minutes.' : 'Wrong PIN. Try again.');
            })
            .catch(() => setMessage('The PIN couldn\'t be checked. Try again.'))
            .finally(() => setChecking(false));
    }, [ onUnlocked, profile ]);

    // The fourth digit checks the PIN straight away, like a phone lock screen.
    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 4);
        setPin(value);
        setMessage('');
        if (value.length === 4) {
            check(value);
        }
    }, [ check ]);

    const onSubmit = useCallback((e: FormEvent) => {
        e.preventDefault();
        if (pin.length === 4) {
            check(pin);
        }
    }, [ check, pin ]);

    return (
        <div className='pfPinDialog' role='dialog' aria-modal='true' aria-label={title ?? `Enter ${profile.Name}'s PIN`}>
            <form className='pfPinDialog-panel' onSubmit={onSubmit}>
                <h2 className='pfPinDialog-title'>{title ?? `Enter ${profile.Name}'s PIN`}</h2>
                <input
                    ref={input}
                    className='pfPinDialog-input'
                    type='password'
                    inputMode='numeric'
                    autoComplete='off'
                    maxLength={4}
                    value={pin}
                    onChange={onChange}
                    disabled={checking}
                    aria-label='PIN'
                />
                <p className='pfPinDialog-message' aria-live='polite'>{message}</p>
                <button type='button' className='pfButton pfButton-secondary' onClick={onCancel}>Cancel</button>
            </form>
        </div>
    );
};

export default ProfilePinDialog;
