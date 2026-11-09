import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import TextField from '@mui/material/TextField';
import React, { type ChangeEvent, useCallback, useMemo } from 'react';

import ReleaseGroupsSetting from '../../features/piratefin/components/ReleaseGroupsSetting';
import SettingsPage, { ListSetting, TextSetting } from '../../features/piratefin/components/SettingsPage';

interface PrioritizeDubSettingProps {
    settings: Record<string, unknown>;
    update: (name: string, value: unknown) => void;
}

const PrioritizeDubSetting = ({ settings, update }: PrioritizeDubSettingProps) => {
    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => update('PrioritizeDub', e.target.checked), [ update ]);
    return (
        <div>
            <FormControlLabel
                control={<Checkbox checked={Boolean(settings.PrioritizeDub)} onChange={onChange} />}
                label='Prioritize Dub'
            />
            <FormHelperText>
                Preselects &quot;Dub if available&quot; when subscribing to anime, and looks for a dub first for
                downloads nobody chose a language for (opening an episode, prefetching, older subscriptions).
            </FormHelperText>
        </div>
    );
};

interface IndexerSettingProps {
    settings: Record<string, unknown>;
    update: (name: string, value: unknown) => void;
    library: 'Shows' | 'Anime';
}

const IndexerSetting = ({ settings, update, library }: IndexerSettingProps) => {
    const indexers = useMemo(() => (settings.Indexer as Record<string, string> | undefined) ?? {}, [ settings.Indexer ]);
    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        update('Indexer', { ...indexers, [library]: e.target.value.trim() });
    }, [ indexers, library, update ]);

    return (
        <TextField
            label={`${library} indexer`}
            value={indexers[library] ?? ''}
            onChange={onChange}
            helperText={`The Jackett indexer id used for ${library === 'Shows' ? 'TV shows' : 'anime'}, e.g. ${library === 'Shows' ? 'knaben' : 'nyaasi'}`}
            fullWidth
        />
    );
};

export const Component = () => (
    <SettingsPage
        kind='Jackett'
        id='pirateFinJackettPage'
        title='Jackett'
        description='Where PirateFin searches for episode torrents (jackett.json).'
    >
        {(settings, update) => (
            <>
                <TextSetting settings={settings} update={update} name='BaseUrl' label='Jackett url' type='url' helperText='e.g. http://localhost:9117/' />
                <TextSetting settings={settings} update={update} name='ApiKey' label='API key' type='password' helperText='Shown at the top right of the Jackett dashboard' />
                <IndexerSetting settings={settings} update={update} library='Shows' />
                <IndexerSetting settings={settings} update={update} library='Anime' />
                <TextSetting settings={settings} update={update} name='ShowCategory' label='TV category' helperText='Torznab category, e.g. 5040 (TV/HD)' />
                <TextSetting settings={settings} update={update} name='AnimeCategory' label='Anime category' helperText='Torznab category, e.g. 5070 (TV/Anime)' />
                <ListSetting
                    settings={settings}
                    update={update}
                    name='ShowAuthors'
                    label='Preferred TV release groups'
                    helperText='One per line, in priority order. Every word must appear in the release name, e.g. "1080p MeGusta".'
                />
                <ReleaseGroupsSetting
                    settings={settings}
                    update={update}
                    name='AnimeDubGroups'
                    label='Preferred anime Dub release groups'
                    helperText='In priority order (drag to reorder). The language indicator is added to the search before the episode number, and a release must contain all of its words, e.g. Yameii → English Dub.'
                    namePlaceholder='Yameii'
                    indicatorPlaceholder='English Dub'
                />
                <ReleaseGroupsSetting
                    settings={settings}
                    update={update}
                    name='AnimeSubGroups'
                    label='Preferred anime Sub release groups'
                    helperText='In priority order (drag to reorder), e.g. ToonsHub → Multi-Subs. Leave the indicator empty to add nothing to the search.'
                    namePlaceholder='ToonsHub'
                    indicatorPlaceholder='Multi-Subs'
                />
                <PrioritizeDubSetting settings={settings} update={update} />
            </>
        )}
    </SettingsPage>
);

Component.displayName = 'PirateFinJackettPage';
