#requires -Version 5.1
<#
.SYNOPSIS
    Invariant tests for SDD artifacts of HU0-1-modelo-de-datos-prisma.

.DESCRIPTION
    Phase 6 (TDD-GUARDIAN mini) of Vorkan v2.1.0 SDD flow.

    This HU is atypical: it does NOT deliver product code (the stack is not
    installed). The tests verify that the SDD artifacts produced by Phases 1-5
    (exploration, proposal, spec, design, tasks) satisfy structural and
    semantic invariants.

    The script is PowerShell 5.1 compatible (Windows native). No external
    dependencies. Exit code 0 = all tests passed. Non-zero = at least one
    invariant failed.

.PARAMETER ChangePath
    Relative or absolute path to the change directory.
    Default: openspec/changes/hu0-1-modelo-de-datos-prisma

.EXAMPLE
    pwsh ./invariants.test.ps1
    pwsh ./invariants.test.ps1 -ChangePath "openspec/changes/hu0-1-modelo-de-datos-prisma"
    powershell -ExecutionPolicy Bypass -File .\invariants.test.ps1
#>

[CmdletBinding()]
param(
    [string]$ChangePath = "openspec/changes/hu0-1-modelo-de-datos-prisma"
)

$ErrorActionPreference = "Stop"

# =====================================================================
# Internal state
# =====================================================================
$script:results = @()
$script:failed = 0

# =====================================================================
# Helpers
# =====================================================================
function Get-ArtifactPath {
    param([Parameter(Mandatory)][string]$Relative)
    return Join-Path $ChangePath $Relative
}

function Read-Artifact {
    param([Parameter(Mandatory)][string]$Relative)
    $p = Get-ArtifactPath $Relative
    if (-not (Test-Path -LiteralPath $p)) {
        throw "Artifact not found: $p"
    }
    # -Raw: return whole file as a single string. -Encoding UTF8: avoid BOM issues.
    return Get-Content -LiteralPath $p -Raw -Encoding UTF8
}

function Get-MatchCount {
    param(
        [Parameter(Mandatory)][string]$Content,
        [Parameter(Mandatory)][string]$Pattern
    )
    return ([regex]::Matches($Content, $Pattern)).Count
}

function Get-CodeBlock {
    <#
    Extract the content of a fenced code block whose info string equals
    the given language tag (e.g. 'prisma', 'typescript').
    Returns $null if not found.
    #>
    param(
        [Parameter(Mandatory)][string]$Content,
        [Parameter(Mandatory)][string]$Language
    )
    # NOTE: use single quotes for the fence marker so PowerShell does not interpret
    #       backticks as the escape character.
    $open = '```' + $Language
    $startIdx = $Content.IndexOf($open)
    if ($startIdx -lt 0) { return $null }
    $blockStart = $startIdx + $open.Length
    # Skip the trailing newline of the opening fence if present
    if ($blockStart -lt $Content.Length -and $Content[$blockStart] -eq "`r") { $blockStart++ }
    if ($blockStart -lt $Content.Length -and $Content[$blockStart] -eq "`n") { $blockStart++ }
    $endIdx = $Content.IndexOf('```', $blockStart)
    if ($endIdx -lt 0) { return $null }
    return $Content.Substring($blockStart, $endIdx - $blockStart)
}

function Test-Invariant {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][scriptblock]$Test
    )
    try {
        $result = & $Test
        if ($result) {
            Write-Host "  PASS  $Name" -ForegroundColor Green
            $script:results += [pscustomobject]@{ Name = $Name; Status = "PASS" }
        } else {
            Write-Host "  FAIL  $Name" -ForegroundColor Red
            $script:results += [pscustomobject]@{ Name = $Name; Status = "FAIL" }
            $script:failed++
        }
    } catch {
        Write-Host "  ERROR $Name -- $($_.Exception.Message)" -ForegroundColor Red
        $script:results += [pscustomobject]@{ Name = $Name; Status = "ERROR"; Error = $_.Exception.Message }
        $script:failed++
    }
}

# =====================================================================
# Load all artifacts (fail fast if any is missing)
# =====================================================================
try {
    $exploration = Read-Artifact "explore/exploration.md"
    $proposal    = Read-Artifact "proposal/proposal.md"
    $spec        = Read-Artifact "specs/modelo-de-datos-prisma/spec.md"
    $design      = Read-Artifact "design/design.md"
    $tasks       = Read-Artifact "tasks/tasks.md"
} catch {
    Write-Host "FATAL: cannot load required artifacts -- $($_.Exception.Message)" -ForegroundColor Red
    exit 2
}

# =====================================================================
# Header
# =====================================================================
Write-Host ""
Write-Host "=== SDD Artifacts Invariants: $ChangePath ===" -ForegroundColor Cyan
Write-Host "Working dir: $(Get-Location)" -ForegroundColor DarkGray

# =====================================================================
# Block A -- Existence and basic structure (5 tests)
# =====================================================================
Write-Host ""
Write-Host "Block A -- Existencia y estructura basica" -ForegroundColor Yellow

Test-Invariant -Name "exploration.md existe y tiene tamano minimo (>= 5000 bytes)" -Test {
    $p = Get-ArtifactPath "explore/exploration.md"
    if (-not (Test-Path -LiteralPath $p)) { return $false }
    return ((Get-Item -LiteralPath $p).Length -ge 5000)
}

Test-Invariant -Name "proposal.md existe y tiene tamano minimo (>= 1000 bytes)" -Test {
    $p = Get-ArtifactPath "proposal/proposal.md"
    if (-not (Test-Path -LiteralPath $p)) { return $false }
    return ((Get-Item -LiteralPath $p).Length -ge 1000)
}

Test-Invariant -Name "spec.md existe y tiene tamano minimo (>= 1000 bytes)" -Test {
    $p = Get-ArtifactPath "specs/modelo-de-datos-prisma/spec.md"
    if (-not (Test-Path -LiteralPath $p)) { return $false }
    return ((Get-Item -LiteralPath $p).Length -ge 1000)
}

Test-Invariant -Name "design.md existe y tiene tamano minimo (>= 5000 bytes)" -Test {
    $p = Get-ArtifactPath "design/design.md"
    if (-not (Test-Path -LiteralPath $p)) { return $false }
    return ((Get-Item -LiteralPath $p).Length -ge 5000)
}

Test-Invariant -Name "tasks.md existe y tiene tamano minimo (>= 1000 bytes)" -Test {
    $p = Get-ArtifactPath "tasks/tasks.md"
    if (-not (Test-Path -LiteralPath $p)) { return $false }
    return ((Get-Item -LiteralPath $p).Length -ge 1000)
}

# =====================================================================
# Block B -- Spec.md has exactly 9 requirements and 11 scenarios (3 tests)
# =====================================================================
Write-Host ""
Write-Host "Block B -- Spec.md tiene 9 requisitos y 11 escenarios" -ForegroundColor Yellow

Test-Invariant -Name "spec.md tiene exactamente 9 headers '### Requirement:'" -Test {
    return (Get-MatchCount $spec '(?m)^### Requirement:') -eq 9
}

Test-Invariant -Name "spec.md tiene exactamente 11 headers '#### Scenario:'" -Test {
    return (Get-MatchCount $spec '(?m)^#### Scenario:') -eq 11
}

Test-Invariant -Name "Cada requisito tiene al menos un escenario (no hay requisitos huerfanos)" -Test {
    # Walk lines, track current requirement, count scenarios under it.
    $lines = [regex]::Split($spec, '\r?\n')
    $reqScenarios = @{}
    $currentReq = $null
    foreach ($line in $lines) {
        if ($line -match '^###\s+Requirement:\s*(.+)$') {
            $currentReq = $Matches[1].Trim()
            if (-not $reqScenarios.ContainsKey($currentReq)) {
                $reqScenarios[$currentReq] = 0
            }
        } elseif ($line -match '^####\s+Scenario:') {
            if ($null -ne $currentReq) {
                $reqScenarios[$currentReq]++
            }
        }
    }
    $orphans = @($reqScenarios.GetEnumerator() | Where-Object { $_.Value -lt 1 })
    if ($orphans.Count -gt 0) {
        Write-Host "    Orphan requirements (no scenario):" -ForegroundColor DarkYellow
        foreach ($o in $orphans) {
            Write-Host "      - $($o.Key) [scenarios: $($o.Value)]" -ForegroundColor DarkYellow
        }
        return $false
    }
    return $true
}

# =====================================================================
# Block C -- Checkpoint 1 binding decisions reflected (5 tests)
# =====================================================================
Write-Host ""
Write-Host "Block C -- Decisiones binding del Checkpoint 1" -ForegroundColor Yellow

Test-Invariant -Name "spec.md menciona convencion camelCase (sin @map/@@map)" -Test {
    # Match camelCase token anywhere; tolerate case variations.
    return ($spec -match '(?i)\bcamelCase\b')
}

Test-Invariant -Name "design.md contiene bloque prisma con '@default(uuid())' (uuid v4)" -Test {
    $block = Get-CodeBlock $design 'prisma'
    if ($null -eq $block) { return $false }
    return ($block -match '@default\(uuid\(\)\)')
}

Test-Invariant -Name "design.md menciona 'postgres:16' o 'postgres 16'" -Test {
    return ($design -match 'postgres:16') -or ($design -match 'postgres\s*16')
}

Test-Invariant -Name "design.md y spec.md NO contienen tokens prohibidos (firmadoPor/firmadoAt/hashFirma)" -Test {
    $forbiddenTokens = @('firmadoPor', 'firmadoAt', 'hashFirma')
    foreach ($tok in $forbiddenTokens) {
        # Word-boundary, case-sensitive (these are JS identifiers, not natural language)
        $pattern = "(?m)\b$([regex]::Escape($tok))\b"
        if ($design -match $pattern) {
            Write-Host "    Forbidden token found in design.md: $tok" -ForegroundColor DarkYellow
            return $false
        }
        if ($spec -match $pattern) {
            Write-Host "    Forbidden token found in spec.md: $tok" -ForegroundColor DarkYellow
            return $false
        }
    }
    return $true
}

Test-Invariant -Name "casoPrueba.responsableId tiene Restrict o NOT NULL (FK obligatoria)" -Test {
    # Look for `responsableId` near `Restrict` (within ~400 chars window) in either
    # design.md or spec.md.
    $found = $false
    foreach ($text in @($design, $spec)) {
        $idx = $text.IndexOf('responsableId')
        while ($idx -ge 0 -and -not $found) {
            $windowLen = [Math]::Min(400, $text.Length - $idx)
            $window = $text.Substring($idx, $windowLen)
            if ($window -match 'Restrict') { $found = $true; break }
            if ($window -match 'NOT\s+NULL') { $found = $true; break }
            $nextIdx = $text.IndexOf('responsableId', $idx + 1)
            if ($nextIdx -eq $idx) { break }
            $idx = $nextIdx
        }
        if ($found) { break }
    }
    return $found
}

# =====================================================================
# Block D -- design.md includes complete schema.prisma block (3 tests)
# =====================================================================
Write-Host ""
Write-Host "Block D -- design.md incluye bloque schema.prisma completo" -ForegroundColor Yellow

Test-Invariant -Name "design.md contiene un bloque de codigo con lenguaje 'prisma'" -Test {
    # Match the opening fence line exactly
    return ($design -match '(?m)^```prisma\s*$')
}

Test-Invariant -Name "Bloque prisma contiene los 11 modelos (Usuario, Espacio, UsuarioEspacio, Proyecto, CasoPrueba, Ejecucion, PasoEjecucion, Artefacto, Acta, Credencial, ConsecutivoAnual)" -Test {
    $block = Get-CodeBlock $design 'prisma'
    if ($null -eq $block) { return $false }
    $expectedModels = @(
        'Usuario', 'Espacio', 'UsuarioEspacio', 'Proyecto', 'CasoPrueba',
        'Ejecucion', 'PasoEjecucion', 'Artefacto', 'Acta', 'Credencial',
        'ConsecutivoAnual'
    )
    $missing = @()
    foreach ($m in $expectedModels) {
        # Use \b word-boundary + 'model' keyword to avoid matching model names inside other words
        $pattern = "(?m)\bmodel\s+$([regex]::Escape($m))\b"
        if (-not ($block -match $pattern)) {
            $missing += $m
        }
    }
    if ($missing.Count -gt 0) {
        Write-Host "    Missing models in prisma block: $($missing -join ', ')" -ForegroundColor DarkYellow
        return $false
    }
    return $true
}

Test-Invariant -Name "Bloque prisma contiene los 3 enums (EjecucionEstado, PasoEjecucionEstado, ArtefactoTipo)" -Test {
    $block = Get-CodeBlock $design 'prisma'
    if ($null -eq $block) { return $false }
    $expectedEnums = @('EjecucionEstado', 'PasoEjecucionEstado', 'ArtefactoTipo')
    $missing = @()
    foreach ($e in $expectedEnums) {
        # PascalCase enum names -- use exact-match, word-boundary, case-sensitive
        $pattern = "(?m)\benum\s+$([regex]::Escape($e))\b"
        if (-not ($block -match $pattern)) {
            $missing += $e
        }
    }
    if ($missing.Count -gt 0) {
        Write-Host "    Missing enums in prisma block: $($missing -join ', ')" -ForegroundColor DarkYellow
        return $false
    }
    return $true
}

# =====================================================================
# Block E -- tasks.md has correct structure (4 tests)
# =====================================================================
Write-Host ""
Write-Host "Block E -- tasks.md tiene estructura correcta" -ForegroundColor Yellow

Test-Invariant -Name "tasks.md contiene exactamente 4 headers '## Phase'" -Test {
    # Match "## Phase " (followed by space or digit, not "## Phase 1" in a code block).
    # Use ^## Phase with a trailing space/colon/digit to avoid matching "## Phase X" comments.
    $count = Get-MatchCount $tasks '(?m)^## Phase '
    return ($count -eq 4)
}

Test-Invariant -Name "tasks.md contiene 'Chained PRs recommended: Yes'" -Test {
    return ($tasks -match 'Chained PRs recommended:\s*Yes')
}

Test-Invariant -Name "tasks.md contiene 'feature-branch-chain'" -Test {
    return ($tasks -match 'feature-branch-chain')
}

Test-Invariant -Name "tasks.md contiene '400-line budget risk: High'" -Test {
    return ($tasks -match '400-line budget risk:\s*High')
}

# =====================================================================
# Block F -- Cross-artifact coherence (2 tests)
# =====================================================================
Write-Host ""
Write-Host "Block F -- Coherencia entre artefactos" -ForegroundColor Yellow

Test-Invariant -Name "11 entidades en exploration.md coinciden con 11 modelos en bloque schema.prisma de design.md" -Test {
    # Each of the 11 models must appear (in any case/spacing form) in exploration.md.
    # exploration.md uses snake_case and natural Spanish ("ejecucion", "ejecución").
    $entityPatterns = @{
        'Usuario'          = '(?i)\busuario\b'
        'Espacio'          = '(?i)\bespacio\b'
        'UsuarioEspacio'   = '(?i)\busuario[_ ]?espacio\b'
        'Proyecto'         = '(?i)\bproyecto\b'
        'CasoPrueba'       = '(?i)\bcaso[_ ]?prueba\b'
        'Ejecucion'        = '(?i)\bejecuci[oó]n\b'
        'PasoEjecucion'    = '(?i)\bpaso[_ ]?ejecuci[oó]n\b'
        'Artefacto'        = '(?i)\bartefacto\b'
        'Acta'             = '(?i)\bacta\b'
        'Credencial'       = '(?i)\bcredencial\b'
        'ConsecutivoAnual' = '(?i)\bconsecutivo[_ ]?anual\b'
    }
    $missing = @()
    foreach ($entry in $entityPatterns.GetEnumerator()) {
        if (-not ($exploration -match $entry.Value)) {
            $missing += $entry.Key
        }
    }
    if ($missing.Count -gt 0) {
        Write-Host "    Entities missing in exploration.md: $($missing -join ', ')" -ForegroundColor DarkYellow
        return $false
    }
    return $true
}

Test-Invariant -Name "Los 3 enums en design.md estan tambien en spec.md" -Test {
    $enums = @('EjecucionEstado', 'PasoEjecucionEstado', 'ArtefactoTipo')
    $missing = @()
    foreach ($e in $enums) {
        if (-not ($spec -match "\b$([regex]::Escape($e))\b")) {
            $missing += $e
        }
    }
    if ($missing.Count -gt 0) {
        Write-Host "    Enums missing in spec.md: $($missing -join ', ')" -ForegroundColor DarkYellow
        return $false
    }
    return $true
}

# =====================================================================
# Summary
# =====================================================================
Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
$total = $script:results.Count
$passed = @($script:results | Where-Object { $_.Status -eq "PASS" }).Count
$errored = @($script:results | Where-Object { $_.Status -eq "ERROR" }).Count
Write-Host ("Total: {0}  |  Passed: {1}  |  Failed: {2}  |  Errored: {3}" -f $total, $passed, $script:failed, $errored)

if ($script:failed -gt 0) {
    Write-Host ""
    Write-Host "Failed tests:" -ForegroundColor Red
    foreach ($r in $script:results) {
        if ($r.Status -ne "PASS") {
            Write-Host "  [$($r.Status)] $($r.Name)" -ForegroundColor Red
        }
    }
    Write-Host ""
    Write-Host "STATUS: FAIL" -ForegroundColor Red
    exit 1
} else {
    Write-Host ""
    Write-Host "STATUS: PASS" -ForegroundColor Green
    exit 0
}