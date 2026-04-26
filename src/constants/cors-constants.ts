/**
 * Public UI origin (must match the browser `Origin` header exactly — no path, no trailing slash).
 */
export const PUBLIC_APP_ORIGIN = 'https://maq.projektstudencki.pl';

/** Used when `CORS_ORIGIN` is not set. */
export const DEFAULT_CORS_ORIGINS: readonly string[] = [
  PUBLIC_APP_ORIGIN,
  'http://maq.projektstudencki.pl',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  /** Vite default and common alternate dev ports (SPA `fetch` to API + credentials). */
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];
