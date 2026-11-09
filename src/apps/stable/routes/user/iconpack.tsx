import React, { type ChangeEvent, type FC, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import loading from 'components/loading/loading';
import Page from 'components/Page';
import toast from 'components/toast/toast';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';
import {
    addIcon,
    createIconPack,
    cropToIcon,
    deleteIcon,
    getIconPacks,
    getIconUrl,
    getTitleFromFileName,
    renameIconPack,
    type IconPack
} from 'utils/profileIcons';

import 'styles/piratefin.scss';
import 'styles/profileIcons.scss';

/** An icon on the sheet: already in the pack, or added and not saved yet. */
interface SheetIcon {
    key: string;
    title: string;
    url: string;
    /** The file in the pack, for saved icons. */
    file?: string;
    /** The cropped PNG (a data url, also the preview), for new icons. */
    png?: string;
}

interface TileProps {
    icon: SheetIcon;
    selected: boolean;
    onToggle: (key: string) => void;
}

const Tile: FC<TileProps> = ({ icon, selected, onToggle }) => {
    const onClick = useCallback(() => onToggle(icon.key), [ icon.key, onToggle ]);
    const className = [ 'pfIconTile', selected && 'pfIconTile-selected', icon.png && 'pfIconTile-new' ].filter(Boolean).join(' ');

    return (
        <button type='button' className={className} title={icon.title} aria-label={icon.title} aria-pressed={selected} onClick={onClick}>
            <img src={icon.url} alt='' loading='lazy' />
        </button>
    );
};

/**
 * Admin: creates an icon pack (no packId) or edits one. The pack's name is its folder's name and the icons are the
 * images inside. Images are cropped to squares when they're added; nothing is saved until Save.
 */
export const Component: FC = () => {
    const navigate = useNavigate();
    const [ searchParams ] = useSearchParams();
    const packId = searchParams.get('packId');
    const apiClient = ServerConnections.currentApiClient();

    const [ pack, setPack ] = useState<IconPack | null>(null);
    const [ name, setName ] = useState('');
    const [ icons, setIcons ] = useState<SheetIcon[]>([]);
    const [ removedFiles, setRemovedFiles ] = useState<string[]>([]);
    const [ selected, setSelected ] = useState<Set<string>>(new Set());
    const fileInput = useRef<HTMLInputElement>(null);
    const nextKey = useRef(0);

    useEffect(() => {
        if (!apiClient || !packId) {
            return;
        }

        loading.show();
        getIconPacks(apiClient).then(packs => {
            const found = packs.find(p => p.Id === packId);
            if (!found) {
                toast('That icon pack no longer exists.');
                return;
            }

            setPack(found);
            setName(found.Name);
            setIcons(found.Icons.map(icon => ({
                key: `saved:${icon.File}`,
                title: icon.Title,
                url: getIconUrl(apiClient, found.Id, icon.File),
                file: icon.File
            })));
        }).catch(err => {
            console.error('[ProfileIcons] failed to load the icon pack', err);
            toast('Could not load the icon pack.');
        }).finally(() => {
            loading.hide();
        });
    }, [ apiClient, packId ]);

    const onNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setName(e.target.value), []);

    const onToggle = useCallback((key: string) => {
        setSelected(current => {
            const next = new Set(current);
            if (!next.delete(key)) {
                next.add(key);
            }
            return next;
        });
    }, []);

    const onAddClick = useCallback(() => {
        if (fileInput.current) {
            fileInput.current.value = '';
            fileInput.current.click();
        }
    }, []);

    const onFilesChosen = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'));
        const added: SheetIcon[] = [];
        for (const file of files) {
            try {
                const png = await cropToIcon(file);
                added.push({
                    key: `new:${nextKey.current++}`,
                    title: getTitleFromFileName(file.name),
                    url: png,
                    png
                });
            } catch (err) {
                console.error('[ProfileIcons] could not read', file.name, err);
                toast(`Could not read ${file.name}`);
            }
        }

        setIcons(current => [ ...current, ...added ]);
    }, []);

    const onDeleteSelected = useCallback(() => {
        const removed = icons.filter(icon => selected.has(icon.key));
        setRemovedFiles(current => [ ...current, ...removed.flatMap(icon => (icon.file ? [ icon.file ] : [])) ]);
        setIcons(current => current.filter(icon => !selected.has(icon.key)));
        setSelected(new Set());
    }, [ icons, selected ]);

    const onCancel = useCallback(() => navigate(-1), [ navigate ]);

    const onSave = useCallback(async () => {
        const trimmed = name.trim();
        if (!apiClient) {
            return;
        }
        if (!trimmed) {
            toast('Give the icon pack a name.');
            return;
        }

        loading.show();
        try {
            let saved: IconPack;
            if (!pack) {
                saved = await createIconPack(apiClient, trimmed);
            } else if (trimmed !== pack.Name) {
                saved = await renameIconPack(apiClient, pack.Id, trimmed);
            } else {
                saved = pack;
            }

            for (const file of removedFiles) {
                await deleteIcon(apiClient, saved.Id, file);
            }

            for (const icon of icons) {
                if (icon.png) {
                    await addIcon(apiClient, saved.Id, icon.title, icon.png);
                }
            }

            toast(`Saved ${trimmed}`);
            navigate('/iconpacks', { replace: true });
        } catch (err) {
            console.error('[ProfileIcons] failed to save the icon pack', err);
            toast('Could not save the icon pack.');
        } finally {
            loading.hide();
        }
    }, [ apiClient, icons, name, navigate, pack, removedFiles ]);

    const title = packId ? 'Edit Icon Pack' : 'Add Icon Pack';
    const iconCount = icons.length === 1 ? '1 icon' : `${icons.length} icons`;

    return (
        <Page id='pirateFinIconPackPage' className='mainAnimatedPage libraryPage noSecondaryNavPage pfIconPage' title={title}>
            <div className='pfIconPageContent'>
                <header className='pfIconHeader'>
                    <div>
                        <button type='button' className='pfIconBack' onClick={onCancel}>
                            <span className='material-icons arrow_back' aria-hidden='true' />
                            Icon packs
                        </button>
                        <h1 className='pfIconTitle'>{title}</h1>
                    </div>
                </header>

                <div className='pfIconToolbar'>
                    <input
                        className='pfIconNameField'
                        type='text'
                        value={name}
                        onChange={onNameChange}
                        placeholder='Icon pack name'
                        aria-label='Icon pack name'
                        maxLength={100}
                    />
                    <span className='pfIconToolbarSpacer' />
                    <span className='pfIconPackCount'>
                        {selected.size ? `${selected.size} selected` : iconCount}
                    </span>
                    <button
                        type='button'
                        className='pfIconRoundButton'
                        onClick={onDeleteSelected}
                        disabled={!selected.size}
                        title='Delete selected icons'
                        aria-label='Delete selected icons'
                    >
                        <span className='material-icons delete' aria-hidden='true' />
                    </button>
                </div>

                <div className='pfIconGrid'>
                    <button type='button' className='pfIconTile pfIconTile-add' onClick={onAddClick} title='Add icons' aria-label='Add icons'>
                        <span className='material-icons add' aria-hidden='true' />
                    </button>
                    {icons.map(icon => (
                        <Tile key={icon.key} icon={icon} selected={selected.has(icon.key)} onToggle={onToggle} />
                    ))}
                </div>
                <input ref={fileInput} type='file' accept='image/*' multiple hidden onChange={onFilesChosen} />

                <div className='pfIconEditorButtons'>
                    <button type='button' className='pfButton pfButton-secondary' onClick={onCancel}>Cancel</button>
                    <button type='button' className='pfButton pfButton-primary' onClick={onSave}>Save</button>
                </div>
            </div>
        </Page>
    );
};

Component.displayName = 'PirateFinIconPackPage';

export default Component;
