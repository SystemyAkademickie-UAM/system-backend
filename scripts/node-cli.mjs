#!/usr/bin/env node
/**
 * Runs CLI scripts with Node type-stripping. Suppresses MODULE_TYPELESS_PACKAGE_JSON:
 * .mjs scripts import shared constants from src/*.ts while the Nest app stays CommonJS
 * (no root package.json "type": "module").
 */
import { spawnSync } from 'node:child_process';

const [, , scriptPath, ...scriptArgs] = process.argv;
if (scriptPath === undefined || scriptPath.length === 0) {
  console.error('Usage: node scripts/node-cli.mjs <script.mjs> [args...]');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    '--experimental-strip-types',
    scriptPath,
    ...scriptArgs,
  ],
  { stdio: 'inherit', env: process.env },
);

process.exit(result.status ?? 1);
