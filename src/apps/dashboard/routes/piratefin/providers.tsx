import Typography from '@mui/material/Typography';
import React from 'react';

import SettingsPage, { ListSetting, NumberSetting, TextSetting } from '../../features/piratefin/components/SettingsPage';

export const Component = () => (
    <SettingsPage
        kind='Providers'
        id='pirateFinProvidersPage'
        title='Providers'
        description='Where PirateFin finds new and airing shows, anime and movies (providers.json).'
    >
        {(settings, update) => (
            <>
                <Typography variant='h2'>Trakt (TV shows)</Typography>
                <TextSetting settings={settings} update={update} name='TraktApiUrl' label='Trakt API url' type='url' />
                <TextSetting settings={settings} update={update} name='TraktApiKey' label='Trakt client id' type='password' helperText='From your Trakt API app at trakt.tv/oauth/applications' />
                <TextSetting settings={settings} update={update} name='TraktApiUser' label='User agent' helperText='Identifies PirateFin to Trakt, e.g. "PirateFin (you@example.com)"' />
                <ListSetting settings={settings} update={update} name='AllowedShowNetworks' label='Allowed networks' helperText='One per line. Only shows from these networks are added from the weekly schedule.' />
                <ListSetting settings={settings} update={update} name='AllowedShowGenres' label='Allowed genres' helperText='One per line (Trakt slugs, e.g. drama, science-fiction). A show needs at least one.' />
                <ListSetting settings={settings} update={update} name='BannedShowGenres' label='Banned genres' helperText='One per line. Shows with any of these are skipped.' />

                <Typography variant='h2'>AniList (anime)</Typography>
                <TextSetting settings={settings} update={update} name='AniListGraphQlUrl' label='AniList GraphQL url' type='url' />
                <NumberSetting settings={settings} update={update} name='AniListPageSize' label='Page size' helperText='Results per AniList request (max 50)' />
                <ListSetting
                    settings={settings}
                    update={update}
                    name='ExcludedAnimeCountries'
                    label='Excluded countries of origin'
                    helperText='One country code per line. Leave empty to use the default (CN).'
                    placeholder='CN'
                />

                <Typography variant='h2'>YTS (movies)</Typography>
                <TextSetting settings={settings} update={update} name='YtsApiUrl' label='YTS API url' type='url' helperText='The YTS mirror to use; change it when the current one stops responding' />
                <NumberSetting settings={settings} update={update} name='MovieMinimumRating' label='Minimum rating' helperText='IMDb rating, 0-10' step={0.5} />
                <ListSetting settings={settings} update={update} name='AllowedLanguages' label='Allowed languages' helperText='One language code per line, e.g. en' />
            </>
        )}
    </SettingsPage>
);

Component.displayName = 'PirateFinProvidersPage';
