import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { type FC, useCallback, useEffect, useState } from 'react';

import { getProfileSettings, removeProfilePin } from 'utils/piratefin';

/**
 * The dashboard's profile PIN setting for a user: removing a forgotten PIN. Kids profiles (and their PIN) are set in
 * Parental Control.
 */
const KidsAndPinSettings: FC<{ userId: string }> = ({ userId }) => {
    const [ isKids, setIsKids ] = useState(false);
    const [ hasPin, setHasPin ] = useState(false);
    const [ message, setMessage ] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        getProfileSettings(window.ApiClient, userId).then(profile => {
            setIsKids(profile.IsKids);
            setHasPin(profile.HasPin);
        }).catch(err => console.error('[PirateFin] could not load the profile settings', err));
    }, [ userId ]);

    const onRemovePin = useCallback(() => {
        removeProfilePin(window.ApiClient, userId)
            .then(() => {
                setHasPin(false);
                setMessage({ severity: 'success', text: 'The profile PIN was removed.' });
            })
            .catch(() => setMessage({ severity: 'error', text: 'Could not remove the PIN.' }));
    }, [ userId ]);

    let description: string;
    if (isKids) {
        description = hasPin ?
            'This kids profile has a PIN (asked when leaving it). Change it in Parental Control, or remove it if it was forgotten.' :
            'This kids profile has no PIN, so it can be left freely. Set one in Parental Control.';
    } else {
        description = hasPin ?
            'This profile has a PIN. Remove it if it was forgotten; the user can set a new one on their profile page.' :
            'This profile has no PIN.';
    }

    return (
        <Stack spacing={2} sx={{ mt: 4, mb: 4 }}>
            <Typography variant='h2'>Profile PIN</Typography>
            {message && <Alert severity={message.severity}>{message.text}</Alert>}
            <Typography variant='body2' color='text.secondary'>{description}</Typography>
            {hasPin && (
                <Stack direction='row'>
                    <Button variant='outlined' color='error' onClick={onRemovePin}>Remove PIN</Button>
                </Stack>
            )}
        </Stack>
    );
};

export default KidsAndPinSettings;
