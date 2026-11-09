import { AsyncRoute } from '../../../../components/router/AsyncRoute';

export const ASYNC_USER_ROUTES: AsyncRoute[] = [
    { path: 'changepassword', page: 'session/changePassword' },
    { path: 'iconpack', page: 'user/iconpack' },
    { path: 'iconpacks', page: 'user/iconpacks' },
    { path: 'mypreferencesmenu', page: 'user/settings' },
    { path: 'profileicon', page: 'user/profileicon' },
    { path: 'quickconnect', page: 'quickConnect' },
    { path: 'search', page: 'search' },
    { path: 'userprofile', page: 'user/userprofile' },
    { path: 'youtube', page: 'youtube' },
    { path: 'youtubechannel', page: 'youtubechannel' },
    { path: 'youtubesearch', page: 'youtubesearch' }
];
