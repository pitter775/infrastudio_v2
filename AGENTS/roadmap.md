# Roadmap

## Objetivo principal

Deixar o atendimento do v2 tao bom quanto ou melhor que o legado, sem fallback generico e sem contaminacao entre agentes.

## Foco de retomada

O foco principal nao e mais a home/widget em si.
O foco principal agora e fechar a paridade e o refinamento do cerebro de atendimento do v2.

## Checklist do que ainda falta no cerebro

1. Paridade fina com o legado no fluxo comercial
- revisar objecoes comerciais, qualificacao e conducao para WhatsApp
- revisar tom consultivo
- revisar prioridade entre responder oferta, qualificar e capturar lead
- reduzir respostas que pedem nome cedo demais

2. API runtime realmente confiavel
- usar mais resposta estruturada da API e menos `preview` textual
- validar valor, prazo, estoque e status com payload real
- cache curto em memoria ja existe via `configuracoes.runtime.cacheTtlSeconds`
- proximo passo: cache distribuido e metricas

3. Remocao de residuos de heuristica fraca
- manter no codigo apenas heuristicas estruturais e genericas
- tudo especifico de negocio deve ir para banco

4. Refinamento de prompt e contexto
- melhorar `buildRuntimeConfigInstructions`
- melhorar resumo de APIs factuais
- evitar excesso de contexto

5. Laboratorio como gate obrigatorio
- sempre rodar:
  - `npm run test:chat-intelligence`
  - `npm run test:chat-laboratory:record`
  - `npm run build`

6. Isolamento para clientes
- testar agente de cliente sem config premium
- testar agente de cliente com config propria
- usar simulador real efemero no editor do agente para testar sem criar `chats`/`mensagens`

## Bases ja entregues

- versionamento de agente com rollback
- versionamento de API com rollback
- cache curto de API runtime em memoria
- observabilidade de IA no atendimento, Laboratorio e simulador
- simulador de agente real efemero
- regra de WhatsApp apenas com canal ativo/conectado do agente
- billing por projeto com `free` apenas no primeiro projeto do usuario
- bloqueio de projeto sem plano para projetos criados apos o primeiro
- home consumindo planos reais do banco
- checkout de upgrade/creditos e retorno de pagamento ja conectados ao projeto
- transferencia admin -> usuario comum aplicando `free` quando o projeto vinha ilimitado
- tela admin de projetos com destaque e ordenacao dos projetos do owner `admin`
- base funcional da loja publica do Mercado Livre:
  - aba `Mercado Livre > Loja`
  - landing `/loja/{slug}`
  - pagina de produto `/loja/{slug}/produto/{produtoSlug}`
  - `sheet` na navegacao interna
  - snapshot local como fonte da vitrine
  - sync manual de snapshot preparado no backend

## Ordem recomendada quando voltar

1. Rodar baseline
2. Ler os ultimos logs do Laboratorio
3. Refinar primeiro o cerebro da InfraStudio usando `runtimeConfig` + API real
4. Usar simulador do agente para validar ajuste pontual
5. Transformar testes bons em cenarios fixos do Laboratorio
6. So depois expandir UI/admin
7. Nao desviar do foco principal
