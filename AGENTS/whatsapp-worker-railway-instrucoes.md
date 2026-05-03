# WhatsApp Worker Railway - instrucoes para fechar critico

Objetivo: fechar persistencia, restauracao e reconexao real da sessao WhatsApp no worker externo da Railway sem depender do fallback do backend.

Contexto do backend `infrastudio_v2`:

- O worker e chamado pelo backend via `WHATSAPP_WORKER_URL`.
- Todas as chamadas entre worker e backend usam `WHATSAPP_BRIDGE_SECRET`.
- O backend espera estes endpoints no worker:
  1. `GET /status?channelId=...`
  2. `POST /connect`
  3. `POST /channel-config`
  4. `POST /send`
  5. `POST /purge`
- O worker deve avisar o backend por:
  1. `POST {APP_URL}/api/whatsapp/session`
  2. `POST {APP_URL}/api/whatsapp/worker-log`
- Header obrigatorio no callback:
  - `x-whatsapp-bridge-secret: ${WHATSAPP_BRIDGE_SECRET}`

## Contratos

### `POST /channel-config`

Salvar configuracao persistente do canal no worker.

Body recebido do backend:

```json
{
  "channelId": "uuid",
  "projetoId": "uuid",
  "agenteId": "uuid|null",
  "numero": "5511999999999",
  "onlyReplyToUnsavedContacts": true
}
```

Regra:

- persistir essa config em disco/storage duravel por `channelId`
- nao depender de memoria para recuperar config apos restart
- se ja existir cliente ativo, atualizar flags em runtime sem recriar sessao sem necessidade

### `POST /connect`

Criar ou restaurar cliente WhatsApp do canal.

Body:

```json
{
  "channelId": "uuid",
  "projetoId": "uuid",
  "agenteId": "uuid|null",
  "numero": "5511999999999",
  "onlyReplyToUnsavedContacts": true
}
```

Resposta esperada:

```json
{
  "channelId": "uuid",
  "status": "connected|connecting|aguardando_qr|desconectado",
  "connectionStatus": "connected|connecting|aguardando_qr|desconectado",
  "qrCodeDataUrl": "data:image/png;base64,...|null",
  "qrCodeText": "string|null",
  "notes": "string|null",
  "lastError": "string|null"
}
```

Regras:

- usar storage persistente por canal, exemplo: `${WHATSAPP_SESSION_DIR || "/data/whatsapp-sessions"}/${channelId}`
- se a sessao ja existir, tentar restaurar antes de gerar QR novo
- nao apagar auth/session em restart normal
- nao criar dois clientes para o mesmo `channelId`
- se o perfil estiver bloqueado por processo anterior, encerrar cliente antigo/lock com seguranca antes de abrir outro
- se reconnect automatico falhar, retornar `lastError` tecnico claro

### `GET /status?channelId=...`

Retornar snapshot atual do canal sem efeitos colaterais destrutivos.

Resposta:

```json
{
  "channelId": "uuid",
  "status": "connected|connecting|aguardando_qr|desconectado",
  "connectionStatus": "connected|connecting|aguardando_qr|desconectado",
  "qrCodeDataUrl": "data:image/png;base64,...|null",
  "qrCodeText": "string|null",
  "notes": "string|null",
  "lastError": "string|null",
  "lastInboundAt": "iso|null",
  "lastOutboundAt": "iso|null",
  "autoReconnectScheduled": false,
  "manualDisconnect": false,
  "terminalDisconnect": false
}
```

Regras:

- se cliente nao estiver em memoria, mas existir sessao/config persistida, tentar restore leve ou informar `desconectado` com `notes`
- nao limpar sessao no `status`

### `POST /send`

Enviar mensagem pelo cliente ativo.

Body:

```json
{
  "channelId": "uuid",
  "to": "5511999999999",
  "message": "texto"
}
```

Regras:

- se cliente nao estiver em memoria, tentar restaurar sessao persistida antes de falhar
- se envio falhar por sessao ausente/desconectada, registrar `lastError` e devolver erro claro
- ao enviar com sucesso, atualizar `lastOutboundAt` no snapshot e sincronizar com backend

### `POST /purge`

Remover cliente e sessao persistida do canal.

Body:

```json
{
  "channelId": "uuid"
}
```

Regras:

- encerrar cliente
- remover auth/session do canal
- remover config persistida do canal
- avisar backend com `terminalDisconnect: true`, `connectionStatus: "desconectado"`

## Persistencia obrigatoria

Implementar no worker:

1. diretorio persistente por canal para auth/session do WhatsApp
2. arquivo de config por canal
3. restore automatico no boot da Railway
4. registry em memoria somente como cache runtime

Sugestao de layout:

```text
/data/whatsapp-worker/
  channels/
    <channelId>.json
  sessions/
    <channelId>/
```

Variavel recomendada:

```text
WHATSAPP_SESSION_DIR=/data/whatsapp-worker
```

Na Railway, anexar volume persistente nesse path. Sem volume persistente, o critico nao fecha.

## Reconnect automatico

Implementar por canal:

1. `connected/ready`: marcar conectado e zerar backoff
2. `disconnected/offline/browser_crash/network_error`: agendar reconnect com backoff
3. `auth_failure/logout/manual_disconnect`: marcar terminal/manual e nao reconectar sozinho
4. `qr`: manter aguardando QR e enviar QR no `/status`

Backoff recomendado:

```text
5s, 15s, 30s, 60s, 120s, max 300s
```

Cada falha deve atualizar:

```json
{
  "channelId": "uuid",
  "connectionStatus": "desconectado",
  "autoReconnectScheduled": true,
  "reconnectAttempt": 3,
  "lastReconnectRequestAt": "iso",
  "lastError": "motivo tecnico"
}
```

## Sync com backend

Criar fila/scheduler por canal antes de chamar `/api/whatsapp/session`.

Regras:

- eventos criticos enviam imediatamente:
  - `connected`
  - `desconectado`
  - `manualDisconnect`
  - `terminalDisconnect`
  - `lastError` novo
  - mensagem inbound/outbound
- eventos transitorios devem ser coalescidos:
  - `connecting`
  - `reconnecting`
  - notas repetidas
  - QR repetido
- usar janela curta de 2 a 5 segundos por canal
- enviar somente o ultimo snapshot util da janela
- incluir `workerUpdatedAt` ISO no payload
- nao fazer polling agressivo contra backend

Callback:

```http
POST {APP_URL}/api/whatsapp/session
x-whatsapp-bridge-secret: ...
content-type: application/json
```

Payload minimo:

```json
{
  "channelId": "uuid",
  "connectionStatus": "connected",
  "notes": "Sessao conectada.",
  "lastError": null,
  "lastInboundAt": "iso|null",
  "lastOutboundAt": "iso|null",
  "autoReconnectScheduled": false,
  "reconnectAttempt": 0,
  "workerUpdatedAt": "iso"
}
```

Logs de erro:

```http
POST {APP_URL}/api/whatsapp/worker-log
x-whatsapp-bridge-secret: ...
```

Payload:

```json
{
  "channelId": "uuid",
  "projetoId": "uuid",
  "tipo": "reconnect_failed|client_error|send_failed",
  "origem": "whatsapp-worker",
  "level": "error",
  "descricao": "motivo tecnico"
}
```

## Criterios de aceite

1. Conectar canal com QR.
2. Confirmar que sessao/auth foi gravada no volume.
3. Reiniciar deploy/processo na Railway.
4. Sem escanear QR de novo, `GET /status` deve voltar `connected` ou restaurar para `connected`.
5. Derrubar cliente/browser internamente e confirmar reconnect automatico.
6. Se reconnect falhar, backend deve receber `lastError` tecnico.
7. Enviar mensagem manual pelo admin e confirmar entrega pelo `/send`.
8. Validar 2 canais/projetos simultaneos sem sobrescrever sessao.
9. Validar que eventos `connecting/reconnecting` repetidos nao geram spam em `/api/whatsapp/session`.

## O que nao pode fazer

- nao apagar sessao em todo restart
- nao salvar auth apenas em memoria
- nao compartilhar o mesmo perfil/browser entre canais diferentes
- nao chamar `/api/whatsapp/session` para cada evento transitorio repetido
- nao mascarar erro tecnico com mensagem generica no worker
- nao reconectar automaticamente quando o usuario fez logout/manual disconnect

