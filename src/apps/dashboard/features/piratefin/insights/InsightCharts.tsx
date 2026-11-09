import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import React, { type ReactNode, useCallback, useMemo, useState } from 'react';

import type { RankedGenre, UserInsights } from '../api/pirateFinApi';

const WEEKDAYS = [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ];

// Reference data-viz palette (validated): sequential blue ramp and the first three categorical slots.
const RAMP = [ '#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b' ];
const COLORS = {
    light: { series: '#2a78d6', categorical: [ '#2a78d6', '#eb6834', '#1baf7a' ] },
    dark: { series: '#3987e5', categorical: [ '#3987e5', '#d95926', '#199e70' ] }
};

/** "2 h 5 min", "45 min" or "0 min". */
export function formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours === 0) {
        return `${minutes} min`;
    }
    return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
}

function formatHour(hour: number): string {
    const suffix = hour < 12 ? 'AM' : 'PM';
    return `${hour % 12 || 12} ${suffix}`;
}

function formatDay(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function useColors() {
    return COLORS[useTheme().palette.mode];
}

/** A chart with a button to show its numbers as a table instead. */
const ChartFrame = ({ title, subtitle, chart, table }: { title: string; subtitle?: string; chart: ReactNode; table: ReactNode }) => {
    const [ showTable, setShowTable ] = useState(false);
    const toggle = useCallback(() => setShowTable(value => !value), []);

    return (
        <Stack spacing={1}>
            <Stack direction='row' alignItems='baseline' justifyContent='space-between'>
                <Box>
                    <Typography variant='h3'>{title}</Typography>
                    {subtitle && <Typography variant='body2' color='text.secondary'>{subtitle}</Typography>}
                </Box>
                <Button size='small' variant='text' onClick={toggle}>{showTable ? 'Show chart' : 'Show table'}</Button>
            </Stack>
            {showTable ? <Box sx={{ maxHeight: 320, overflow: 'auto' }}>{table}</Box> : chart}
        </Stack>
    );
};

/** Watch time per day for the last 90 days, as bars. */
export const DailyWatchChart = ({ daily }: { daily: UserInsights['Daily'] }) => {
    const { series } = useColors();
    const max = Math.max(...daily.map(d => d.Seconds), 1);
    const monthStarts = daily.map((d, i) => (d.Date.endsWith('-01') || i === 0 ? i : -1)).filter(i => i >= 0);

    const chart = (
        <Box>
            <Stack direction='row' alignItems='flex-end' sx={{ height: 140, gap: '2px', borderBottom: 1, borderColor: 'divider' }}>
                {daily.map(day => (
                    <Tooltip key={day.Date} title={`${formatDay(day.Date)}: ${formatDuration(day.Seconds)}`} placement='top' disableInteractive>
                        {/* The hit area is the whole column; the bar inside is the mark. */}
                        <Box sx={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', cursor: 'default' }}>
                            <Box
                                sx={{
                                    width: '100%',
                                    height: `${(day.Seconds / max) * 100}%`,
                                    minHeight: day.Seconds > 0 ? 2 : 0,
                                    bgcolor: series,
                                    borderRadius: '4px 4px 0 0'
                                }}
                            />
                        </Box>
                    </Tooltip>
                ))}
            </Stack>
            <Box sx={{ position: 'relative', height: 18 }}>
                {monthStarts.map(i => (
                    <Typography
                        key={daily[i].Date}
                        variant='caption'
                        color='text.secondary'
                        sx={{ position: 'absolute', left: `${(i / daily.length) * 100}%`, whiteSpace: 'nowrap' }}
                    >
                        {new Date(`${daily[i].Date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Typography>
                ))}
            </Box>
            <Typography variant='caption' color='text.secondary'>Tallest bar: {formatDuration(max)}</Typography>
        </Box>
    );

    const table = (
        <Table size='small' stickyHeader>
            <TableHead><TableRow><TableCell>Day</TableCell><TableCell align='right'>Watched</TableCell></TableRow></TableHead>
            <TableBody>
                {[ ...daily ].reverse().map(day => (
                    <TableRow key={day.Date}><TableCell>{formatDay(day.Date)}</TableCell><TableCell align='right'>{formatDuration(day.Seconds)}</TableCell></TableRow>
                ))}
            </TableBody>
        </Table>
    );

    return <ChartFrame title='Watch time' subtitle='Per day, last 90 days' chart={chart} table={table} />;
};

/** When the user watches: weekday by hour of day, darker = more. */
export const WatchHeatmap = ({ heatmap }: { heatmap: number[][] }) => {
    const theme = useTheme();
    const max = Math.max(...heatmap.flat(), 1);
    // On a dark surface "a little" must recede toward the surface, so the ramp runs the other way.
    const ramp = useMemo(() => (theme.palette.mode === 'dark' ? [ ...RAMP ].reverse() : RAMP), [ theme.palette.mode ]);
    const cellColor = (seconds: number) => (seconds <= 0 ?
        theme.palette.action.hover :
        ramp[Math.min(ramp.length - 1, Math.floor((seconds / max) * (ramp.length - 1)) + 1)]);

    const chart = (
        <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '2.5em repeat(24, minmax(14px, 1fr))', gap: '2px', minWidth: 420 }}>
                {heatmap.map((row, day) => (
                    <React.Fragment key={WEEKDAYS[day]}>
                        <Typography variant='caption' color='text.secondary' sx={{ alignSelf: 'center' }}>{WEEKDAYS[day]}</Typography>
                        {row.map((seconds, hour) => (
                            <Tooltip key={`${WEEKDAYS[day]}-${formatHour(hour)}`} title={`${WEEKDAYS[day]} ${formatHour(hour)}: ${formatDuration(seconds)}`} disableInteractive>
                                <Box sx={{ aspectRatio: '1', borderRadius: '3px', bgcolor: cellColor(seconds) }} />
                            </Tooltip>
                        ))}
                    </React.Fragment>
                ))}
                <span />
                {Array.from({ length: 24 }, (_, hour) => (
                    <Typography key={formatHour(hour)} variant='caption' color='text.secondary' sx={{ textAlign: 'center' }}>
                        {hour % 3 === 0 ? formatHour(hour).replace(' ', '') : ''}
                    </Typography>
                ))}
            </Box>
        </Box>
    );

    const table = (
        <Table size='small' stickyHeader>
            <TableHead>
                <TableRow><TableCell>Hour</TableCell>{WEEKDAYS.map(d => <TableCell key={d} align='right'>{d}</TableCell>)}</TableRow>
            </TableHead>
            <TableBody>
                {Array.from({ length: 24 }, (_, hour) => (
                    <TableRow key={formatHour(hour)}>
                        <TableCell>{formatHour(hour)}</TableCell>
                        {heatmap.map((row, day) => <TableCell key={WEEKDAYS[day]} align='right'>{row[hour] ? formatDuration(row[hour]) : '–'}</TableCell>)}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );

    return <ChartFrame title='When they watch' subtitle='Weekday by hour, last 90 days (your time zone)' chart={chart} table={table} />;
};

/** A ranked list of genres as horizontal bars with the title count beside each. */
export const GenreBars = ({ genres, limit = 8 }: { genres: RankedGenre[]; limit?: number }) => {
    const { series } = useColors();
    const shown = genres.slice(0, limit);
    const max = Math.max(...shown.map(g => g.Titles), 1);

    if (!shown.length) {
        return <Typography variant='body2' color='text.secondary'>Not enough watched yet.</Typography>;
    }

    return (
        <Stack spacing={0.75}>
            {shown.map(genre => (
                <Tooltip key={genre.Id || genre.Name} title={`${genre.Name}: ${genre.Titles} ${genre.Titles === 1 ? 'title' : 'titles'}`} placement='right' disableInteractive>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '7.5em 1fr 2.5em', alignItems: 'center', gap: 1 }}>
                        <Typography variant='body2' noWrap>{genre.Name}</Typography>
                        <Box sx={{ height: 10, width: `${(genre.Titles / max) * 100}%`, minWidth: 4, bgcolor: series, borderRadius: '0 4px 4px 0' }} />
                        <Typography variant='body2' color='text.secondary' align='right'>{genre.Titles}</Typography>
                    </Box>
                </Tooltip>
            ))}
        </Stack>
    );
};

/** Share of watch time per library, as one stacked bar with a labelled legend. */
export const LibrarySplit = ({ libraries }: { libraries: UserInsights['Activity']['Libraries'] }) => {
    const { categorical } = useColors();
    const total = libraries.reduce((sum, l) => sum + l.Seconds, 0);
    if (!total) {
        return <Typography variant='body2' color='text.secondary'>Nothing watched yet.</Typography>;
    }

    // Colour follows the library, not its rank: Shows, Anime, Movies keep their slot.
    const order = [ 'Shows', 'Anime', 'Movies' ];
    const colorOf = (library: string) => {
        const slot = order.indexOf(library);
        return slot >= 0 ? categorical[slot] : 'text.disabled';
    };
    const percent = (seconds: number) => Math.round((seconds / total) * 100);

    return (
        <Stack spacing={1}>
            <Stack direction='row' sx={{ height: 12, gap: '2px' }}>
                {libraries.map(library => (
                    <Tooltip key={library.Library} title={`${library.Library}: ${formatDuration(library.Seconds)} (${percent(library.Seconds)}%)`} disableInteractive>
                        <Box sx={{ width: `${(library.Seconds / total) * 100}%`, minWidth: 4, bgcolor: colorOf(library.Library), borderRadius: '4px' }} />
                    </Tooltip>
                ))}
            </Stack>
            <Stack direction='row' spacing={2} flexWrap='wrap' useFlexGap>
                {libraries.map(library => (
                    <Stack key={library.Library} direction='row' spacing={0.75} alignItems='center'>
                        <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: colorOf(library.Library) }} />
                        <Typography variant='body2'>
                            {library.Library} <Typography component='span' variant='body2' color='text.secondary'>{formatDuration(library.Seconds)} · {percent(library.Seconds)}%</Typography>
                        </Typography>
                    </Stack>
                ))}
            </Stack>
        </Stack>
    );
};
