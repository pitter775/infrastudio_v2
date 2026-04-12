# Melhorias


# Prompt Codex — Regras e Melhorias InfraStudio

## 🎯 Objetivo

Organizar instruções claras para o Codex executar sem se perder.

---

## ⚠️ REGRAS GERAIS (NUNCA QUEBRAR)

* Projeto: `infrastudio_v2`
* NÃO criar estrutura paralela
* NÃO duplicar componentes
* NÃO importar nada do legado direto
* SEMPRE reaproveitar o que já existe
* Código simples, direto e funcional
* Alterar somente o necessário

---

## 🐞 BUGS

### 1. Arrastar do chat

* NÃO aplicar drag no container inteiro
* Aplicar drag APENAS no cabeçalho do chat

### 2. Chat de teste sem widget

Problema atual:

```
Chat publico sem projeto/agente valido
```

Solução:

* Ao criar um agente
* Criar automaticamente um `chatWidget` padrão
* Garantir que sempre exista um widget válido

---

## 🚀 CRIAÇÃO DE AGENTES (FLUXO CORRETO)

### ⚠️ Importante

Se o projeto NÃO tiver agente:

### Passo 1 — Modal inicial

* Abrir modal
* Perguntar:

  * Sobre o negócio
  * URL do site (opcional)

### Passo 2 — Criação automática

Ao salvar:

* Criar agente automaticamente
* Criar chatWidget padrão
* Buscar dados da URL (se existir)
* salva o logotipo encontrado na url 
* Gerar resumo com base em:

  * conteúdo da URL
  * texto digitado pelo usuário

### Passo 3 — Fluxo de tela

* Fechar modal automaticamente
* Abrir tela padrão de agente (fluxo atual)

---

## 🧠 MELHORIA DO RESUMO (IA)

Problema:

* Resumo atual superficial

Melhoria:

* Tornar mais completo
* Incluir:

  * Contato
  * Pessoas
  * Informações institucionais

### UX

* Adicionar ícones
* Melhorar visual para facilitar entendimento
* Mostrar ao usuário como melhorar o texto

---

## 📍 AJUSTES DE UI

* Mover botão "Histórico" para segunda posição
* "Observabilidade":

  * adicionar tag: "Em desenvolvimento"

---

## 📲 WHATSAPP (AGENTE PRODUTO)

### Objetivo

Reaproveitar inteligência do legado

---

### 1. Base

* Analisar legado
* Extrair lógica funcional
* Adaptar para padrão atual (v2)

---

### 2. Estrutura do Sheet WhatsApp

Manter apenas estas abas:

#### 1. Conectar

* Passos de conexão
* QR Code

#### 2. Atendentes

* CRUD completo
* Lista de atendentes

#### 3. Tutorial

* Guia de uso

---

### 3. Regras

* NÃO copiar código direto
* Recriar no padrão atual
* Reaproveitar lógica
* Melhorar UX onde possível

---

## 🧠 RESUMO FINAL

* Resolver bugs do chat
* Melhorar fluxo de criação de agentes
* Tornar IA mais completa
* Ajustar UI
* Evoluir WhatsApp com base no legado

---

## 🎯 INSTRUÇÃO FINAL PARA O CODEX

```
Siga todas as regras acima.

Prioridade:
1. Corrigir bugs
2. Ajustar fluxo de criação de agente
3. Melhorar resumo com IA
4. Ajustar UI
5. Evoluir módulo WhatsApp

Sempre:
- Usar código existente
- Não reinventar
- Não criar estrutura nova desnecessária
- Manter padrão do projeto
```

---

**Status:** pronto para execução no Codex 🚀


============================================================================================================================================



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




------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------




# Guia Único — Deploy Monorepo InfraStudio (Vercel + Codex)

## 🎯 Objetivo

Ter um fluxo simples e previsível onde:

* você altera código → `git push`
* Vercel faz deploy automático
* frontend e backend ficam independentes
* Codex ajuda só no código (não no deploy)

---

## 🧱 Estrutura do Projeto

```
/backend   → API (Node)
/frontend  → Next.js (UI)
```

---

## ☁️ Configuração na Vercel (PASSO A PASSO)

### 1) Criar DOIS projetos na Vercel (mesmo repo)

#### 🔹 Projeto 1 — Backend

* Nome: `infrastudio-backend`
* Repo: `pitter775/infrastudio_v2`
* Root Directory: `backend`
* Framework Preset: `Other`

#### 🔹 Projeto 2 — Frontend

* Nome: `infrastudio-frontend`
* Repo: `pitter775/infrastudio_v2`
* Root Directory: `frontend`
* Framework Preset: `Next.js`

---

### 2) Ajuste de dependências (React 19 x react-quill)

Criar arquivo:

```
/frontend/vercel.json
```

Conteúdo:

```json
{
  "installCommand": "npm install --legacy-peer-deps"
}
```

> Isso evita erro de peer deps no build.

---

### 3) Variáveis de Ambiente (exemplo)

No projeto **frontend**:

* `NEXT_PUBLIC_API_URL=https://<url-do-backend>`

No projeto **backend**:

* variáveis internas que sua API precisar (se houver)

---

## 🚀 Fluxo de Deploy (o que acontece na prática)

### 👨‍💻 Você (VSCode)

```bash
git add .
git commit -m "feat: ajuste no chat"
git push
```

### ☁️ Vercel (automático)

* Detecta o push
* Dispara **2 builds independentes**:

#### 📦 Backend

* entra em `/backend`
* `npm install`
* build (se existir)
* publica API

#### 🌐 Frontend

* entra em `/frontend`
* `npm install --legacy-peer-deps`
* `next build`
* publica UI

> Mesmo com 1 push, são 2 deploys separados.

---

## 🔗 Integração Frontend ↔ Backend

No frontend (exemplo):

```ts
fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
  method: 'POST',
  body: JSON.stringify({ mensagem: 'teste' })
})
```

---

## 🤖 Papel do Codex

* Gera/edita código (frontend e backend)
* Mantém padrão do projeto
* NÃO configura Vercel
* NÃO decide deploy

---

## 🧾 Prompt Padrão para o Codex

Use sempre que for pedir mudanças grandes:

```
Você está trabalhando no projeto infrastudio_v2.

Contexto:
- Monorepo com duas pastas:
  /backend (API Node)
  /frontend (Next.js)
- Não criar estrutura paralela
- Não duplicar componentes
- Não importar nada do legado C:\Projetos\infrastudio

Objetivo:
[DESCREVA AQUI O QUE QUER FAZER]

Regras:
- Se for UI → alterar apenas /frontend
- Se for lógica/API → alterar apenas /backend
- Se precisar comunicação → usar NEXT_PUBLIC_API_URL no frontend
- Código simples, direto e funcional
- Evitar libs desnecessárias
- Manter padrão já existente no projeto

Entrega:
- Código pronto para commit
- Sem explicações longas
```

---

## ⚠️ Problemas Comuns (e solução)

### ❌ "No Next.js version detected"

➡ Root Directory errado (não está em `frontend`)

### ❌ `ERESOLVE unable to resolve dependency tree`

➡ usar `--legacy-peer-deps` no frontend

### ❌ Build rodando no lugar errado

➡ revisar Root Directory na Vercel

---

## 🧠 Resumo

* 1 repo → 2 projetos na Vercel
* cada projeto aponta para uma pasta
* `git push` → múltiplos deploys
* frontend e backend independentes
* Codex só cuida do código

---

## ✅ Checklist Rápido

* [ ] Projeto backend criado (root: backend)
* [ ] Projeto frontend criado (root: frontend)
* [ ] `/frontend/vercel.json` com legacy-peer-deps
* [ ] `NEXT_PUBLIC_API_URL` configurado
* [ ] Teste de deploy com `git push`

---

**Status:** pronto para uso 🚀
