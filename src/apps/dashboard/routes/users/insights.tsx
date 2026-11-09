import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { formatDistanceToNow } from 'date-fns';
import React, { type ReactNode, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import SectionTabs from 'components/dashboard/users/SectionTabs';
import SectionTitleContainer from 'elements/SectionTitleContainer';
import { getLocaleWithSuffix } from 'utils/dateFnsLocale';

import { getErrorMessage, type InsightTitle, type UserInsights, useUserInsights } from '../../features/piratefin/api/pirateFinApi';
import { DailyWatchChart, formatDuration, GenreBars, LibrarySplit, WatchHeatmap } from '../../features/piratefin/insights/InsightCharts';

const REQUEST_STATUS: Record<UserInsights['Requests'][number]['Status'], { label: string; color: 'default' | 'success' | 'warning' | 'error' }> = {
    Open: { label: 'Open', color: 'warning' },
    Fulfilled: { label: 'Fulfilled', color: 'success' },
    NotFound: { label: 'Not found', color: 'error' },
    Cancelled: { label: 'Cancelled', color: 'default' }
};

function ago(date?: string | null): string {
    return date ? formatDistanceToNow(Date.parse(date), getLocaleWithSuffix()) : 'never';
}

const progressDetail = (title: InsightTitle) => title.Progress ?? '';
const dropOffDetail = (title: InsightTitle) => `${title.Progress ?? ''} · ${ago(title.LastPlayedUtc)}`;
const rewatchDetail = (title: InsightTitle) => `${title.PlayCount}×`;

const itemLink = (id: string, name: string) => <Link href={`#/details?id=${id}`} underline='hover' color='inherit'>{name}</Link>;

const Section = ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
    <Card variant='outlined'>
        <CardContent>
            <Stack spacing={1.5}>
                <Box>
                    <Typography variant='h3'>{title}</Typography>
                    {subtitle && <Typography variant='body2' color='text.secondary'>{subtitle}</Typography>}
                </Box>
                {children}
            </Stack>
        </CardContent>
    </Card>
);

const Empty = ({ children }: { children: ReactNode }) => <Typography variant='body2' color='text.secondary'>{children}</Typography>;

/** A number with its label, for the row of headline figures. */
const StatTile = ({ label, value, note }: { label: string; value: string; note?: string }) => (
    <Card variant='outlined' sx={{ flex: '1 1 10em' }}>
        <CardContent>
            <Typography variant='body2' color='text.secondary'>{label}</Typography>
            <Typography variant='h2' component='p' sx={{ my: 0.5 }}>{value}</Typography>
            {note && <Typography variant='caption' color='text.secondary'>{note}</Typography>}
        </CardContent>
    </Card>
);

const TitleList = ({ titles, empty, detail }: { titles: InsightTitle[]; empty: string; detail: (title: InsightTitle) => string }) => (
    titles.length ? (
        <Table size='small'>
            <TableBody>
                {titles.map(title => (
                    <TableRow key={title.ItemId}>
                        <TableCell>
                            {itemLink(title.ItemId, title.Name)}
                            {title.Library && <Typography component='span' variant='caption' color='text.secondary'> · {title.Library}</Typography>}
                        </TableCell>
                        <TableCell align='right' sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{detail(title)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    ) : <Empty>{empty}</Empty>
);

const Grid = ({ min = 22, children }: { min?: number; children: ReactNode }) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}em), 1fr))`, gap: 2 }}>{children}</Box>
);

const InsightsView = ({ insights }: { insights: UserInsights }) => {
    const { Activity: activity } = insights;
    const libraries = insights.Genres.filter(g => g.Genres.length || g.Discovery.length);

    return (
        <Stack spacing={2}>
            <Typography variant='body2' color='text.secondary'>
                Watch time, the chart and &quot;when they watch&quot; count from when PirateFin started recording playback.
                Genres, current titles, drop-offs and rewatches use the user&apos;s whole history.
            </Typography>

            <Section title='Suggestions' subtitle='Ways to cater to this user'>
                {insights.Suggestions.length ? (
                    <Stack spacing={1}>
                        {insights.Suggestions.map(s => (
                            <Alert key={s.Text} severity='info' icon={<LightbulbOutlined />}>{s.Text}</Alert>
                        ))}
                    </Stack>
                ) : <Empty>Nothing to suggest right now.</Empty>}
            </Section>

            <Stack direction='row' flexWrap='wrap' useFlexGap spacing={2}>
                <StatTile label='This week' value={formatDuration(activity.Seconds7)} />
                <StatTile label='Last 30 days' value={formatDuration(activity.Seconds30)} note={`${activity.ActiveDays30} of 30 days active`} />
                <StatTile label='Last 90 days' value={formatDuration(activity.Seconds90)} />
                <StatTile label='Streak' value={`${activity.StreakDays} ${activity.StreakDays === 1 ? 'day' : 'days'}`} note='Days in a row with something watched' />
                <StatTile label='Last watched' value={ago(activity.LastWatchedUtc)} note={`Last active ${ago(activity.LastActiveUtc)}`} />
            </Stack>

            <Section title='Libraries' subtitle='Share of watch time, last 90 days'>
                <LibrarySplit libraries={activity.Libraries} />
            </Section>

            <Card variant='outlined'><CardContent><DailyWatchChart daily={insights.Daily} /></CardContent></Card>
            <Card variant='outlined'><CardContent><WatchHeatmap heatmap={insights.Heatmap} /></CardContent></Card>

            <Section title='Genres' subtitle='Titles watched per genre: movies watched at least halfway, series with 3 or more episodes played'>
                {libraries.length ? (
                    <Grid min={18}>
                        {libraries.map(library => (
                            <Stack key={library.Library} spacing={1}>
                                <Typography variant='h4' component='h4'>{library.Library}</Typography>
                                <GenreBars genres={library.Genres} />
                                {library.Discovery.length > 0 && (
                                    <Box>
                                        <Typography variant='caption' color='text.secondary'>Popular with others, rarely watched by them:</Typography>
                                        <Stack direction='row' flexWrap='wrap' useFlexGap spacing={0.5} sx={{ mt: 0.5 }}>
                                            {library.Discovery.slice(0, 5).map(g => <Chip key={g.Name} label={g.Name} size='small' variant='outlined' />)}
                                        </Stack>
                                    </Box>
                                )}
                            </Stack>
                        ))}
                    </Grid>
                ) : <Empty>Not enough watched yet.</Empty>}
            </Section>

            <Grid>
                <Section title='Top titles' subtitle='Most watched, last 90 days'>
                    {insights.TopTitles.length ? (
                        <Table size='small'>
                            <TableHead><TableRow><TableCell>Title</TableCell><TableCell align='right'>Watched</TableCell></TableRow></TableHead>
                            <TableBody>
                                {insights.TopTitles.map(t => (
                                    <TableRow key={t.ItemId}>
                                        <TableCell>
                                            {itemLink(t.ItemId, t.Name)}
                                            {t.Episodes > 0 && <Typography component='span' variant='caption' color='text.secondary'> · {t.Episodes} {t.Episodes === 1 ? 'episode' : 'episodes'}</Typography>}
                                        </TableCell>
                                        <TableCell align='right' sx={{ whiteSpace: 'nowrap' }}>{formatDuration(t.Seconds)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : <Empty>Nothing recorded yet.</Empty>}
                </Section>
                <Section title='Watching now' subtitle='Played in the last 30 days, not finished'>
                    <TitleList titles={insights.CurrentlyWatching} empty='Nothing in progress.' detail={progressDetail} />
                </Section>
                <Section title='Drop-offs' subtitle='Started, not finished, nothing played in 30 days'>
                    <TitleList titles={insights.DropOffs} empty='No drop-offs.' detail={dropOffDetail} />
                </Section>
                <Section title='Rewatches' subtitle='Played more than once'>
                    <TitleList titles={insights.Rewatches} empty='No rewatches.' detail={rewatchDetail} />
                </Section>
            </Grid>

            <Grid>
                <Section title='Subscriptions' subtitle='Seasons they get new episodes of'>
                    {insights.Subscriptions.length ? (
                        <Table size='small'>
                            <TableBody>
                                {insights.Subscriptions.map(s => (
                                    <TableRow key={s.SeasonId}>
                                        <TableCell>{itemLink(s.SeriesId, s.SeriesName)} <Typography component='span' variant='caption' color='text.secondary'>· {s.SeasonName}</Typography></TableCell>
                                        <TableCell align='right' sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>since {ago(s.SinceUtc)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : <Empty>No subscriptions.</Empty>}
                </Section>
                <Section title='Download requests'>
                    {insights.Requests.length ? (
                        <Table size='small'>
                            <TableBody>
                                {insights.Requests.map(r => (
                                    <TableRow key={r.Id}>
                                        <TableCell>{r.SeriesName} {r.Title} <Typography component='span' variant='caption' color='text.secondary'>· {ago(r.CreatedUtc)}</Typography></TableCell>
                                        <TableCell align='right'><Chip size='small' label={REQUEST_STATUS[r.Status].label} color={REQUEST_STATUS[r.Status].color} variant='outlined' /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : <Empty>No requests.</Empty>}
                </Section>
                <Section title='Searches that found nothing' subtitle='Last 90 days'>
                    {insights.FailedSearches.length ? (
                        <Table size='small'>
                            <TableBody>
                                {insights.FailedSearches.map(s => (
                                    <TableRow key={`${s.Library}-${s.Query}-${s.Utc}`}>
                                        <TableCell>&quot;{s.Query}&quot; <Typography component='span' variant='caption' color='text.secondary'>· {s.Library}</Typography></TableCell>
                                        <TableCell align='right' sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{ago(s.Utc)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : <Empty>None.</Empty>}
                </Section>
            </Grid>
        </Stack>
    );
};

const UserInsightsPage = () => {
    const [ searchParams ] = useSearchParams();
    const userId = searchParams.get('userId');
    const [ userName, setUserName ] = useState('');
    const { data, isPending, isError, error } = useUserInsights(userId);

    useEffect(() => {
        if (!userId) {
            return;
        }
        window.ApiClient.getUser(userId)
            .then(user => setUserName(user.Name ?? ''))
            .catch(err => console.error('[userinsights] failed to fetch user', err));
    }, [ userId ]);

    let content;
    if (isError) {
        content = <Alert severity='error'>{getErrorMessage(error)}</Alert>;
    } else if (isPending || !data) {
        content = <Loading />;
    } else {
        content = <InsightsView insights={data} />;
    }

    return (
        <Page id='userInsightsPage' className='mainAnimatedPage type-interior userInsightsPage'>
            <div className='content-primary'>
                <div className='verticalSection'>
                    <SectionTitleContainer title={userName} />
                </div>
                <SectionTabs activeTab='userinsights' />
                {content}
            </div>
        </Page>
    );
};

export default UserInsightsPage;
