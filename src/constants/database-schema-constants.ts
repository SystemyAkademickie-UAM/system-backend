/**
 * PostgreSQL schema names (English DDL as of 2026-05 migration).
 */
/** PostgreSQL schema: authorization tables (`users`, `accounts`, `organizations`, `tokens`). */
export const AUTH_SCHEMA = 'auth';

/** PostgreSQL schema: education domain tables (`groups`, `stages`, `activities`, `posts`). */
export const EDUCATION_SCHEMA = 'education';

/** PostgreSQL schema: gamification tables (`enrollments`, `ranks`, `badges`, …). */
export const GAMIFICATION_SCHEMA = 'gamification';

/** PostgreSQL schema: service-layer tables (`drive`). */
export const SERVICES_SCHEMA = 'services';

/** PostgreSQL schema: analytics tables (`backlog`, `activity_backlog`). */
export const ANALYTICS_SCHEMA = 'analytics';
