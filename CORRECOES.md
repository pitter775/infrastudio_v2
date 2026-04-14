# 📄 InfraStudio V2 — Fase 1 (Mock/UI)

## 🎯 Objetivo

Construir todas as telas e fluxos visuais completos, sem lógica pesada.

IMPORTANTE:

- não integrar IA
- não integrar billing real
- não integrar WhatsApp real
- não usar legado

Objetivo final:
deixar todas as telas prontas visualmente e navegáveis

---

# 🏠 HOME

## Ajustes

- remover seção “próximo nível”
- adicionar imagem de banner no topo
- ajustar textos da home
- remover botão “falar com especialista”
- adicionar telefone no header

---

## Header

- corrigir bug: botão login some em algumas resoluções
- adicionar ícone no botão “entrar”
- adicionar loading no lugar do ícone ao logar

### Estado logado

- trocar “Entrar” → “Meus Projetos” (verde)
- após login → redirecionar direto para `/app/projetos`

---

## Botões

- alterar “Testar agora sem cadastro” → “Testar grátis”

### Planos

- ao clicar em plano → abrir tela de cadastro + pagamento

---

# 💬 CHAT WIDGET

- adicionar logo no chat
- manter padrão visual do sistema
- usar mesmo design do chat de teste

---

# 📊 ADMIN / PROJETOS

## Geral

- ajustar responsividade mobile
- evitar sobreposição:
  - menu
  - box do agente

---

## Mobile (CRÍTICO)

- botão fechar do sheet não aparece
- título do sheet não aparece
- layout do agente colado no topo → adicionar espaçamento

---

# 🤖 AGENTE (SHEET)

## Layout

- remover scroll duplicado
- padronizar layout

---

## Anexos

- mostrar apenas se houver conexão
- hoje sempre mostra 3 → tornar dinâmico

---

## JSON

- revisar funcionamento
- criar modelos melhores de JSON
- validar como configs estão no banco

---

# 🔗 CONEXÕES / ATENDIMENTO

## Atendimento

- adicionar mídias do contato como sheet

### Chat

- corrigir balões:
  - aceitar formatação
- corrigir anexos

---

## WhatsApp

Adicionar toggle:

[ ] responder contatos já cadastrados

Comportamento:

- desligado → responde apenas novos contatos

---

## Testes

- testar conversa WhatsApp
- testar envio de anexos
- testar integração API

---

# 🛒 LOJA (MERCADO LIVRE)

## UI

- criar tela da loja
- adicionar link da loja
- vincular com agente

---

## Ajustes

- resolver captura do seller_id
- corrigir link de produto

---

# 💰 PAGAMENTO / PLANOS

## UI

- criar tela de pagamento
- definir modo free

---

## Funcionalidades

- opção de comprar créditos
- alerta de créditos acabando via WhatsApp

---

## BUG (não corrigir agora)

- billing não está funcionando:
  - não conta tokens
  - não conta custo
  - não separa por projeto

(ignorar por enquanto - apenas mock)

---

# 📣 LANDING PAGES

Criar páginas:

- WhatsApp
- Chat Widget
- Mercado Livre

---

# 📱 MOBILE

- validar TODAS as telas no celular

Corrigir:

- sobreposição
- botões invisíveis
- espaçamentos

---

# 🧪 TESTES

- testar consistência geral
- testar travamentos
- validar fluxo completo sem IA

---

# 👤 USUÁRIO

- adicionar foto de perfil:
  - login social
  - upload manual

---

# 📢 FEEDBACK / NOTIFICAÇÕES

- quando cliente enviar feedback:
  - avisar admin via WhatsApp

---

# 🧪 DEMOS

Adicionar demos:

- nexo
- demandas

---

# 🧠 FORA DO MOCK (FASE FUTURA)

NÃO fazer agora:

- marketing da InfraStudio
- IA / heurísticas
- runtime do chat
- billing real