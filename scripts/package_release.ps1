# Enkel Release Packaging Script (Windows x64)
# Generates:
#   1. Enkel-1.0.0-windows-x64-portable.exe (Standalone portable executable)
#   2. Enkel-1.0.0-windows-x64-setup.exe    (Conventional Windows installer)
#   3. SHA256SUMS.txt                       (SHA-256 hashes for GitHub Releases)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$ReleaseDir = Join-Path $ProjectRoot "release-artifacts"
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null

$BuiltExe = Join-Path $ProjectRoot "src-tauri\target\release\enkel.exe"
if (-not (Test-Path $BuiltExe)) {
    throw "Executable not found at: $BuiltExe"
}

# 1. Copy Portable Executable
$PortableExe = Join-Path $ReleaseDir "Enkel-1.0.0-windows-x64-portable.exe"
Copy-Item -Force $BuiltExe $PortableExe
Write-Host "[OK] Portable executable generated: $PortableExe"

# 2. Build Windows Installer via Inno Setup (if ISCC is available)
$IsccPaths = @(
    "D:\tools\InnoSetup\ISCC.exe",
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe"
)
$IsccExe = $IsccPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($IsccExe) {
    $IssFile = Join-Path $ProjectRoot "installer\enkel.iss"
    & $IsccExe /Q $IssFile
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to compile Inno Setup installer."
    }
    Write-Host "[OK] Windows installer generated: $(Join-Path $ReleaseDir 'Enkel-1.0.0-windows-x64-setup.exe')"
}

# 3. Generate SHA256SUMS.txt
$HashLines = Get-ChildItem $ReleaseDir -File | Where-Object { $_.Name -ne "SHA256SUMS.txt" } | Sort-Object Name | ForEach-Object {
    $Hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower()
    "$Hash  $($_.Name)"
}
$ShaFile = Join-Path $ReleaseDir "SHA256SUMS.txt"
$HashLines | Set-Content -Path $ShaFile -Encoding UTF8
Write-Host "[OK] SHA-256 checksums written to: $ShaFile"
Get-Content $ShaFile
