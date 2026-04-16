$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

$stagingPort = if ($env:STAGING_PORT) { $env:STAGING_PORT } else { '5050' }
$apiBaseUrl = if ($env:API_BASE_URL) { $env:API_BASE_URL } else { "http://localhost:$stagingPort" }
$healthPath = if ($env:HEALTH_PATH) { $env:HEALTH_PATH } else { '/api/health' }

Write-Output "[smoke] starting staging server on port $stagingPort"
$env:PORT = $stagingPort
$server = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'start:staging' -PassThru -WindowStyle Hidden

try {
  $healthOk = $false
  for ($i = 1; $i -le 30; $i++) {
    try {
      $response = Invoke-WebRequest -Uri ("$apiBaseUrl$healthPath") -UseBasicParsing
      if ($response.StatusCode -eq 200) {
        Write-Output "[smoke] health ok: $($response.Content)"
        $healthOk = $true
        break
      }
    } catch {
      # Retry until timeout.
    }
    Start-Sleep -Seconds 1
  }

  if (-not $healthOk) {
    throw "[smoke] health check failed after 30 attempts"
  }

  Write-Output '[smoke] check auth route availability'
  try {
    Invoke-WebRequest -Uri "$apiBaseUrl/api/auth/login" -Method Post -ContentType 'application/json' -Body '{"email":"nobody@example.com","password":"invalid"}' -UseBasicParsing | Out-Null
  } catch {
    # Non-2xx is acceptable for smoke.
  }

  Write-Output '[smoke] check admin route protection'
  try {
    $adminResponse = Invoke-WebRequest -Uri "$apiBaseUrl/api/admin/overview" -UseBasicParsing
    $adminStatus = $adminResponse.StatusCode
  } catch {
    if ($_.Exception.Response) {
      $adminStatus = [int]$_.Exception.Response.StatusCode
    } else {
      throw
    }
  }

  if ($adminStatus -ne 401 -and $adminStatus -ne 403) {
    throw "[smoke] expected protected admin endpoint to return 401/403, got $adminStatus"
  }

  Write-Output 'Smoke tests complete.'
}
finally {
  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
}
