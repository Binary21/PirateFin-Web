import React, { type FC } from 'react';
import IconButton from '@mui/material/IconButton';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import globalize from 'lib/globalize';

interface SubscribeToSeasonIconButtonProps {
    className?: string;
    subscribed?: boolean;
}

const SubscribeToSeasonIconButton: FC<SubscribeToSeasonIconButtonProps> = ({ className, subscribed = false }) => {
    return (
        <IconButton
            className={className}
            data-action='subscribetoseason'
            title={subscribed ? 'Unsubscribe from season' : globalize.translate('SubscribeToSeason')}
        >
            {subscribed ? <NotificationsActiveIcon /> : <NotificationsNoneIcon />}
        </IconButton>
    );
};

export default SubscribeToSeasonIconButton;
