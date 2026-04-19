# Melhorias

## Como tocar de ponta a ponta

Ordem recomendada para cada melhoria:

1. entender contrato atual e reaproveitar componentes/utilitarios existentes
2. ajustar banco apenas em `database/seeder/` quando precisar schema/dados
3. implementar backend/API
4. implementar UI/admin/widget
5. conectar runtime do agente quando envolver chat/IA
6. validar fluxo real no navegador e, quando envolver chat, validar widget/admin/WhatsApp
7. rodar `npm run lint`, testes especificos e `npm run build` quando o impacto justificar
8. remover deste arquivo o que ficar concluido

## Trilha 1 - Atendimento, handoff e WhatsApp

### Critico

- Atendimento humano no admin.
  Feito:
  1. ao enviar mensagem no atendimento, a tela indica que o humano assumiu o comando
  2. mensagem enviada pelo atendente aparece no chat do atendimento sem reload
  3. widget publico sincroniza mensagens manuais por `GET /api/chat`
  4. estado de handoff/humano fica visivel para o atendente
  Pendente:
  1. validar em canal real se mensagem manual chega no WhatsApp
  2. adicionar validacao no Laboratorio ou teste focado quando possivel

- WhatsApp/handoff.
  Entrega ponta a ponta:
  1. validar em canal real o disparo para atendente cadastrado usando o proprio canal do projeto
  2. validar link direto para `/admin/atendimento?conversa=...`
  3. registrar falhas de envio de forma consultavel
  4. garantir que CTA de WhatsApp so aparece com canal ativo/conectado no agente

## Trilha 2 - Identificacao do usuario e memoria

### Alto

- Identificacao simples no chat/widget por email ou contato.
  Feito:
  1. input do widget tem icone discreto de email/contato
  2. clique abre box simples no lugar da caixa de texto para informar email e celular
  3. contato fica persistido no `localStorage`
  4. contato entra no contexto `lead` e no `identificadorExterno`
  5. runtime importa mensagens recentes de conversas anteriores pelo `identificadorExterno`
  6. agente recebe resumo do historico importado em `memoria.historicoIdentificado`
  Pendente:
  1. validar nova conversa, conversa existente e usuario sem identificacao
  2. endurecer confirmacao de posse do email/celular se virar dado sensivel

- Login/identificacao pelo Google direto no chat: estudar antes de implementar.
  Estudo necessario:
  1. decidir se Google sera login real ou identificacao de lead
  2. reaproveitar auth atual quando possivel
  3. manter fallback por email/celular
  4. definir impacto em LGPD/privacidade antes de importar historico
  5. validar fluxo em mobile e desktop

## Trilha 3 - Agenda, reservas e API do agente

### Alto

- Agenda de horarios disponiveis.
  Feito:
  1. criar seeder/schema para horarios disponiveis e reservas
  2. criar APIs de cadastro, leitura, update e cancelamento/desativacao
  3. admin cria, edita, lista e desativa dias/horarios disponiveis
  4. API publica `GET /api/agenda` lista disponibilidade
  5. API publica `POST /api/agenda` cria reserva
  6. reserva grava resumo da conversa, contato, horario reservado, origem/canal, status, criado em e atualizado em
  7. dispara email de aviso quando configurado
  8. dispara WhatsApp quando houver canal ativo e contatos de handoff
  9. registra falhas de notificacao em logs
  10. runtime do chat carrega horarios disponiveis no contexto do agente
  11. prompt instrui o agente a coletar contato antes de confirmar reserva
  12. skill/intencao local de agenda detecta pedido de reserva, cobra contato quando faltar e cria reserva via modulo `POST`
  13. agenda foi refatorada para gerar slots reais por periodo, hora inicial/final e duracao
  14. UI compacta exibe slots por data com status visual disponivel, reservado e bloqueado
  15. admin seleciona slots e reserva, bloqueia ou libera em lote
  16. cron diario remove slots vencidos sem reserva vinculada
  17. cadastro de APIs do agente aceita metodos GET, POST, PUT, PATCH e DELETE
  18. gerar/replicar agenda cadastra automaticamente as APIs publicas de agenda na tabela `apis`, com URL/config dinamica por projeto e agente
  Pendente:
  1. validar reserva via chat em fluxo completo com as APIs de agenda cadastradas automaticamente no projeto
  2. quando o fluxo atual de agenda estiver maduro, extrair para uma estrutura padronizada por capacidade:
     - nucleo comum de agendamento no runtime
     - configuracao por projeto/agente em `runtimeConfig`
     - extensoes especificas por cliente sem duplicar o fluxo base
     - manter evolucao rapida no formato atual ate estabilizar comportamento real

## Trilha 4 - Chat widget e mobile

### Pendente

- Validar visualmente widget e fullscreen mobile em navegador real apos subir dev server.

## Trilha 5 - Laboratorio e qualidade do runtime

### Medio

- Agente de teste/laboratorio: importar inteligencia do chat widget sem icone.
  Entrega ponta a ponta:
  1. agente de teste reaproveita inteligencia/comportamento do chat widget
  2. nao exibe icone usado no widget publico
  3. mantem isolamento de contexto
  4. simulador efemero continua sem gravar `chats`/`mensagens`
  5. validar no admin/laboratorio

- Limpeza operacional do Laboratorio/logs.
  Feito:
  1. criar TTL por categoria
  2. incluir dry-run
  3. preservar logs com `payload.pinned` ou `payload.keep`
  4. executar limpeza em lote
  5. registrar resultado da limpeza
  Pendente:
  1. expor botao/controle visual no Laboratorio se necessario

## Trilha 6 - Home, billing e produto

### Critico

- Mercado Livre.
  Entrega ponta a ponta:
  1. evoluir painel v2 inicial para fluxo completo com OAuth
  2. sincronizar catalogo
  3. listar pedidos
  4. listar e responder perguntas
  5. validar fluxo em conta real/sandbox conforme disponibilidade

### Alto

- Billing por projeto / Mercado Pago: recarga avulsa 100% automatica.
  Pendencia real:
  1. aguardar ajuste/configuracao no painel e na conta do Mercado Pago
  Entrega ponta a ponta depois da pendencia:
  1. trocar recarga avulsa restante para `preference` criada por API
  2. usar `external_reference` para reconciliar pagamento sem ambiguidade
  3. validar `x-signature` no webhook
  4. remover dependencia de link `mpago.la` do painel
  5. compra avulsa credita tokens automaticamente por webhook
  6. fluxo fica consistente com upgrade de plano

- Home publica: tema dual dark/light.
  Estado atual:
  1. infraestrutura de tema por `html.dark` ja existe
  2. heranca de `prefers-color-scheme` ja existe
  3. landing, modal e chat-demo ja aceitam claro/escuro
  4. blur/backdrop pesado foi removido da home
  Entrega ponta a ponta:
  1. refinar hero e pricing para ficar mais proximo da referencia clara
  2. manter light branco, limpo e comercial
  3. evitar glassmorphism, blur, glow exagerado e excesso de sombra
  4. preferir fundos chapados, bordas suaves e contraste por tipografia/espacamento
  5. expandir so depois para `/app` e `/admin`

### Medio

- Excluir conta.
  Entrega ponta a ponta:
  1. permitir exclusao de conta com tudo que o usuario teria acesso
  2. preservar dados administrativos necessarios
  3. registrar auditoria minima da operacao
  4. validar impacto em projetos, billing e chats

- Chat widget: remover resquicio legado de `whatsapp_celular`.
  Entrega ponta a ponta:
  1. remover do cadastro quando compatibilidade permitir
  2. remover mapeamentos internos e banco relacionados
  3. manter WhatsApp controlado somente por canal ativo/conectado do agente
  4. validar que oferta de WhatsApp nao depende mais desse campo
