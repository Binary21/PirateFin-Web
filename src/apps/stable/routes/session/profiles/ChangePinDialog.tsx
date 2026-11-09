import React, { type ChangeEvent, type FC, type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import focusManager from 'components/focusManager';
import type { SavedProfile } from 'utils/profiles';

type Step = 'current' | 'new' | 'confirm';

const STEP_TITLES: Record<Step, string> = {
    current: 'Enter the current PIN',
    new: 'Choose a new 4-digit PIN',
    confirm: 'Enter the new PIN again'
};

async function savePin(profile: SavedProfile, pin: string, currentPin: string): Promise<string | null> {
    const response = await fetch(`${profile.ServerAddress}/PirateFin/Users/${profile.UserId}/Pin`, {
        method: 'POST',
        headers: {
            'Authorization': `MediaBrowser Token="${profile.AccessToken}"`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ Pin: pin, CurrentPin: currentPin || null })
    });
    if (response.ok) {
        return null;
    }

    // The server's reason, sent as plain text or a JSON string.
    const text = (await response.text()).replace(/(^")|("$)/g, '');
    return text || 'The PIN couldn\'t be changed. Try again.';
}

interface ChangePinDialogProps {
    profile: SavedProfile;
    /** Whether the profile has a PIN now (then it's asked first). */
    hasPin: boolean;
    onDone: () => void;
    onCancel: () => void;
}

/**
 * Changes a kids profile's PIN from "Manage profiles" (with that profile's sign in): the current PIN first, then the
 * new one twice.
 */
const ChangePinDialog: FC<ChangePinDialogProps> = ({ profile, hasPin, onDone, onCancel }) => {
    const [ step, setStep ] = useState<Step>(hasPin ? 'current' : 'new');
    const [ pin, setPin ] = useState('');
    const [ currentPin, setCurrentPin ] = useState('');
    const [ newPin, setNewPin ] = useState('');
    const [ message, setMessage ] = useState('');
    const [ saving, setSaving ] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (input.current) {
            focusManager.focus(input.current);
        }
    }, [ step ]);

    const next = useCallback((value: string) => {
        setPin('');
        if (step === 'current') {
            setCurrentPin(value);
            setStep('new');
        } else if (step === 'new') {
            setNewPin(value);
            setStep('confirm');
        } else if (value !== newPin) {
            setMessage('The PINs don\'t match. Choose the new PIN again.');
            setStep('new');
        } else {
            setSaving(true);
            savePin(profile, newPin, currentPin)
                .then(error => {
                    if (!error) {
                        onDone();
                        return;
                    }
                    setMessage(error);
                    setStep(hasPin ? 'current' : 'new');
                })
                .catch(() => setMessage('The PIN couldn\'t be changed. Try again.'))
                .finally(() => setSaving(false));
        }
    }, [ currentPin, hasPin, newPin, onDone, profile, step ]);

    // Each fourth digit moves on, like a phone lock screen.
    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 4);
        setPin(value);
        if (value.length === 4) {
            setMessage('');
            next(value);
        }
    }, [ next ]);

    const onSubmit = useCallback((e: FormEvent) => {
        e.preventDefault();
        if (pin.length === 4) {
            next(pin);
        }
    }, [ next, pin ]);

    return (
        <div className='pfPinDialog' role='dialog' aria-modal='true' aria-label={`Change ${profile.Name}'s PIN`}>
            <form className='pfPinDialog-panel' onSubmit={onSubmit}>
                <h2 className='pfPinDialog-title'>{profile.Name}: {STEP_TITLES[step]}</h2>
                <input
                    ref={input}
                    className='pfPinDialog-input'
                    type='password'
                    inputMode='numeric'
                    autoComplete='off'
                    maxLength={4}
                    value={pin}
                    onChange={onChange}
                    disabled={saving}
                    aria-label='PIN'
                />
                <p className='pfPinDialog-message' aria-live='polite'>{message}</p>
                <button type='button' className='pfButton pfButton-secondary' onClick={onCancel}>Cancel</button>
            </form>
        </div>
    );
};

export default ChangePinDialog;
