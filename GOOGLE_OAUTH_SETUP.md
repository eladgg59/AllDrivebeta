# Fix Google OAuth "Access blocked: Authorization Error"

The app uses the Expo auth proxy for Google sign-in on native (Expo Go). Add this redirect URI to your Google Cloud project:

## Steps

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Open your **OAuth 2.0 Client ID** (Web application type) – the one with client ID `494172450205-...`
3. Under **Authorized redirect URIs**, add:
   ```
   https://auth.expo.io/@anonymous/AllDrive
   ```
4. If you're logged into Expo (`npx expo login`), also add (replace YOUR_USERNAME with your Expo username):
   ```
   https://auth.expo.io/@YOUR_USERNAME/AllDrive
   ```
5. Click **Save**

## OAuth consent screen

- If your app is in **Testing** mode, add your Google email (`ELADBROSH59@gmail.com`) under **Test users**
- Ensure the Drive and userinfo scopes are configured
