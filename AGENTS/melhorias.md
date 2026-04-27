# Melhorias

Backlog revisado com base no estado real do codigo.

Regra:

- nao listar aqui feature ja implementada como se estivesse do zero
- separar o que falta construir do que falta apenas validar ou refinar
- remover deste arquivo o que for concluido

## Como tocar de ponta a ponta

1. entender contrato atual e reaproveitar componentes/utilitarios existentes
2. ajustar banco apenas em `database/seeder/` quando precisar schema/dados
3. implementar backend/API
4. implementar UI/admin/widget
5. conectar runtime do agente quando envolver chat/IA
6. validar fluxo real no navegador e, quando envolver chat, validar widget/admin/WhatsApp
7. rodar `npm run lint`, testes especificos e `npm run build` quando o impacto justificar
8. remover deste arquivo o que ficar concluido

## Critico

- WhatsApp-service: endurecer persistencia e reconexao automatica da sessao no worker da Railway.
  Estado atual:
  1. backend ja tenta reconciliar snapshot e reconnect como contingencia
  2. problema estrutural ainda parece morar no worker externo
  Pendente:
  1. revisar como o worker salva e restaura auth/session do WhatsApp
  2. garantir reconexao automatica real apos queda, restart ou perda temporaria de conexao
  3. registrar motivo tecnico quando falhar reconectar
  4. validar em ambiente real na Railway com restart do processo e queda controlada
  5. manter o fallback do backend apenas como contingencia, nao como solucao principal

- WhatsApp/handoff: fechar validacao ponta a ponta em canal real.
  Estado atual:
  1. CTA de humano existe
  2. link direto para `/admin/atendimento?conversa=...` existe
  3. pausa por loop existe
  4. alerta de handoff por WhatsApp ja esta conectado no runtime
  Pendente:
  1. validar envio manual do atendimento para WhatsApp real
  2. validar disparo para atendente cadastrado usando o proprio canal do projeto
  3. registrar falhas de envio de forma consultavel
  4. exibir no admin o motivo tecnico salvo em `handoff.metadata.autoPause.reason`

## Alto

- WhatsApp-service: reduzir volume de sync com backend e Supabase.
  Estado atual:
  1. existe tratamento de snapshot e estados transitorios no backend
  2. ainda falta endurecer a estrategia de sync no worker
  Pendente:
  1. criar fila ou scheduler central de sync por canal dentro do worker
  2. coalescer eventos rapidos do mesmo canal e enviar so o ultimo estado util
  3. diferenciar sync critico de sync transitorio
  4. remover sync redundante do fluxo de mensagem e notas operacionais
  5. aplicar debounce/throttle por canal e janela minima para payload repetido
  6. validar com mais de um canal/projeto ligado ao mesmo tempo e medir queda das chamadas a `/api/whatsapp/session`

- Mercado Livre: fechar validacao operacional real.
  Estado atual:
  1. OAuth existe
  2. pedidos existem
  3. perguntas e resposta existem
  4. loja publica e snapshot existem
  Pendente:
  1. validar fluxo em conta real ou sandbox
  2. revisar consistencia de sync de catalogo/snapshot
  3. confirmar operacao real sem falhas de ambiente, permissao ou schema

- Billing por projeto / Mercado Pago: fechar operacao e limpeza final do fluxo de recarga.
  Estado atual:
  1. `preference` ja existe por API
  2. `external_reference` ja existe
  3. webhook com `x-signature` ja existe
  4. confirmacao de recarga por webhook ja existe
  Pendente:
  1. validar operacao final no ambiente real
  2. remover dependencias remanescentes de link manual/teste onde ainda houver
  3. alinhar painel e conta do Mercado Pago para operacao 100% sem ajuste manual

- Agenda: fechar validacao via chat em fluxo real.
  Estado atual:
  1. admin de agenda existe
  2. API publica existe
  3. reserva existe
  4. skill de agenda no chat existe
  5. auto-cadastro das APIs no agente existe
  Pendente:
  1. validar reserva via chat em fluxo completo
  2. revisar comportamento real de coleta de contato antes da confirmacao
  3. quando estabilizar, extrair para estrutura padronizada por capacidade em `runtimeConfig`

## Medio

- Identificacao simples no chat/widget: fechar validacao e endurecimento.
  Estado atual:
  1. widget ja coleta nome, email e telefone
  2. persiste no `localStorage`
  3. envia `identificadorExterno`
  4. importa historico por identificador
  Pendente:
  1. validar conversa nova, conversa existente e usuario sem identificacao
  2. endurecer confirmacao de posse se email/celular passarem a ser dado sensivel no fluxo

- Laboratorio: melhorar operacao sobre a base que ja existe.
  Estado atual:
  1. baseline anterior existe
  2. score humano existe
  3. simulador real efemero existe
  Pendente:
  1. criar ciclo de limpeza de logs com TTL por categoria
  2. adicionar acao para salvar conversa boa do simulador como cenario fixo
  3. continuar transformando casos reais em cenarios fixos do laboratorio

- Chat widget: validar visualmente widget e fullscreen mobile em navegador real.

- Landing pages publicas de aquisicao: estruturar trilha WhatsApp + Mercado Livre.
  Estado atual:
  1. home publica ja comunica automacao com IA e WhatsApp
  2. existem assets base como `bg_whatsapp.png`
  3. a base publica da loja Mercado Livre ja existe com URLs indexaveis
  Pendente:
  1. criar landing dedicada de WhatsApp
  2. criar landing dedicada de Mercado Livre
  3. decidir se a home vira pagina combinada ou se entra rota dedicada para `WhatsApp + Mercado Livre`
  4. anexar novas rotas publicas no sitemap somente quando estiverem prontas para indexacao

- Home publica: refinamento visual do tema dual dark/light.
  Estado atual:
  1. suporte dark/light ja existe
  2. landing, modal e chat demo ja trabalham com os dois temas
  Pendente:
  1. refinar hero e pricing
  2. manter light mais limpo e comercial
  3. reduzir residuos visuais exagerados onde ainda houver

- Agente de teste/laboratorio: avaliar se ainda vale aproximar mais do widget publico sem icone.
  Estado atual:
  1. simulador real efemero ja existe
  2. teste nao grava `chats` nem `mensagens` reais
  Pendente:
  1. decidir se ainda existe gap relevante entre simulador atual e widget real
  2. se existir, reaproveitar mais comportamento do widget sem adicionar icone

## Baixo

- Excluir conta.
  Pendente:
  1. permitir exclusao de conta com tudo que o usuario teria acesso
  2. preservar dados administrativos necessarios
  3. registrar auditoria minima da operacao
  4. validar impacto em projetos, billing e chats

- Chat widget: remover resquicio legado de `whatsapp_celular`.
  Estado atual:
  1. regra de oferta de WhatsApp ja depende do canal ativo/conectado
  2. campo legado ainda existe no schema e em partes do runtime
  Pendente:
  1. remover do cadastro quando compatibilidade permitir
  2. remover mapeamentos internos e banco relacionados
  3. validar que oferta de WhatsApp nao depende mais desse campo em nenhum fluxo

- Login ou identificacao pelo Google no chat: estudar antes de implementar.
  Estado atual:
  1. OAuth social existe no sistema
  2. isso ainda nao esta integrado ao chat/widget como backlog especifico
  Pendente:
  1. decidir se Google sera login real ou identificacao de lead
  2. reaproveitar auth atual quando fizer sentido
  3. manter fallback por email/celular
  4. definir impacto em LGPD/privacidade antes de importar historico
  5. validar fluxo em mobile e desktop

- Chatwidget: comportamento inteligente orientado a contexto.
  Pendente:
  1. scrollou -> chat aparece
  2. ficou parado -> chat sugere ajuda
  3. clicou produto -> chat contextualiza
