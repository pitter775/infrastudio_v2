# Laboratorio

## Laboratorio usado pelo Codex

E o mesmo Laboratorio visual do admin:

- tela: `backend/app/admin/laboratorio/page.js`
- API: `backend/app/api/admin/laboratorio/route.js`

Os cenarios gravados entram como logs reais no admin com:

- `type = "lab_chat_scenario"`
- `origin = "laboratorio"`

## Baseline atual

Arquivos:

- `backend/lib/laboratory-scenarios.js`
- `backend/tests/chat-laboratory.record.ts`

Comando:

- `npm run test:chat-laboratory:record`

## Uso correto

- rodar antes e depois de mexer no cerebro
- comparar regressao no `/admin/laboratorio`
- transformar casos reais em cenarios fixos

## Cenarios que devem existir

- preco
- prazo
- objecao
- pedido de humano
- transicao para WhatsApp
- perguntas comerciais da home

## Melhoria operacional pendente

- criar ciclo de limpeza do Laboratorio/logs com TTL por categoria
- idealmente com execucao diaria em lote, dry-run e opcao `pinned`/`keep`

## Integracoes ja feitas

- logs de cenario mostram `IA trace`
- teste manual do editor do agente grava log `lab_agent_test`
- painel tambem exibe bloco de `Possiveis erros` para consulta rapida
- esse bloco ja cobre:
  - falhas de chat/runtime
  - falhas de billing/checkout/webhook
  - problemas comuns de configuracao do Mercado Pago
- simulador usa modo real efemero:
  - IA real
  - APIs reais
  - custo/token ativo
  - sem gravar `chats`
  - sem gravar `mensagens`

## Proximo encaixe bom

- botao para salvar uma conversa do simulador como cenario fixo
- comparar resposta atual contra baseline anterior
- score humano por cenario
