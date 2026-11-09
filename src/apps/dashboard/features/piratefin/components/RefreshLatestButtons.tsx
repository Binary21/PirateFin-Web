import RefreshIcon from '@mui/icons-material/Refresh';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import React, { type FC, useCallback, useState } from 'react';

import ConfirmDialog from 'components/ConfirmDialog';
import globalize from 'lib/globalize';

import { getErrorMessage, type PirateFinLibrary, type PlaceholderRemovalResult, useResetPirateFinLibrary } from '../api/pirateFinApi';

const LIBRARIES: { library: PirateFinLibrary, label: string }[] = [
    { library: 'Movies', label: 'ButtonRefreshLatestMovies' },
    { library: 'Shows', label: 'ButtonRefreshLatestShows' },
    { library: 'Anime', label: 'ButtonRefreshLatestAnime' }
];

const describe = (library: PirateFinLibrary, result: PlaceholderRemovalResult) => (
    library === 'Movies' ?
        `Removed ${result.Movies} movies.` :
        `Removed ${result.Episodes} episodes, ${result.Seasons} seasons and ${result.Series} series.`
) + ' Fetching the newest items in the background.';

interface RefreshButtonProps {
    library: PirateFinLibrary;
    label: string;
    disabled: boolean;
    onClick: (library: PirateFinLibrary) => void;
}

const RefreshButton: FC<RefreshButtonProps> = ({ library, label, disabled, onClick }) => {
    const onButtonClick = useCallback(() => onClick(library), [ library, onClick ]);

    return (
        <Button
            onClick={onButtonClick}
            disabled={disabled}
            startIcon={<RefreshIcon />}
            sx={{ fontWeight: 'bold' }}
        >
            {globalize.translate(label)}
        </Button>
    );
};

/**
 * Removes a PirateFin library's placeholders that aren't downloaded or downloading (and seasons / series left
 * empty), then fetches the newest items for it again.
 */
const RefreshLatestButtons: FC = () => {
    const reset = useResetPirateFinLibrary();
    const [ pending, setPending ] = useState<PirateFinLibrary | null>(null);
    const [ message, setMessage ] = useState<{ severity: 'success' | 'error', text: string } | null>(null);

    const onCancel = useCallback(() => setPending(null), []);

    const onConfirm = useCallback(() => {
        if (!pending) {
            return;
        }

        const library = pending;
        setPending(null);
        setMessage(null);
        reset.mutate(library, {
            onSuccess: result => setMessage({ severity: 'success', text: `${library}: ${describe(library, result)}` }),
            onError: error => setMessage({ severity: 'error', text: `${library}: ${getErrorMessage(error)}` })
        });
    }, [ pending, reset ]);

    const onClose = useCallback(() => setMessage(null), []);

    return (
        <Stack spacing={1.5}>
            <ConfirmDialog
                open={!!pending}
                title={pending ? `Refresh latest ${pending.toLowerCase()}` : ''}
                text={pending === 'Movies' ?
                    'All movies that are not downloaded or downloading will be removed, then the newest movies are fetched again.' :
                    'All episodes that are not downloaded or downloading will be removed, along with seasons and series that have nothing left in them. The newest episodes are fetched again afterwards.'}
                onConfirm={onConfirm}
                onCancel={onCancel}
                confirmButtonText={globalize.translate('ButtonRefresh')}
                confirmButtonColor='error'
            />
            <Stack direction='row' spacing={1.5} flexWrap='wrap' useFlexGap>
                {LIBRARIES.map(({ library, label }) => (
                    <RefreshButton
                        key={library}
                        library={library}
                        label={label}
                        disabled={reset.isPending}
                        onClick={setPending}
                    />
                ))}
            </Stack>
            {message && (
                <Alert severity={message.severity} onClose={onClose}>
                    {message.text}
                </Alert>
            )}
        </Stack>
    );
};

export default RefreshLatestButtons;
