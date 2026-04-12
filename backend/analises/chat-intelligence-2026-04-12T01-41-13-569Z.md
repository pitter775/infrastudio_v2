# Chat Intelligence Scenario Report

Execucao: 2026-04-12T01:41:13.569Z

## Resumo

- api: 1 cenarios
- catalog: 2 cenarios
- handoff: 1 cenarios
- service: 1 cenarios
- whatsapp: 1 cenarios
- handoff_runtime_decision: none

## [catalog] resolucao de catalogo recente
Input: `gostei da sopeira que mandou`
- decision=recent_product_reference
- ambiguous=recent_product_reference_ambiguous
- resolved_refs=Jogo de Sopeira Completo

## [catalog] catalogo semantico segura produto em foco
Input: `tem garantia?`
- semantic_decision=non_catalog_message
- used_llm=true

## [api] api runtime focal e data normalizada
Input: `status pedido PED-2026-0042 / me passa a data do leilao`
- focused_fields=4
- api_reply_has_date=yes
- api_reply_has_raw_iso=no
- domain_stage=api_runtime

## [handoff] handoff explicito e resposta controlada
Input: `quero falar com um atendente humano`
- explicit_intent=true
- offer_has_human=yes
- reply_has_channel=yes

## [whatsapp] identidade canonica e lote humanizado
Input: `catalogo enviado no whatsapp`
- canonical=5511978510655
- sequence_length=4
- intro_has_follow_up=yes

## [service] snapshot de contato e assets recentes
Input: `mergeContext + assets mercado livre`
- snapshot_name=Julia Rodrigues
- snapshot_phone=5511999999999
- snapshot_avatar=yes
- recent_products=1
- recent_first_price=2990

