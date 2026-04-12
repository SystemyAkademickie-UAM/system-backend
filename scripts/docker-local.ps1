# Build and run this API image locally (Docker only; no npm/Node on the host required for the container).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$image = if ($env:IMAGE_NAME) { $env:IMAGE_NAME } else { 'system-backend:local' }
docker build -t $image .
docker run --rm -p 8080:8080 -e PORT=8080 $image
