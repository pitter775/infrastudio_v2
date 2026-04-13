# InfraStudio V2 - plano geral de execucao com minimo de token

## objetivo

Aplicar os ajustes de UI, navegacao e reorganizacao dos sheets no `infrastudio_v2`, reaproveitando a inteligencia ja documentada do legado, mas sem importar nada do projeto antigo e sem criar estrutura paralela sem ficar abrindo o legado para comparar.

Este arquivo serve como guia unico para o Codex executar por partes, com baixo custo de token e sem reanalisar o legado a cada tarefa.

---

## regra principal de economia de token

Nao releia o legado inteiro a cada passo.

Considere este arquivo como fonte principal da tarefa.
Use os arquivos ja documentados do projeto que estao na raiz do v2 apenas como referencia pontual quando a etapa pedir:
- `AGENTS.md`
- `ABA_APIS.md`
- `ABA_WHATSAPP.md`
- `ABA_CHAT_WIDGET.md`
- `ABA_MERCADO_LIVRE.md`

Objetivo:
- evitar leitura repetida
- evitar planejamento amplo demais
- executar uma etapa por vez
- validar localmente cada etapa antes de seguir

---

## regras fixas que nunca podem ser quebradas

- este projeto e o `infrastudio_v2`
- nao criar estrutura paralela
- nao duplicar componente, utilitario ou fluxo existente
- nao reintroduzir imports do legado `C:\Projetos\infrastudio`
- usar padroes, rotas, auth, componentes e estrutura atuais do v2
- se precisar reaproveitar inteligencia do legado, portar a regra, nao copiar a estrutura antiga
- nao fazer push sem pedido do usuario
- ao concluir algo que estava em backlog, remover do arquivo de melhorias correspondente se isso ja fizer parte do fluxo atual do projeto

---

## estrategia de execucao

Executar em fases curtas.

Cada fase deve:
1. localizar apenas os arquivos necessarios
2. implementar apenas o escopo da fase
3. validar sem expandir para outras areas
4. parar ao concluir a fase

Nao tentar resolver tudo em uma unica chamada.

---

## ordem ideal de implementacao

### fase 1 - ajustes rapidos de UI e comportamento base
Objetivo: corrigir o que e pequeno, visivel e barato.

Itens:
- corrigir o visual do estado logado de um usuario comum da v2 para herdar o comportamento e a identidade visual do usuario logado como admin
- remover do menu principal da home o botao `Solicitar Orcamento`
- na tela de edicao do agente, aba `Ver JSON`, deixar apenas um scroll

Criterio de pronto:
- home logada consistente com o legado
- botao removido
- aba JSON sem scroll duplicado

---

### fase 2 - URLs unicas por aba do sheet do agente
Objetivo: melhorar navegacao e linkagem.

Itens:
- cada aba do sheet do agente deve ter URL unica
- usar query param simples, exemplo:
  - `?tab=conexao`
  - `?tab=json`
  - `?tab=apis`
- ao abrir o sheet com URL especifica, a aba correta deve abrir automaticamente
- ao trocar de aba, a URL deve atualizar

Criterio de pronto:
- qualquer aba relevante do sheet pode ser aberta diretamente por link
- refresh nao perde a aba atual

---

### fase 3 - aba conexao com icones e deep link
Objetivo: transformar a aba conexao em hub navegavel.

Itens:
- adicionar icones visuais para os tipos de conexao listados
- cada item listado deve levar para a tela exata de edicao correspondente
- se clicar em API, abrir a API correta
- se clicar em canal, abrir o canal correto
- se clicar em widget ou conector, abrir o item correto
- manter contexto de projeto/agente
- aproveitar as URLs unicas criadas na fase 2

Criterio de pronto:
- a aba conexao nao e so listagem, ela navega para o item exato
- o link cai direto no ponto correto do outro sheet

---

### fase 4 - reorganizacao do sheet de APIs
Objetivo: mudar a experiencia da aba sem perder a inteligencia existente.

Comportamento esperado:
- ao abrir o sheet de APIs, nao mostrar abas imediatamente
- mostrar apenas:
  - lista de APIs cadastradas
  - botao `Criar API`

Ao clicar em uma API existente ou em `Criar API`:
- trocar o conteudo do sheet
- exibir abas:
  - `Criar/Editar`
  - `JSON`
  - `Testar`

#### aba criar/editar
Campos:
- nome
- url GET
- descricao
- ativo ou nao com toggle

#### aba JSON
Exibir:
- configuracao JSON
- abaixo: exemplo JSON de valores / retorno

#### aba Testar
Exibir:
- apenas um botao `Testar`
- abaixo: resposta do teste em JSON

Regras:
- manter metodo GET
- manter inteligencia atual de teste, deteccao de parametros e campos
- manter fluxo atual do v2
- apenas reorganizar a experiencia conforme acima

Criterio de pronto:
- entrada da aba sem tabs iniciais
- tabs so aparecem ao entrar numa API ou ao criar nova
- teste continua funcionando
- JSON continua visivel e util

---

### fase 5 - reorganizacao do sheet do WhatsApp
Objetivo: organizar o que ja abre hoje dentro das abas corretas.

Ao abrir o sheet do WhatsApp, exibir abas:
- `Conectar`
- `Atendentes`
- `Tutorial`

Regras:
- reorganizar o conteudo ja existente nas abas corretas
- manter a logica do canal principal
- manter fluxo de conectar / gerar QR / desconectar
- manter fluxo de atendentes / handoff
- manter tutorial como area separada

Criterio de pronto:
- tudo do WhatsApp fica dentro dessas 3 abas
- sem conteudo solto fora do cabecalho do sheet
- sem quebrar o fluxo atual de conexao

---

### fase 6 - reorganizacao do sheet do Mercado Livre
Objetivo: simplificar a experiencia e reaproveitar a inteligencia existente.

Ao abrir o sheet do Mercado Livre, exibir apenas:
- `Conexao`
- `Tutorial`

#### aba Conexao
Se nao houver conexao:
- mostrar apenas o botao `Cadastrar loja Mercado Livre`

Fluxo da aba conexao em 2 etapas:

##### etapa 1 - descobrir loja
Campo:
- input onde o usuario informa qualquer produto cadastrado da loja

Ao avancar:
- tentar localizar a conta automaticamente usando a inteligencia ja usada no legado
- se der certo, preencher automaticamente os dados encontrados
- se der erro, permitir seguir manualmente mesmo assim

##### etapa 2 - criar ou editar conexao
Campos:
- nome da conexao
- app id do Mercado Livre
- client secret do Mercado Livre
- seed_id ou identificador equivalente manual quando nao vier automatico

Regras:
- manter a inteligencia de resolve do legado
- nao travar o fluxo se a resolucao automatica falhar
- tutorial fica separado na aba propria
- como no legado, manter apenas uma conexao Mercado Livre por projeto

Criterio de pronto:
- fluxo claro em 2 etapas
- usuario consegue seguir mesmo sem autopreenchimento
- tutorial separado

---

### fase 7 - reorganizacao do sheet do Chat Widget
Objetivo: adaptar o widget unico ao fluxo correto.

Regras base:
- widget e unico
- nao existe botao de criar novo
- ele ja deve existir assim que um novo projeto for criado

Abas do sheet:
- `Editar`
- `Ver codigo fonte`
- `Documentacao`

#### aba Editar
Campos:
- nome do widget
- slugpublico
- dominio ou contexto
- whatsapp
- tema
- cor principal
- fundo transparente com toggle

Regras:
- reaproveitar toda a inteligencia ja existente
- manter snippet / codigo fonte separado na aba propria
- manter documentacao separada

Criterio de pronto:
- sheet do widget trabalha como editor de item unico
- sem fluxo de lista e sem criar novo manualmente
- codigo e documentacao em abas proprias

---

## observacoes importantes por area

### APIs
- manter comportamento baseado na documentacao existente
- manter GET como metodo unico
- manter teste, deteccao de parametros por URL e deteccao de campos
- a mudanca principal e de experiencia e organizacao visual

### WhatsApp
- manter canal principal
- manter worker externo e fluxo atual do v2
- manter criar, conectar, gerar QR, desconectar e handoff
- a mudanca principal e organizacao em abas corretas

### Mercado Livre
- manter apenas uma conexao por projeto
- manter inteligencia de resolver loja por URL de produto
- permitir fluxo manual quando a deteccao falhar
- a mudanca principal e UX em 2 etapas + abas claras

### Chat Widget
- manter widget vinculado ao projeto/agente atual
- tratar como item unico do projeto
- a mudanca principal e UX do sheet e separacao entre editar / codigo / documentacao

---

## como executar com baixo token

### regra de trabalho
Sempre trabalhar em uma fase por vez.

### formato de entrega por fase
Ao final de cada fase, responder apenas com:
- arquivos alterados
- resumo curto do que mudou
- validacao feita
- pendencias reais, se houver

### evitar
- nao fazer refactor amplo sem necessidade
- nao reescrever telas inteiras se bastar reorganizar containers e tabs
- nao abrir arquivos fora do escopo da fase
- nao ficar comparando legado x v2 o tempo todo

---

## prompts curtos sugeridos para execucao por fase

### prompt fase 1
Corrija apenas os ajustes rapidos de UI no `infrastudio_v2`: estado logado da home seguindo o legado, remocao do botao `Solicitar Orcamento` e remocao do scroll duplicado na aba `Ver JSON` do sheet do agente. Nao mexa em outras areas.

### prompt fase 2
Implemente URL unica por aba no sheet do agente usando query param simples. A aba deve abrir pelo link e persistir no refresh. Nao altere outras logicas.

### prompt fase 3
Na aba `Conexao` do agente, adicione icones e linkagem direta para o item exato de API, canal, widget ou conector, aproveitando as URLs unicas das abas. Mantenha contexto de projeto/agente.

### prompt fase 4
Reorganize o sheet de APIs: entrada com lista + botao `Criar API`; tabs so aparecem ao abrir uma API ou criar nova; tabs `Criar/Editar`, `JSON`, `Testar`. Preserve a inteligencia atual.

### prompt fase 5
Reorganize o sheet do WhatsApp nas abas `Conectar`, `Atendentes` e `Tutorial`, apenas organizando o conteudo atual nos lugares corretos sem quebrar os fluxos existentes.

### prompt fase 6
Reorganize o sheet do Mercado Livre com abas `Conexao` e `Tutorial`. Na aba conexao, criar fluxo em 2 etapas com tentativa de resolver loja por produto e fallback manual caso falhe.

### prompt fase 7
Reorganize o sheet do Chat Widget para tratar widget unico com abas `Editar`, `Ver codigo fonte` e `Documentacao`, sem fluxo de criar novo manualmente.

---

## criterio final de aceite

O trabalho sera considerado concluido quando:
- a home logada estiver consistente com o legado
- o menu principal estiver limpo
- o sheet do agente suportar link direto por aba
- a aba conexao navegar direto para os itens corretos
- APIs, WhatsApp, Mercado Livre e Chat Widget estiverem organizados conforme este plano
- toda a implementacao estiver no padrao do `infrastudio_v2`, sem importar nada do legado

---

## ordem de uso recomendada no Codex

1. usar este arquivo como guia principal
2. executar uma fase por vez
3. validar
4. so depois ir para a proxima

Nao tentar resolver as 7 fases em uma unica execucao.