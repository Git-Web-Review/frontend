# frontend

React TypeScript frontend for git-web-review.

## Development

```sh
npm install
npm run dev
```

The app expects these environment variables, provided by the root Docker Compose file during container development:

- `VITE_BACKEND_URL`
- `VITE_WEBSOCKET_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`

See the root `README.md` and `example.env` for Firebase setup details.
