import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import React, { type ChangeEvent, useCallback } from 'react';

import confirm from 'components/confirm/confirm';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';

import {
    getErrorMessage,
    useDeleteAllTrailers,
    useSaveMissingTrailers,
    useSaveTrailerSettings,
    useTrailerSettings
} from '../../features/piratefin/api/pirateFinApi';

function formatSize(bytes: number): string {
    if (bytes >= 1024 ** 3) {
        return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
    }
    return `${Math.round(bytes / 1024 ** 2)} MB`;
}

export const Component = () => {
    const { data: settings, isPending, isError, error } = useTrailerSettings();
    const save = useSaveTrailerSettings();
    const deleteAll = useDeleteAllTrailers();
    const saveMissing = useSaveMissingTrailers();

    const onToggle = useCallback((e: ChangeEvent<HTMLInputElement>) => save.mutate(e.target.checked), [ save ]);
    const onSaveMissing = useCallback(() => saveMissing.mutate(), [ saveMissing ]);

    const onDeleteAll = useCallback(() => {
        const again = settings?.Enabled ?
            ' Downloads are still on, so they\'ll be saved again by the daily task: turn downloads off first to keep the space free.' :
            '';
        confirm({
            title: 'Delete all trailers',
            text: `This deletes every trailer PirateFin saved next to your movies and series.${again} Trailers you added yourself are kept.`,
            confirmText: 'Delete',
            primary: 'delete'
        }).then(() => deleteAll.mutate())
            .catch(() => { /* cancelled */ });
    }, [ deleteAll, settings?.Enabled ]);

    let content;
    if (isError) {
        content = <Alert severity='error'>{getErrorMessage(error)}</Alert>;
    } else if (isPending || !settings) {
        content = <Loading />;
    } else {
        content = (
            <Stack spacing={3}>
                {(save.isError || deleteAll.isError || saveMissing.isError) && (
                    <Alert severity='error'>{getErrorMessage(save.error ?? deleteAll.error ?? saveMissing.error)}</Alert>
                )}
                {deleteAll.isSuccess && <Alert severity='success'>Deleted {deleteAll.data} trailers.</Alert>}

                <Box>
                    <FormControlLabel
                        control={<Switch checked={settings.Enabled} onChange={onToggle} disabled={save.isPending} />}
                        label='Download trailers'
                    />
                    <Typography variant='body2' color='text.secondary'>
                        Saves the first 30 seconds of each downloaded movie&apos;s and series&apos; YouTube trailer (720p or better) in a
                        &quot;trailers&quot; folder next to it, when it finishes downloading and daily for anything missed. Downloads skip drives
                        below the minimum free space. Turning this off stops new downloads; saved trailers keep playing.
                    </Typography>
                </Box>

                <Box>
                    <Typography variant='h3'>Saved trailers</Typography>
                    <Typography sx={{ my: 1 }}>
                        {settings.Count} {settings.Count === 1 ? 'trailer' : 'trailers'}, {formatSize(settings.Bytes)}
                        {settings.IsSaving && ' · saving missing trailers…'}
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <Button variant='outlined' onClick={onSaveMissing} disabled={!settings.Enabled || settings.IsSaving || saveMissing.isPending}>
                            Save missing trailers now
                        </Button>
                        <Button variant='outlined' color='error' onClick={onDeleteAll} disabled={settings.Count === 0 || deleteAll.isPending}>
                            Delete all trailers
                        </Button>
                    </Stack>
                </Box>
            </Stack>
        );
    }

    return (
        <Page id='pirateFinTrailersPage' className='mainAnimatedPage type-interior' title='Trailers'>
            <Box className='content-primary'>
                <Stack spacing={3}>
                    <Typography variant='h1'>Trailers</Typography>
                    {content}
                </Stack>
            </Box>
        </Page>
    );
};

Component.displayName = 'PirateFinTrailersPage';

export default Component;
