# Supabase Edge Functions 一括デプロイ
# 事前: npx supabase login （ブラウザで1回認証）
# 実行: powershell -ExecutionPolicy Bypass -File scripts/deploy-supabase-functions.ps1

$ErrorActionPreference = "Stop"
$ProjectRef = "pzqkfknrzvrqrfdemetq"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$functions = @(
  "admin-users",
  "admin-billing",
  "withdraw-account",
  "create-checkout-session",
  "create-portal-session"
)

foreach ($name in $functions) {
  Write-Host "Deploying $name ..."
  npx supabase functions deploy $name --project-ref $ProjectRef
}

Write-Host "Done."
