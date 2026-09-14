// Runtime configuration for the frontend.
//
// Inside the container this file is replaced at start-up by
// docker/entrypoint.sh, from the environment variables.
// In development (`npm run dev`) it stays empty and the values come from .env
// through import.meta.env.
window.__APP_CONFIG__ = {};
