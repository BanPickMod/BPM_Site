<#
.SYNOPSIS
  Builds the BPM Uploader installer and update packages with Velopack.

.EXAMPLE
  scripts/Build-UploaderRelease.ps1 -Version 0.2.0 -ServerUrl https://bpm.example -UpdateUrl https://downloads.bpm.example/uploader

.NOTES
  Output goes to uploader/releases (ignored by git): Setup.exe for new users, *.nupkg + RELEASES files for the updater.
  Upload the whole folder contents to the folder that -UpdateUrl points at; installed copies pick them up on their own.

  Signing is optional and read from the environment so no secret ever lands in the repository:
    BPM_AZURE_SIGN_FILE   path to the Azure signing service metadata.json (preferred)
    BPM_SIGN_PARAMS       signtool arguments, e.g. '/f cert.pfx /p ***** /fd sha256 /tr http://timestamp.digicert.com /td sha256'
  With neither set the build is unsigned and Windows SmartScreen will warn users.
#>
param(
  [Parameter(Mandatory)] [string] $Version,
  [Parameter(Mandatory)] [string] $ServerUrl,
  [string] $UpdateUrl = "",
  [string] $ReleaseNotes = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw "Version must look like 1.2.3" }
  $publish = Join-Path $root "publish"
  $out = Join-Path $root "releases"
  if (Test-Path $publish) { Remove-Item -Recurse -Force $publish }

  dotnet tool restore | Out-Null
  dotnet test tests/Bpm.Uploader.Tests -c Release
  if ($LASTEXITCODE) { throw "tests failed" }

  # Self-contained so users do not need to install .NET.
  dotnet publish src/Bpm.Uploader.Tray -c Release -r win-x64 --self-contained -o $publish `
    "-p:Version=$Version" "-p:ServerUrl=$ServerUrl" "-p:UpdateUrl=$UpdateUrl"
  if ($LASTEXITCODE) { throw "publish failed" }

  # Keep earlier releases in the folder so Velopack can build small delta updates against them.
  New-Item -ItemType Directory -Force $out | Out-Null
  if ($UpdateUrl) { dotnet vpk download http --url $UpdateUrl -o $out 2>$null }

  $args = @("pack", "-u", "BanPickModUploader", "-v", $Version, "-p", $publish, "-e", "BPMUploader.exe", "-r", "win-x64",
            "--packTitle", "BPM Uploader", "--packAuthors", "BanPickMod", "-o", $out,
            "--icon", (Join-Path $root "assets/bpm.ico"), "--shortcuts", "StartMenuRoot")
  if ($ReleaseNotes) { $args += @("--releaseNotes", $ReleaseNotes) }
  if ($env:BPM_AZURE_SIGN_FILE) { $args += @("--azureTrustedSignFile", $env:BPM_AZURE_SIGN_FILE) }
  elseif ($env:BPM_SIGN_PARAMS) { $args += @("--signParams", $env:BPM_SIGN_PARAMS) }
  else { Write-Warning "No signing configured: the installer is UNSIGNED (SmartScreen will warn)." }

  dotnet vpk @args
  if ($LASTEXITCODE) { throw "vpk pack failed" }
  Write-Host "`nDone. Upload the contents of $out to $UpdateUrl" -ForegroundColor Green
}
finally { Pop-Location }

