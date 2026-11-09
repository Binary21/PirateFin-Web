import ExpandMore from '@mui/icons-material/ExpandMore';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { type ChangeEvent, useCallback, useEffect, useState } from 'react';

import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';

import {
    type DownloadRequest,
    getErrorMessage,
    useCloseRequest,
    useDefaultRequestLimit,
    useDownloadRequests,
    useSaveDefaultRequestLimit,
    useSetRequestMagnet
} from '../../features/piratefin/api/pirateFinApi';

const STATUS_LABELS: Record<DownloadRequest['Status'], string> = {
    Open: 'Open',
    Fulfilled: 'Fulfilled',
    NotFound: 'Not found',
    Cancelled: 'Cancelled by the user'
};

interface EpisodeMagnetProps {
    request: DownloadRequest;
    episode: DownloadRequest['Episodes'][number];
}

/** A requested episode: paste the magnet link of the release you found and it starts downloading. */
const EpisodeMagnet = ({ request, episode }: EpisodeMagnetProps) => {
    const [ magnet, setMagnet ] = useState(episode.MagnetUrl ?? '');
    const setMagnetUrl = useSetRequestMagnet();
    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setMagnet(e.target.value), []);
    const onDownload = useCallback(() => {
        setMagnetUrl.mutate({ requestId: request.Id, episodeId: episode.EpisodeId, magnetUrl: magnet.trim() });
    }, [ episode.EpisodeId, magnet, request.Id, setMagnetUrl ]);

    const open = request.Status === 'Open';
    return (
        <Stack spacing={0.5}>
            <Typography variant='body2'>{episode.Label}</Typography>
            {open ? (
                <Stack direction='row' spacing={1} alignItems='flex-start'>
                    <TextField size='small' label='Magnet link' value={magnet} onChange={onChange} fullWidth />
                    <Button variant='outlined' onClick={onDownload} disabled={!magnet.trim() || setMagnetUrl.isPending} sx={{ flexShrink: 0 }}>
                        Download
                    </Button>
                </Stack>
            ) : (
                episode.MagnetUrl && <Typography variant='caption' color='text.secondary' sx={{ wordBreak: 'break-all' }}>{episode.MagnetUrl}</Typography>
            )}
            {setMagnetUrl.isSuccess && <Alert severity='success'>Downloading.</Alert>}
            {setMagnetUrl.isError && <Alert severity='error'>{getErrorMessage(setMagnetUrl.error)}</Alert>}
        </Stack>
    );
};

/**
 * The requested episodes with their magnet fields. A request for several episodes keeps them folded behind an arrow,
 * so a season request doesn't make the page endless.
 */
const EpisodeMagnets = ({ request }: { request: DownloadRequest }) => {
    const [ open, setOpen ] = useState(false);
    const toggle = useCallback(() => setOpen(value => !value), []);

    if (request.Episodes.length <= 1) {
        return (
            <>
                {request.Episodes.map(episode => <EpisodeMagnet key={episode.EpisodeId} request={request} episode={episode} />)}
            </>
        );
    }

    const withMagnet = request.Episodes.filter(e => e.MagnetUrl).length;
    return (
        <Box>
            <Button
                variant='text'
                color='inherit'
                onClick={toggle}
                aria-expanded={open}
                endIcon={<ExpandMore sx={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />}
                sx={{ px: 0, textTransform: 'none' }}
            >
                {request.Episodes.length} episodes · {withMagnet} with a magnet link
            </Button>
            <Collapse in={open} unmountOnExit>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    {request.Episodes.map(episode => <EpisodeMagnet key={episode.EpisodeId} request={request} episode={episode} />)}
                </Stack>
            </Collapse>
        </Box>
    );
};

/** One request: what was asked, a magnet field per episode, and closing it with a note for the user. */
const RequestCard = ({ request }: { request: DownloadRequest }) => {
    const [ note, setNote ] = useState('');
    const close = useCloseRequest();
    const onNoteChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setNote(e.target.value), []);
    const onFulfilled = useCallback(() => close.mutate({ requestId: request.Id, status: 'Fulfilled', note }), [ close, note, request.Id ]);
    const onNotFound = useCallback(() => close.mutate({ requestId: request.Id, status: 'NotFound', note }), [ close, note, request.Id ]);

    return (
        <Card variant='outlined'>
            <CardContent>
                <Stack spacing={2}>
                    <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
                        <Typography variant='h4' sx={{ flexGrow: 1 }}>{request.SeriesName} {request.Title}</Typography>
                        <Chip size='small' label={STATUS_LABELS[request.Status]} color={request.Status === 'Open' ? 'warning' : 'default'} />
                    </Stack>
                    <Typography variant='body2' color='text.secondary'>
                        Requested by {request.UserName} on {new Date(request.CreatedUtc).toLocaleString()}
                    </Typography>
                    <EpisodeMagnets request={request} />
                    {request.Status === 'Open' ? (
                        <>
                            <TextField label='Note for the user (optional)' value={note} onChange={onNoteChange} multiline fullWidth />
                            <Stack direction='row' spacing={1}>
                                <Button variant='contained' onClick={onFulfilled} disabled={close.isPending}>Close: fulfilled</Button>
                                <Button variant='outlined' color='error' onClick={onNotFound} disabled={close.isPending}>Close: not found</Button>
                            </Stack>
                            {close.isError && <Alert severity='error'>{getErrorMessage(close.error)}</Alert>}
                        </>
                    ) : (
                        request.AdminNote && <Typography variant='body2'>Note: {request.AdminNote}</Typography>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
};

/** The request limit users get unless their own is set on their user page. */
const DefaultLimit = () => {
    const { data } = useDefaultRequestLimit();
    const save = useSaveDefaultRequestLimit();
    const [ limit, setLimit ] = useState('');

    useEffect(() => {
        if (data) {
            setLimit(String(data.Limit));
        }
    }, [ data ]);

    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setLimit(e.target.value), []);
    const onSave = useCallback(() => save.mutate(Number.parseInt(limit, 10)), [ limit, save ]);

    return (
        <Stack direction='row' spacing={2} alignItems='center'>
            <TextField
                label='Default request limit'
                type='number'
                value={limit}
                onChange={onChange}
                helperText='Open requests a user can have at a time, unless set on their user page. -1 for no limit.'
                slotProps={{ htmlInput: { min: -1 } }}
            />
            <Button variant='outlined' onClick={onSave} disabled={!/^-?\d+$/.test(limit) || save.isPending}>Save</Button>
            {save.isSuccess && <Typography color='success.main'>Saved</Typography>}
        </Stack>
    );
};

/** Admin: users' requests for episodes PirateFin couldn't find. */
export const Component = () => {
    const [ includeClosed, setIncludeClosed ] = useState(false);
    const { data: requests, isPending, error } = useDownloadRequests(includeClosed);
    const onToggle = useCallback((e: ChangeEvent<HTMLInputElement>) => setIncludeClosed(e.target.checked), []);

    let content;
    if (error) {
        content = <Alert severity='error'>{getErrorMessage(error)}</Alert>;
    } else if (isPending || !requests) {
        content = <Loading />;
    } else if (!requests.length) {
        content = <Typography color='text.secondary'>{includeClosed ? 'No requests yet.' : 'No open requests.'}</Typography>;
    } else {
        content = requests.map(request => <RequestCard key={request.Id} request={request} />);
    }

    return (
        <Page id='pirateFinRequestsPage' className='mainAnimatedPage type-interior' title='Requests'>
            <Box className='content-primary'>
                <Stack spacing={3}>
                    <Typography variant='h1'>Requests</Typography>
                    <Typography color='text.secondary'>
                        Episodes users asked you to find because PirateFin couldn&apos;t. Paste a magnet link for an episode to download it, then close
                        the request: the user is emailed, and the request stops counting against their limit.
                    </Typography>
                    <DefaultLimit />
                    <FormControlLabel control={<Switch checked={includeClosed} onChange={onToggle} />} label='Show closed requests' />
                    {content}
                </Stack>
            </Box>
        </Page>
    );
};

Component.displayName = 'PirateFinRequestsPage';

export default Component;
