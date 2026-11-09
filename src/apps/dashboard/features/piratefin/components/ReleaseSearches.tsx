import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import React, { type FC, useCallback, useState } from 'react';

import confirm from 'components/confirm/confirm';

import {
    getErrorMessage,
    type ReleaseSearchStatus,
    useReleaseSearchStatus,
    useSetOldSearchesPaused,
    useStopOldSearches,
    useStopShowOldSearches
} from '../api/pirateFinApi';

const formatTime = (utc?: string | null) => (utc ? new Date(utc).toLocaleString() : '');

/** "now" for searches that are due, else the time; "paused" when all that's left is paused. */
const formatNext = (utc: string | null | undefined, calculated: string) => {
    if (!utc) {
        return 'paused';
    }
    return new Date(utc) <= new Date(calculated) ? 'now' : formatTime(utc);
};

type Show = ReleaseSearchStatus['Shows'][number];

const oldHint = (status: ReleaseSearchStatus) => {
    if (status.OldPaused) {
        return 'One search each; paused';
    }
    return status.OldPassEndsUtc ? `One search each; done about ${formatTime(status.OldPassEndsUtc)}` : 'One search each';
};

/** Pause / resume and cancel of one show's old searches; its new episodes are never paused. */
const ShowActions: FC<{
    show: Show;
    busy: boolean;
    onTogglePause: (show: Show) => void;
    onStop: (show: Show) => void;
}> = ({ show, busy, onTogglePause, onStop }) => {
    const togglePause = useCallback(() => onTogglePause(show), [ show, onTogglePause ]);
    const stop = useCallback(() => onStop(show), [ show, onStop ]);

    if (show.OldEpisodes === 0 && !show.Paused) {
        return null;
    }

    return (
        <Stack direction='row' spacing={1}>
            <Button size='small' onClick={togglePause} disabled={busy}>{show.Paused ? 'Resume' : 'Pause'}</Button>
            {show.OldEpisodes > 0 && (
                <Button size='small' color='error' onClick={stop} disabled={busy}>Cancel</Button>
            )}
        </Stack>
    );
};

/** Shows listed before "Show all". */
const SHOWS_SHOWN = 25;

const Count: FC<{ label: string; value: number; hint: string }> = ({ label, value, hint }) => (
    <Box sx={{ minWidth: 140 }}>
        <Typography variant='h4' component='div'>{value.toLocaleString()}</Typography>
        <Typography fontWeight='bold'>{label}</Typography>
        <Typography variant='body2' color='text.secondary'>{hint}</Typography>
    </Box>
);

/**
 * What the episode release searches (Jackett) are doing: counts by group, what's being searched right now, what the
 * last 24 hours found and the shows still in the queue. Loaded when the page opens; Refresh loads it again.
 */
const ReleaseSearches: FC = () => {
    const { data: status, isFetching, isError, error, refetch } = useReleaseSearchStatus();
    const stopOld = useStopOldSearches();
    const setPaused = useSetOldSearchesPaused();
    const stopShow = useStopShowOldSearches();
    const [ showAll, setShowAll ] = useState(false);

    const onRefresh = useCallback(() => {
        void refetch();
    }, [ refetch ]);

    const onShowAll = useCallback(() => setShowAll(true), []);

    const onStopOld = useCallback(() => {
        confirm({
            title: 'Stop old searches',
            text: `This stops the release searches of the ${status?.OldEpisodes.toLocaleString() ?? ''} older episodes still waiting for theirs. `
                + 'They keep no release, so opening or playing one won\'t start a download until something searches it again '
                + '(a refresh of the series that re-adds it, or a request). New episodes keep being searched.',
            confirmText: 'Stop',
            primary: 'delete'
        }).then(() => stopOld.mutate())
            .catch(() => { /* cancelled */ });
    }, [ status?.OldEpisodes, stopOld ]);

    const onTogglePause = useCallback(() => {
        if (status) {
            setPaused.mutate({ paused: !status.OldPaused });
        }
    }, [ status, setPaused ]);

    const onToggleShowPause = useCallback((show: Show) => {
        setPaused.mutate({ seriesId: show.SeriesId, paused: !show.Paused });
    }, [ setPaused ]);

    const onStopShow = useCallback((show: Show) => {
        confirm({
            title: `Cancel ${show.SeriesName}'s old searches`,
            text: `This stops the release searches of ${show.SeriesName}'s ${show.OldEpisodes.toLocaleString()} older episodes. `
                + 'They keep no release, so opening or playing one won\'t start a download until something searches it again '
                + '(a refresh of the series that re-adds it, or a request). Its new episodes keep being searched.',
            confirmText: 'Cancel searches',
            primary: 'delete'
        }).then(() => stopShow.mutate(show.SeriesId))
            .catch(() => { /* cancelled */ });
    }, [ stopShow ]);

    // The show whose pause / cancel is being sent, to disable its buttons meanwhile.
    const busyShow = (setPaused.isPending && setPaused.variables.seriesId)
        || (stopShow.isPending && stopShow.variables)
        || undefined;

    if (isError) {
        return <Alert severity='error'>{getErrorMessage(error)}</Alert>;
    }

    if (!status) {
        return <LinearProgress />;
    }

    const shows = showAll ? status.Shows : status.Shows.slice(0, SHOWS_SHOWN);

    return (
        <Stack spacing={2.5}>
            <Stack direction='row' spacing={1} alignItems='center'>
                <Button onClick={onRefresh} disabled={isFetching}>Refresh</Button>
                <Button onClick={onTogglePause} disabled={setPaused.isPending}>
                    {status.OldPaused ? 'Resume old searches' : 'Pause old searches'}
                </Button>
                <Button color='error' onClick={onStopOld} disabled={stopOld.isPending || status.OldEpisodes === 0}>
                    Stop old searches
                </Button>
                <Typography variant='body2' color='text.secondary'>
                    Counts from {formatTime(status.CalculatedUtc)}
                </Typography>
            </Stack>
            {isFetching && <LinearProgress />}
            {status.OldPaused && (
                <Alert severity='info'>
                    Old searches are paused for every show; new episodes are still searched. When resumed, the searches
                    carry on where they were.
                </Alert>
            )}
            {stopOld.isError && <Alert severity='error'>{getErrorMessage(stopOld.error)}</Alert>}
            {setPaused.isError && <Alert severity='error'>{getErrorMessage(setPaused.error)}</Alert>}
            {stopShow.isError && <Alert severity='error'>{getErrorMessage(stopShow.error)}</Alert>}
            {stopShow.data && <Alert severity='success'>Cancelled the searches of {stopShow.data.Stopped.toLocaleString()} older episodes.</Alert>}
            {stopOld.data && <Alert severity='success'>Stopped the searches of {stopOld.data.Stopped.toLocaleString()} older episodes.</Alert>}

            <Stack direction='row' spacing={3} useFlexGap flexWrap='wrap'>
                <Count label='Searching now' value={status.SearchingNow.length} hint={`${status.DueNow.toLocaleString()} due, waiting for a slot`} />
                <Count label='New episodes' value={status.NewEpisodes} hint='Aired this week; retried until a release turns up' />
                <Count
                    label='Old episodes left'
                    value={status.OldEpisodes}
                    hint={oldHint(status)}
                />
                <Count label='Waiting to air' value={status.WaitingToAir} hint='Searched once they air' />
            </Stack>

            <Box>
                <Typography variant='h3' gutterBottom>Searching now</Typography>
                {status.SearchingNow.length === 0 ? (
                    <Typography color='text.secondary'>Nothing is being searched right now.</Typography>
                ) : (
                    status.SearchingNow.map(e => (
                        <Typography key={`${e.SeriesName}-${e.Episode}`}>
                            {e.SeriesName} {e.Episode}{e.Name ? ` · ${e.Name}` : ''}
                        </Typography>
                    ))
                )}
            </Box>

            <Box>
                <Typography variant='h3' gutterBottom>Results since {formatTime(status.ResultsSinceUtc)}</Typography>
                <Typography>
                    {status.FoundPreferred.toLocaleString()} found a preferred release · {status.FoundFallbackOnly.toLocaleString()} only
                    other releases · {status.FoundNothing.toLocaleString()} nothing
                </Typography>
            </Box>

            <Box>
                <Typography variant='h3' gutterBottom>Queue by show ({status.Shows.length.toLocaleString()})</Typography>
                {status.Shows.length === 0 ? (
                    <Typography color='text.secondary'>No episodes are waiting for a search.</Typography>
                ) : (
                    <TableContainer>
                        <Table size='small'>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Show</TableCell>
                                    <TableCell align='right'>New</TableCell>
                                    <TableCell align='right'>Old</TableCell>
                                    <TableCell>Next search</TableCell>
                                    <TableCell>Old searches</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {shows.map(show => (
                                    <TableRow key={show.SeriesId}>
                                        <TableCell>{show.SeriesName}</TableCell>
                                        <TableCell align='right'>{show.NewEpisodes || ''}</TableCell>
                                        <TableCell align='right'>{show.OldEpisodes || ''}</TableCell>
                                        <TableCell>{formatNext(show.NextSearchUtc, status.CalculatedUtc)}</TableCell>
                                        <TableCell>
                                            <ShowActions
                                                show={show}
                                                busy={busyShow === show.SeriesId}
                                                onTogglePause={onToggleShowPause}
                                                onStop={onStopShow}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
                {!showAll && status.Shows.length > SHOWS_SHOWN && (
                    <Button onClick={onShowAll} sx={{ mt: 1 }}>Show all {status.Shows.length.toLocaleString()}</Button>
                )}
            </Box>
        </Stack>
    );
};

export default ReleaseSearches;
