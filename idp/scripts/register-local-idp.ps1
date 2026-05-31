# Registers the local SimpleSAMLphp IdP (npm run idp:up) in PostgreSQL.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path (Split-Path -Parent $PSScriptRoot) '..')
node ./scripts/register-org.mjs `
  --name "Localhost IdP" `
  --metadata-url "http://127.0.0.1:5000/simplesaml/saml2/idp/metadata.php" `
  @args
