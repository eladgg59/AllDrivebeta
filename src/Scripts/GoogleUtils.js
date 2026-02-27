export async function isGoogleDriveTokenValid(accessToken) {
    const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (response.ok) {
        const data = await response.json();
        console.log('Token is valid. User info:', data.user);
        return true;
    } else {
        const error = await response.json();
        console.error('Invalid token:', error);
        return false;
    }
}


