import React, { type FC, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import confirm from 'components/confirm/confirm';
import loading from 'components/loading/loading';
import Page from 'components/Page';
import toast from 'components/toast/toast';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';
import { deleteIconPack, getIconPacks, getIconUrl, type IconPack } from 'utils/profileIcons';

import 'styles/piratefin.scss';
import 'styles/profileIcons.scss';

const PREVIEW_COUNT = 5;

interface PackItemProps {
    pack: IconPack;
    getUrl: (packId: string, file: string) => string;
    onEdit: (pack: IconPack) => void;
    onDelete: (pack: IconPack) => void;
}

const PackItem: FC<PackItemProps> = ({ pack, getUrl, onEdit, onDelete }) => {
    const edit = useCallback(() => onEdit(pack), [ onEdit, pack ]);
    const remove = useCallback(() => onDelete(pack), [ onDelete, pack ]);

    return (
        <div className='pfIconPackItem focuscontainer-x'>
            <div className='pfIconPackPreview'>
                {pack.Icons.slice(0, PREVIEW_COUNT).map(icon => (
                    <img key={icon.File} src={getUrl(pack.Id, icon.File)} alt='' loading='lazy' />
                ))}
            </div>
            <div className='pfIconPackText'>
                <span className='pfIconPackName'>{pack.Name}</span>
                <span className='pfIconPackCount'>{pack.Icons.length === 1 ? '1 icon' : `${pack.Icons.length} icons`}</span>
            </div>
            <button type='button' className='pfIconRoundButton' onClick={edit} title='Edit' aria-label={`Edit ${pack.Name}`}>
                <span className='material-icons edit' aria-hidden='true' />
            </button>
            <button type='button' className='pfIconRoundButton' onClick={remove} title='Delete' aria-label={`Delete ${pack.Name}`}>
                <span className='material-icons delete' aria-hidden='true' />
            </button>
        </div>
    );
};

/** Admin: the icon packs, to add, edit or delete. */
export const Component: FC = () => {
    const navigate = useNavigate();
    const apiClient = ServerConnections.currentApiClient();
    const [ packs, setPacks ] = useState<IconPack[] | null>(null);

    const load = useCallback(() => {
        if (!apiClient) {
            return;
        }

        loading.show();
        getIconPacks(apiClient).then(setPacks).catch(err => {
            console.error('[ProfileIcons] failed to load the icon packs', err);
            toast('Could not load the icon packs.');
        }).finally(() => {
            loading.hide();
        });
    }, [ apiClient ]);

    useEffect(load, [ load ]);

    const getUrl = useCallback((packId: string, file: string) => (apiClient ? getIconUrl(apiClient, packId, file) : ''), [ apiClient ]);
    const goBack = useCallback(() => navigate(-1), [ navigate ]);
    const onAdd = useCallback(() => navigate('/iconpack'), [ navigate ]);
    const onEdit = useCallback((pack: IconPack) => navigate(`/iconpack?packId=${encodeURIComponent(pack.Id)}`), [ navigate ]);

    const onDelete = useCallback((pack: IconPack) => {
        if (!apiClient) {
            return;
        }

        const remove = async () => {
            loading.show();
            try {
                await deleteIconPack(apiClient, pack.Id);
                toast(`Deleted ${pack.Name}`);
                load();
            } catch (err) {
                console.error('[ProfileIcons] failed to delete the icon pack', err);
                toast('Could not delete the icon pack.');
            } finally {
                loading.hide();
            }
        };

        confirm({
            title: 'Delete icon pack',
            text: `Delete “${pack.Name}” and its ${pack.Icons.length} icons? Profiles using one of them keep it.`,
            confirmText: 'Delete',
            primary: 'delete'
        }).then(remove, () => {
            // Cancelled.
        });
    }, [ apiClient, load ]);

    return (
        <Page id='pirateFinIconPacksPage' className='mainAnimatedPage libraryPage noSecondaryNavPage pfIconPage' title='Icon packs'>
            <div className='pfIconPageContent'>
                <header className='pfIconHeader'>
                    <div>
                        <button type='button' className='pfIconBack' onClick={goBack}>
                            <span className='material-icons arrow_back' aria-hidden='true' />
                            Choose profile icon
                        </button>
                        <h1 className='pfIconTitle'>Icon packs</h1>
                    </div>
                    <button type='button' className='pfButton pfButton-primary' onClick={onAdd}>
                        <span className='material-icons add' aria-hidden='true' />
                        Add Icon Pack
                    </button>
                </header>

                {packs?.length === 0 && <p className='pfIconEmpty'>There are no icon packs yet.</p>}
                <div className='pfIconPackList'>
                    {packs?.map(pack => (
                        <PackItem key={pack.Id} pack={pack} getUrl={getUrl} onEdit={onEdit} onDelete={onDelete} />
                    ))}
                </div>
            </div>
        </Page>
    );
};

Component.displayName = 'PirateFinIconPacksPage';

export default Component;
