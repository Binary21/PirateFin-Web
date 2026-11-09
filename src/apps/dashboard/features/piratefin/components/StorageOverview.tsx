import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import React from 'react';

import { getErrorMessage, useLibraryStorage, useSplitSeries } from '../api/pirateFinApi';

const formatGb = (bytes: number) => `${Math.round(bytes / 1024 ** 3)} GB`;

/**
 * The PirateFin library folders and how much room their drives have. New series and movies go to the folder with the
 * most free space; a drive below the minimum free space takes no new downloads.
 */
const StorageOverview = () => {
    const { data: locations, error } = useLibraryStorage();
    const { data: splitSeries } = useSplitSeries();

    return (
        <Stack spacing={1}>
            <Typography variant='h3'>Storage</Typography>
            {error && <Alert severity='error'>{getErrorMessage(error)}</Alert>}
            {locations && locations.length > 0 && locations.every(l => l.IsFull) && (
                <Alert severity='warning'>Every drive is below the minimum free space; all downloads are paused.</Alert>
            )}
            {locations && (
                <Table size='small'>
                    <TableHead>
                        <TableRow>
                            <TableCell>Library</TableCell>
                            <TableCell>Folder</TableCell>
                            <TableCell align='right'>Free</TableCell>
                            <TableCell align='right'>Size</TableCell>
                            <TableCell>Downloads</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {locations.map(location => (
                            <TableRow key={`${location.Library}:${location.Path}`}>
                                <TableCell>{location.Library}</TableCell>
                                <TableCell>{location.Path}</TableCell>
                                <TableCell align='right'>{formatGb(location.FreeBytes)}</TableCell>
                                <TableCell align='right'>{formatGb(location.TotalBytes)}</TableCell>
                                <TableCell sx={{ color: location.IsFull ? 'error.main' : 'success.main' }}>
                                    {location.IsFull ? 'Full: paused' : 'OK'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {splitSeries && splitSeries.length > 0 && (
                <>
                    <Typography variant='h4'>Series split across drives</Typography>
                    <Typography variant='body2'>
                        Moved back onto one drive in the move window. Series no single drive can hold stay split until there is more room.
                    </Typography>
                    <Table size='small'>
                        <TableHead>
                            <TableRow>
                                <TableCell>Series</TableCell>
                                <TableCell>Drives</TableCell>
                                <TableCell>Status</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {splitSeries.map(series => (
                                <TableRow key={series.Path}>
                                    <TableCell title={series.Path}>{series.Name}</TableCell>
                                    <TableCell>
                                        {Object.entries(series.BytesPerDrive).map(([ drive, bytes ]) => `${drive} ${formatGb(bytes)}`).join(', ')}
                                    </TableCell>
                                    <TableCell sx={{ color: series.CannotFit ? 'error.main' : undefined }}>
                                        {series.CannotFit ? 'No drive can hold it: needs more storage' : (series.LastAttempt || 'Waiting for the move window')}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </>
            )}
        </Stack>
    );
};

export default StorageOverview;
