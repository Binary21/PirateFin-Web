import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { type FC, useCallback } from 'react';

import { getErrorMessage, usePopulateStatus, useStartPopulate } from '../api/pirateFinApi';

const formatTime = (utc?: string | null) => (utc ? new Date(utc).toLocaleString() : '');

/**
 * Fills in every series in Shows and Anime: missing seasons and episodes, metadata and images, and release searches
 * spaced out over the following hours. The same happens every night for recent and airing series.
 */
const PopulateLibraries: FC = () => {
    const { data: status } = usePopulateStatus();
    const start = useStartPopulate();
    const onStart = useCallback(() => start.mutate(), [ start ]);

    const running = status?.Running === true;
    const percent = running && status.Total > 0 ? (status.Done / status.Total) * 100 : 0;

    return (
        <Stack spacing={1.5}>
            {running ? (
                <Stack spacing={1}>
                    <Typography>
                        {status.Kind === 'Nightly' ? 'Nightly run' : 'Filling in'}: {status.Done} of {status.Total} series
                        {status.Current ? ` (now: ${status.Current})` : ''}
                    </Typography>
                    <LinearProgress variant='determinate' value={percent} />
                </Stack>
            ) : (
                <Stack direction='row'>
                    <Button onClick={onStart} disabled={start.isPending || !status} sx={{ fontWeight: 'bold' }}>
                        Populate libraries
                    </Button>
                </Stack>
            )}
            {start.isError && <Alert severity='error'>{getErrorMessage(start.error)}</Alert>}
            {!running && status?.FinishedUtc && (
                <Typography variant='body2' color='text.secondary'>
                    Last {status.Kind === 'Nightly' ? 'nightly ' : ''}run finished {formatTime(status.FinishedUtc)}: {status.Done} series
                    {status.Failed > 0 ? `, ${status.Failed} not found on Trakt / AniList` : ''}.
                </Typography>
            )}
            {status?.ReleaseSearchesUntilUtc && (
                <Typography variant='body2' color='text.secondary'>
                    Release searches are spaced out to spare Jackett and go on until about {formatTime(status.ReleaseSearchesUntilUtc)}.
                </Typography>
            )}
        </Stack>
    );
};

export default PopulateLibraries;
