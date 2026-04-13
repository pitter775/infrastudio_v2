# Ajustes e Melhorias - InfraStudio V2

## 1. Bugs / Correções Visuais

- Corrigir layout quando usuário está logado  
  → visual atual está fora da identidade visual  
  → deve seguir padrão do legado

- Remover da home (menu principal) o botão:
  - "Solicitar Orçamento"

- Estado logado da home (v2):
  → deve herdar exatamente o comportamento do legado  
  (mesma lógica + mesma exibição)

- Tela de edição do agente (Sheet → aba JSON):
  → existe scroll duplicado  
  → manter apenas UM scroll


---

## 2. Melhorias de Navegação

- Cada aba do Sheet do agente deve ter URL única  
  Exemplo:
  - `?tab=json`
  - `?tab=conexao`

  Objetivo:
  → facilitar link direto

- Aba "Conexão":
  - adicionar ícones para cada tipo (API, WhatsApp, etc)
  - ao clicar → navegar direto para o item correspondente

  Exemplos:
  - clicar API → abrir edição da API
  - clicar canal → abrir config do canal

  → sempre manter contexto de projeto/agente


---

## 3. Sheet de API (Reorganização)

### Estado Inicial

- NÃO mostrar abas
- Mostrar apenas:
  - lista de APIs cadastradas
  - botão "Criar API"


### Ao clicar em API ou criar nova

Substituir conteúdo do sheet por abas:

- criar/editar
- json
- testar


### Aba: Criar / Editar

Campos:
- nome
- url (GET)
- descrição
- ativo (toggle liga/desliga)


### Aba: JSON

- exibir configuração JSON
- abaixo: exemplo de retorno JSON


### Aba: Testar

- botão "Testar"
- abaixo: resposta da API em JSON


---

## 4. Sheet WhatsApp (Organização)

Abas:
- conectar
- atendentes
- tutorial

Ação:
→ reorganizar conteúdos atuais dentro dessas abas  
→ não alterar lógica, apenas layout


---

## 5. Sheet Mercado Livre (Organização)

Abas:
- conexão
- tutorial


### Aba: Conexão

#### Caso NÃO conectado

Botão:
- "Cadastrar loja Mercado Livre"


### Fluxo em 2 etapas

#### Etapa 1

- input para identificar loja
- usuário cola link de produto
- sistema tenta identificar automaticamente

Observação:
- reutilizar lógica do legado
- se falhar → permitir preenchimento manual


#### Etapa 2

Formulário:
- nome da conexão
- app_id
- client_secret
- seed_id (caso não venha automático)

→ reaproveitar inteligência do legado


### Aba: Tutorial

- reutilizar conteúdo do legado


---

## 6. Sheet Chat Widget (Organização)

Observação:
- widget é único (não existe criar novo)
- já deve existir ao criar projeto

Abas:
- editar
- ver código fonte
- documentação


### Aba: Editar

Campos:
- nome do widget
- slug_publico
- domínio/contexto
- whatsapp
- tema
- cor principal
- fundo transparente (toggle)

→ reaproveitar lógica do legado


---

## 7. Observações Gerais

- reaproveitar ao máximo lógica do legado
- manter consistência visual
- evitar duplicação de scroll, estado ou layout
- manter experiência simples e direta