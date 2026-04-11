param(
  [string]$BaseUrl = "http://localhost:3010",
  [string]$Projeto = "nexo",
  [string]$Agente = "agente-imovel",
  [string]$Widget = "nexo_leiloes",
  [string]$Origin = "https://cliente.example",
  [switch]$SkipPost
)

$ErrorActionPreference = "Stop"

function Join-Url {
  param(
    [string]$Base,
    [string]$Path
  )

  return $Base.TrimEnd("/") + "/" + $Path.TrimStart("/")
}

function Assert-Status {
  param(
    [string]$Name,
    [object]$Response,
    [int]$Expected = 200
  )

  if ($Response.StatusCode -ne $Expected) {
    throw "$Name retornou status $($Response.StatusCode), esperado $Expected"
  }
}

$result = [ordered]@{
  baseUrl = $BaseUrl
  projeto = $Projeto
  agente = $Agente
  widget = $Widget
  origin = $Origin
}

$chatJs = Invoke-WebRequest -Uri (Join-Url $BaseUrl "/chat.js") -Method GET -TimeoutSec 20
Assert-Status "GET /chat.js" $chatJs
$result.chatJs = @{
  status = $chatJs.StatusCode
  bytes = $chatJs.RawContentLength
}

$chatWidget = Invoke-WebRequest -Uri (Join-Url $BaseUrl "/chat-widget.js") -Method GET -TimeoutSec 20
Assert-Status "GET /chat-widget.js" $chatWidget
$result.chatWidget = @{
  status = $chatWidget.StatusCode
  bytes = $chatWidget.RawContentLength
}

$optionsChat = Invoke-WebRequest -Uri (Join-Url $BaseUrl "/api/chat") -Method OPTIONS -Headers @{ Origin = $Origin } -TimeoutSec 20
Assert-Status "OPTIONS /api/chat" $optionsChat 204
$result.optionsChat = @{
  status = $optionsChat.StatusCode
  allowOrigin = $optionsChat.Headers["Access-Control-Allow-Origin"]
}

$optionsConfig = Invoke-WebRequest -Uri (Join-Url $BaseUrl "/api/chat/config") -Method OPTIONS -Headers @{ Origin = $Origin } -TimeoutSec 20
Assert-Status "OPTIONS /api/chat/config" $optionsConfig 204
$result.optionsConfig = @{
  status = $optionsConfig.StatusCode
  allowOrigin = $optionsConfig.Headers["Access-Control-Allow-Origin"]
}

$configUrl = Join-Url $BaseUrl "/api/chat/config?projeto=$([uri]::EscapeDataString($Projeto))&agente=$([uri]::EscapeDataString($Agente))"
$config = Invoke-WebRequest -Uri $configUrl -Method GET -Headers @{ Origin = $Origin } -TimeoutSec 30
Assert-Status "GET /api/chat/config" $config
$configJson = $config.Content | ConvertFrom-Json
$result.config = @{
  status = $config.StatusCode
  hasProjeto = [bool]$configJson.projeto
  hasAgente = [bool]$configJson.agente
  hasUi = [bool]$configJson.ui
}

if (-not $SkipPost) {
  $body = @{
    message = "oi"
    widgetSlug = $Widget
  } | ConvertTo-Json -Compress

  $post = Invoke-WebRequest `
    -Uri (Join-Url $BaseUrl "/api/chat") `
    -Method POST `
    -Headers @{ Origin = $Origin; "Content-Type" = "application/json" } `
    -Body $body `
    -TimeoutSec 90

  Assert-Status "POST /api/chat" $post
  $postJson = $post.Content | ConvertFrom-Json
  if (-not $postJson.chatId) {
    throw "POST /api/chat nao retornou chatId"
  }
  if (-not ($postJson.PSObject.Properties.Name -contains "reply")) {
    throw "POST /api/chat nao retornou reply"
  }

  $result.postChat = @{
    status = $post.StatusCode
    hasChatId = [bool]$postJson.chatId
    hasReply = $postJson.PSObject.Properties.Name -contains "reply"
  }
}

$result.ok = $true
$result | ConvertTo-Json -Depth 6
