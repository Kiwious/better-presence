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

  function Remove-PetButton {
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

    $progress.total = 2 + [int]$useExtension + [int]($addButton -or $dropButton) + [int]$startNow
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

    if ($startNow) {
      Write-Step "Starting the companion"
      Start-Process $node.Source -ArgumentList "`"$companion`"" -WindowStyle Hidden
      Write-Ok "Running"
    }

    Write-Section "Done"
    Write-You "Open a session in the Claude app and keep the Discord desktop app running."
    Write-You "In Discord, turn on: Settings > Activity Privacy > Share your detected activities with others."
    if ($buttonOn) {
      Write-You "Ask a friend to press Pet Clawd on your status, Discord hides it from you."
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
      $buttonOption = if (Test-Path $buttonFile) { "Turn off the Pet Clawd button" } else { "Set up the Pet Clawd button" }
      switch (Choose @("Update", $buttonOption, "Remove", "Cancel")) {
        0 { Invoke-Install }
        1 { Invoke-ButtonSetting }
        2 { Invoke-Remove }
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
