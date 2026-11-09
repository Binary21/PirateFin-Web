import CloudDownload from '@mui/icons-material/CloudDownload';
import Dashboard from '@mui/icons-material/Dashboard';
import Download from '@mui/icons-material/Download';
import Email from '@mui/icons-material/Email';
import SupportAgent from '@mui/icons-material/SupportAgent';
import TravelExplore from '@mui/icons-material/TravelExplore';
import YouTube from '@mui/icons-material/YouTube';
import Badge from '@mui/material/Badge';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import React from 'react';

import ListItemLink from 'components/ListItemLink';
import globalize from 'lib/globalize';

import { useOpenRequestCount } from '../../../features/piratefin/api/pirateFinApi';

const LINKS = [
    { to: '/dashboard/piratefin', label: 'Overview', icon: <Dashboard /> },
    { to: '/dashboard/piratefin/providers', label: 'Providers', icon: <TravelExplore /> },
    { to: '/dashboard/piratefin/jackett', label: 'Jackett', icon: <CloudDownload /> },
    { to: '/dashboard/piratefin/qbittorrent', label: 'qBittorrent', icon: <Download /> },
    { to: '/dashboard/piratefin/gmail', label: 'Email (Gmail)', icon: <Email /> },
    { to: '/dashboard/piratefin/youtube', label: 'YouTube', icon: <YouTube /> }
];

const PirateFinDrawerSection = () => {
    const { data: openRequests } = useOpenRequestCount();

    return (
        <List
            aria-labelledby='piratefin-subheader'
            subheader={
                <ListSubheader component='div' id='piratefin-subheader'>
                    {globalize.translate('HeaderPirateFin')}
                </ListSubheader>
            }
        >
            {LINKS.map(({ to, label, icon }) => (
                <ListItem key={to} disablePadding>
                    <ListItemLink to={to}>
                        <ListItemIcon>{icon}</ListItemIcon>
                        <ListItemText primary={label} />
                    </ListItemLink>
                </ListItem>
            ))}
            <ListItem disablePadding>
                <ListItemLink to='/dashboard/piratefin/requests'>
                    <ListItemIcon>
                        <Badge badgeContent={openRequests ?? 0} color='error'>
                            <SupportAgent />
                        </Badge>
                    </ListItemIcon>
                    <ListItemText primary='Requests' />
                </ListItemLink>
            </ListItem>
        </List>
    );
};

export default PirateFinDrawerSection;
