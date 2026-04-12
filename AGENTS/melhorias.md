# Melhorias

## Ja adiantado

1. Versionamento de agente
- tabela `agente_versoes` criada no banco
- snapshot antes de salvar agente
- historico de `promptBase`
- historico de `runtimeConfig`
- rollback rapido no editor do agente
- rollback tambem aparece no sheet do admin

Ainda cabe melhorar:
- diff visual entre versoes
- campo de nota/motivo ao salvar
- destacar versao atual vs versao restaurada
- filtro por autor/data/origem

2. Observabilidade de IA - primeira camada
- metadata da IA ja aparece na Central de Atendimento via `IA trace`
- metadata da IA ja aparece no Laboratorio para logs de cenario
- simulador de agente tambem mostra `IA trace`
- mostra:
  - provider
  - modelo
  - dominio
  - heuristica
  - tokens
  - custo
  - agente
  - assets
  - APIs consultadas
  - cache hit de APIs

Ainda cabe melhorar:
- painel por chat com linha do tempo tecnica
- mostrar widget resolvido
- mostrar campos exatos usados pelas APIs
- mostrar motivo de fail-closed
- mostrar handoff e decisao de escalada
- filtros por provider, stage, custo e erro

3. Laboratorio como gate real
- `test:chat-laboratory:record` carrega `.env.local`
- laboratorio deixou de passar falso em modo isolado
- cenarios comerciais da home foram ampliados
- gate valida agente/projeto esperado
- gate bloqueia fallback generico e placeholder de WhatsApp

Ainda cabe melhorar:
- diff contra baseline anterior
- score humano por cenario
- limpeza TTL dos logs do Laboratorio

4. Regra de WhatsApp por disponibilidade
- agente so deve direcionar para WhatsApp se houver numero/canal cadastrado
- sem numero/canal, continua atendimento no chat
- com numero cadastrado, instrucao usa o numero real e bloqueia placeholder

Ainda cabe melhorar:
- validar isso visualmente no cadastro de widget/canal
- expor alerta quando `runtimeConfig` tem CTA de WhatsApp mas o widget nao tem numero

5. Simulador de agente - primeira versao
- botao `Testar agente` no editor do agente
- abre chat flutuante, sem sheet
- usa runtime real com IA e APIs reais
- modo real efemero:
  - nao grava `chats`
  - nao grava `mensagens`
  - mantem historico/contexto em memoria no painel
  - mantem custo/token ativo em `consumos`
- registra log tecnico `lab_agent_test`
- mostra `IA trace`

Ainda cabe melhorar:
- escolher canal simulado: web, widget, WhatsApp
- escolher contexto inicial
- anexos no simulador
- salvar cenario a partir de uma conversa de teste
- transformar teste em baseline do Laboratorio

6. Versionamento de API
- tabela `api_versoes` em seeder
- snapshot antes de salvar API
- historico de URL, metodo, descricao, ativo e `configuracoes`
- rollback rapido na tela de APIs

Ainda cabe melhorar:
- diff visual entre versoes
- nota/motivo ao salvar
- destacar versao atual vs restaurada
- rollback tambem no admin global, se houver tela dedicada

7. Cache de API runtime - primeira camada
- cache em memoria por API/config/url/updatedAt
- respeita `configuracoes.runtime.cacheTtlSeconds`
- trace mostra quantas APIs vieram do cache
- cache invalida ao editar API porque `updatedAt` entra na chave

Ainda cabe melhorar:
- cache distribuido em banco/Redis se houver varios processos
- limpeza/metricas de cache
- cache por parametros quando API deixar de ser apenas GET fixo

## Melhorias pendentes ja identificadas

- presets no cadastro de API para:
  - `valores`
  - `status/pedido`
  - `estoque`
  - `prazo`
- editor melhor para `runtimeConfig` do agente
- editor melhor para `apis.configuracoes`
- validacao visual/schema para JSON de agente e API
- ciclo de limpeza do Laboratorio/logs com TTL por categoria
- diff visual para versoes de agente/API

## Melhorias de alto impacto

1. Observabilidade de IA
- painel por chat com:
  - agente resolvido
  - widget
  - APIs consultadas
  - handoff
  - custo
  - motivo do fail-closed
- status: parcial, primeira camada no atendimento, Laboratorio e simulador ja feita

2. Versionamento de agente
- historico de `promptBase`
- historico de `runtimeConfig`
- rollback rapido
- status: base funcional feita

3. Versionamento de API
- historico de `apis.configuracoes`
- comparacao entre versoes
- status: base funcional feita

4. Cache de API runtime
- cache curto por `agente + api + contexto`
- reduzir latencia e custo
- status: primeira camada em memoria feita

5. Simulador de agente no admin
- testar agente por cenario salvo
- escolher agente, widget, canal e contexto
- diff contra baseline anterior
- status: primeira versao real efemera feita no editor do agente

6. Score de qualidade no Laboratorio
- marcar resposta como boa/aceitavel/ruim
- feedback humano por cenario

7. Guardrails por projeto
- limites por cliente
- regras como:
  - nao falar preco
  - nao prometer prazo
  - nao puxar WhatsApp cedo

8. Billing de IA
- uso por projeto
- uso por agente
- uso por canal
- uso por API

## Prioridade sugerida

1. schema/validacao forte de JSON
2. diff visual de versoes do agente/API
3. salvar teste do simulador como cenario do Laboratorio
4. escolher canal/contexto no simulador
5. cache distribuido de API runtime
6. limpeza TTL do Laboratorio/logs



deixa o nome agente primeiro e o botao liga e desliga depois

o bloco onde escreve o comportamento do agente tem que ser mais largo do que o block da direita 

instala o ReactQuill from 'react-quill'

e coloca ele ai para o usuario ter uma liberdade maior para editar o texto 