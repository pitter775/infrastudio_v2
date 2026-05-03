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
  1. backend ja reconcilia snapshot de sessao
  2. backend ja solicita reconnect automatico como contingencia
  3. estados terminais/manuais ja sao tratados para evitar reconnect indevido
  4. problema estrutural restante mora no worker externo/Railway
  5. instrucoes tecnicas para a IA do worker foram preparadas em `AGENTS/whatsapp-worker-railway-instrucoes.md`
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
  5. envio manual pelo admin ja chama o canal WhatsApp quando a conversa vem do WhatsApp
  6. falha de envio manual no WhatsApp fica registrada na conversa como mensagem de sistema
  7. admin exibe motivo tecnico de pausa automatica por loop
  Pendente:
  1. validar envio manual do atendimento para WhatsApp real
  2. validar disparo para atendente cadastrado usando o proprio canal do projeto

## Alto

- WhatsApp-service: reduzir volume de sync com backend e Supabase.
  Estado atual:
  1. existe tratamento de snapshot e estados transitorios no backend
  2. backend ignora snapshot transitorio repetido dentro de janela curta
  3. backend persiste imediatamente mudanca critica de status, erro, nota, disconnect manual ou disconnect terminal
  4. ainda falta endurecer a estrategia de sync no worker externo
  Pendente:
  1. criar fila ou scheduler central de sync por canal dentro do worker
  2. coalescer eventos rapidos do mesmo canal e enviar so o ultimo estado util
  3. diferenciar sync critico de sync transitorio
  4. remover sync redundante do fluxo de mensagem e notas operacionais no worker
  5. aplicar debounce/throttle por canal no worker antes de chamar `/api/whatsapp/session`
  6. validar com mais de um canal/projeto ligado ao mesmo tempo e medir queda das chamadas a `/api/whatsapp/session`

- Mercado Livre: fechar validacao operacional real.
  Estado atual:
  1. OAuth existe
  2. pedidos existem
  3. perguntas e resposta existem
  4. loja publica e snapshot existem
  5. script de preparo da loja de teste real ja valida snapshot e rota publica
  6. chat/widget ja tratam listagem estruturada, contagem filtrada e continuidade de catalogo
  7. enriquecimento opcional por HTML/categoria nao derruba mais o carregamento quando origem externa falha
  Pendente:
  1. validar fluxo em conta real ou sandbox
  2. confirmar permissoes reais de OAuth, pedidos e perguntas
  3. monitorar consistencia de sync de catalogo/snapshot em uso continuo

- Billing por projeto / Mercado Pago: fechar operacao e limpeza final do fluxo de recarga.
  Estado atual:
  1. `preference` ja existe por API
  2. `external_reference` ja existe
  3. webhook com `x-signature` ja existe
  4. confirmacao de recarga por webhook ja existe
  5. webhook rejeita assinatura invalida sem derrubar a rota por tamanho divergente de hash
  Pendente:
  1. validar operacao final no ambiente real
  2. remover dependencias remanescentes de link manual/teste onde ainda houver
  3. alinhar painel e conta do Mercado Pago para operacao 100% sem ajuste manual

## Medio

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

- Chat widget Mercado Livre: validar visualmente fluxo real em mobile.
  Estado atual:
  1. continuidade estruturada de `Ver mais opcoes` foi corrigida para sessao de catalogo valida
  2. contagem inflada por total bruto do Mercado Livre foi corrigida no snapshot/connector
  3. carrossel mobile recebeu botoes laterais com fundo em blur e melhor espacamento
  4. horario do widget foi normalizado para `America/Sao_Paulo`
  5. CTA de WhatsApp foi reduzido em respostas de catalogo/listagem
  Pendente:
  1. validar no navegador mobile real a sequencia `busca -> Ver mais opcoes -> Saber mais -> pergunta factual -> alternativa`
  2. gravar cenario fixo no Laboratorio para essa sequencia
  3. revisar se a API live do Mercado Livre precisa estimar `filteredTotal` alem do primeiro pool

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
