# Checklist de Execucao da Migracao para o InfraStudio v2

## Objetivo deste documento

Este arquivo transforma o plano de migracao em execucao pratica, com etapas pequenas, status e criterio de aceite.

Uso recomendado:

- marcar progresso real
- evitar abrir frentes demais ao mesmo tempo
- usar este checklist junto com:
  - `C:\Projetos\infrastudio_v2\PLANO_MIGRACAO_INFRASTUDIO_V2.md`
  - `C:\Projetos\infrastudio_v2\REALIDADE_LEGADO_INFRASTUDIO.md`
  - `C:\Projetos\infrastudio_v2\REALIDADE_ATUAL_V2.md`

## Legenda de status

- `pendente`
- `em andamento`
- `concluido`
- `bloqueado`

## Bloco 1. Base documental

### 1.1 Criar plano principal de migracao

- status: `concluido`
- arquivo: `PLANO_MIGRACAO_INFRASTUDIO_V2.md`
- criterio de aceite:
  - existir documento de estrategia
  - conter fases
  - conter direcao de publico, app e admin

### 1.2 Criar documento de realidade do legado

- status: `concluido`
- arquivo: `REALIDADE_LEGADO_INFRASTUDIO.md`
- criterio de aceite:
  - descrever auth, chat, handoff, billing, WhatsApp e demo

### 1.3 Criar documento de realidade do v2

- status: `concluido`
- arquivo: `REALIDADE_ATUAL_V2.md`
- criterio de aceite:
  - descrever mock, estrutura atual e limites do v2

### 1.4 Criar checklist operacional

- status: `concluido`
- arquivo: `CHECKLIST_EXECUCAO_MIGRACAO.md`
- criterio de aceite:
  - existir lista executavel por etapa

## Bloco 2. Fechamento do mock estrategico

### 2.1 Finalizar mock da area logada atual

- status: `em andamento`
- foco:
  - estabilizar `mock01`
  - evitar espalhar componentes sem destino
- criterio de aceite:
  - mock atual refletir a experiencia desejada do usuario logado

### 2.2 Finalizar mock de atendimento

- status: `pendente`
- foco:
  - construir a tela de atendimento no mock
  - usar componentes e padrao do `v2`
  - espelhar a intencao funcional da inbox/chat do legado
- criterio de aceite:
  - existir fluxo visual coerente de lista de conversas + feed + composer + acoes

### 2.3 Preservar `mock01` como referencia

- status: `pendente`
- regra:
  - nao desmontar o mock
  - nao mover o mock cegamente
  - manter como referencia ate a area real nascer
- criterio de aceite:
  - decisao respeitada durante as proximas implementacoes

## Bloco 3. Definicao da arvore final do v2

### 3.1 Definir rotas finais do produto

- status: `pendente`
- alvo:
  - publico
  - app logado
  - admin
- estrutura recomendada:
  - `backend/app/...`
  - `backend/app/app/...`
  - `backend/app/admin/...`
- criterio de aceite:
  - arvore final escolhida antes da copia do mock

### 3.2 Definir destino de componentes por ambiente

- status: `pendente`
- estrutura desejada:
  - `backend/components/public/...`
  - `backend/components/app/...`
  - `backend/components/admin/...`
  - `backend/components/ui/...`
- criterio de aceite:
  - ficar claro onde cada nova tela deve nascer

## Bloco 4. Infra base do v2

### 4.1 Preparar `.env.local` do v2 com base no legado

- status: `pendente`
- foco:
  - reaproveitar envs necessarias
  - manter compatibilidade com banco e servicos existentes
- criterio de aceite:
  - `v2` subir com env valida

### 4.2 Conectar o v2 ao banco atual

- status: `pendente`
- foco:
  - usar o mesmo banco do legado
  - sem alterar comportamento funcional neste momento
- criterio de aceite:
  - leitura real de dados no `v2`

### 4.3 Definir adaptacao com worker WhatsApp

- status: `pendente`
- regra:
  - worker deve continuar praticamente intacto
  - app `v2` deve se adaptar ao contrato atual
- criterio de aceite:
  - contrato mapeado

## Bloco 5. Auth no v2

### 5.1 Migrar base de auth

- status: `pendente`
- foco:
  - login
  - logout
  - sessao atual
  - usuario autenticado
- criterio de aceite:
  - usuario autenticado reconhecido no `v2`

### 5.2 Criar guards de rota

- status: `pendente`
- foco:
  - separar publico
  - separar app logado
  - separar admin
- criterio de aceite:
  - rotas protegidas por papel e sessao

### 5.3 Reproduzir papeis necessarios

- status: `pendente`
- foco:
  - `admin`
  - `viewer`
- criterio de aceite:
  - area admin e area do usuario funcionando com controle correto

## Bloco 6. Copia do mock para o lugar certo

### 6.1 Copiar a base do mock da area logada

- status: `pendente`
- regra:
  - copiar, nao destruir
  - preservar `mock01`
  - criar a versao real no lugar certo
- destino esperado:
  - `backend/app/app/...`
  - `backend/components/app/...`
- criterio de aceite:
  - area logada real nascer sem depender da rota `mock01`

### 6.2 Ajustar naming e estrutura da copia

- status: `pendente`
- foco:
  - remover nome `mock`
  - adequar componentes ao novo destino
- criterio de aceite:
  - componentes da area logada passarem a refletir o destino real

## Bloco 7. Projetos e agentes reais

### 7.1 Ligar listagem de projetos a dados reais

- status: `pendente`
- criterio de aceite:
  - lista puxar projetos reais do banco

### 7.2 Ligar detalhe do projeto a dados reais

- status: `pendente`
- criterio de aceite:
  - tela abrir projeto real

### 7.3 Ligar gestao de agentes

- status: `pendente`
- criterio de aceite:
  - editar e visualizar agente real

### 7.4 Ligar APIs do projeto/agente

- status: `pendente`
- criterio de aceite:
  - dados reais de APIs disponiveis na tela

## Bloco 8. Atendimento, chat e handoff

### 8.1 Migrar contrato principal do chat

- status: `pendente`
- foco:
  - `POST /api/chat`
  - configuracao do widget
  - resolucao de projeto/agente
- criterio de aceite:
  - chat do site falar com o `v2`

### 8.2 Migrar persistencia de mensagens e chats

- status: `pendente`
- criterio de aceite:
  - historico e feed reais no `v2`

### 8.3 Migrar handoff

- status: `pendente`
- criterio de aceite:
  - assumir atendimento
  - liberar para IA
  - estados corretos

### 8.4 Migrar tela real de atendimento

- status: `pendente`
- dependencia:
  - mock de atendimento concluido
  - contratos reais de chat definidos
- criterio de aceite:
  - tela operacional no `v2`

## Bloco 9. WhatsApp

### 9.1 Mapear endpoints e contratos com o worker

- status: `pendente`
- criterio de aceite:
  - payloads documentados

### 9.2 Ligar status e sessao de WhatsApp ao v2

- status: `pendente`
- criterio de aceite:
  - visualizacao de estado real do canal

### 9.3 Ligar mensagens do WhatsApp ao pipeline unico

- status: `pendente`
- criterio de aceite:
  - WhatsApp usando o mesmo cerebro do chat

## Bloco 10. Admin real

### 10.1 Estruturar rota admin no v2

- status: `pendente`
- criterio de aceite:
  - layout admin definido

### 10.2 Migrar projetos admin

- status: `pendente`
- criterio de aceite:
  - admin consegue operar projetos reais

### 10.3 Migrar atendimento admin

- status: `pendente`
- criterio de aceite:
  - inbox/admin operacional no `v2`

### 10.4 Migrar chat logs

- status: `pendente`
- criterio de aceite:
  - diagnostico basico funcionando

### 10.5 Migrar planos e billing admin

- status: `pendente`
- criterio de aceite:
  - leitura e operacao de billing no `v2`

## Bloco 11. Demo

### 11.1 Mapear regras demo do legado

- status: `pendente`
- base:
  - `DEMO_MODE_TECHNICAL_SPEC.md`
- criterio de aceite:
  - regras claras para implementar sem chute

### 11.2 Reintroduzir demo no v2

- status: `pendente`
- dependencia:
  - auth
  - projetos
  - agentes
  - widgets
- criterio de aceite:
  - demo funcional sem contaminar fluxo real

## Bloco 12. Refino e limpeza

### 12.1 Revisar componentes extraidos

- status: `pendente`
- criterio de aceite:
  - reducao de arquivos monoliticos

### 12.2 Revisar naming e pastas

- status: `pendente`
- criterio de aceite:
  - estrutura refletir o produto final

### 12.3 Decidir futuro do `mock01`

- status: `pendente`
- opcoes:
  - manter como laboratorio
  - reduzir
  - remover
- criterio de aceite:
  - decisao tomada depois da area real estabilizar

## Regras operacionais durante a execucao

- nao pular auth e ir direto para tela real
- nao ligar dado real em rota de mock temporaria
- nao quebrar o worker do WhatsApp
- nao espalhar a migracao entre `backend` e `frontend` sem necessidade
- nao duplicar regra do legado se puder adaptar a mesma logica

## Proxima prioridade sugerida

Se a execucao continuar na ordem mais segura, o proximo foco e:

1. terminar o mock de atendimento
2. definir arvore final `publico`, `app`, `admin`
3. preparar auth do `v2`
4. copiar o mock da area logada para a rota real
