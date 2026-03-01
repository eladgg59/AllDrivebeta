# Environment Setup

## 1. Create your `.env` file

Copy the example file and fill in your values:

```
cp .env.example .env
```

On Windows:
```
copy .env.example .env
```

## 2. Get your Google Client Secret

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one)
3. **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID (or create one for Web application)
5. Click on it and copy the **Client secret**
6. Paste it into `.env` as `GOOGLE_CLIENT_SECRET=your_secret_here`

## 3. Run the backend

```bash
npm run backend
```

Keep this running in a terminal. The backend listens on `http://localhost:4000` and is used for Google token refresh.

## 4. Run the app

In a separate terminal:

```bash
npm start
```

## Production

When you deploy:

1. Deploy your backend to a host (Railway, Render, Heroku, etc.)
2. Set `EXPO_PUBLIC_API_URL` in your deployment environment to your backend URL (e.g. `https://your-app.railway.app`)
3. Deploy the Firestore rules from `firestore.rules` in Firebase Console → Firestore → Rules
