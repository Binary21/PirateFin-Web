import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { type ChangeEvent, type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';

import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import globalize from 'lib/globalize';

import { getErrorMessage, type SettingsKind, usePirateFinSettings, useSavePirateFinSettings } from '../api/pirateFinApi';

type Settings = Record<string, unknown>;
type Update = (name: string, value: unknown) => void;

interface FieldProps {
    settings: Settings;
    update: Update;
    name: string;
    label: string;
    helperText?: string;
}

/** A text setting. */
export const TextSetting = ({ settings, update, name, label, helperText, type = 'text' }: FieldProps & { type?: 'text' | 'password' | 'url' | 'time' }) => {
    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => update(name, e.target.value), [ name, update ]);
    return (
        <TextField
            label={label}
            type={type}
            value={(settings[name] as string | undefined) ?? ''}
            onChange={onChange}
            helperText={helperText}
            autoComplete='off'
            // A time input always shows its "--:--" placeholder, which the label would overlap.
            slotProps={type === 'time' ? { inputLabel: { shrink: true } } : undefined}
            fullWidth
        />
    );
};

/** A numeric setting. */
export const NumberSetting = ({ settings, update, name, label, helperText, step = 1 }: FieldProps & { step?: number }) => {
    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => update(name, Number(e.target.value)), [ name, update ]);
    return (
        <TextField
            label={label}
            type='number'
            slotProps={{ htmlInput: { step } }}
            value={(settings[name] as number | undefined) ?? 0}
            onChange={onChange}
            helperText={helperText}
            fullWidth
        />
    );
};

/** An on / off setting. */
export const BooleanSetting = ({ settings, update, name, label }: Omit<FieldProps, 'helperText'>) => {
    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => update(name, e.target.checked), [ name, update ]);
    return (
        <FormControlLabel
            control={<Switch checked={Boolean(settings[name])} onChange={onChange} />}
            label={label}
        />
    );
};

/** A list setting, edited one entry per line. */
export const ListSetting = ({ settings, update, name, label, helperText, placeholder }: FieldProps & { placeholder?: string }) => {
    const value = settings[name] as string[] | null | undefined;
    const [ text, setText ] = useState((value ?? []).join('\n'));

    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        setText(e.target.value);
        const entries = e.target.value.split('\n').map(entry => entry.trim()).filter(Boolean);
        update(name, entries);
    }, [ name, update ]);

    return (
        <TextField
            label={label}
            value={text}
            onChange={onChange}
            helperText={helperText ?? 'One per line'}
            placeholder={placeholder}
            multiline
            minRows={2}
            fullWidth
        />
    );
};

interface SettingsPageProps {
    kind: SettingsKind;
    id: string;
    title: string;
    description: ReactNode;
    children: (settings: Settings, update: Update) => ReactNode;
}

/** Loads a PirateFin settings file, lets the user edit it and saves it back. */
const SettingsPage = ({ kind, id, title, description, children }: SettingsPageProps) => {
    const { data, isPending, isError, error } = usePirateFinSettings(kind);
    const save = useSaveSettings(kind);
    const [ draft, setDraft ] = useState<Settings | null>(null);

    useEffect(() => {
        if (data) {
            setDraft(structuredClone(data) as unknown as Settings);
        }
    }, [ data ]);

    const update = useCallback<Update>((name, value) => {
        setDraft(current => (current ? { ...current, [name]: value } : current));
    }, []);

    const onSubmit = useCallback((e: FormEvent) => {
        e.preventDefault();
        if (draft) {
            save.mutate(draft);
        }
    }, [ draft, save ]);

    let content;
    if (isError) {
        content = <Alert severity='error'>{getErrorMessage(error)}</Alert>;
    } else if (isPending || !draft) {
        content = <Loading />;
    } else {
        content = (
            <form onSubmit={onSubmit}>
                <Stack spacing={3}>
                    {save.isSuccess && <Alert severity='success'>{globalize.translate('SettingsSaved')}</Alert>}
                    {save.isError && <Alert severity='error'>{getErrorMessage(save.error)}</Alert>}
                    {children(draft, update)}
                    <Box>
                        <Button type='submit' size='large' disabled={save.isPending}>
                            {globalize.translate('Save')}
                        </Button>
                    </Box>
                </Stack>
            </form>
        );
    }

    return (
        <Page id={id} className='mainAnimatedPage type-interior' title={title}>
            <Box className='content-primary'>
                <Stack spacing={3}>
                    <Typography variant='h1'>{title}</Typography>
                    <Typography color='text.secondary'>{description}</Typography>
                    {content}
                </Stack>
            </Box>
        </Page>
    );
};

// The mutation's settings type depends on the kind; the form edits them generically.
const useSaveSettings = (kind: SettingsKind) => {
    const mutation = useSavePirateFinSettings(kind);
    return mutation as unknown as {
        mutate: (settings: Settings) => void;
        isPending: boolean;
        isSuccess: boolean;
        isError: boolean;
        error: unknown;
    };
};

export default SettingsPage;
