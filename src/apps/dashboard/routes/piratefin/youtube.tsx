import OpenInNew from '@mui/icons-material/OpenInNew';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepContent from '@mui/material/StepContent';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { type ChangeEvent, type FormEvent, type ReactNode, useCallback, useState } from 'react';

import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';

import { type YouTubeSettings, getErrorMessage, useSaveYouTubeSettings, useYouTubeSettings } from '../../features/piratefin/api/pirateFinApi';

const DAILY_UNITS = 10000;
const CREATE_PROJECT_URL = 'https://console.cloud.google.com/projectcreate';
const ENABLE_API_URL = 'https://console.cloud.google.com/apis/library/youtube.googleapis.com';
const CREDENTIALS_URL = 'https://console.cloud.google.com/apis/credentials';
const CONSENT_URL = 'https://console.cloud.google.com/auth/overview';
const AUDIENCE_URL = 'https://console.cloud.google.com/auth/audience';
const CLIENTS_URL = 'https://console.cloud.google.com/auth/clients';

/** Opens a Google Cloud console page in a new tab. */
const ConsoleLink = ({ href, children }: { href: string; children: ReactNode }) => (
    <Box>
        <Button component='a' href={href} target='_blank' rel='noopener noreferrer' variant='outlined' endIcon={<OpenInNew />}>
            {children}
        </Button>
    </Box>
);

/** The API key, OAuth client and limits. */
const KeysForm = ({ settings, onSaved }: { settings: YouTubeSettings; onSaved?: () => void }) => {
    const [ apiKey, setApiKey ] = useState(settings.ApiKey);
    const [ clientId, setClientId ] = useState(settings.ClientId);
    const [ clientSecret, setClientSecret ] = useState('');
    const [ searchCap, setSearchCap ] = useState(String(settings.DailySearchCap));
    const [ region, setRegion ] = useState(settings.RegionCode);
    const save = useSaveYouTubeSettings();

    const onApiKey = useCallback((e: ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value), []);
    const onClientId = useCallback((e: ChangeEvent<HTMLInputElement>) => setClientId(e.target.value), []);
    const onClientSecret = useCallback((e: ChangeEvent<HTMLInputElement>) => setClientSecret(e.target.value), []);
    const onSearchCap = useCallback((e: ChangeEvent<HTMLInputElement>) => setSearchCap(e.target.value), []);
    const onRegion = useCallback((e: ChangeEvent<HTMLInputElement>) => setRegion(e.target.value), []);

    const onSubmit = useCallback((e: FormEvent) => {
        e.preventDefault();
        save.mutate({
            ...settings,
            ApiKey: apiKey.trim(),
            ClientId: clientId.trim(),
            ClientSecret: clientSecret,
            DailySearchCap: Number.parseInt(searchCap, 10) || 0,
            RegionCode: region.trim()
        }, { onSuccess: onSaved });
    }, [ apiKey, clientId, clientSecret, onSaved, region, save, searchCap, settings ]);

    return (
        <form onSubmit={onSubmit}>
            <Stack spacing={2} sx={{ pt: 1 }}>
                {save.isError && <Alert severity='error'>{getErrorMessage(save.error)}</Alert>}
                {save.isSuccess && !onSaved && <Alert severity='success'>Saved.</Alert>}
                <TextField
                    label='API key'
                    value={apiKey}
                    onChange={onApiKey}
                    helperText='Needed for everything: videos, channels, search and linking by channel.'
                    autoComplete='off'
                    required
                    fullWidth
                />
                <TextField
                    label='OAuth client ID'
                    value={clientId}
                    onChange={onClientId}
                    helperText='Ends in .apps.googleusercontent.com. Needed for "Sign in with Google".'
                    autoComplete='off'
                    fullWidth
                />
                <TextField
                    label='OAuth client secret'
                    type='password'
                    value={clientSecret}
                    onChange={onClientSecret}
                    helperText={settings.HasClientSecret ? 'Leave empty to keep the saved secret.' : 'Stored encrypted on this server.'}
                    autoComplete='new-password'
                    fullWidth
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField
                        label='Searches per day (all users)'
                        type='number'
                        value={searchCap}
                        onChange={onSearchCap}
                        helperText='Each search costs 100 of the 10,000 daily units. 50 uses half.'
                        slotProps={{ htmlInput: { min: 0, max: 100 } }}
                        fullWidth
                    />
                    <TextField
                        label='Region'
                        value={region}
                        onChange={onRegion}
                        helperText='Two letter country code for popular videos, e.g. US, GB, NL.'
                        slotProps={{ htmlInput: { maxLength: 2 } }}
                        fullWidth
                    />
                </Stack>
                <Box><Button type='submit' disabled={save.isPending}>Save</Button></Box>
            </Stack>
        </form>
    );
};

/** The step by step Google Cloud set up. */
const Guide = ({ settings, onDone }: { settings: YouTubeSettings; onDone: () => void }) => {
    const [ active, setActive ] = useState(0);
    const next = useCallback(() => setActive(step => step + 1), []);
    const back = useCallback(() => setActive(step => step - 1), []);

    const steps: { label: string; content: ReactNode }[] = [
        {
            label: 'Create a Google Cloud project',
            content: (
                <>
                    <Typography>
                        Sign in to the Google Cloud console with any Google account (a dedicated one is best, like for email)
                        and create a project named &quot;PirateFin&quot;. It&apos;s free: no billing account is needed.
                    </Typography>
                    <ConsoleLink href={CREATE_PROJECT_URL}>Create a project</ConsoleLink>
                </>
            )
        },
        {
            label: 'Turn on the YouTube Data API v3',
            content: (
                <>
                    <Typography>With the PirateFin project selected at the top, open the API&apos;s page and select Enable.</Typography>
                    <ConsoleLink href={ENABLE_API_URL}>Open YouTube Data API v3</ConsoleLink>
                </>
            )
        },
        {
            label: 'Create an API key',
            content: (
                <>
                    <Typography>
                        On Credentials, select Create credentials → API key. Then edit the key: under API restrictions choose
                        &quot;Restrict key&quot; and tick only YouTube Data API v3, and save. Copy the key.
                    </Typography>
                    <ConsoleLink href={CREDENTIALS_URL}>Open Credentials</ConsoleLink>
                </>
            )
        },
        {
            label: 'Set up the sign in screen (optional, for "Sign in with Google")',
            content: (
                <>
                    <Typography>
                        Skip this and the next step if users will only link by channel. Otherwise open Google Auth Platform and
                        select Get started: app name &quot;PirateFin&quot;, your email as support and contact email, and
                        Audience &quot;External&quot;.
                    </Typography>
                    <ConsoleLink href={CONSENT_URL}>Open Google Auth Platform</ConsoleLink>
                    <Typography>
                        Then on Audience, select Publish app (&quot;In production&quot;). Don&apos;t submit it for
                        verification. Up to 100 people can sign in; they&apos;ll see &quot;Google hasn&apos;t verified this
                        app&quot; and continue with Advanced → Go to PirateFin.
                    </Typography>
                    <Alert severity='info'>
                        If you leave it in &quot;Testing&quot; instead, add each user&apos;s Google account under Test users. In
                        Testing, Google ends sign ins after 7 days and users have to link again every week.
                    </Alert>
                    <ConsoleLink href={AUDIENCE_URL}>Open Audience</ConsoleLink>
                </>
            )
        },
        {
            label: 'Create the OAuth client (optional)',
            content: (
                <>
                    <Typography>
                        On Clients, select Create client, choose the application type &quot;TVs and Limited Input
                        devices&quot; and the name &quot;PirateFin&quot;. Copy the client ID and secret.
                    </Typography>
                    <ConsoleLink href={CLIENTS_URL}>Open Clients</ConsoleLink>
                </>
            )
        },
        {
            label: 'Enter the keys',
            content: <KeysForm settings={settings} onSaved={onDone} />
        }
    ];

    return (
        <Stepper activeStep={active} orientation='vertical'>
            {steps.map(({ label, content }, index) => (
                <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                    <StepContent>
                        <Stack spacing={2}>
                            {content}
                            <Stack direction='row' spacing={2}>
                                {index > 0 && <Button type='button' variant='text' onClick={back}>Back</Button>}
                                {index < steps.length - 1 && <Button type='button' onClick={next}>Next</Button>}
                            </Stack>
                        </Stack>
                    </StepContent>
                </Step>
            ))}
        </Stepper>
    );
};

/** The on/off switch and today's quota. */
const Status = ({ settings }: { settings: YouTubeSettings }) => {
    const save = useSaveYouTubeSettings();
    const onToggle = useCallback((e: ChangeEvent<HTMLInputElement>) => save.mutate({ ...settings, ClientSecret: '', Enabled: e.target.checked }), [ save, settings ]);
    const used = Math.min(100, (settings.UnitsUsedToday / DAILY_UNITS) * 100);

    return (
        <Stack spacing={2}>
            {save.isError && <Alert severity='error'>{getErrorMessage(save.error)}</Alert>}
            <Box>
                <FormControlLabel
                    control={<Switch checked={settings.Enabled} onChange={onToggle} disabled={save.isPending || !settings.ApiKey} />}
                    label='Show the YouTube tab'
                />
                <Typography variant='body2' color='text.secondary'>
                    Adds a YouTube tab next to Anime for every user. Each user links their own YouTube there, by signing in with
                    Google or by their channel. Turning it off hides the tab; links and downloads are kept.
                </Typography>
            </Box>
            <Box>
                <Typography>
                    Today: {settings.UnitsUsedToday.toLocaleString()} of {DAILY_UNITS.toLocaleString()} API units used ·
                    {' '}{settings.SearchesLeftToday} searches left (resets at midnight Pacific time)
                </Typography>
                <LinearProgress variant='determinate' value={used} color={used > 80 ? 'warning' : 'primary'} sx={{ mt: 1, maxWidth: 480 }} />
            </Box>
        </Stack>
    );
};

export const Component = () => {
    const { data: settings, isPending, isError, error } = useYouTubeSettings();
    const [ guide, setGuide ] = useState(false);
    const showGuide = useCallback(() => setGuide(true), []);
    const hideGuide = useCallback(() => setGuide(false), []);

    let content;
    if (isError) {
        content = <Alert severity='error'>{getErrorMessage(error)}</Alert>;
    } else if (isPending || !settings) {
        content = <Loading />;
    } else if (guide || !settings.ApiKey) {
        content = (
            <Stack spacing={2}>
                <Typography>
                    PirateFin reads YouTube only through Google&apos;s official YouTube Data API, with a free Google Cloud
                    project of your own. This takes about 10 minutes.
                </Typography>
                <Guide settings={settings} onDone={hideGuide} />
                {settings.ApiKey && <Box><Button type='button' variant='text' onClick={hideGuide}>Cancel</Button></Box>}
            </Stack>
        );
    } else {
        content = (
            <Stack spacing={4}>
                <Status settings={settings} />
                {!settings.ClientId && (
                    <Alert severity='info'>
                        &quot;Sign in with Google&quot; isn&apos;t set up, so users can only link by channel (with public
                        subscriptions). Open the set up guide to add an OAuth client.
                    </Alert>
                )}
                <Stack spacing={1}>
                    <Typography variant='h3'>Keys</Typography>
                    <KeysForm settings={settings} />
                </Stack>
                <Box><Button type='button' variant='outlined' onClick={showGuide}>Open the set up guide</Button></Box>
            </Stack>
        );
    }

    return (
        <Page id='pirateFinYouTubePage' className='mainAnimatedPage type-interior' title='YouTube'>
            <Box className='content-primary'>
                <Stack spacing={3}>
                    <Typography variant='h1'>YouTube</Typography>
                    <Alert severity='warning'>
                        <AlertTitle>Off by default</AlertTitle>
                        The YouTube tab stays hidden from users until you turn it on here. Videos are streamed through this
                        server with yt-dlp and only stored when a user downloads one.
                    </Alert>
                    {content}
                </Stack>
            </Box>
        </Page>
    );
};

Component.displayName = 'PirateFinYouTubePage';

export default Component;
