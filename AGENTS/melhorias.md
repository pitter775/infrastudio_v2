# Melhorias

## Critico

- Mercado Livre: evoluir o painel v2 inicial para fluxo completo com OAuth, catalogo, pedidos e perguntas.
- WhatsApp/handoff: validar ponta a ponta em canal real o disparo para atendente cadastrado usando o proprio canal do projeto.

## Alto

- Billing por projeto / Mercado Pago: fechar a recarga avulsa 100% automatica.
  Pendencia real:
  1. aguardar ajuste/configuracao no painel e na conta do Mercado Pago
  2. depois disso, trocar a recarga avulsa restante para `preference` criada por API
  3. usar `external_reference` para reconciliar pagamento sem ambiguidade
  4. validar `x-signature` no webhook
  5. remover dependencia de link `mpago.la` do painel
  Resultado esperado:
  1. compra avulsa credita tokens automaticamente por webhook
  2. sem intervencao manual do admin
  3. fluxo consistente com o upgrade de plano

- Home publica: simplificar a implementacao de tema dual dark/light sem pesar renderizacao nem poluir a interface.
  Estado atual:
  1. infraestrutura de tema por `html.dark` ja existe
  2. heranca de `prefers-color-scheme` ja existe
  3. landing, modal e chat-demo ja aceitam claro/escuro
  4. blur/backdrop pesado foi removido da home nesta rodada
  Direcao obrigatoria:
  1. light precisa ser branco, limpo e comercial, proximo da referencia enviada
  2. evitar glassmorphism, blur, glow exagerado e excesso de sombra
  3. preferir fundos chapados, bordas suaves e contraste por tipografia/espacamento
  4. manter a estrutura atual sem criar paralelos
  Proximos passos:
  1. refinar hero e pricing para ficar mais proximo da referencia clara
  2. reduzir ainda mais efeitos visuais se surgir qualquer sensacao de interface pesada
  3. expandir so depois para `/app` e `/admin`

- Chat widget: adicionar tema automatico herdando claro/escuro do navegador.
  Objetivo:
  1. widget alterna automaticamente entre light/dark conforme sistema
  2. visual do light segue a mesma linguagem da landing clara
  3. dark continua fiel ao tema atual
  Regras:
  1. evitar blur/backdrop pesado no widget
  2. priorizar branco limpo no light
  3. priorizar painel escuro simples no dark
  4. se precisar override manual, manter `system` como padrao

## Medio

- Opcao de excluir conta com tudo que o usuario teria acesso, preservando dados administrativos.

## Baixo

- Limpeza operacional do Laboratorio/logs com TTL, dry-run e opcao de fixar logs importantes.
