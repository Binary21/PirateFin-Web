import type { ServerConfiguration } from '@jellyfin/sdk/lib/generated-client/models/server-configuration';
import { getConfigurationApi } from '@jellyfin/sdk/lib/utils/api/configuration-api';
import Alert from '@mui/material/Alert';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import { useMutation } from '@tanstack/react-query';
import React, { type ChangeEvent, useCallback } from 'react';

import { useApi } from 'hooks/useApi';
import { QUERY_KEY, useConfiguration } from 'hooks/useConfiguration';
import { queryClient } from 'utils/query/queryClient';

/** PirateFin's server setting; the SDK's model doesn't know it. */
type PirateFinServerConfiguration = ServerConfiguration & { AllowRemoteAdminAccess?: boolean };

/** Whether admins keep their admin rights when signed in from outside the home network. */
const RemoteAdminAccess = () => {
    const { api } = useApi();
    const { data: config } = useConfiguration();
    const allowed = (config as PirateFinServerConfiguration | undefined)?.AllowRemoteAdminAccess === true;

    const save = useMutation({
        mutationFn: async (allow: boolean) => {
            const current = await getConfigurationApi(api!).getConfiguration();
            const updated: PirateFinServerConfiguration = { ...current.data, AllowRemoteAdminAccess: allow };
            await getConfigurationApi(api!).updateConfiguration({ serverConfiguration: updated });
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [ QUERY_KEY ] })
    });

    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => save.mutate(e.target.checked), [ save ]);

    return (
        <Stack spacing={1}>
            {save.isError && <Alert severity='error'>The setting couldn&apos;t be saved.</Alert>}
            <FormControlLabel
                control={<Switch checked={allowed} onChange={onChange} disabled={!config || save.isPending} />}
                label='Allow admin access from outside the home network'
            />
            <Alert severity={allowed ? 'warning' : 'info'}>
                {allowed ?
                    'Admins have their full rights from anywhere. Anyone who learns an admin password can change the server over the internet.' :
                    'Admins signed in from outside the home network (e.g. through your public address) are treated as ordinary users: no dashboard and no admin actions. At home nothing changes.'}
            </Alert>
        </Stack>
    );
};

export default RemoteAdminAccess;
