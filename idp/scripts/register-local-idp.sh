#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
exec node ./scripts/register-org.mjs \
  --name "Localhost IdP" \
  --metadata-url "http://127.0.0.1:5000/simplesaml/saml2/idp/metadata.php" \
  "$@"
