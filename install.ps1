# Claude Discord Presence installer. Run it with:
#   irm https://raw.githubusercontent.com/laurensanp/claude-discord-presence/main/install.ps1 | iex
# Running it again offers update and removal. Wrapped in a block so "return" can't close your window.
& {
  $ErrorActionPreference = "Stop"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

  $base = "https://github.com/laurensanp/claude-discord-presence/releases/latest/download"
  $dir = "$env:LOCALAPPDATA\better-presence"
  $companion = "$dir\companion.js"
  $autostart = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\better-presence-companion.vbs"
  $extensionId = "kevinpartizan.better-vscode-presence"

  function Ask($question, $default) {
    $hint = if ($default) { "Y/n" } else { "y/N" }
    while ($true) {
      $answer = (Read-Host "$question [$hint]").Trim().ToLower()
      if ($answer -eq "") { return $default }
      if ($answer -in "y", "yes") { return $true }
      if ($answer -in "n", "no") { return $false }
    }
  }

  function Stop-Companion {
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
      Where-Object { $_.CommandLine -match "better-presence.companion" } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  }

  function Get-CodeProfiles {
    $storage = "$env:APPDATA\Code\User\globalStorage\storage.json"
    if (-not (Test-Path $storage)) { return @() }
    try { return @((Get-Content $storage -Raw | ConvertFrom-Json).userDataProfiles | ForEach-Object { $_.name }) }
    catch { return @() }
  }

  Write-Host ""
  Write-Host "Claude Discord Presence" -ForegroundColor Yellow
  Write-Host "Your Discord status for the Claude Code desktop app, with Clawd the pet."
  Write-Host ""

  $hasCode = [bool](Get-Command code -ErrorAction SilentlyContinue)

  if ((Test-Path $companion) -or (Test-Path $autostart)) {
    Write-Host "It's already installed."
    $choice = (Read-Host "[U]pdate, [R]emove or [C]ancel? [U]").Trim().ToLower()
    if ($choice -in "c", "cancel") { return }
    if ($choice -in "r", "remove") {
      Stop-Companion
      Remove-Item $autostart -Force -ErrorAction SilentlyContinue
      Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
      if ($hasCode -and (Ask "Also remove the VS Code extension?" $false)) {
        code --uninstall-extension $extensionId
        foreach ($codeProfile in Get-CodeProfiles) { code --uninstall-extension $extensionId --profile $codeProfile }
      }
      Write-Host "Removed." -ForegroundColor Green
      return
    }
  }

  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Write-Host "Node.js is required. Install it from https://nodejs.org and run this again." -ForegroundColor Red
    return
  }

  $useAutostart = Ask "Start it automatically with Windows?" $true
  $startNow = Ask "Start it now?" $true
  $useExtension = $hasCode -and (Ask "Install the VS Code extension too? (shows your file while the Claude app is closed)" $false)
  $extensionProfiles = @()
  if ($useExtension) {
    foreach ($codeProfile in Get-CodeProfiles) {
      if (Ask "Also install it in the VS Code profile '$codeProfile'?" $true) { $extensionProfiles += $codeProfile }
    }
  }

  Write-Host ""
  Write-Host "Downloading..."
  New-Item -ItemType Directory -Force $dir | Out-Null
  $download = "$companion.download"
  Invoke-WebRequest "$base/companion.js" -OutFile $download -UseBasicParsing
  Stop-Companion
  Move-Item $download $companion -Force
  Write-Host "Installed the companion to $dir"

  if ($useAutostart) {
    # UTF-16 so a user folder with umlauts survives
    Set-Content $autostart ('CreateObject("WScript.Shell").Run """{0}"" ""{1}""", 0, False' -f $node.Source, $companion) -Encoding Unicode
    Write-Host "Autostart is on"
  } else {
    Remove-Item $autostart -Force -ErrorAction SilentlyContinue
    Write-Host "Autostart is off"
  }

  if ($useExtension) {
    $vsix = "$env:TEMP\claude-discord-presence.vsix"
    Invoke-WebRequest "$base/claude-discord-presence.vsix" -OutFile $vsix -UseBasicParsing
    code --install-extension $vsix --force
    foreach ($codeProfile in $extensionProfiles) { code --install-extension $vsix --force --profile $codeProfile }
    Remove-Item $vsix -Force
    Write-Host "Installed the VS Code extension. Run 'Developer: Reload Window' in VS Code."
  }

  if ($startNow) {
    Start-Process $node.Source -ArgumentList "`"$companion`"" -WindowStyle Hidden
    Write-Host "The companion is running"
  }

  Write-Host ""
  Write-Host "Done!" -ForegroundColor Green
  Write-Host "Open a session in the Claude app and keep the Discord desktop app running."
  Write-Host "In Discord, turn on: Settings > Activity Privacy > Share your detected activities with others."
  Write-Host "People who can see your status will see session, file and folder names."
  Write-Host "To update or remove it, run this installer again."
}
