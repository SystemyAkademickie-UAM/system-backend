/** Env var: `true` / `false` override; when unset, Swagger is off in production only. */
export const SWAGGER_ENABLED_ENV_KEY = 'SWAGGER_ENABLED';

/** Path segment under global `/api` prefix (UI at `/api/docs`). */
export const SWAGGER_UI_PATH = 'docs';

/** OpenAPI security scheme name for the `X-Browser-ID` header. */
export const SWAGGER_BROWSER_ID_SECURITY_NAME = 'browserId';
