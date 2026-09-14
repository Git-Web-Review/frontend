# frontend

React TypeScript frontend for git-web-review.

## Development

```sh
npm install
npm run dev
```

The app expects these environment variables, provided by the root Docker Compose file during container development:

- `FRONTEND_ALLOWED_HOSTS`
- `VITE_BACKEND_URL`
- `VITE_WEBSOCKET_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`

`FRONTEND_ALLOWED_HOSTS` restricts which `Host` headers are served. Values are
comma-separated; `*` or an empty value allows every host, and an entry prefixed
with a dot also matches its subdomains. In development it configures Vite's own
allowlist; in the container it is compiled into the nginx host check.

See the root `README.md` and `example.env` for Firebase setup details.

## Container image

The image **builds** the app and serves `dist/` with nginx as an unprivileged
user. It does not run the Vite dev server, which exposes sources, source maps
and the `/@fs/` file endpoint and is not meant to face a network.

```sh
docker compose up --build frontend
```

### Runtime configuration

Vite inlines `VITE_*` variables at build time, which would freeze them into the
image. Instead, `docker/entrypoint.sh` writes `/config.js` from the container
environment before starting nginx, and [`src/config.ts`](src/config.ts) reads it
through `window.__APP_CONFIG__`. Editing `.env` and restarting the service is
enough — no rebuild.

`npm run dev` has no such file and falls back to `import.meta.env`, so local
development is unchanged.

**Adding a variable** means touching three places: `src/config.ts` to read it,
`docker/entrypoint.sh` to emit it, and `docker-compose.yml` to pass it.
