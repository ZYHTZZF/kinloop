$ErrorActionPreference = 'Stop'

$wd = Split-Path -Parent $PSScriptRoot
Set-Location $wd

function Kill-Port8787 {
  $listen = netstat -ano -p tcp | Select-String ':8787' | Select-String 'LISTENING'
  foreach ($line in $listen) {
    $parts = ($line.ToString() -replace '\s+', ' ').Trim().Split(' ')
    $procId = $parts[-1]
    if ($procId -match '^\d+$') {
      Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
    }
  }
}

function Add-Result([System.Collections.Generic.List[object]]$results, [string]$name, [bool]$ok, [string]$detail) {
  $results.Add([PSCustomObject]@{
      name   = $name
      status = $(if ($ok) { 'PASS' } else { 'FAIL' })
      detail = $detail
    }) | Out-Null
}

Kill-Port8787
Start-Sleep -Milliseconds 300
$api = Start-Process -FilePath node -ArgumentList 'server/index.mjs' -WorkingDirectory $wd -PassThru
Start-Sleep -Seconds 2
$results = New-Object 'System.Collections.Generic.List[object]'

try {
  try {
    $h = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/health' -TimeoutSec 10
    Add-Result $results 'health' ($h.ok -eq $true) $h.service
  } catch {
    Add-Result $results 'health' $false $_.Exception.Message
  }

  $elderCards = @()
  $familyCards = @()
  $aiConversationId = $null

  try {
    $elderCards = (curl.exe -s 'http://127.0.0.1:8787/api/conversations/cards' | ConvertFrom-Json)
    if ($elderCards -isnot [System.Array]) { $elderCards = @($elderCards) }
    Add-Result $results 'elder_cards_ai_visible' (@($elderCards | Where-Object { $_.conversationType -eq 'AI_ASSISTANT' }).Count -gt 0) ("count={0}" -f $elderCards.Count)
    Add-Result $results 'elder_cards_ai_first' ($elderCards.Count -gt 0 -and $elderCards[0].conversationType -eq 'AI_ASSISTANT') ("first={0}" -f $elderCards[0].id)

    $aiCard = $elderCards | Where-Object { $_.conversationType -eq 'AI_ASSISTANT' } | Select-Object -First 1
    $aiConversationId = if ($aiCard) { [string]$aiCard.id } else { $null }
  } catch {
    Add-Result $results 'elder_cards_ai_visible' $false $_.Exception.Message
    Add-Result $results 'elder_cards_ai_first' $false 'failed'
  }

  try {
    $familyCards = (curl.exe -s 'http://127.0.0.1:8787/api/conversations/cards?viewer=family' | ConvertFrom-Json)
    if ($familyCards -isnot [System.Array]) { $familyCards = @($familyCards) }
    Add-Result $results 'family_cards_hide_ai' (@($familyCards | Where-Object { $_.conversationType -eq 'AI_ASSISTANT' }).Count -eq 0) ("count={0}" -f $familyCards.Count)
  } catch {
    Add-Result $results 'family_cards_hide_ai' $false $_.Exception.Message
  }

  try {
    if ($aiConversationId) {
      $d = Invoke-RestMethod -Uri ("http://127.0.0.1:8787/api/conversations/{0}" -f $aiConversationId) -TimeoutSec 20
      Add-Result $results 'ai_conversation_detail' ([string]$d.id -eq [string]$aiConversationId) ("name={0}" -f $d.name)
    } else {
      Add-Result $results 'ai_conversation_detail' $false 'missing ai id'
    }
  } catch {
    Add-Result $results 'ai_conversation_detail' $false $_.Exception.Message
  }

  $members = @(
    @{ id = 'member_son'; role = 'Family'; displayName = '儿子'; elderAlias = '儿子' },
    @{ id = 'member_daughter'; role = 'Primary'; displayName = '女儿'; elderAlias = '女儿' }
  )

  $convs = @(
    @{ id = 'conv_son'; memberId = 'member_son'; name = '儿子'; elderDisplayName = '李阿姨' },
    @{ id = 'conv_daughter'; memberId = 'member_daughter'; name = '女儿'; elderDisplayName = '李阿姨' }
  )

  $sendIntent = $null
  try {
    $body = @{ spokenText = '给儿子发送你今天回来吃饭吗'; members = $members; conversations = $convs } | ConvertTo-Json -Depth 8
    $sendIntent = (Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8787/api/ai/elder-intent' -ContentType 'application/json; charset=utf-8' -Body $body -TimeoutSec 100).result
    $ok = ($sendIntent.nextAction -eq 'open_conversation') -and [bool]$sendIntent.targetConversationId
    Add-Result $results 'intent_send_message' $ok ("intent={0},action={1},autoSend={2},target={3}" -f $sendIntent.intentType, $sendIntent.nextAction, $sendIntent.autoSendMessage, $sendIntent.targetConversationId)
  } catch {
    Add-Result $results 'intent_send_message' $false $_.Exception.Message
  }

  try {
    $body = @{ spokenText = '我胸口很痛，快联系家人'; members = $members; conversations = $convs } | ConvertTo-Json -Depth 8
    $sos = (Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8787/api/ai/elder-intent' -ContentType 'application/json; charset=utf-8' -Body $body -TimeoutSec 100).result
    $ok = ($sos.nextAction -eq 'trigger_alert')
    Add-Result $results 'intent_emergency' $ok ("urgency={0},action={1}" -f $sos.urgencyLevel, $sos.nextAction)
  } catch {
    Add-Result $results 'intent_emergency' $false $_.Exception.Message
  }

  try {
    if ($sendIntent -and $sendIntent.targetConversationId) {
      $before = Invoke-RestMethod -Uri ("http://127.0.0.1:8787/api/conversations/{0}" -f $sendIntent.targetConversationId) -TimeoutSec 20
      $beforeCount = @($before.messages).Count
      $text = if ([string]::IsNullOrWhiteSpace($sendIntent.draftText)) { '你今天回来吃饭吗' } else { [string]$sendIntent.draftText }
      $body = @{ senderType = 'Elder'; senderMemberId = 'member_elder'; messageType = 'Text'; textContent = $text; aiDrafted = $true; isLowInformation = $false } | ConvertTo-Json
      $after = Invoke-RestMethod -Method Post -Uri ("http://127.0.0.1:8787/api/conversations/{0}/messages" -f $sendIntent.targetConversationId) -ContentType 'application/json' -Body $body -TimeoutSec 20
      $afterCount = @($after.messages).Count
      $last = $after.messages[-1]
      Add-Result $results 'auto_send_chain' (($afterCount -eq ($beforeCount + 1)) -and ($last.aiDrafted -eq $true)) ("messages:{0}->{1},lastAiDrafted={2}" -f $beforeCount, $afterCount, $last.aiDrafted)
    } else {
      Add-Result $results 'auto_send_chain' $false 'missing target'
    }
  } catch {
    Add-Result $results 'auto_send_chain' $false $_.Exception.Message
  }

  try {
    if ($aiConversationId) {
      $before = Invoke-RestMethod -Uri ("http://127.0.0.1:8787/api/conversations/{0}" -f $aiConversationId) -TimeoutSec 20
      $beforeCount = @($before.messages).Count
      $body = @{ senderType = 'System'; senderMemberId = $null; messageType = 'Text'; textContent = 'AI执行结果：测试日志写入'; aiDrafted = $false; isLowInformation = $false } | ConvertTo-Json
      $after = Invoke-RestMethod -Method Post -Uri ("http://127.0.0.1:8787/api/conversations/{0}/messages" -f $aiConversationId) -ContentType 'application/json' -Body $body -TimeoutSec 20
      $afterCount = @($after.messages).Count
      Add-Result $results 'ai_log_writable' ($afterCount -eq ($beforeCount + 1)) ("messages:{0}->{1}" -f $beforeCount, $afterCount)
    } else {
      Add-Result $results 'ai_log_writable' $false 'missing ai id'
    }
  } catch {
    Add-Result $results 'ai_log_writable' $false $_.Exception.Message
  }

  $results | ForEach-Object { "{0}`t{1}`t{2}" -f $_.name, $_.status, $_.detail }
  $pass = @($results | Where-Object { $_.status -eq 'PASS' }).Count
  $fail = @($results | Where-Object { $_.status -eq 'FAIL' }).Count
  "SUMMARY`tPASS=$pass`tFAIL=$fail"
} finally {
  if ($api -and -not $api.HasExited) {
    Stop-Process -Id $api.Id -Force
  }
}
