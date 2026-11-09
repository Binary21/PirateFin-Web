import Alert from '@mui/material/Alert';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { type ChangeEvent, type FC, useCallback } from 'react';

interface KidsProfileSectionProps {
    isKids: boolean;
    /** Whether the profile already has a PIN. */
    hasPin: boolean;
    pin: string;
    onKidsChange: (isKids: boolean) => void;
    onPinChange: (pin: string) => void;
}

/**
 * Parental Control's kids profile switch and PIN. The rating limit is the page's "Maximum allowed parental rating";
 * the PIN is asked when leaving the kids profile (Switch Profile, Settings, Exit), not when entering it.
 */
const KidsProfileSection: FC<KidsProfileSectionProps> = ({ isKids, hasPin, pin, onKidsChange, onPinChange }) => {
    const onSwitch = useCallback((e: ChangeEvent<HTMLInputElement>) => onKidsChange(e.target.checked), [ onKidsChange ]);
    const onPin = useCallback((e: ChangeEvent<HTMLInputElement>) => onPinChange(e.target.value.replace(/\D/g, '').slice(0, 4)), [ onPinChange ]);

    return (
        <Stack spacing={2} sx={{ mb: 4 }}>
            <Typography variant='h2'>Kids profile</Typography>
            <FormControlLabel control={<Switch checked={isKids} onChange={onSwitch} />} label='Kids profile' />
            <Typography variant='body2' color='text.secondary'>
                Kids profiles only see titles up to the Maximum allowed parental rating below (unrated movies and shows are
                blocked too), get the kids look, and can&apos;t make download requests or add new titles from search. Leaving
                the profile (Switch Profile, Settings, Exit) asks for its PIN; opening it doesn&apos;t.
            </Typography>
            {isKids && (
                <>
                    {!hasPin && !pin && (
                        <Alert severity='warning'>
                            This kids profile has no PIN yet, so it can be left freely. Set a PIN to lock it.
                        </Alert>
                    )}
                    <TextField
                        label={hasPin ? 'New PIN' : 'PIN'}
                        type='password'
                        value={pin}
                        onChange={onPin}
                        slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 4, autoComplete: 'new-password' } }}
                        helperText={hasPin ?
                            'Leave empty to keep the current PIN. Parents can also change it on "Who\'s watching?" > Manage profiles.' :
                            '4 digits, asked when leaving the kids profile.'}
                        sx={{ maxWidth: '16em' }}
                    />
                </>
            )}
        </Stack>
    );
};

export default KidsProfileSection;
