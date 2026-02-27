import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DropboxScreen = () => {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    // Dropbox OAuth configuration
    const CLIENT_ID = 'aggqdrczzlyxndd';  // Replace with your Dropbox app's client ID
    const REDIRECT_URI = 'http://localhost:8080'; // Change this to your redirect URI

    // Construct Dropbox OAuth URL
    const getDropboxAuthUrl = () => {
        const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${REDIRECT_URI}`;
        return authUrl;
    };

    // Function to start the OAuth flow
    const authenticateDropbox = () => {
        setLoading(true);
        window.location.href = getDropboxAuthUrl(); // Redirect to Dropbox's auth page
    };

    // Handle the redirect from Dropbox and get the access token
    const handleRedirect = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const authCode = urlParams.get('code');

        if (authCode) {
            try {
                const response = await axios.post('https://api.dropbox.com/oauth2/token', null, {
                    params: {
                        code: authCode,
                        grant_type: 'authorization_code',
                        client_id: CLIENT_ID,
                        client_secret: 'mslbf9vbzeksd7l', // Replace with your Dropbox app's client secret
                        redirect_uri: REDIRECT_URI
                    }
                });
                setAccessToken(response.data.access_token);
                console.log('Access Token:', response.data.access_token); // Store it for later use
            } catch (err) {
                console.error('Error during token exchange:', err);
                setError('Failed to get access token from Dropbox');
            }
        }
    };

    // Run handleRedirect on component mount if it's a redirect URL
    useEffect(() => {
        if (window.location.search.includes('code=')) {
            handleRedirect();
        }
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            {accessToken ? (
                <div>Authenticated successfully with Dropbox! You can now access files.</div>
            ) : (
                <button onClick={authenticateDropbox}>Login with Dropbox</button>
            )}

            {error && <div>{error}</div>}
        </div>
    );
};

export default DropboxScreen;
