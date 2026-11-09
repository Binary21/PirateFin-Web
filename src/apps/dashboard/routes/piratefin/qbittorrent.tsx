import React from 'react';

import SettingsPage, { NumberSetting, TextSetting } from '../../features/piratefin/components/SettingsPage';
import StorageOverview from '../../features/piratefin/components/StorageOverview';

export const Component = () => (
    <SettingsPage
        kind='QBitTorrent'
        id='pirateFinQBitTorrentPage'
        title='qBittorrent'
        description='The client PirateFin downloads with (qbittorrent.json). Enable the Web UI in qBittorrent under Options > Web UI.'
    >
        {(settings, update) => (
            <>
                <TextSetting settings={settings} update={update} name='Url' label='Web UI url' type='url' helperText='e.g. http://localhost:8080/' />
                <TextSetting settings={settings} update={update} name='Username' label='Username' />
                <TextSetting settings={settings} update={update} name='Password' label='Password' type='password' />
                <TextSetting
                    settings={settings}
                    update={update}
                    name='ExecutablePath'
                    label='qBittorrent executable'
                    helperText='Started automatically when qBittorrent is not running. Leave empty to never start it.'
                />
                <NumberSetting settings={settings} update={update} name='MonitorPollSeconds' label='Progress check interval (seconds)' helperText='Applies after a server restart' />
                <NumberSetting
                    settings={settings}
                    update={update}
                    name='PlayableProgress'
                    label='Playable at'
                    helperText='Fraction downloaded before an episode or movie can be played, e.g. 0.1 = 10%'
                    step={0.05}
                />
                <NumberSetting
                    settings={settings}
                    update={update}
                    name='MinimumFreeSpaceGb'
                    label='Minimum free space per drive (GB)'
                    helperText='Downloads go to library drives with at least this much free; when none has, downloads pause until one does'
                />
                <TextSetting
                    settings={settings}
                    update={update}
                    name='StorageMoveStart'
                    label='Move split series from'
                    type='time'
                    helperText='Server time. Series split across drives are moved back onto one drive in this window, when nobody is watching them'
                />
                <TextSetting settings={settings} update={update} name='StorageMoveEnd' label='Move split series until' type='time' />
                <StorageOverview />
            </>
        )}
    </SettingsPage>
);

Component.displayName = 'PirateFinQBitTorrentPage';
