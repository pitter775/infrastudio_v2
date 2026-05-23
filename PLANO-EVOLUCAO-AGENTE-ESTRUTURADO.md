# Plano de evolucao do agente estruturado

Este documento organiza a evolucao do agente para sair de um prompt gigante como fonte principal e passar a usar uma estrutura revisavel, modular e mais confiavel.

Objetivo: permitir que cada cliente crie agentes muito diferentes entre si, sem prender o runtime a texto livre longo em toda conversa.

## Principios

- O texto livre do cliente deve ser entrada de configuracao, nao a fonte principal do atendimento.
- O sistema deve transformar texto livre em estrutura, base de conhecimento e regras editaveis.
- O LLM pode organizar e sugerir, mas a aplicacao deve validar antes de ativar.
- Dados factuais importantes precisam virar campos estruturados sempre que possivel.
- Textos longos, politicas, manuais e documentos devem ir para base de conhecimento segmentada.
- O prompt final usado no atendimento deve ser curto, montado a partir da estrutura ativa.
- O texto original deve ser preservado para auditoria, reprocessamento e comparacao.

## Ordem de desenvolvimento

### 1. Documento e contrato da nova estrutura

- [x] Definir schema base do agente estruturado.
- [x] Definir campos obrigatorios e opcionais.
- [x] Definir versao da estrutura, exemplo: `structuredConfigVersion`.
- [x] Definir compatibilidade com `runtimeConfig` atual.
- [x] Definir como o prompt antigo continua funcionando durante a migracao.

Estrutura base sugerida:

```json
{
  "identity": {
    "name": "string",
    "role": "string",
    "businessName": "string"
  },
  "behavior": {
    "tone": "string",
    "rules": ["string"],
    "avoid": ["string"]
  },
  "capabilities": ["string"],
  "pricingCatalog": {
    "enabled": true,
    "items": []
  },
  "marketplace": {},
  "integrations": {},
  "handoff": {},
  "knowledgeBase": [],
  "source": {
    "originalText": "string",
    "lastStructuredAt": "datetime"
  }
}
```

### 2. Classificador do texto inicial

- [x] Criar funcao backend para analisar o texto livre inicial.
- [x] Detectar o tipo principal do agente.
- [x] Detectar quais modulos devem ser usados.
- [x] Retornar confianca por modulo.
- [x] Nunca aplicar direto sem validacao.

Tipos iniciais sugeridos:

- [x] `business_support_agent`
- [x] `pricing_catalog`
- [x] `product_catalog`
- [x] `policy_document`
- [x] `faq`
- [x] `appointment_agent`
- [ ] `real_estate_agent`
- [ ] `restaurant_agent`
- [ ] `technical_support`
- [x] `lead_capture`
- [x] `generic_knowledge`

### 3. Extracao estruturada com LLM

- [x] Criar `extractAgentStructuredConfigFromText(text, currentConfig?)`.
- [x] Usar schema rigido para resposta JSON.
- [x] Extrair identidade, comportamento, regras e capacidades.
- [x] Extrair planos, precos, creditos e limites.
- [x] Extrair integracoes citadas.
- [x] Extrair regras de atendimento humano.
- [x] Separar conteudo factual de texto longo.
- [x] Retornar warnings quando houver ambiguidade.
- [x] Retornar confidence por secao.

Campos importantes para planos:

- [x] `slug`
- [x] `name`
- [x] `priceLabel`
- [x] `creditLimit`
- [x] `attendanceLimit`
- [x] `agentLimit`
- [x] `marketplaceProductLimit`
- [x] `whatsappIncluded`
- [x] `supportLevel`
- [x] `features`
- [x] `channels`

### 4. Draft antes de ativar

- [x] Salvar resultado como rascunho, nao como configuracao ativa.
- [x] Criar campo/registro para `draftStructuredConfig`.
- [ ] Mostrar diferencas entre configuracao atual e proposta.
- [x] Permitir confirmar, editar ou descartar.
- [x] Permitir "resetar e importar tudo de novo".
- [x] Permitir "atualizar estrutura existente".

Modos:

- [x] Criar do zero.
- [x] Atualizar estrutura existente.
- [x] Analisar sem aplicar.

### 5. Base de conhecimento

- [x] Criar modelo para textos longos do agente.
- [x] Dividir textos longos em blocos.
- [x] Gerar titulo, tags e tipo de conteudo por bloco.
- [x] Diferenciar politica, FAQ, manual, termos, procedimento e informativo.
- [ ] Usar busca textual/semantica para recuperar apenas blocos relevantes.
- [ ] Evitar enviar toda a base de conhecimento em toda conversa.

Formato sugerido:

```json
{
  "title": "Politica de reembolso",
  "content": "string",
  "tags": ["financeiro", "reembolso"],
  "contentType": "policy",
  "confidence": 0.9
}
```

### 6. Mercado Livre como modulo estruturado

- [x] Criar estrutura especifica para Mercado Livre.
- [x] Separar configuracao do conector de comportamento do agente.
- [x] Registrar limite de produtos por plano.
- [x] Registrar politica de link externo.
- [x] Registrar se loja publica, produto publico, pedidos e perguntas estao ativos.
- [x] Garantir que produtos venham do catalogo/API, nao do prompt.

Estrutura sugerida:

```json
{
  "marketplace": {
    "mercadoLivre": {
      "enabled": true,
      "publicStore": true,
      "productPages": true,
      "contextualChat": true,
      "ordersLookup": true,
      "questionsPanel": true,
      "externalLinkPolicy": "only_when_requested",
      "productLimitByPlan": {
        "free": 10,
        "basic": 50,
        "plus": 200,
        "pro": "unlimited"
      }
    }
  }
}
```

### 7. Runtime usando estrutura ativa

- [x] Montar prompt final pequeno a partir da estrutura.
- [x] Priorizar campos estruturados para perguntas factuais.
- [x] Usar base de conhecimento apenas quando necessaria.
- [x] Manter guardrails do sistema acima da estrutura do cliente.
- [x] Registrar diagnostico de qual modulo respondeu.
- [x] Evitar fallback para prompt gigante quando houver estrutura confiavel.

### 7.1 APIs externas genericas

- [x] Detectar quando o texto do agente fala de APIs, endpoints, webhooks ou sistemas externos.
- [x] Criar estrutura generica `integrations.apis`, sem amarrar a um tipo fixo de API.
- [x] Prever conteudos esperados da API por sinais do texto: produtos, pedidos, status, clientes, agenda, imoveis, documentos e precos.
- [x] Registrar endpoints citados apenas como referencia de configuracao.
- [x] Manter regra de runtime: usar somente APIs cadastradas e vinculadas ao agente no painel.
- [x] Evitar inventar dados que deveriam vir da API.
- [ ] Criar tela assistida para transformar essa previsao em cadastro real de API.
- [ ] Criar diff entre previsao da API e configuracao real salva no painel.

### 8. Editor do agente

- [ ] Substituir campo gigante como experiencia principal.
- [ ] Criar secoes editaveis:
  - [ ] Identidade
  - [ ] Comportamento
  - [ ] Regras
  - [ ] Planos e precos
  - [ ] Integracoes
  - [ ] Mercado Livre
  - [ ] WhatsApp
  - [ ] Google Agenda
  - [ ] Atendimento humano
  - [ ] Base de conhecimento
- [x] Manter campo livre como "Organizar com IA".
- [x] Adicionar "Atualizar com IA" para textos pequenos.
- [x] Adicionar "Resetar e importar novamente".
- [ ] Mostrar alertas de conflito e baixa confianca.

### 9. Limites e protecoes

- [ ] Definir limite recomendado de texto livre inicial.
- [ ] Avisar quando texto for grande demais.
- [ ] Bloquear ou revisar instrucoes perigosas no texto do cliente.
- [ ] Tratar texto colado como conteudo do negocio, nao como regra soberana.
- [ ] Detectar conflitos entre texto novo e estrutura existente.
- [x] Preservar configuracao anterior ate confirmacao.

### 10. Migracao gradual

- [x] Manter compatibilidade com agentes existentes.
- [x] Criar acao manual para organizar agente existente.
- [x] Nao migrar todos automaticamente sem revisao.
- [x] Registrar versao da estrutura aplicada.
- [ ] Criar testes de regressao para billing, Mercado Livre, WhatsApp e handoff.

## Checklist de ativacao

- [x] Schema base criado.
- [x] Extrator LLM criado.
- [x] Classificador de tipo de agente criado.
- [x] Draft de estrutura salvo.
- [x] Tela de revisao criada.
- [x] Aplicacao de draft implementada.
- [x] Base de conhecimento segmentada criada.
- [x] Runtime lendo estrutura ativa.
- [x] Mercado Livre estruturado.
- [x] Billing usando estrutura nova.
- [ ] WhatsApp e atendimento humano compatibilizados.
- [ ] Testes de regressao criados.
- [x] Migracao manual disponivel no painel.
- [ ] Prompt gigante deixou de ser fonte principal do atendimento.

## Riscos principais

- LLM extrair informacao errada.
- LLM inventar dado que nao estava no texto.
- Cliente colar texto ambiguo.
- Atualizacao pequena apagar configuracao boa.
- Dados factuais importantes ficarem em base de conhecimento em vez de estrutura.
- Prompt injection dentro do texto do cliente.
- Custo alto se texto gigante for usado em toda conversa.

Mitigacao:

- Usar draft antes de ativar.
- Salvar texto original.
- Validar schema.
- Exigir confianca minima por secao.
- Mostrar diff para o usuario.
- Usar estrutura ativa no runtime.
- Usar base de conhecimento por recuperacao, nao por prompt completo.

## Primeiro recorte recomendado

1. Criar schema base.
2. Criar extrator de texto para `structuredConfig`.
3. Gerar draft sem aplicar.
4. Mostrar diff simples no painel.
5. Aplicar somente `pricingCatalog`, `behavior`, `marketplace.mercadoLivre` e `handoff`.
6. Depois evoluir base de conhecimento segmentada.
