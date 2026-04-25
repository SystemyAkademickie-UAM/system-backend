# Smoke checks: Nest SP metadata (requires API) and proxy IdP TLS (requires docker compose).
$ErrorActionPreference = "Stop"
$apiBase = $env:SAML_VERIFY_API_BASE
if ([string]::IsNullOrWhiteSpace($apiBase)) {
  $apiBase = "http://127.0.0.1:8080/api"
}
$idpBase = $env:SAML_VERIFY_PROXY_IDP_BASE
if ([string]::IsNullOrWhiteSpace($idpBase)) {
  $idpBase = "https://localhost:14443"
}
Write-Host "SP metadata: GET $apiBase/auth/saml/metadata"
try {
  $sp = Invoke-WebRequest -Uri "$apiBase/auth/saml/metadata" -UseBasicParsing -TimeoutSec 5
  if ($sp.StatusCode -ne 200) { throw "Unexpected status $($sp.StatusCode)" }
  if ($sp.Headers["Content-Type"] -notmatch "xml") { Write-Warning "Content-Type may not be XML" }
  if ($sp.Content -notmatch "EntityDescriptor") { throw "Body missing EntityDescriptor" }
  Write-Host "SP metadata: OK"
} catch {
  Write-Warning "SP metadata check skipped or failed: $($_.Exception.Message)"
}
Write-Host "Proxy IdP: GET $idpBase/idp/shibboleth (ignore cert errors)"
try {
  [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
  $idp = Invoke-WebRequest -Uri "$idpBase/idp/shibboleth" -UseBasicParsing -TimeoutSec 10
  Write-Host "Proxy IdP TLS: OK ($($idp.StatusCode))"
} catch {
  Write-Warning "Proxy IdP check skipped or failed: $($_.Exception.Message)"
}
