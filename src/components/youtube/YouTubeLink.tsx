import React, { type ChangeEvent, type FC, type FormEvent, useCallback, useEffect, useState } from 'react';

import Button from 'elements/emby-button/Button';
import Input from 'elements/emby-input/Input';
import { useApi } from 'hooks/useApi';
import { getErrorText } from 'utils/piratefin';
import { type YouTubeDeviceCode, type YouTubeStatus, linkChannel, pollGoogleLink, startGoogleLink } from 'utils/youtube';

interface YouTubeLinkProps {
    status: YouTubeStatus;
    onLinked: () => void;
}

/** "Sign in with Google": shows the code to enter at google.com/device and waits for it. */
const GoogleLink: FC<{ onLinked: () => void }> = ({ onLinked }) => {
    const { __legacyApiClient__: apiClient } = useApi();
    const [ code, setCode ] = useState<YouTubeDeviceCode | null>(null);
    const [ error, setError ] = useState('');
    const [ busy, setBusy ] = useState(false);

    const onStart = useCallback(() => {
        if (!apiClient) return;
        setBusy(true);
        setError('');
        startGoogleLink(apiClient)
            .then(setCode)
            .catch(async err => setError(await getErrorText(err) || 'Couldn\'t start signing in.'))
            .finally(() => setBusy(false));
    }, [ apiClient ]);

    // Ask the server every few seconds whether the code was entered.
    useEffect(() => {
        if (!apiClient || !code) return;
        let stopped = false;
        const timer = setInterval(() => {
            pollGoogleLink(apiClient).then(state => {
                if (stopped) return;
                if (state === 'linked') {
                    onLinked();
                } else if (state === 'denied' || state === 'expired') {
                    setCode(null);
                    setError(state === 'denied' ? 'Access was denied on Google\'s page.' : 'The code expired. Please start again.');
                }
            }).catch(async err => {
                if (!stopped) {
                    setCode(null);
                    setError(await getErrorText(err) || 'Signing in failed.');
                }
            });
        }, Math.max(5, code.IntervalSeconds) * 1000);
        return () => {
            stopped = true;
            clearInterval(timer);
        };
    }, [ apiClient, code, onLinked ]);

    return (
        <div className='ytLinkOption'>
            <h2>Sign in with Google</h2>
            <p>
                Uses your own YouTube subscriptions, including private ones. PirateFin only gets read access, and you can
                remove it at any time in your Google account.
            </p>
            {code ? (
                <div className='ytDeviceCode'>
                    <p>On your phone or computer, go to</p>
                    <div className='ytDeviceUrl'>{code.VerificationUrl.replace(/^https?:\/\//, '')}</div>
                    <p>and enter</p>
                    <div className='ytUserCode'>{code.UserCode}</div>
                    <p className='fieldDescription'>
                        If Google says it hasn&apos;t verified the app, choose Advanced → Go to PirateFin. Waiting for you…
                    </p>
                </div>
            ) : (
                <Button type='button' className='raised button-submit' onClick={onStart} disabled={busy} title='Sign in with Google' />
            )}
            {error && <p className='ytError'>{error}</p>}
        </div>
    );
};

/** Links by channel id, @handle or link (public subscriptions only). */
const ChannelLink: FC<{ onLinked: () => void }> = ({ onLinked }) => {
    const { __legacyApiClient__: apiClient } = useApi();
    const [ channel, setChannel ] = useState('');
    const [ error, setError ] = useState('');
    const [ busy, setBusy ] = useState(false);

    const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setChannel(e.target.value), []);
    const onSubmit = useCallback((e: FormEvent) => {
        e.preventDefault();
        if (!apiClient || !channel.trim()) return;
        setBusy(true);
        setError('');
        linkChannel(apiClient, channel.trim())
            .then(onLinked)
            .catch(async err => setError(await getErrorText(err) || 'That channel couldn\'t be linked.'))
            .finally(() => setBusy(false));
    }, [ apiClient, channel, onLinked ]);

    return (
        <form className='ytLinkOption' onSubmit={onSubmit}>
            <h2>Use my channel</h2>
            <p>
                No Google sign in: PirateFin reads your subscriptions with the server&apos;s key. They must be public: on
                YouTube, open Settings → Privacy and turn off &quot;Keep all my subscriptions private&quot;. Anyone can then
                see them on your channel.
            </p>
            <div className='inputContainer'>
                <Input
                    id='ytChannelInput'
                    label='Your channel'
                    type='text'
                    value={channel}
                    onChange={onChange}
                    placeholder='@yourhandle, channel link or UC… id'
                />
                <div className='fieldDescription'>
                    Find it on YouTube under your profile picture → View your channel.
                </div>
            </div>
            <Button type='submit' className='raised' disabled={busy || !channel.trim()} title='Link channel' />
            {error && <p className='ytError'>{error}</p>}
        </form>
    );
};

/** Shown until the user links their YouTube: both ways, with what each means. */
const YouTubeLink: FC<YouTubeLinkProps> = ({ status, onLinked }) => (
    <div className='ytLink padded-left padded-right'>
        <h1>Link your YouTube</h1>
        <p>
            Your YouTube tab shows new videos from your subscriptions and videos like them. Pick one way to link it; you
            can change it later.
        </p>
        <div className='ytLinkOptions'>
            {status.GoogleAvailable && <GoogleLink onLinked={onLinked} />}
            {status.ChannelIdAvailable && <ChannelLink onLinked={onLinked} />}
        </div>
        {!status.GoogleAvailable && !status.ChannelIdAvailable && (
            <p>YouTube isn&apos;t set up on this server yet. Ask your admin.</p>
        )}
    </div>
);

export default YouTubeLink;
