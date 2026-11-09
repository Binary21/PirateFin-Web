import OpenInNew from '@mui/icons-material/OpenInNew';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepContent from '@mui/material/StepContent';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode, useCallback, useEffect, useState } from 'react';

import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import confirm from 'components/confirm/confirm';

import {
    type GmailSettings,
    getErrorMessage,
    useGmailSettings,
    useSaveEmailPublicAddress,
    useSaveGmailSettings,
    useSendTestEmail
} from '../../features/piratefin/api/pirateFinApi';

const SIGN_UP_URL = 'https://accounts.google.com/signup';
const TWO_STEP_URL = 'https://myaccount.google.com/signinoptions/twosv';
// A link to Google's page, not a password.
// eslint-disable-next-line sonarjs/no-hardcoded-passwords
const APP_PASSWORDS_PAGE = 'https://myaccount.google.com/apppasswords';

type Mode = 'new' | 'existing';

/** Opens one of Google's account pages in a new tab. */
const GoogleLink = ({ href, children }: { href: string; children: ReactNode }) => (
    <Button component='a' href={href} target='_blank' rel='noopener noreferrer' variant='outlined' endIcon={<OpenInNew />}>
        {children}
    </Button>
);

/** Shown on every view: the account's app password lives on this server and its address is on every email. */
const DedicatedAccountWarning = () => (
    <Alert severity='warning'>
        <AlertTitle>Use a dedicated Gmail account for PirateFin</AlertTitle>
        Do <strong>NOT</strong> use your personal email account. Create a new Gmail account that is only used by PirateFin.
        Its app password is stored on this server and lets PirateFin send email as that account, and its address is shown
        to everyone who gets an email. If the server is ever compromised, only the dedicated account is affected.
    </Alert>
);

/** Sends a test email from the saved account. */
const TestEmail = () => {
    const [ to, setTo ] = useState('');
    const send = useSendTestEmail();

    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setTo(e.target.value), []);
    const onSend = useCallback(() => send.mutate(to.trim()), [ send, to ]);

    const onKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onSend();
        }
    }, [ onSend ]);

    return (
        <Stack spacing={1}>
            {send.isSuccess && <Alert severity='success'>Sent. Check the inbox (and the spam folder).</Alert>}
            {send.isError && <Alert severity='error'>{getErrorMessage(send.error)}</Alert>}
            <Stack direction='row' spacing={2} alignItems='center'>
                <TextField label='Send a test email to' type='email' value={to} onChange={onChange} onKeyDown={onKeyDown} fullWidth />
                <Button type='button' variant='outlined' onClick={onSend} disabled={!to.trim() || send.isPending} sx={{ flexShrink: 0 }}>
                    Send test email
                </Button>
            </Stack>
        </Stack>
    );
};

/** The address the buttons in emails (Watch now, Sign in, ...) link to. */
const PublicAddress = ({ settings }: { settings: GmailSettings }) => {
    const [ address, setAddress ] = useState(settings.PublicAddress);
    const save = useSaveEmailPublicAddress();

    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setAddress(e.target.value), []);
    const onSubmit = useCallback((e: FormEvent) => {
        e.preventDefault();
        save.mutate(address.trim());
    }, [ address, save ]);

    return (
        <form onSubmit={onSubmit}>
            <Stack spacing={1}>
                {save.isSuccess && <Alert severity='success'>Saved.</Alert>}
                {save.isError && <Alert severity='error'>{getErrorMessage(save.error)}</Alert>}
                <Stack direction='row' spacing={2} alignItems='flex-start'>
                    <TextField
                        label='Public address'
                        type='url'
                        value={address}
                        onChange={onChange}
                        helperText='Where PirateFin is reached from the internet, e.g. https://piratefin.com. Leave empty for emails without buttons.'
                        autoComplete='off'
                        fullWidth
                    />
                    <Button type='submit' variant='outlined' disabled={save.isPending || address.trim() === settings.PublicAddress} sx={{ flexShrink: 0, mt: 1 }}>
                        Save
                    </Button>
                </Stack>
            </Stack>
        </form>
    );
};

interface DetailsFormProps {
    settings: GmailSettings;
    onSaved: () => void;
    onBack?: () => void;
}

/** The Gmail address, app password and sender name. */
const DetailsForm = ({ settings, onSaved, onBack }: DetailsFormProps) => {
    const [ address, setAddress ] = useState(settings.Address);
    const [ appPassword, setAppPassword ] = useState('');
    const [ fromName, setFromName ] = useState(settings.FromName || 'PirateFin');
    const save = useSaveGmailSettings();

    // Changing the address needs that account's app password.
    const keepsPassword = settings.HasAppPassword && !settings.AppPasswordUnreadable && address.trim() === settings.Address;

    const onAddressChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setAddress(e.target.value), []);
    const onAppPasswordChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setAppPassword(e.target.value), []);
    const onFromNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setFromName(e.target.value), []);

    const onSubmit = useCallback((e: FormEvent) => {
        e.preventDefault();
        save.mutate(
            { Address: address.trim(), FromName: fromName.trim(), AppPassword: appPassword },
            { onSuccess: onSaved }
        );
    }, [ address, appPassword, fromName, onSaved, save ]);

    return (
        <form onSubmit={onSubmit}>
            <Stack spacing={2} sx={{ pt: 1 }}>
                {save.isError && <Alert severity='error'>{getErrorMessage(save.error)}</Alert>}
                <TextField
                    label='Gmail address'
                    type='email'
                    value={address}
                    onChange={onAddressChange}
                    helperText='The dedicated account, e.g. myserver.piratefin@gmail.com'
                    autoComplete='off'
                    required
                    fullWidth
                />
                <TextField
                    label='App password'
                    type='password'
                    value={appPassword}
                    onChange={onAppPasswordChange}
                    helperText={keepsPassword ?
                        'Leave empty to keep the saved app password.' :
                        'The 16 letters from the App passwords page (spaces are fine). Not the account\'s normal password.'}
                    autoComplete='new-password'
                    required={!keepsPassword}
                    fullWidth
                />
                <TextField
                    label='Send from (name)'
                    value={fromName}
                    onChange={onFromNameChange}
                    helperText='The name users see as the sender.'
                    autoComplete='off'
                    fullWidth
                />
                <Stack direction='row' spacing={2}>
                    {onBack && <Button type='button' variant='text' onClick={onBack}>Back</Button>}
                    <Button type='submit' disabled={save.isPending}>Save</Button>
                </Stack>
            </Stack>
        </form>
    );
};

interface WizardProps {
    mode: Mode;
    settings: GmailSettings;
    onCancel: () => void;
    onDone: () => void;
}

/** The step by step Gmail set up. */
const Wizard = ({ mode, settings, onCancel, onDone }: WizardProps) => {
    const [ active, setActive ] = useState(0);
    const next = useCallback(() => setActive(step => step + 1), []);
    const back = useCallback(() => setActive(step => step - 1), []);

    const steps: { label: string; content: ReactNode }[] = [];

    if (mode === 'new') {
        steps.push({
            label: 'Create the Gmail account',
            content: (
                <Stack spacing={2}>
                    <Typography>
                        Open Google&apos;s sign up page and create a new account only for PirateFin, choosing
                        &quot;For my personal use&quot;. Keep its password somewhere safe; PirateFin doesn&apos;t need it.
                    </Typography>
                    <Box><GoogleLink href={SIGN_UP_URL}>Open Google sign up</GoogleLink></Box>
                </Stack>
            )
        });
    }

    steps.push(
        {
            label: 'Turn on 2-Step Verification',
            content: (
                <Stack spacing={2}>
                    <Typography>
                        Signed in to the PirateFin account, turn on 2-Step Verification. Google only offers app passwords
                        once it&apos;s on. A phone number is enough.
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                        If you&apos;re signed in to several Google accounts, check that the account picker in the top right
                        shows the PirateFin account and not your personal one.
                    </Typography>
                    <Box><GoogleLink href={TWO_STEP_URL}>Open 2-Step Verification</GoogleLink></Box>
                </Stack>
            )
        },
        {
            label: 'Create an app password',
            content: (
                <Stack spacing={2}>
                    <Typography>
                        Open App passwords, enter the name &quot;PirateFin&quot; and select Create. Google shows a 16 letter
                        password once; copy it for the next step.
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                        If the page says the setting isn&apos;t available, 2-Step Verification isn&apos;t on yet.
                    </Typography>
                    <Box><GoogleLink href={APP_PASSWORDS_PAGE}>Open App passwords</GoogleLink></Box>
                </Stack>
            )
        },
        {
            label: 'Enter the account details',
            content: <DetailsForm settings={settings} onSaved={next} onBack={back} />
        },
        {
            label: 'Send a test email',
            content: (
                <Stack spacing={2}>
                    <Typography>Send a test email to your own address to check that Gmail accepts the sign in.</Typography>
                    <TestEmail />
                    <Box><Button type='button' onClick={onDone}>Finish</Button></Box>
                </Stack>
            )
        }
    );

    // The details and test steps have their own buttons.
    const detailsStep = steps.length - 2;

    return (
        <Stack spacing={2}>
            <Stepper activeStep={active} orientation='vertical'>
                {steps.map(({ label, content }, index) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                        <StepContent>
                            <Stack spacing={2}>
                                {content}
                                {index < detailsStep && (
                                    <Stack direction='row' spacing={2}>
                                        {index > 0 && <Button type='button' variant='text' onClick={back}>Back</Button>}
                                        <Button type='button' onClick={next}>Next</Button>
                                    </Stack>
                                )}
                            </Stack>
                        </StepContent>
                    </Step>
                ))}
            </Stepper>
            <Box><Button type='button' variant='text' onClick={onCancel}>Cancel</Button></Box>
        </Stack>
    );
};

/** Lets the admin pick how to start when no account is set up (or they're switching accounts). */
const ChooseMode = ({ onChoose, onCancel }: { onChoose: (mode: Mode) => void; onCancel?: () => void }) => {
    const onNew = useCallback(() => onChoose('new'), [ onChoose ]);
    const onExisting = useCallback(() => onChoose('existing'), [ onChoose ]);

    return (
        <Stack spacing={2}>
            <Typography>
                PirateFin emails users when a new episode of a season they follow is ready, and about their requests. It
                sends them from a Gmail account through smtp.gmail.com with an app password.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button type='button' size='large' onClick={onNew}>Create a new Gmail account</Button>
                <Button type='button' size='large' variant='outlined' onClick={onExisting}>
                    I already have a dedicated Gmail account
                </Button>
                {onCancel && <Button type='button' variant='text' onClick={onCancel}>Cancel</Button>}
            </Stack>
        </Stack>
    );
};

/** Shows the account in use, with a test, change and turn off. */
const Connected = ({ settings, onChange }: { settings: GmailSettings; onChange: () => void }) => {
    const save = useSaveGmailSettings();

    const onTurnOff = useCallback(() => {
        confirm({
            title: 'Turn email off',
            text: 'PirateFin will stop sending emails and forget the app password. You can also revoke it on Google\'s App passwords page.',
            confirmText: 'Turn off',
            primary: 'delete'
        }).then(() => save.mutate({ Address: '', FromName: settings.FromName, AppPassword: '' }))
            .catch(() => { /* cancelled */ });
    }, [ save, settings.FromName ]);

    return (
        <Stack spacing={3}>
            {settings.AppPasswordUnreadable ? (
                <Alert severity='error'>
                    The saved app password for {settings.Address} can&apos;t be read on this server (it was saved by another
                    Windows account or machine). Select Change account and enter it again.
                </Alert>
            ) : (
                <Alert severity='success'>Emails are sent from <strong>{settings.Address}</strong> as &quot;{settings.FromName}&quot;.</Alert>
            )}
            {save.isError && <Alert severity='error'>{getErrorMessage(save.error)}</Alert>}
            <Stack direction='row' spacing={2}>
                <Button type='button' variant='outlined' onClick={onChange}>Change account</Button>
                <Button type='button' variant='text' color='error' onClick={onTurnOff} disabled={save.isPending}>Turn email off</Button>
            </Stack>
            <Stack spacing={1}>
                <Typography variant='h3'>Links in emails</Typography>
                <PublicAddress settings={settings} />
            </Stack>
            <Stack spacing={1}>
                <Typography variant='h3'>Test</Typography>
                <TestEmail />
            </Stack>
        </Stack>
    );
};

type View = { kind: 'status' } | { kind: 'choose' } | { kind: 'wizard'; mode: Mode };

export const Component = () => {
    const { data: settings, isPending, isError, error } = useGmailSettings();
    const [ view, setView ] = useState<View>({ kind: 'status' });

    const isConfigured = !!settings?.Address && settings.HasAppPassword;

    // Once loaded, an unconfigured server starts at the choice.
    useEffect(() => {
        if (settings && !isConfigured) {
            setView(current => (current.kind === 'status' ? { kind: 'choose' } : current));
        }
    }, [ settings, isConfigured ]);

    const showStatus = useCallback(() => setView(isConfigured ? { kind: 'status' } : { kind: 'choose' }), [ isConfigured ]);
    const showChoose = useCallback(() => setView({ kind: 'choose' }), []);
    const startWizard = useCallback((mode: Mode) => setView({ kind: 'wizard', mode }), []);
    const finish = useCallback(() => setView({ kind: 'status' }), []);

    let content;
    if (isError) {
        content = <Alert severity='error'>{getErrorMessage(error)}</Alert>;
    } else if (isPending || !settings) {
        content = <Loading />;
    } else if (view.kind === 'wizard') {
        content = <Wizard mode={view.mode} settings={settings} onCancel={showStatus} onDone={finish} />;
    } else if (view.kind === 'choose' || !isConfigured) {
        content = <ChooseMode onChoose={startWizard} onCancel={isConfigured ? showStatus : undefined} />;
    } else {
        content = <Connected settings={settings} onChange={showChoose} />;
    }

    return (
        <Page id='pirateFinGmailPage' className='mainAnimatedPage type-interior' title='Email (Gmail)'>
            <Box className='content-primary'>
                <Stack spacing={3}>
                    <Typography variant='h1'>Email (Gmail)</Typography>
                    <Typography color='text.secondary'>
                        The Gmail account PirateFin sends email from (gmail.json). Users enter their own address on their
                        profile page.
                    </Typography>
                    <DedicatedAccountWarning />
                    {content}
                </Stack>
            </Box>
        </Page>
    );
};

Component.displayName = 'PirateFinGmailPage';

export default Component;
