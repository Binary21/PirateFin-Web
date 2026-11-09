import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import Page from 'components/Page';
import globalize from 'lib/globalize';

import PopulateLibraries from '../../features/piratefin/components/PopulateLibraries';
import RefreshLatestButtons from '../../features/piratefin/components/RefreshLatestButtons';
import ReleaseSearches from '../../features/piratefin/components/ReleaseSearches';
import RemoteAdminAccess from '../../features/piratefin/components/RemoteAdminAccess';

export const Component = () => (
    <Page id='pirateFinPage' className='mainAnimatedPage type-interior' title={globalize.translate('HeaderPirateFin')}>
        <Box className='content-primary'>
            <Stack spacing={3}>
                <Typography variant='h1'>{globalize.translate('HeaderPirateFin')}</Typography>
                <Paper sx={{ padding: 2 }}>
                    <Stack spacing={2}>
                        <Typography variant='h2'>Refresh latest</Typography>
                        <Typography color='text.secondary'>
                            Removes everything in a library that is not downloaded or downloading (seasons and series too once
                            nothing is left in them) and fetches the newest items again. Downloaded and downloading items are kept.
                        </Typography>
                        <RefreshLatestButtons />
                    </Stack>
                </Paper>
                <Paper sx={{ padding: 2 }}>
                    <Stack spacing={2}>
                        <Typography variant='h2'>Populate libraries</Typography>
                        <Typography color='text.secondary'>
                            Goes through every series in Shows and Anime: adds the seasons and episodes it&apos;s missing (Trakt /
                            AniList), refreshes its metadata and images, and schedules release searches for the new episodes,
                            spaced out so Jackett isn&apos;t flooded. The same runs every night in the storage move window
                            (qBittorrent settings) for series added in the last 7 days and series still airing.
                        </Typography>
                        <PopulateLibraries />
                    </Stack>
                </Paper>
                <Paper sx={{ padding: 2 }}>
                    <Stack spacing={2}>
                        <Typography variant='h2'>Release searches</Typography>
                        <Typography color='text.secondary'>
                            Episodes without a release are searched on Jackett: new ones (aired this week) are retried until
                            a release turns up, older ones get one search each, spaced out.
                        </Typography>
                        <ReleaseSearches />
                    </Stack>
                </Paper>
                <Paper sx={{ padding: 2 }}>
                    <Stack spacing={2}>
                        <Typography variant='h2'>Admin access away from home</Typography>
                        <RemoteAdminAccess />
                    </Stack>
                </Paper>
                <Typography color='text.secondary'>
                    Use Providers, Jackett and qBittorrent in the menu to change PirateFin&apos;s settings. Changes apply without
                    restarting the server.
                </Typography>
            </Stack>
        </Box>
    </Page>
);

Component.displayName = 'PirateFinPage';
