# Aba WhatsApp - comportamento do legado

Objetivo deste arquivo: servir como especificacao de comportamento para o Codex replicar a aba no `infrastudio_v2`, mantendo o funcionamento do legado, mas usando os padroes, rotas, componentes, auth, worker externo e estrutura atuais do v2. Nao importar nada de `C:\Projetos\infrastudio`.

Fonte analisada no legado:

- `C:\Projetos\infrastudio\app\admin\projetos\[id]\page.tsx`
- `C:\Projetos\infrastudio\app\admin\projetos\[id]\_components\project-whatsapp-section.tsx`
- `C:\Projetos\infrastudio\app\api\admin\whatsapp-canais\route.ts`
- `C:\Projetos\infrastudio\app\api\admin\whatsapp-canais\[id]\connect\route.ts`
- `C:\Projetos\infrastudio\app\api\admin\whatsapp-canais\[id]\disconnect\route.ts`
- `C:\Projetos\infrastudio\app\api\admin\whatsapp-canais\[id]\handoff-contatos\route.ts`
- `C:\Projetos\infrastudio\app\api\whatsapp\webhook\route.ts`
- `C:\Projetos\infrastudio\lib\whatsapp-channels.ts`

## Entrada na aba

Ao abrir o projeto, a pagina carrega:

```json
{
  "endpoint": "GET /api/admin/projetos/[id]",
  "retorno_usado": {
    "whatsappChannels": "canais do projeto",
    "agentes": "para vincular canal ao agente",
    "stats.totalWhatsAppChannels": "contador da aba"
  },
  "env_usada": {
    "NEXT_PUBLIC_WHATSAPP_SERVICE_URL": "URL do worker/bridge externo"
  }
}
```

A aba fica bloqueada se nao houver agente. No modo demo, os canais sao ocultados.

O legado trabalha com um canal principal. Mesmo que existam varios no banco, a interface prioriza o primeiro e avisa que existem outros.

## Estados exibidos

O card principal mostra:

```json
{
  "numero": "formatado pt-BR",
  "agente": "agente do canal ou agente ativo do projeto",
  "status": "conectado | connecting | aguardando_qr | desconectado",
  "ultimaSincronizacao": "sessionData.lastSyncAt ou nao sincronizada",
  "nota": "sessionData.notes traduzida para mensagem amigavel"
}
```

Mapeamento de status:

```json
{
  "online": "conectado",
  "conectado": "conectado",
  "connecting": "connecting",
  "aguardando_qr": "aguardando_qr",
  "outros": "desconectado"
}
```

## Criar canal

Botao: `Conectar ao WhatsApp`.

Abre modal `WhatsAppChannelModal`.

Campos:

```json
{
  "numero": "obrigatorio; salva apenas digitos",
  "status": "ativo por padrao",
  "agenteId": "nao aparece como campo livre; resolvido pelo agente ativo ou primeiro agente"
}
```

Salva em:

```json
{
  "endpoint": "POST /api/admin/whatsapp-canais",
  "body": {
    "projetoId": "id da rota",
    "agenteId": "agente resolvido",
    "numero": "digitos",
    "status": "ativo|inativo"
  }
}
```

Validacoes:

```json
{
  "acesso": "admin, pode gerenciar e acessar projeto",
  "numero": "obrigatorio",
  "agente": "se informado, precisa pertencer ao projeto",
  "unicidade": "um canal WhatsApp por projeto",
  "demo": "bloqueia escrita"
}
```

No banco `canais_whatsapp`, cria:

```json
{
  "projeto_id": "projeto",
  "agente_id": "agente",
  "numero": "somente digitos",
  "session_data": {
    "connectionStatus": "offline"
  },
  "status": "ativo",
  "created_at": "now",
  "updated_at": "now"
}
```

## Editar canal

Botao: `Editar`.

Carrega numero formatado, agenteId atual e status. Salva em:

```json
{
  "endpoint": "PUT /api/admin/whatsapp-canais",
  "regra": "mantem session_data atual se nao for enviada nova",
  "validacoes": ["canal existe", "projeto bate", "numero obrigatorio", "agente valido", "um canal por projeto"]
}
```

## Gerar QR Code / reconectar

Botao: `Gerar QR Code`.

Fluxo exato do legado:

```json
{
  "pre_condicao": "NEXT_PUBLIC_WHATSAPP_SERVICE_URL definido",
  "passo_1": "checkWhatsAppServiceHealth()",
  "passo_2": "resetWhatsAppChannelSession(channel, serviceUrl)",
  "passo_3": "POST {serviceUrl}/connect",
  "passo_4": "POST /api/admin/whatsapp-canais/[id]/connect",
  "passo_5": "atualiza estado local para connectionStatus=connecting",
  "passo_6": "refreshWhatsAppRuntime(channel.id)",
  "passo_7": "agenda outro refresh em 1800ms"
}
```

`resetWhatsAppChannelSession` faz:

```json
{
  "worker": "POST {serviceUrl}/purge com { channelId }",
  "backend": "POST /api/admin/whatsapp-canais/[id]/disconnect",
  "estado_local": {
    "qr": null,
    "status": "desconectado",
    "connectionStatus": "offline"
  }
}
```

Payload para o worker externo:

```json
{
  "endpoint": "POST {NEXT_PUBLIC_WHATSAPP_SERVICE_URL}/connect",
  "body": {
    "channelId": "channel.id",
    "projetoId": "channel.projetoId",
    "agenteId": "channel.agenteId",
    "numero": "channel.numero"
  }
}
```

A rota interna `/connect` apenas marca no banco:

```json
{
  "connectionStatus": "aguardando_qr",
  "qrCodeUrl": null,
  "qrCodeDataUrl": null,
  "qrCodeText": "mantem anterior se houver",
  "notes": "Clique em \"Gerar QR Code\" para iniciar a conexao deste numero.",
  "status": "ativo"
}
```

O QR exibido vem do worker:

```json
{
  "status": "GET {serviceUrl}/status?channelId=...",
  "qr": "GET {serviceUrl}/qr?channelId=...",
  "qr_preferido": "serviceQrByChannel[channel.id] ou sessionData.qrCodeDataUrl ou sessionData.qrCodeUrl"
}
```

## Desconectar

Botao: `Desconectar`.

Fluxo:

```json
{
  "worker": "POST {serviceUrl}/purge se serviceUrl existir",
  "backend": "POST /api/admin/whatsapp-canais/[id]/disconnect",
  "estado_local": {
    "qr": null,
    "status": "desconectado",
    "connectionStatus": "offline"
  }
}
```

A rota interna `/disconnect` grava:

```json
{
  "connectionStatus": "offline",
  "qrCodeUrl": null,
  "qrCodeDataUrl": null,
  "qrCodeText": null,
  "disconnectedAt": "now",
  "notes": "Canal desconectado pelo admin.",
  "status": "inativo"
}
```

## Remover canal

Botao: `Remover`.

O legado confirma em modal. Ao excluir:

```json
{
  "endpoint": "DELETE /api/admin/whatsapp-canais",
  "body": {
    "id": "channel.id",
    "projetoId": "id da rota"
  },
  "efeito_extra": "antes de apagar no banco, chama purgeWhatsAppServiceSessions({ channelId })"
}
```

## Atendimento humano / handoff

So aparece quando existe canal principal.

Campos para cadastrar contato:

```json
{
  "nome": "obrigatorio",
  "numero": "obrigatorio, formatado no input e normalizado para BR",
  "papel": "opcional",
  "observacoes": "opcional",
  "ativo": true,
  "receberAlertas": true
}
```

Lista contatos em:

```json
{
  "endpoint": "GET /api/admin/whatsapp-canais/[channelId]/handoff-contatos",
  "filtro": {
    "projetoId": "channel.projetoId",
    "canalWhatsappId": "channel.id ou nulo"
  }
}
```

Cria contato em:

```json
{
  "endpoint": "POST /api/admin/whatsapp-canais/[channelId]/handoff-contatos",
  "validacao_especial": "numero do contato nao pode ser o mesmo do canal principal"
}
```

Acoes do contato:

```json
{
  "Pausar alerta": {
    "ativo": true,
    "receberAlertas": false
  },
  "Ativar alerta": {
    "ativo": true,
    "receberAlertas": true
  },
  "Desativar contato": {
    "ativo": false,
    "receberAlertas": false
  },
  "Reativar contato": {
    "ativo": true,
    "receberAlertas": "mantem valor anterior"
  },
  "Remover": {
    "action": "delete",
    "contactId": "id"
  }
}
```

Teste de alerta:

```json
{
  "endpoint": "POST /api/admin/whatsapp-canais/[channelId]/handoff-contatos",
  "body": {
    "action": "test"
  },
  "pre_condicao": "existe pelo menos um contato ativo com receberAlertas=true",
  "envio": "sendWhatsAppHandoffTestAlert usa o mesmo canal oficial conectado"
}
```

## Webhook de mensagens recebidas

O worker externo chama:

```json
{
  "endpoint": "POST /api/whatsapp/webhook",
  "auth": "header x-whatsapp-bridge-secret precisa bater com WHATSAPP_BRIDGE_SECRET",
  "body": {
    "channelId": "obrigatorio",
    "numero": "remetente",
    "message": "obrigatorio",
    "context": "objeto opcional",
    "metadata": "objeto opcional"
  }
}
```

Processamento:

```json
{
  "passo_1": "busca canal por channelId",
  "passo_2": "normaliza numero do remetente",
  "passo_3": "marca session_data connectionStatus=online e lastInboundAt=now",
  "passo_4": "chama processIncomingChatMessage",
  "chat_payload": {
    "message": "body.message",
    "projeto": "channel.projetoId",
    "agente": "channel.agenteId",
    "canal": "whatsapp",
    "identificadorExterno": "numero do remetente",
    "whatsappChannelId": "channel.id",
    "source": "whatsapp_webhook",
    "context.whatsapp": {
      "channelId": "channel.id",
      "numeroCanal": "channel.numero",
      "remetente": "numero",
      "metadata": "body.metadata"
    }
  }
}
```

## Regra importante para replicar no v2

O painel nao conecta WhatsApp sozinho. Ele orquestra estado no banco e manda comandos para um worker externo por `NEXT_PUBLIC_WHATSAPP_SERVICE_URL`.
