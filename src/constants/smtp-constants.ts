/** Env key: SMTP host (UAM student mail: smtp.office365.com). */
export const SMTP_HOST_ENV_KEY = 'SMTP_HOST';

/** Env key: SMTP port (Microsoft 365 STARTTLS: 587; implicit TLS: 465). */
export const SMTP_PORT_ENV_KEY = 'SMTP_PORT';

/** Env key: SMTP username (full @st.amu.edu.pl address for student mail). */
export const SMTP_USER_ENV_KEY = 'SMTP_USER';

/** Env key: SMTP password (Microsoft 365 account password or app password if MFA is on). */
export const SMTP_PASSWORD_ENV_KEY = 'SMTP_PASSWORD';

/** Env key: RFC5322 From header; quote in .env when it contains spaces. */
export const SMTP_FROM_ENV_KEY = 'SMTP_FROM';

/** Default SMTP host for UAM student Microsoft 365 mail. */
export const SMTP_DEFAULT_HOST = 'smtp.office365.com';

/** Default SMTP port for Microsoft 365 STARTTLS submission. */
export const SMTP_DEFAULT_PORT = 587;

/** Port for implicit TLS (SSL) SMTP. */
export const SMTP_IMPLICIT_TLS_PORT = 465;

/** Default From header when SMTP_FROM is unset (quote in .env if it contains spaces). */
export const SMTP_DEFAULT_FROM = 'MyAcademyQuest <no-reply@maq.amu.edu.pl>';
