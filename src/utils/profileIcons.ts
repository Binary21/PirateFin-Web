import type { ApiClient } from 'jellyfin-apiclient';

/** A profile icon users can choose. Mirrors the server's ProfileIcon. */
export interface ProfileIcon {
    File: string;
    Title: string;
    /** The season the icon is from when its pack spans several. */
    Season?: string | null;
    /** New users may be given this icon at random. */
    Default: boolean;
}

/** A set of icons, e.g. the characters of one show; a folder on the server. */
export interface IconPack {
    /** The pack's folder name. */
    Id: string;
    Name: string;
    Icons: ProfileIcon[];
}

/** An icon of a pack. */
export interface IconRef {
    PackId: string;
    File: string;
}

/** Icons are stored as squares of this size. */
const ICON_SIZE = 320;

export function getIconPacks(apiClient: ApiClient): Promise<IconPack[]> {
    return apiClient.getJSON(apiClient.getUrl('PirateFin/Icons'));
}

export function getIconUrl(apiClient: ApiClient, packId: string, file: string): string {
    return apiClient.getUrl(`PirateFin/Icons/${encodeURIComponent(packId)}/${encodeURIComponent(file)}`);
}

/** The icon the user has, or null when their image isn't one of the icons. */
export async function getUserIcon(apiClient: ApiClient, userId: string): Promise<IconRef | null> {
    const response: Response = await apiClient.ajax({ type: 'GET', url: apiClient.getUrl(`PirateFin/Users/${userId}/Icon`) });
    return response.status === 204 ? null : response.json();
}

/** Makes the icon the user's profile image. */
export function setUserIcon(apiClient: ApiClient, userId: string, icon: IconRef): Promise<unknown> {
    return apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl(`PirateFin/Users/${userId}/Icon`),
        data: JSON.stringify(icon),
        contentType: 'application/json'
    });
}

export function createIconPack(apiClient: ApiClient, name: string): Promise<IconPack> {
    return apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl('PirateFin/Icons'),
        data: JSON.stringify({ Name: name }),
        contentType: 'application/json',
        dataType: 'json'
    });
}

/** Renames a pack; its id (folder name) changes with it. */
export function renameIconPack(apiClient: ApiClient, packId: string, name: string): Promise<IconPack> {
    return apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl(`PirateFin/Icons/${encodeURIComponent(packId)}`),
        data: JSON.stringify({ Name: name }),
        contentType: 'application/json',
        dataType: 'json'
    });
}

export function deleteIconPack(apiClient: ApiClient, packId: string): Promise<unknown> {
    return apiClient.ajax({ type: 'DELETE', url: apiClient.getUrl(`PirateFin/Icons/${encodeURIComponent(packId)}`) });
}

/**
 * Adds an icon to a pack.
 * @param apiClient The api client.
 * @param packId The pack id.
 * @param title The icon's display name.
 * @param pngDataUrl The icon as a PNG data url (see {@link cropToIcon}); sent base64 encoded like Jellyfin's own image uploads.
 */
export function addIcon(apiClient: ApiClient, packId: string, title: string, pngDataUrl: string): Promise<ProfileIcon> {
    return apiClient.ajax({
        type: 'POST',
        url: apiClient.getUrl(`PirateFin/Icons/${encodeURIComponent(packId)}/Icons`, { title }),
        data: pngDataUrl.substring(pngDataUrl.indexOf(',') + 1),
        contentType: 'image/png',
        dataType: 'json'
    });
}

export function deleteIcon(apiClient: ApiClient, packId: string, file: string): Promise<unknown> {
    return apiClient.ajax({
        type: 'DELETE',
        url: apiClient.getUrl(`PirateFin/Icons/${encodeURIComponent(packId)}/Icons/${encodeURIComponent(file)}`)
    });
}

function readAsDataUrl(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error ?? new Error('Could not read the image'));
        reader.readAsDataURL(file);
    });
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Not an image'));
        image.src = src;
    });
}

/** Crops the middle square of an image and scales it to the icon size. Resolves with a PNG data url. */
export async function cropToIcon(file: Blob): Promise<string> {
    const image = await loadImage(await readAsDataUrl(file));
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Canvas is not supported');
    }

    context.imageSmoothingQuality = 'high';
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, ICON_SIZE, ICON_SIZE);
    return canvas.toDataURL('image/png');
}

/** The icon's title for an image file: its name without the extension. */
export function getTitleFromFileName(name: string): string {
    return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Icon';
}
