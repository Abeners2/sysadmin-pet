param(
    [string]$VmIp = "",
    [string]$SshKey = "",
    [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$EnvFile = Join-Path $ProjectRoot ".env.local"

# Load defaults from .env.local (gitignored) so one-command deploy stays effortless
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $k = $matches[1].Trim()
            $v = $matches[2].Trim()
            if ($k -eq "OCI_VM_IP" -and -not $VmIp) { $VmIp = $v }
            if ($k -eq "OCI_SSH_KEY" -and -not $SshKey) { $SshKey = $ExecutionContext.InvokeCommand.ExpandString($v) }
            if ($k -eq "OCI_API_KEY" -and -not $ApiKey) { $ApiKey = $v }
        }
    }
}

if (-not $VmIp) {
    throw "OCI_VM_IP not set. Copy .env.example to .env.local or pass -VmIp <IP>."
}
if (-not $SshKey) {
    $SshKey = "$HOME\.ssh\id_ed25519"
}

$TempArchive = "$env:TEMP\sysadmin-pet-deploy.tar.gz"
$RemoteSetupLocal = Join-Path $ProjectRoot "infra\remote-setup.sh"
$LocalAssetsDir = Join-Path $ProjectRoot "assets\trex3.r"

Write-Host "[1/4] Packaging SysAdmin Pet (Zepp OS + Lightweight OCI Agent)..." -ForegroundColor Cyan
if (Test-Path $TempArchive) { Remove-Item $TempArchive -Force }

tar -czf $TempArchive `
    --exclude="node_modules" `
    --exclude="dist" `
    --exclude="assets" `
    --exclude=".env.local" `
    --exclude="app-side/config.js" `
    -C $ProjectRoot .

Write-Host "[2/4] Uploading archive via SCP to ubuntu@$VmIp..." -ForegroundColor Cyan
scp -o ConnectTimeout=15 -i $SshKey $TempArchive "ubuntu@${VmIp}:/home/ubuntu/sysadmin-pet-deploy.tar.gz"
scp -o ConnectTimeout=15 -i $SshKey $RemoteSetupLocal "ubuntu@${VmIp}:/home/ubuntu/remote-setup-pet.sh"

Write-Host "[3/4] Deploying hardened systemd agent + generating 24 sprites on OCI VM..." -ForegroundColor Cyan
$RemoteCmd = "mkdir -p ~/sysadmin-pet && tar -xzf ~/sysadmin-pet-deploy.tar.gz -C ~/sysadmin-pet && rm -f ~/sysadmin-pet-deploy.tar.gz && sed -i 's/\r$//' ~/remote-setup-pet.sh && SYSADMIN_PET_API_KEY='$ApiKey' bash ~/remote-setup-pet.sh"
ssh -o ConnectTimeout=15 -i $SshKey "ubuntu@$VmIp" $RemoteCmd

Write-Host "[4/4] Syncing generated sprites from OCI VM back to Windows..." -ForegroundColor Cyan
if (Test-Path $LocalAssetsDir) { Remove-Item "$LocalAssetsDir\*" -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Force -Path $LocalAssetsDir | Out-Null
scp -o ConnectTimeout=15 -i $SshKey "ubuntu@${VmIp}:/home/ubuntu/sysadmin-pet/assets/trex3.r/*" "$LocalAssetsDir\"

Write-Host "Deploy complete! Run .\preview-relogio.ps1 to update your Amazfit T-Rex 3." -ForegroundColor Green
