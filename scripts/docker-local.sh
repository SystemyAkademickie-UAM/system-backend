#!/usr/bin/env bash
# Build and run this API image locally (Docker only; no npm/Node on the host required for the container).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
IMAGE="${IMAGE_NAME:-system-backend:local}"
docker build -t "$IMAGE" .
exec docker run --rm -p 8080:8080 -e PORT=8080 "$IMAGE"
