# Checkpoint de Continuacao do InfraStudio v2

Data: 2026-04-11

## Estado seguro

- Nao fazer push.
- Nao fazer deploy.
- Usuario vai trocar a fonte do Git/deploy na Vercel.
- `mock01` deve permanecer como laboratorio visual.
- Nao reintroduzir dependencia de `C:\Projetos\infrastudio`.

## Validacoes ja feitas

- `npm run test:chat-intelligence:full --workspace backend` passou.
- `npm run build` passou.
- busca por imports do legado em codigo retornou zero resultado.

## Pronto localmente

- Chat v2 sem fallback legado.
- Widgets publicos `/chat.js` e `/chat-widget.js`.
- `/api/chat` com contrato publico e CORS.
- `/api/chat/config`.
- `/app/projetos`.
- detalhe de projeto com agente, APIs, conectores, widgets e WhatsApp.
- `/admin/atendimento` com conversas reais, handoff e polling.

## Bloqueio externo antes de trocar dominio

- publicar preview/Vercel.
- rodar `scripts/validate-widget-contract.ps1` contra a URL publicada.
- validar `nexo_leiloes` com POST real.
- reduzir TTL.
- manter legado online para rollback.

## Proximo passo tecnico

- fechar Fase 9 demo.
- depois revisar `PLANO_TROCA_DOMINIO_WIDGETS_V2.md` e executar a validacao online quando houver URL da Vercel.
