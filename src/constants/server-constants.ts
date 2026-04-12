/** HTTP listen host (0.0.0.0 for Docker; bind all interfaces). */
export const HTTP_HOST = '0.0.0.0';

const parsedPort = Number.parseInt(process.env.PORT ?? '', 10);

/** API port (from PORT env or default). */
export const HTTP_PORT = Number.isFinite(parsedPort) ? parsedPort : 8080;
