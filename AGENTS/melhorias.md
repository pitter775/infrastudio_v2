# Melhorias

## Critico

- Mercado Livre: evoluir o painel v2 inicial para fluxo completo com OAuth, catalogo, pedidos e perguntas.
- Chat runtime: ampliar observabilidade de fail-closed, widget resolvido, APIs usadas e decisao de handoff.
- Chat runtime: fechar oferta automatica de humano quando a pergunta fugir do dominio do agente.
- WhatsApp worker externo: garantir envio sempre explicito da flag de contato salvo para o v2 confiar sem inferencia.
- WhatsApp/handoff: validar ponta a ponta em canal real o disparo para atendente cadastrado usando o proprio canal do projeto.

## Alto

- IA/resumo do agente: melhorar extracao do site com contatos, pessoas, dados institucionais e sugestoes de prompt.
- Laboratorio: criar diff contra baseline anterior e score humano por cenario.

## Medio

- Versionamento de agente: diff visual entre versoes, nota de alteracao e destaque da versao atual.
- Observabilidade: filtros por provider, stage, custo, erro e timeline tecnica por chat.

## Baixo

- Limpeza operacional do Laboratorio/logs com TTL, dry-run e opcao de fixar logs importantes.
