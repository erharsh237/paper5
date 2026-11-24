$targets = @('OpenToonz', 'Tahoma2D', 'Blender', 'Inkscape', 'Resolve', 'DaVinci')
$searchPaths = @(
    'C:\Program Files',
    'C:\Program Files (x86)',
    'C:\Users\Paras Koul\AppData\Local\Programs',
    'C:\Users\Paras Koul\AppData\Roaming',
    'C:\ProgramData'
)

Write-Host "=== SCANNING FOR ANIMATION PACKAGES ==="
$found = @()

foreach ($base in $searchPaths) {
    if (Test-Path $base) {
        $dirs = Get-ChildItem -Path $base -Directory -Depth 2 -ErrorAction SilentlyContinue | Where-Object {
            $n = $_.Name
            foreach ($t in $targets) {
                if ($n -like "*$t*") { return $true }
            }
            return $false
        }
        foreach ($d in $dirs) {
            $found += $d.FullName
        }
    }
}

# Also check registry for installed software
$regKeys = @(
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
)

foreach ($key in $regKeys) {
    Get-ItemProperty $key -ErrorAction SilentlyContinue | Where-Object {
        $name = $_.DisplayName
        if ($name) {
            foreach ($t in $targets) {
                if ($name -like "*$t*") {
                    Write-Host "[REGISTRY FOUND] $name (Version: $($_.DisplayVersion), Path: $($_.InstallLocation))"
                }
            }
        }
    }
}

if ($found.Count -eq 0) {
    Write-Host "[SYSTEM DISK] No folders matching OpenToonz, Tahoma2D, Blender, Inkscape, or DaVinci found."
} else {
    foreach ($f in ($found | Select-Object -Unique)) {
        Write-Host "[SYSTEM DISK FOUND] $f"
    }
}
