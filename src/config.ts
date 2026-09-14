/**
 * Configuration read at start-up rather than at build time.
 *
 * Vite inlines `VITE_*` when it builds, which freezes the configuration into the
 * image. So the container writes `config.js` from its own environment before
 * starting nginx, and this module reads that file first. `npm run dev` has no
 * such file and falls back to the values inlined from `.env`, as before.
 */

export type RuntimeConfig = {
  backendUrl?: string;
  websocketUrl?: string;
  firebase?: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    appId?: string;
    messagingSenderId?: string;
    storageBucket?: string;
  };
};

declare global {
  interface Window {
    __APP_CONFIG__?: RuntimeConfig;
  }
}

const runtime: RuntimeConfig =
  (typeof window !== "undefined" ? window.__APP_CONFIG__ : undefined) ?? {};

/** First non-empty value: runtime, then build, then local default. */
function setting(
  runtimeValue: string | undefined,
  buildValue: string | undefined,
  fallback = "",
): string {
  return (
    (runtimeValue ?? "").trim() || (buildValue ?? "").trim() || fallback
  );
}

export const backendUrl = setting(
  runtime.backendUrl,
  import.meta.env.VITE_BACKEND_URL,
  "http://localhost:3005",
);

export const websocketUrl = setting(
  runtime.websocketUrl,
  import.meta.env.VITE_WEBSOCKET_URL,
  "ws://localhost:3001",
);

export const firebaseConfig = {
  apiKey: setting(runtime.firebase?.apiKey, import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: setting(
    runtime.firebase?.authDomain,
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  ),
  projectId: setting(
    runtime.firebase?.projectId,
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
  ),
  appId: setting(runtime.firebase?.appId, import.meta.env.VITE_FIREBASE_APP_ID),
  messagingSenderId: setting(
    runtime.firebase?.messagingSenderId,
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  ),
  storageBucket: setting(
    runtime.firebase?.storageBucket,
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  ),
};
