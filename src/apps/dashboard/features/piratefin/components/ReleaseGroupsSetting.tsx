import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';
import DragIndicator from '@mui/icons-material/DragIndicator';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import Sortable from 'sortablejs';

import type { ReleaseGroup } from '../api/pirateFinApi';

interface Row extends ReleaseGroup {
    key: number;
}

interface ReleaseGroupsSettingProps {
    settings: Record<string, unknown>;
    update: (name: string, value: unknown) => void;
    name: string;
    label: string;
    helperText: string;
    namePlaceholder: string;
    indicatorPlaceholder: string;
}

let nextKey = 0;
const toRows = (groups: ReleaseGroup[] | null | undefined): Row[] =>
    (groups ?? []).map(g => ({ Name: g.Name ?? '', Indicator: g.Indicator ?? '', key: nextKey++ }));

interface GroupRowProps {
    row: Row;
    index: number;
    namePlaceholder: string;
    indicatorPlaceholder: string;
    onChange: (index: number, field: keyof ReleaseGroup, value: string) => void;
    onRemove: (index: number) => void;
}

const GroupRow = ({ row, index, namePlaceholder, indicatorPlaceholder, onChange, onRemove }: GroupRowProps) => {
    const onName = useCallback((e: ChangeEvent<HTMLInputElement>) => onChange(index, 'Name', e.target.value), [ index, onChange ]);
    const onIndicator = useCallback((e: ChangeEvent<HTMLInputElement>) => onChange(index, 'Indicator', e.target.value), [ index, onChange ]);
    const remove = useCallback(() => onRemove(index), [ index, onRemove ]);

    return (
        <Stack direction='row' spacing={1} alignItems='center'>
            <Box
                className='releaseGroupHandle'
                sx={{ cursor: 'grab', display: 'flex', color: 'text.secondary' }}
                title='Drag to change the priority'
                aria-label={`Priority ${index + 1}; drag to reorder`}
            >
                <DragIndicator />
            </Box>
            <TextField
                size='small'
                label='Release group'
                placeholder={namePlaceholder}
                value={row.Name}
                onChange={onName}
                autoComplete='off'
                sx={{ flex: 1 }}
            />
            <TextField
                size='small'
                label='Language indicator'
                placeholder={indicatorPlaceholder}
                value={row.Indicator}
                onChange={onIndicator}
                autoComplete='off'
                sx={{ flex: 1 }}
            />
            <IconButton onClick={remove} aria-label={`Remove ${row.Name || 'group'}`} title='Remove'>
                <Close />
            </IconButton>
        </Stack>
    );
};

/**
 * An ordered list of release groups, each with the language indicator that is added to its search
 * (e.g. "Yameii" → "English Dub"). Rows are reordered by dragging their handle; the order is the priority.
 */
const ReleaseGroupsSetting = ({ settings, update, name, label, helperText, namePlaceholder, indicatorPlaceholder }: ReleaseGroupsSettingProps) => {
    const [ rows, setRows ] = useState<Row[]>(() => toRows(settings[name] as ReleaseGroup[] | undefined));
    const listRef = useRef<HTMLDivElement>(null);

    const commit = useCallback((next: Row[]) => {
        setRows(next);
        // Rows without a group name are kept on screen while typing but not saved.
        update(name, next
            .filter(r => r.Name.trim())
            .map(r => ({ Name: r.Name.trim(), Indicator: r.Indicator.trim() })));
    }, [ name, update ]);

    const rowsRef = useRef(rows);
    rowsRef.current = rows;

    useEffect(() => {
        const list = listRef.current;
        if (!list) {
            return;
        }

        const sortable = Sortable.create(list, {
            handle: '.releaseGroupHandle',
            animation: 150,
            onEnd: evt => {
                const { oldIndex, newIndex, item, from } = evt;
                if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) {
                    return;
                }

                // Put the node back where React rendered it, then let React re-render the new order.
                from.removeChild(item);
                from.insertBefore(item, from.children[oldIndex] ?? null);
                const next = [ ...rowsRef.current ];
                const [ moved ] = next.splice(oldIndex, 1);
                next.splice(newIndex, 0, moved);
                commit(next);
            }
        });
        return () => sortable.destroy();
    }, [ commit ]);

    const onChange = useCallback((index: number, field: keyof ReleaseGroup, value: string) => {
        commit(rowsRef.current.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    }, [ commit ]);

    const onRemove = useCallback((index: number) => {
        commit(rowsRef.current.filter((_, i) => i !== index));
    }, [ commit ]);

    const onAdd = useCallback(() => {
        setRows(current => [ ...current, { Name: '', Indicator: '', key: nextKey++ } ]);
    }, []);

    return (
        <Stack spacing={1}>
            <Typography variant='h3' component='h2' sx={{ fontSize: '1.05rem', fontWeight: 600 }}>{label}</Typography>
            <Typography variant='body2' color='text.secondary'>{helperText}</Typography>
            <Stack spacing={1} ref={listRef}>
                {rows.map((row, index) => (
                    <GroupRow
                        key={row.key}
                        row={row}
                        index={index}
                        namePlaceholder={namePlaceholder}
                        indicatorPlaceholder={indicatorPlaceholder}
                        onChange={onChange}
                        onRemove={onRemove}
                    />
                ))}
            </Stack>
            {rows.length === 0 && <Typography variant='body2' color='text.secondary'>No groups yet.</Typography>}
            <Box>
                <Button variant='text' startIcon={<Add />} onClick={onAdd}>Add group</Button>
            </Box>
        </Stack>
    );
};

export default ReleaseGroupsSetting;
