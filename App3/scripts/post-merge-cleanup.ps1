param(
  [switch]$SkipSmoke,
  [switch]$KeepWorktree
)

$ErrorActionPreference = 'Stop'

if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$featureBranch = 'feature/codebase-audit-fixes'
$featureRemoteRef = "origin/$featureBranch"
$tempWorktreePath = Join-Path $repoRoot '.tmp-main-verify'

Set-Location $repoRoot

Write-Output '[post-merge] fetching origin'
git fetch origin

$featureHead = (cmd /c "git rev-parse $featureRemoteRef 2>nul").Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($featureHead)) {
  Write-Output "[post-merge] missing remote branch ref: $featureRemoteRef; using local branch head instead"
  $featureHead = (cmd /c "git rev-parse $featureBranch 2>nul").Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($featureHead)) {
    Write-Output "[post-merge] local branch not found either: $featureBranch"
    Write-Output '[post-merge] cleanup already complete; nothing to do.'
    exit 0
  }
}

# merge-base --is-ancestor returns 0 when the feature head is included in origin/main
& git merge-base --is-ancestor $featureHead origin/main
if ($LASTEXITCODE -ne 0) {
  Write-Output '[post-merge] feature branch is not merged into origin/main yet. Stop cleanup here.'
  exit 1
}

if (Test-Path $tempWorktreePath) {
  Write-Output '[post-merge] removing stale temporary worktree'
  git worktree remove $tempWorktreePath --force
}

Write-Output '[post-merge] creating temporary main worktree for safe verification'
git worktree add --detach $tempWorktreePath origin/main

$safeDirectoryAdded = $false
$safeDirectoryPath = ($tempWorktreePath -replace '\\', '/')
try {
  $existingSafeDirectories = git config --global --get-all safe.directory 2>$null
  if (-not ($existingSafeDirectories -contains $safeDirectoryPath)) {
    Write-Output '[post-merge] registering temporary worktree as git safe.directory'
    git config --global --add safe.directory $safeDirectoryPath
    $safeDirectoryAdded = $true
  }
} catch {
  Write-Output '[post-merge] warning: unable to configure git safe.directory automatically'
}

try {
  Write-Output '[post-merge] fast-forwarding main inside temporary worktree'
  git -C $tempWorktreePath pull --ff-only origin main

  if (-not $SkipSmoke) {
    Write-Output '[post-merge] running smoke verification on main (temp worktree)'
    Push-Location $tempWorktreePath
    npm run smoke
    Pop-Location
  } else {
    Write-Output '[post-merge] skip smoke requested'
  }
}
finally {
  if ($safeDirectoryAdded) {
    try {
      Write-Output '[post-merge] removing temporary safe.directory entry'
      git config --global --unset-all safe.directory $safeDirectoryPath
    } catch {
      Write-Output '[post-merge] warning: failed to remove temporary safe.directory entry'
    }
  }

  if (-not $KeepWorktree -and (Test-Path $tempWorktreePath)) {
    Write-Output '[post-merge] removing temporary worktree'
    git worktree remove $tempWorktreePath --force
  }
}

$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
$changes = git status --porcelain

if ($currentBranch -eq $featureBranch) {
  if ($changes) {
    Write-Output '[post-merge] branch cleanup skipped: currently on feature branch with local changes.'
    Write-Output '[post-merge] to delete local branch later: switch to main with a clean tree, then run git branch -d feature/codebase-audit-fixes'
  } else {
    Write-Output '[post-merge] switching to main and deleting local feature branch'
    git switch main
    git pull --ff-only origin main
    git branch -d $featureBranch
  }
} else {
  Write-Output '[post-merge] deleting local feature branch (not currently checked out)'
  & git show-ref --verify --quiet "refs/heads/$featureBranch"
  if ($LASTEXITCODE -eq 0) {
    git branch -d $featureBranch
  } else {
    Write-Output '[post-merge] local feature branch already deleted'
  }
}

& git ls-remote --exit-code --heads origin $featureBranch > $null
if ($LASTEXITCODE -eq 0) {
  Write-Output '[post-merge] deleting remote feature branch'
  git push origin --delete $featureBranch
} else {
  Write-Output '[post-merge] remote feature branch already deleted'
}

Write-Output '[post-merge] done'
