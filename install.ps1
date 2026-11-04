# Claude Discord Presence installer. Run it with:
#   irm https://raw.githubusercontent.com/Kiwious/claude-presence/main/install.ps1 | iex
# Running it again offers update, the Pet Clawd button and removal. Wrapped in a block so "return" can't close your window.
# ASCII only: Windows PowerShell can misread other characters when the script comes through irm.
& {
  $ErrorActionPreference = "Stop"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

  $base = "https://github.com/Kiwious/claude-presence/releases/latest/download"
  $dir = "$env:LOCALAPPDATA\better-presence"
  $companion = "$dir\companion.js"
  $buttonFile = "$dir\clawd-button.txt"
  # Says what to undo: "installed" when this installer added Vencord, "enabled" when it was already there
  $vencordMark = "$dir\clawd-vencord.txt"
  $vencordSettings = "$env:APPDATA\Vencord\settings\settings.json"
  $vencordInstaller = "https://github.com/Vencord/Installer/releases/latest/download/VencordInstallerCli.exe"
  $autostart = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\better-presence-companion.vbs"
  $extensionId = "kevinpartizan.better-vscode-presence"
  $workerName = "pet-clawd"
  $progress = @{ done = 0; total = 0 }

  function Write-Section($title) {
    Write-Host ""
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host ("  " + ("-" * $title.Length)) -ForegroundColor DarkGray
  }

  function Write-Text($text) { Write-Host "  $text" -ForegroundColor Gray }

  function Write-Tagged($tag, $color, $text) {
    Write-Host "  $tag " -ForegroundColor $color -NoNewline
    Write-Host $text
  }

  function Write-Ok($text) { Write-Tagged "[ok]" Green $text }
  function Write-Warn($text) { Write-Tagged "[!!]" Yellow $text }
  function Write-You($text) { Write-Tagged "[you]" Magenta $text }

  function Write-Step($text) {
    $progress.done++
    Write-Host ""
    Write-Tagged "[$($progress.done)/$($progress.total)]" Cyan $text
  }

  function Ask($question, $default) {
    $hint = if ($default) { "Y/n" } else { "y/N" }
    while ($true) {
      Write-Host "  $question " -NoNewline
      Write-Host "[$hint] " -ForegroundColor DarkGray -NoNewline
      $answer = "$(Read-Host)".Trim().ToLower()
      if ($answer -eq "") { return $default }
      if ($answer -in "y", "yes") { return $true }
      if ($answer -in "n", "no") { return $false }
    }
  }

  # Returns the index of the choice, the first one is the default
  function Choose($options) {
    for ($i = 0; $i -lt $options.Count; $i++) {
      Write-Host "    $($i + 1)  " -ForegroundColor Cyan -NoNewline
      Write-Host $options[$i]
    }
    while ($true) {
      Write-Host "  Choose " -NoNewline
      Write-Host "[1] " -ForegroundColor DarkGray -NoNewline
      $answer = "$(Read-Host)".Trim()
      if ($answer -eq "") { return 0 }
      $number = 0
      if ([int]::TryParse($answer, [ref]$number) -and $number -ge 1 -and $number -le $options.Count) { return $number - 1 }
    }
  }

  function Stop-Companion {
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
      Where-Object { $_.CommandLine -match "better-presence.companion" } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  }

  function Start-Companion {
    Start-Process (Get-Command node).Source -ArgumentList "`"$companion`"" -WindowStyle Hidden
  }

  function Get-CodeProfiles {
    $storage = "$env:APPDATA\Code\User\globalStorage\storage.json"
    if (-not (Test-Path $storage)) { return @() }
    try { return @((Get-Content $storage -Raw | ConvertFrom-Json).userDataProfiles | ForEach-Object { $_.name }) }
    catch { return @() }
  }

  # Wrangler only asks its questions when it has the console, so its output can't be piped or captured here
  function Invoke-Wrangler($arguments, $folder = $env:TEMP) {
    $process = Start-Process npx.cmd -ArgumentList (@("-y", "wrangler@4") + $arguments) -WorkingDirectory $folder -NoNewWindow -Wait -PassThru
    return $process.ExitCode
  }

  function Test-CloudflareLogin {
    return [bool]((cmd /c "npx -y wrangler@4 whoami 2>&1" | Out-String) -match "You are logged in")
  }

  function Connect-Cloudflare {
    Write-Text "Checking for a Cloudflare login. The first run downloads Cloudflare's tool, which takes a moment."
    if (Test-CloudflareLogin) {
      Write-Ok "Already signed in to Cloudflare"
      return $true
    }
    while ($true) {
      Write-You "Your browser opens now. Sign in to Cloudflare, or create a free account, then click Allow."
      Write-Text "      If it says 'Authentication error', sign in at https://dash.cloudflare.com first and try again."
      Invoke-Wrangler @("login") | Out-Null
      if (Test-CloudflareLogin) {
        Write-Ok "Signed in to Cloudflare"
        return $true
      }
      Write-Warn "That didn't sign you in."
      if (-not (Ask "Try again?" $true)) { return $false }
    }
  }

  function Publish-PetWorker {
    $folder = Join-Path $env:TEMP "pet-clawd-$([guid]::NewGuid())"
    New-Item -ItemType Directory $folder | Out-Null
    try {
      Invoke-WebRequest "$base/pet-worker.js" -OutFile "$folder\index.js" -UseBasicParsing
      Invoke-WebRequest "$base/pet-worker.toml" -OutFile "$folder\wrangler.toml" -UseBasicParsing
      $env:WRANGLER_OUTPUT_FILE_PATH = "$folder\output.json"
      $env:WRANGLER_SEND_METRICS = "false"
      if ((Invoke-Wrangler @("deploy") $folder) -ne 0) { return $null }
      foreach ($line in Get-Content "$folder\output.json" -ErrorAction SilentlyContinue) {
        $entry = $line | ConvertFrom-Json
        if ($entry.type -eq "deploy" -and $entry.targets) { return @($entry.targets)[0] }
      }
      return $null
    } finally {
      Remove-Item Env:\WRANGLER_OUTPUT_FILE_PATH -ErrorAction SilentlyContinue
      Remove-Item $folder -Recurse -Force -ErrorAction SilentlyContinue
    }
  }

  function Write-PetGuide {
    Write-Text "Adds a 'Pet Clawd' button to your Discord status. When someone presses it,"
    Write-Text "Clawd reacts on your PC and on your profile. It needs a small free web service"
    Write-Text "on your own Cloudflare account, which only stores a pet count."
    Write-Host ""
    Write-Text "What happens:"
    Write-Tagged "[you]" Magenta "Sign in to Cloudflare in your browser (a free account is enough)"
    Write-Tagged "[you]" Magenta "First time only: pick a name for your link, <name>.workers.dev"
    Write-Text "      Everyone who presses the button can see that name."
    Write-Tagged "[auto]" Green "Upload the service, connect it to the companion and test it"
    Write-Host ""
    Write-Text "Discord hides your own status buttons from you, but other people see them."
  }

  # True once the companion knows the service's address. A failure here never stops the rest of the install
  function Add-PetButton {
    try {
      if (-not (Get-Command npx.cmd -ErrorAction SilentlyContinue)) {
        Write-Warn "This needs npx, which comes with Node.js. Reinstall Node.js from https://nodejs.org."
        return $false
      }
      if (-not (Connect-Cloudflare)) { return $false }
      Write-You "If asked to register a workers.dev subdomain, answer yes and type your name."
      $url = Publish-PetWorker
      if (-not $url) {
        Write-Warn "The upload didn't report an address."
        Write-You "If it did show a https://....workers.dev address above, paste it here. Otherwise press Enter."
        $url = "$(Read-Host '  Address')".Trim()
      }
      $url = $url.TrimEnd("/")
      if ($url -notmatch "^https://\S{1,480}$") {
        Write-Warn "No valid address, so the button stays off."
        return $false
      }
      New-Item -ItemType Directory -Force $dir | Out-Null
      Set-Content $buttonFile $url -Encoding Ascii
      Write-Ok "Connected to $url"
      Write-Text "Testing it. A new name can take a minute or two to start working."
      for ($try = 0; $try -lt 24; $try++) {
        try {
          if ((Invoke-RestMethod "$url/count" -TimeoutSec 5).count -ge 0) {
            Write-Ok "The service answers. Try it yourself: $url/pet"
            return $true
          }
        } catch {
          Start-Sleep -Seconds 5
        }
      }
      Write-Warn "It isn't answering yet. It should start soon, try $url/pet in a few minutes."
      return $true
    } catch {
      Write-Warn "Couldn't set up the button: $($_.Exception.Message)"
      Write-Text "Everything else still works. Run this installer again to retry."
      return $false
    }
  }

  function Get-DiscordInstalls {
    foreach ($install in @(@{ name = "Discord"; branch = "stable" }, @{ name = "DiscordPTB"; branch = "ptb" }, @{ name = "DiscordCanary"; branch = "canary" })) {
      $app = Get-ChildItem "$env:LOCALAPPDATA\$($install.name)" -Directory -Filter "app-*" -ErrorAction SilentlyContinue |
        Sort-Object { [version]($_.Name -replace "^app-", "") } |
        Select-Object -Last 1
      if ($app) {
        $install.patched = Test-Path "$($app.FullName)\resources\_app.asar"
        $install.app = $app.FullName
        [pscustomobject]$install
      }
    }
  }

  # Returns the ones that were running, to start them again
  function Stop-Discord($installs) {
    $running = @($installs | Where-Object { Get-Process $_.name -ErrorAction SilentlyContinue })
    foreach ($install in $running) { Get-Process $install.name -ErrorAction SilentlyContinue | Stop-Process -Force }
    if ($running.Count -gt 0) { Start-Sleep -Seconds 2 }
    return $running
  }

  function Start-Discord($installs) {
    foreach ($install in $installs) {
      Start-Process "$env:LOCALAPPDATA\$($install.name)\Update.exe" -ArgumentList "--processStart", "$($install.name).exe"
      Write-Ok "Restarted $($install.name)"
    }
  }

  function Invoke-VencordInstaller($installs, $action) {
    $exe = Join-Path $env:TEMP "VencordInstallerCli-$([guid]::NewGuid()).exe"
    try {
      Invoke-WebRequest $vencordInstaller -OutFile $exe -UseBasicParsing
      foreach ($install in $installs) {
        & $exe $action --branch $install.branch | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "Vencord's installer failed for $($install.name)" }
      }
    } finally {
      Remove-Item $exe -Force -ErrorAction SilentlyContinue
    }
  }

  function Read-VencordSettings {
    if (-not (Test-Path $vencordSettings)) { return [pscustomobject]@{ plugins = [pscustomobject]@{} } }
    # A file this can't read stops here, so a user's settings are never replaced
    $settings = Get-Content $vencordSettings -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $settings.plugins) { $settings | Add-Member plugins ([pscustomobject]@{}) -Force }
    return $settings
  }

  function Save-VencordSettings($settings) {
    New-Item -ItemType Directory -Force (Split-Path $vencordSettings) | Out-Null
    # No byte order mark: Vencord can't parse a file with one and would start over with empty settings
    [IO.File]::WriteAllText("$vencordSettings.tmp", ($settings | ConvertTo-Json -Depth 100), (New-Object Text.UTF8Encoding $false))
    Move-Item "$vencordSettings.tmp" $vencordSettings -Force
  }

  function Test-OwnButtonPatch($settings) {
    return [bool]($settings.plugins.ShowOwnButtons.enabled -or $settings.plugins.CustomRPC.enabled)
  }

  function Write-OwnButtonGuide {
    Write-Text "Discord hides your own status buttons from you. The client mod Vencord can show them."
    Write-Warn "Client mods break Discord's terms and run code inside your logged-in Discord."
    Write-Text "      Vencord says it knows of no bans for using one, but that risk is yours."
    Write-Warn "Discord restarts for this, which drops you from any call."
  }

  # Prebuilt Vencord can't load extra plugins, so this turns on the patch its CustomRPC plugin has built in
  function Add-OwnButton {
    $running = @()
    try {
      $installs = @(Get-DiscordInstalls)
      if ($installs.Count -eq 0) {
        Write-Warn "No Discord desktop app found, so there's nothing to change."
        return
      }
      $settings = Read-VencordSettings
      $missing = @($installs | Where-Object { -not $_.patched })
      if ($missing.Count -eq 0 -and (Test-OwnButtonPatch $settings)) {
        Write-Ok "Vencord already shows your own button"
        return
      }
      $mark = if (Test-Path $vencordMark) { (Get-Content $vencordMark -Raw).Trim() } elseif ($missing.Count -gt 0) { "installed" } else { "enabled" }
      $running = @(Stop-Discord $installs)
      if ($missing.Count -gt 0) {
        Write-Text "Installing Vencord from its official release."
        Invoke-VencordInstaller $missing "--install"
        Write-Ok "Installed Vencord"
      } else {
        Write-Ok "Vencord is already installed"
      }
      # A fresh official Vencord has no user plugins, so an old ShowOwnButtons setting says nothing
      if ($missing.Count -gt 0 -or -not (Test-OwnButtonPatch $settings)) {
        if (-not $settings.plugins.CustomRPC) { $settings.plugins | Add-Member CustomRPC ([pscustomobject]@{}) }
        $settings.plugins.CustomRPC | Add-Member enabled $true -Force
        # With its presence off, turning this on can't bring back an old custom status
        $settings.plugins.CustomRPC | Add-Member enablePresence $false -Force
        Save-VencordSettings $settings
        Write-Ok "Turned on the patch that shows your own buttons"
      }
      New-Item -ItemType Directory -Force $dir | Out-Null
      Set-Content $vencordMark $mark -Encoding Ascii
      Write-You "Look for Pet Clawd on your profile. A Discord update can undo this, then run this installer again."
    } catch {
      Write-Warn "Couldn't set up Vencord: $($_.Exception.Message)"
      Write-Text "Everything else still works, your friends still see the button."
    } finally {
      Start-Discord $running
    }
  }

  function Remove-OwnButton {
    if (-not (Test-Path $vencordMark)) { return }
    $mark = (Get-Content $vencordMark -Raw).Trim()
    $question = if ($mark -eq "installed") { "Also remove Vencord, which this installer added? (restarts Discord)" } else { "Also hide your own button in Vencord again? (restarts Discord)" }
    if (-not (Ask $question $true)) {
      Remove-Item $vencordMark -Force
      return
    }
    $running = @()
    try {
      $installs = @(Get-DiscordInstalls)
      $running = @(Stop-Discord $installs)
      $settings = Read-VencordSettings
      if ($settings.plugins.CustomRPC) {
        $settings.plugins.CustomRPC.enabled = $false
        $settings.plugins.CustomRPC.PSObject.Properties.Remove("enablePresence")
        Save-VencordSettings $settings
      }
      if ($mark -eq "installed") {
        Invoke-VencordInstaller @($installs | Where-Object { $_.patched }) "--uninstall"
        Write-Ok "Removed Vencord"
      } else {
        Write-Ok "Your own button is hidden again"
      }
      Remove-Item $vencordMark -Force
    } catch {
      Write-Warn "Couldn't undo the Vencord change: $($_.Exception.Message)"
    } finally {
      Start-Discord $running
    }
  }

  function Remove-PetButton {
    Remove-OwnButton
    $url = if (Test-Path $buttonFile) { (Get-Content $buttonFile -Raw).Trim() }
    Remove-Item $buttonFile -Force -ErrorAction SilentlyContinue
    if (-not $url) { return }
    Write-Ok "The button is off"
    if (Ask "Also delete the service from your Cloudflare account?" $true) {
      if ((Invoke-Wrangler @("delete", "--name", $workerName, "--force")) -eq 0) {
        Write-Ok "Deleted it from Cloudflare"
      } else {
        Write-Warn "Couldn't delete it. It does nothing on its own. To remove it later: npx wrangler@4 delete --name $workerName"
      }
    } else {
      Write-Text "It stays online and does nothing on its own."
    }
  }

  function Invoke-Install {
    $hasCode = [bool](Get-Command code -ErrorAction SilentlyContinue)
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
      Write-Warn "Node.js is required. Install it from https://nodejs.org and run this again."
      return
    }
    $hasButton = Test-Path $buttonFile

    Write-Section "Your choices"
    $useAutostart = Ask "Start it automatically with Windows?" $true
    $startNow = Ask "Start it now?" $true
    $useExtension = $hasCode -and (Ask "Install the VS Code extension too? (shows your file while the Claude app is closed)" $false)
    $extensionProfiles = @()
    if ($useExtension) {
      foreach ($codeProfile in Get-CodeProfiles) {
        if (Ask "Also install it in the VS Code profile '$codeProfile'?" $true) { $extensionProfiles += $codeProfile }
      }
    }
    $dropButton = $false
    $addButton = $false
    if ($hasButton) {
      $dropButton = -not (Ask "Keep the Pet Clawd button?" $true)
    } else {
      Write-Section "Optional: Pet Clawd button"
      Write-PetGuide
      Write-Host ""
      $addButton = Ask "Add the button?" $false
    }
    # A Discord update can undo it, so an update repairs it without asking again
    $useOwnButton = Test-Path $vencordMark
    if (-not $useOwnButton -and -not $dropButton -and ($hasButton -or $addButton)) {
      Write-Section "Optional: see the button yourself"
      Write-OwnButtonGuide
      Write-Host ""
      $useOwnButton = Ask "Set up Vencord for this?" $false
    }
    $useOwnButton = $useOwnButton -and -not $dropButton

    $progress.total = 2 + [int]$useExtension + [int]($addButton -or $dropButton) + [int]$useOwnButton + [int]$startNow
    Write-Section "Installing"

    Write-Step "Downloading the companion"
    New-Item -ItemType Directory -Force $dir | Out-Null
    $download = "$companion.download"
    Invoke-WebRequest "$base/companion.js" -OutFile $download -UseBasicParsing
    Stop-Companion
    Move-Item $download $companion -Force
    Write-Ok "Installed to $dir"

    Write-Step "Setting up autostart"
    if ($useAutostart) {
      # UTF-16 so a user folder with umlauts survives
      Set-Content $autostart ('CreateObject("WScript.Shell").Run """{0}"" ""{1}""", 0, False' -f $node.Source, $companion) -Encoding Unicode
      Write-Ok "Starts with Windows"
    } else {
      Remove-Item $autostart -Force -ErrorAction SilentlyContinue
      Write-Ok "Doesn't start with Windows"
    }

    if ($useExtension) {
      Write-Step "Installing the VS Code extension"
      $vsix = "$env:TEMP\claude-discord-presence.vsix"
      Invoke-WebRequest "$base/claude-discord-presence.vsix" -OutFile $vsix -UseBasicParsing
      code --install-extension $vsix --force
      foreach ($codeProfile in $extensionProfiles) { code --install-extension $vsix --force --profile $codeProfile }
      Remove-Item $vsix -Force
      Write-Ok "Installed. Run 'Developer: Reload Window' in VS Code."
    }

    $buttonOn = $hasButton -and -not $dropButton
    if ($addButton) {
      Write-Step "Setting up the Pet Clawd button"
      $buttonOn = Add-PetButton
    } elseif ($dropButton) {
      Write-Step "Removing the Pet Clawd button"
      Remove-PetButton
    }

    if ($useOwnButton) {
      Write-Step "Showing the button on your own profile"
      if ($buttonOn) {
        Add-OwnButton
      } else {
        Write-Warn "Skipped, because the button isn't set up."
      }
    }

    if ($startNow) {
      Write-Step "Starting the companion"
      Start-Process $node.Source -ArgumentList "`"$companion`"" -WindowStyle Hidden
      Write-Ok "Running"
    }

    Write-Section "Done"
    Write-You "Open a session in the Claude app and keep the Discord desktop app running."
    Write-You "In Discord, turn on: Settings > Activity Privacy > Share your detected activities with others."
    if ($buttonOn) {
      Write-You "Ask a friend to press Pet Clawd on your status to test it."
    }
    Write-Host ""
    Write-Text "People who can see your status will see session, file and folder names."
    Write-Text "To update or remove it, run this installer again."
  }

  function Invoke-Remove {
    Write-Section "Removing"
    $hasCode = [bool](Get-Command code -ErrorAction SilentlyContinue)
    Stop-Companion
    Remove-PetButton
    Remove-Item $autostart -Force -ErrorAction SilentlyContinue
    Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Ok "Removed the companion and autostart"
    if ($hasCode -and (Ask "Also remove the VS Code extension?" $false)) {
      code --uninstall-extension $extensionId
      foreach ($codeProfile in Get-CodeProfiles) { code --uninstall-extension $extensionId --profile $codeProfile }
      Write-Ok "Removed the VS Code extension"
    }
  }

  function Invoke-OwnButtonSetting {
    if (Test-Path $vencordMark) {
      Write-Section "Your own button"
      Remove-OwnButton
      return
    }
    Write-Section "See the button yourself"
    Write-OwnButtonGuide
    Write-Host ""
    if (Ask "Set up Vencord for this?" $false) { Add-OwnButton }
  }

  # Only the button changes, so the rest of the install stays as it is
  function Invoke-ButtonSetting {
    $wasRunning = [bool](Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match "better-presence.companion" })
    if (Test-Path $buttonFile) {
      Write-Section "Turning off the Pet Clawd button"
      Remove-PetButton
    } else {
      Write-Section "Pet Clawd button"
      Write-PetGuide
      Write-Host ""
      if (-not (Ask "Set it up now?" $true)) { return }
      Write-Host ""
      Add-PetButton | Out-Null
    }
    # It reads the address when it starts
    Stop-Companion
    if ($wasRunning) {
      Start-Companion
      Write-Ok "Restarted the companion"
    }
  }

  try {
    Write-Host ""
    Write-Host "  Claude Discord Presence" -ForegroundColor Yellow
    Write-Text "Your Discord status for the Claude Code desktop app, with Clawd the pet."

    if ((Test-Path $companion) -or (Test-Path $autostart)) {
      Write-Section "Already installed"
      $hasButton = Test-Path $buttonFile
      $buttonOption = if ($hasButton) { "Turn off the Pet Clawd button" } else { "Set up the Pet Clawd button" }
      $ownOption = if (Test-Path $vencordMark) { "Hide the button from yourself again (Vencord)" } else { "See the button yourself (Vencord)" }
      $options = @("Update", $buttonOption) + $(if ($hasButton) { @($ownOption) } else { @() }) + @("Remove", "Cancel")
      switch ($options[(Choose $options)]) {
        "Update" { Invoke-Install }
        $buttonOption { Invoke-ButtonSetting }
        $ownOption { Invoke-OwnButtonSetting }
        "Remove" { Invoke-Remove }
      }
    } else {
      Invoke-Install
    }
  } catch {
    Write-Host ""
    Write-Warn "Something went wrong: $($_.Exception.Message)"
    Write-Text "Check your internet connection and run this installer again."
  }
  Write-Host ""
}
