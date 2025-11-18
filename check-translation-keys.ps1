# Script per verificare chiavi di traduzione
# Cerca tutte le chiavi usate in .ts e .html e confronta con en.json e it.json

Write-Host "🔍 Analisi chiavi di traduzione..." -ForegroundColor Cyan
Write-Host ""

$projectRoot = $PSScriptRoot
$appPath = Join-Path $projectRoot "frontend\src\app"
$i18nPath = Join-Path $projectRoot "frontend\src\assets\i18n"

# Funzione per estrarre chiavi da una stringa
function Extract-TranslationKeys {
    param(
        [string]$content,
        [string]$filePath,
        [int]$startLine = 1
    )
    
    $keys = @{}
    
    # Rimuovi a capo per gestire pattern multi-riga, ma tieni traccia delle righe
    $lines = $content -split "`n"
    $contentSingleLine = $content -replace "`r`n", " " -replace "`n", " "
    
    # Pattern 1: .instant('key') o .instant('key', {...}) - include parametri opzionali
    [regex]::Matches($contentSingleLine, "\.instant\(['""]([^'""]+)['""](?:\s*,\s*\{[^}]*\})?\)") | ForEach-Object {
        $key = $_.Groups[1].Value
        if ($key -and $key -notmatch '[\{\}\$\|]' -and $key -notmatch '^:') {
            # Trova la riga approssimativa basandosi sulla posizione nel testo
            $position = $_.Index
            $lineNum = ($content.Substring(0, [Math]::Min($position, $content.Length)) -split "`n").Count
            
            if (!$keys.ContainsKey($key)) { $keys[$key] = @() }
            $keys[$key] += "$($filePath):$lineNum"
        }
    }
    
    # Pattern 1b: .instant(condition ? 'key1' : 'key2') - SOLO dentro chiamate a .instant() e solo in file .ts
    if ($filePath -match '\.ts$') {
        [regex]::Matches($contentSingleLine, "\.instant\((?:[^)]*?)\?\s*['""]([^'""]+)['""]\s*:\s*['""]([^'""]+)['""][^)]*\)") | ForEach-Object {
            $position = $_.Index
            $lineNum = ($content.Substring(0, [Math]::Min($position, $content.Length)) -split "`n").Count

            $key1 = $_.Groups[1].Value
            $key2 = $_.Groups[2].Value

            foreach ($k in @($key1, $key2)) {
                if ($k -and $k -notmatch '[\{\}\$\|]' -and $k -notmatch '^:') {
                    if (!$keys.ContainsKey($k)) { $keys[$k] = @() }
                    $keys[$k] += "$($filePath):$lineNum"
                }
            }
        }
    }
    
    # Pattern 2: | translate con 'key' prima del pipe (anche multi-riga)
    [regex]::Matches($contentSingleLine, "['""]([^'""]+)['""]\s*\|\s*translate") | ForEach-Object {
        $key = $_.Groups[1].Value
        if ($key -and $key -notmatch '[\{\}\$]' -and $key -notmatch '^:' -and $key -notmatch 'date:') {
            # Trova la riga approssimativa basandosi sulla posizione nel testo
            $position = $_.Index
            $lineNum = ($content.Substring(0, [Math]::Min($position, $content.Length)) -split "`n").Count
            
            if (!$keys.ContainsKey($key)) { $keys[$key] = @() }
            $keys[$key] += "$($filePath):$lineNum"
        }
    }

    # Pattern 2b (HTML): Ternario in template pipato a translate, con parentesi
    if ($filePath -match '\.html$') {
        [regex]::Matches($contentSingleLine, "\(\s*[^?]*\?\s*['""]([^'""]+)['""]\s*:\s*['""]([^'""]+)['""][^)]*\)\s*\|\s*translate") | ForEach-Object {
            $position = $_.Index
            $lineNum = ($content.Substring(0, [Math]::Min($position, $content.Length)) -split "`n").Count

            $key1 = $_.Groups[1].Value
            $key2 = $_.Groups[2].Value

            foreach ($k in @($key1, $key2)) {
                if ($k -and $k -notmatch '[\{\}\$]' -and $k -notmatch '^:' -and $k -notmatch 'date:') {
                    if (!$keys.ContainsKey($k)) { $keys[$k] = @() }
                    $keys[$k] += "$($filePath):$lineNum"
                }
            }
        }

        # Pattern 2c (HTML): Ternario direttamente prima del pipe senza parentesi
        [regex]::Matches($contentSingleLine, "\?\s*['""]([^'""]+)['""]\s*:\s*['""]([^'""]+)['""]\s*\|\s*translate") | ForEach-Object {
            $position = $_.Index
            $lineNum = ($content.Substring(0, [Math]::Min($position, $content.Length)) -split "`n").Count

            $key1 = $_.Groups[1].Value
            $key2 = $_.Groups[2].Value

            foreach ($k in @($key1, $key2)) {
                if ($k -and $k -notmatch '[\{\}\$]' -and $k -notmatch '^:' -and $k -notmatch 'date:') {
                    if (!$keys.ContainsKey($k)) { $keys[$k] = @() }
                    $keys[$k] += "$($filePath):$lineNum"
                }
            }
        }

        # Pattern 2d (HTML): Attributo translate="key"
        [regex]::Matches($contentSingleLine, "\btranslate\s*=\s*['""]([a-zA-Z0-9._-]+)['""]") | ForEach-Object {
            $position = $_.Index
            $lineNum = ($content.Substring(0, [Math]::Min($position, $content.Length)) -split "`n").Count
            $key = $_.Groups[1].Value
            if ($key) {
                if (!$keys.ContainsKey($key)) { $keys[$key] = @() }
                $keys[$key] += "$($filePath):$lineNum"
            }
        }

        # Pattern 2e (HTML): Attributo [translate]="'key'" oppure [translate]="\"key\""
        [regex]::Matches($contentSingleLine, "\[translate\]\s*=\s*['""]\s*['""]?([a-zA-Z0-9._-]+)['""]?\s*['""]") | ForEach-Object {
            $position = $_.Index
            $lineNum = ($content.Substring(0, [Math]::Min($position, $content.Length)) -split "`n").Count
            $key = $_.Groups[1].Value
            if ($key) {
                if (!$keys.ContainsKey($key)) { $keys[$key] = @() }
                $keys[$key] += "$($filePath):$lineNum"
            }
        }

        # Pattern 2f (HTML): Direttiva translate con chiave come contenuto: <tag translate>key</tag>
        [regex]::Matches($contentSingleLine, "<[^>]*\btranslate\b[^>]*>\s*([a-zA-Z0-9._-]+)\s*<\/") | ForEach-Object {
            $position = $_.Index
            $lineNum = ($content.Substring(0, [Math]::Min($position, $content.Length)) -split "`n").Count
            $key = $_.Groups[1].Value
            if ($key) {
                if (!$keys.ContainsKey($key)) { $keys[$key] = @() }
                $keys[$key] += "$($filePath):$lineNum"
            }
        }
    }
    
    return $keys
}

# Funzione per verificare se una chiave esiste nel JSON ed è una stringa (non un oggetto)
function Test-KeyExists {
    param($obj, $path)
    
    $parts = $path.Split('.')
    $current = $obj
    
    foreach ($part in $parts) {
        # Verifica che $current non sia null e abbia proprietà
        if ($null -eq $current -or $null -eq $current.PSObject.Properties) {
            return $false
        }
        
        if ($current.PSObject.Properties[$part]) {
            $current = $current.$part
        } else {
            return $false
        }
    }
    
    # Verifica che il valore finale sia una stringa, non un oggetto/array
    if ($null -eq $current -or $current -is [PSCustomObject] -or $current -is [Array]) {
        return $false
    }
    
    return $true
}

# Funzione per estrarre tutte le chiavi da un oggetto JSON (ricorsiva)
function Get-AllJsonKeys {
    param($obj, $prefix = "")
    
    $keys = @()
    
    foreach ($prop in $obj.PSObject.Properties) {
        $currentKey = if ($prefix) { "$prefix.$($prop.Name)" } else { $prop.Name }
        
        if ($prop.Value -is [PSCustomObject]) {
            # Ricorsione per oggetti annidati
            $keys += Get-AllJsonKeys -obj $prop.Value -prefix $currentKey
        } else {
            # È una chiave finale
            $keys += $currentKey
        }
    }
    
    return $keys
}

# Carica i file di traduzione
Write-Host "📂 Caricamento file di traduzione..." -ForegroundColor Yellow
$enJsonPath = Join-Path $i18nPath "en.json"
$itJsonPath = Join-Path $i18nPath "it.json"

if (!(Test-Path $enJsonPath)) {
    Write-Host "❌ File en.json non trovato!" -ForegroundColor Red
    exit 1
}

if (!(Test-Path $itJsonPath)) {
    Write-Host "❌ File it.json non trovato!" -ForegroundColor Red
    exit 1
}

$enJson = Get-Content $enJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
$itJson = Get-Content $itJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json

# Estrai tutte le chiavi dai file JSON
$enKeys = Get-AllJsonKeys -obj $enJson
$itKeys = Get-AllJsonKeys -obj $itJson

Write-Host "✅ Chiavi in en.json: $($enKeys.Count)" -ForegroundColor Green
Write-Host "✅ Chiavi in it.json: $($itKeys.Count)" -ForegroundColor Green
Write-Host ""

# Scansiona tutti i file .ts e .html
Write-Host "🔎 Scansione file TypeScript e HTML..." -ForegroundColor Yellow
$allUsedKeys = @{}

Get-ChildItem -Path $appPath -Recurse -Include *.ts,*.html | ForEach-Object {
    $relativePath = $_.FullName.Replace("$projectRoot\", "")
    $content = Get-Content $_.FullName -Raw -Encoding UTF8
    
    if ($content) {
        $fileKeys = Extract-TranslationKeys -content $content -filePath $relativePath
        
        foreach ($key in $fileKeys.Keys) {
            if (!$allUsedKeys.ContainsKey($key)) {
                $allUsedKeys[$key] = @()
            }
            $allUsedKeys[$key] += $fileKeys[$key]
        }
    }
}

Write-Host "✅ Chiavi utilizzate nel codice: $($allUsedKeys.Count)" -ForegroundColor Green
Write-Host ""

# Trova chiavi mancanti in en.json
$missingInEn = @{}
foreach ($key in $allUsedKeys.Keys | Sort-Object) {
    if (!(Test-KeyExists -obj $enJson -path $key)) {
        $missingInEn[$key] = $allUsedKeys[$key]
    }
}

# Trova chiavi mancanti in it.json
$missingInIt = @{}
foreach ($key in $allUsedKeys.Keys | Sort-Object) {
    if (!(Test-KeyExists -obj $itJson -path $key)) {
        $missingInIt[$key] = $allUsedKeys[$key]
    }
}

# Trova chiavi non utilizzate in en.json
$unusedInEn = @()
foreach ($key in $enKeys) {
    if (!$allUsedKeys.ContainsKey($key)) {
        $unusedInEn += $key
    }
}

# Trova chiavi non utilizzate in it.json
$unusedInIt = @()
foreach ($key in $itKeys) {
    if (!$allUsedKeys.ContainsKey($key)) {
        $unusedInIt += $key
    }
}

# Trova chiavi presenti in en.json ma non in it.json
$missingTranslations = @()
foreach ($key in $enKeys) {
    if ($itKeys -notcontains $key) {
        $missingTranslations += $key
    }
}

# Trova chiavi presenti in it.json ma non in en.json
$extraInIt = @()
foreach ($key in $itKeys) {
    if ($enKeys -notcontains $key) {
        $extraInIt += $key
    }
}

# Funzione per ordinare le location di ogni chiave per file e riga
function Sort-KeyLocations {
    param($keyHash)
    
    $sorted = @{}
    foreach ($key in $keyHash.Keys) {
        $locations = $keyHash[$key] | Sort-Object {
            $parts = $_ -split ':'
            $file = $parts[0]
            $line = if ($parts[1]) { [int]$parts[1] } else { 0 }
            # Ordina prima per file, poi per numero di riga
            "$file|{0:D10}" -f $line
        }
        $sorted[$key] = $locations
    }
    return $sorted
}

# === REPORT ===
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "📊 REPORT CHIAVI DI TRADUZIONE" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

# 1. Chiavi mancanti in en.json
if ($missingInEn.Count -gt 0) {
    Write-Host "❌ CHIAVI USATE NEL CODICE MA MANCANTI IN en.json ($($missingInEn.Count))" -ForegroundColor Red
    Write-Host ""
    
    $sortedMissingInEn = Sort-KeyLocations -keyHash $missingInEn
    
    foreach ($key in $sortedMissingInEn.Keys | Sort-Object) {
        Write-Host "  • $key" -ForegroundColor Yellow
        foreach ($location in $sortedMissingInEn[$key]) {
            Write-Host "    - $location" -ForegroundColor Gray
        }
    }
    Write-Host ""
} else {
    Write-Host "✅ Tutte le chiavi usate nel codice esistono in en.json" -ForegroundColor Green
    Write-Host ""
}

# 2. Chiavi mancanti in it.json
if ($missingInIt.Count -gt 0) {
    Write-Host "❌ CHIAVI USATE NEL CODICE MA MANCANTI IN it.json ($($missingInIt.Count))" -ForegroundColor Red
    Write-Host ""
    
    $sortedMissingInIt = Sort-KeyLocations -keyHash $missingInIt
    
    foreach ($key in $sortedMissingInIt.Keys | Sort-Object) {
        Write-Host "  • $key" -ForegroundColor Yellow
        foreach ($location in $sortedMissingInIt[$key]) {
            Write-Host "    - $location" -ForegroundColor Gray
        }
    }
    Write-Host ""
} else {
    Write-Host "✅ Tutte le chiavi usate nel codice esistono in it.json" -ForegroundColor Green
    Write-Host ""
}

# 3. Chiavi non utilizzate
if ($unusedInEn.Count -gt 0) {
    # Prefissi noti usati dinamicamente (es. `activityLog.types.${type}`)
    $dynamicPrefixes = @(
        'activityLog.types.',
        'certificates.status.',
        'primeng.',
        'notifications.alertTypes.',
        'notifications.alertDescriptions.',
        'authProviders.types.'
    )
    
    # Filtra le chiavi che iniziano con prefissi dinamici noti
    $filteredUnused = $unusedInEn | Where-Object {
        $key = $_
        $isDynamic = $false
        foreach ($prefix in $dynamicPrefixes) {
            if ($key.StartsWith($prefix)) {
                $isDynamic = $true
                break
            }
        }
        return -not $isDynamic
    }
    
    if ($filteredUnused.Count -gt 0) {
        Write-Host "⚠️  CHIAVI IN en.json MAI UTILIZZATE NEL CODICE ($($filteredUnused.Count))" -ForegroundColor Magenta
        Write-Host "    (Escluse chiavi con prefissi dinamici: $($unusedInEn.Count - $filteredUnused.Count))" -ForegroundColor DarkGray
        Write-Host ""
        
        foreach ($key in $filteredUnused | Sort-Object) {
            Write-Host "  • $key" -ForegroundColor DarkGray
        }
        Write-Host ""
    } else {
        Write-Host "✅ Tutte le chiavi in en.json sono utilizzate (esclusi prefissi dinamici)" -ForegroundColor Green
        Write-Host ""
    }
} else {
    Write-Host "✅ Tutte le chiavi in en.json sono utilizzate" -ForegroundColor Green
    Write-Host ""
}

# 4. Chiavi presenti in en ma non in it
if ($missingTranslations.Count -gt 0) {
    Write-Host "🌐 CHIAVI IN en.json MA NON TRADOTTE IN it.json ($($missingTranslations.Count))" -ForegroundColor Yellow
    Write-Host ""
    
    foreach ($key in $missingTranslations | Sort-Object) {
        Write-Host "  • $key" -ForegroundColor Yellow
    }
    Write-Host ""
}

# 5. Chiavi in it ma non in en (anomalia)
if ($extraInIt.Count -gt 0) {
    Write-Host "⚠️  CHIAVI IN it.json MA NON IN en.json (ANOMALIA) ($($extraInIt.Count))" -ForegroundColor Red
    Write-Host ""
    
    foreach ($key in $extraInIt | Sort-Object) {
        Write-Host "  • $key" -ForegroundColor Red
    }
    Write-Host ""
}

# === RIEPILOGO FINALE ===
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "📈 RIEPILOGO" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""
Write-Host "Chiavi nel codice:              $($allUsedKeys.Count)" -ForegroundColor White
Write-Host "Chiavi in en.json:              $($enKeys.Count)" -ForegroundColor White
Write-Host "Chiavi in it.json:              $($itKeys.Count)" -ForegroundColor White
Write-Host ""
Write-Host "Mancanti in en.json:            $($missingInEn.Count)" -ForegroundColor $(if ($missingInEn.Count -gt 0) { "Red" } else { "Green" })
Write-Host "Mancanti in it.json:            $($missingInIt.Count)" -ForegroundColor $(if ($missingInIt.Count -gt 0) { "Red" } else { "Green" })
Write-Host "Non utilizzate in en.json:      $($unusedInEn.Count)" -ForegroundColor $(if ($unusedInEn.Count -gt 0) { "Yellow" } else { "Green" })
Write-Host "Mancanti traduzioni (en→it):    $($missingTranslations.Count)" -ForegroundColor $(if ($missingTranslations.Count -gt 0) { "Yellow" } else { "Green" })
Write-Host "Chiavi extra in it.json:        $($extraInIt.Count)" -ForegroundColor $(if ($extraInIt.Count -gt 0) { "Red" } else { "Green" })
Write-Host ""

# Salva report dettagliato su file
$reportPath = Join-Path $projectRoot "translation-keys-report.txt"

# Ordina le location di ogni chiave per file e riga
$sortedMissingInEn = Sort-KeyLocations -keyHash $missingInEn
$sortedMissingInIt = Sort-KeyLocations -keyHash $missingInIt

# Prefissi dinamici (stessa lista usata sopra)
$dynamicPrefixes = @(
    'activityLog.types.',
    'certificates.status.',
    'primeng.',
    'notifications.alertTypes.',
    'notifications.alertDescriptions.',
    'authProviders.types.'
)

# Filtra le chiavi non utilizzate escludendo i prefissi dinamici
$filteredUnusedForReport = $unusedInEn | Where-Object {
    $key = $_
    $isDynamic = $false
    foreach ($prefix in $dynamicPrefixes) {
        if ($key.StartsWith($prefix)) {
            $isDynamic = $true
            break
        }
    }
    return -not $isDynamic
}

$reportContent = @"
========================================
REPORT CHIAVI DI TRADUZIONE
Generato: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
========================================

STATISTICHE:
- Chiavi utilizzate nel codice: $($allUsedKeys.Count)
- Chiavi in en.json: $($enKeys.Count)
- Chiavi in it.json: $($itKeys.Count)
- Mancanti in en.json: $($missingInEn.Count)
- Mancanti in it.json: $($missingInIt.Count)
- Non utilizzate in en.json: $($filteredUnusedForReport.Count) (esclusi $($unusedInEn.Count - $filteredUnusedForReport.Count) con prefissi dinamici)
- Traduzioni mancanti (en→it): $($missingTranslations.Count)
- Chiavi extra in it.json: $($extraInIt.Count)

========================================
CHIAVI MANCANTI IN en.json ($($missingInEn.Count))
(Location ordinate per file e riga)
========================================

"@

foreach ($key in $sortedMissingInEn.Keys | Sort-Object) {
    $reportContent += "`n$key`n"
    foreach ($location in $sortedMissingInEn[$key]) {
        $reportContent += "  - $location`n"
    }
}

$reportContent += @"

========================================
CHIAVI MANCANTI IN it.json ($($missingInIt.Count))
(Location ordinate per file e riga)
========================================

"@

foreach ($key in $sortedMissingInIt.Keys | Sort-Object) {
    $reportContent += "`n$key`n"
    foreach ($location in $sortedMissingInIt[$key]) {
        $reportContent += "  - $location`n"
    }
}

$reportContent += @"

========================================
CHIAVI NON UTILIZZATE in en.json ($($filteredUnusedForReport.Count))
(Escluse chiavi con prefissi dinamici)
========================================

"@

foreach ($key in $filteredUnusedForReport | Sort-Object) {
    $reportContent += "$key`n"
}

$reportContent += @"

========================================
TRADUZIONI MANCANTI (en→it) ($($missingTranslations.Count))
========================================

"@

foreach ($key in $missingTranslations | Sort-Object) {
    $reportContent += "$key`n"
}

if ($extraInIt.Count -gt 0) {
    $reportContent += @"

========================================
CHIAVI EXTRA IN it.json ($($extraInIt.Count))
========================================

"@

    foreach ($key in $extraInIt | Sort-Object) {
        $reportContent += "$key`n"
    }
}

$reportContent | Out-File -FilePath $reportPath -Encoding UTF8
Write-Host "💾 Report dettagliato salvato in: $reportPath" -ForegroundColor Green
Write-Host ""

# Exit code
if ($missingInEn.Count -gt 0 -or $missingInIt.Count -gt 0) {
    Write-Host "❌ Ci sono chiavi mancanti! Controlla il report." -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Tutte le chiavi sono presenti!" -ForegroundColor Green
    exit 0
}
