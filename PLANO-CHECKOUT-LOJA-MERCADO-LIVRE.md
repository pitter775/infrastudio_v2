# Plano: Checkout da Loja Mercado Livre com Mercado Pago

## Objetivo

Criar um checkout próprio para a loja pública vinculada ao Mercado Livre, separando claramente:

- pagamentos do InfraStudio;
- pagamentos da loja do cliente;
- usuários administrativos do InfraStudio;
- compradores finais da loja.

O checkout deve permitir que a loja pública `/loja/{slug}` venda produtos usando Mercado Pago e cálculo de frete, sem misturar dados financeiros, permissões ou usuários com o billing do InfraStudio.

## Decisão principal

O pagamento da loja do cliente deve ser uma frente separada do pagamento do InfraStudio.

Hoje o InfraStudio já usa Mercado Pago para planos e créditos do projeto. Esse fluxo não deve ser reaproveitado diretamente para vender produtos da loja, porque:

- o dinheiro do billing pertence ao InfraStudio;
- o dinheiro da venda da loja pertence ao cliente/lojista;
- o usuário do InfraStudio é operador/admin;
- o comprador da loja é cliente final;
- o webhook de assinatura/créditos não pode atualizar pedido de produto;
- o pedido da loja tem endereço, frete, itens, comprador e status de entrega.

## Estado atual do projeto

Já existe:

- loja pública em `/loja/{slug}`;
- página pública de produto em `/loja/{slug}/produto/{produtoSlug}`;
- botão atual para abrir o produto no Mercado Livre;
- botão para atendimento via chat/widget;
- snapshot local de produtos do Mercado Livre;
- OAuth do Mercado Livre por projeto;
- dashboard de vendas baseado em pedidos lidos do Mercado Livre;
- Mercado Pago para billing do InfraStudio;
- webhook Mercado Pago atual em `/api/mercado-pago/webhook`;
- cadastro/login dos usuários do InfraStudio.

Já foi iniciado neste plano:

- banco do checkout próprio da loja criado em `database/seeder/2026-05-26-store-checkout.sql`;
- tabelas separadas para compradores, pedidos, itens, pagamentos e configuração Mercado Pago da loja;
- RLS habilitado com policy `service_role` fail-closed;
- índices principais por projeto, loja, pedido público, referência externa e recursos Mercado Pago.
- lib de pedido próprio criada em `backend/lib/store-checkout.js`;
- lib de cálculo de frete Mercado Livre criada em `backend/lib/mercado-livre-shipping.js`;
- lib separada de Mercado Pago da loja criada em `backend/lib/mercado-pago-store.js`;
- rotas públicas iniciais criadas para frete, checkout e webhook da loja;
- página inicial de checkout criada em `/loja/{slug}/checkout`;
- página inicial de sucesso criada em `/loja/{slug}/pagamento/sucesso`;
- página de produto passa a exibir `Comprar na loja` quando o checkout estiver habilitado.
- OAuth Mercado Pago por projeto/loja iniciado:
  - `GET /api/app/projetos/[id]/loja/mercado-pago/oauth/start`;
  - `GET /api/mercado-pago/store-oauth/callback`;
  - `GET/DELETE /api/app/projetos/[id]/loja/mercado-pago`;
  - tokens salvos criptografados em `loja_pagamento_config`;
- checkout passa a priorizar token conectado da loja antes do fallback `MERCADO_PAGO_STORE_ACCESS_TOKEN`;
- aba `Mercado Livre > Loja > Pagamento` agora permite conectar/reconectar/desconectar Mercado Pago.
- painel mínimo de pedidos iniciado:
  - `GET /api/app/projetos/[id]/loja/pedidos`;
  - aba `Mercado Livre > Loja > Pedidos` lista pedidos do checkout próprio.
- proteção inicial de estoque implementada no checkout:
  - antes de criar pedido, tenta consultar produto live no Mercado Livre pela conexão existente;
  - conta pedidos recentes pendentes/em análise/aprovados do mesmo item;
  - bloqueia checkout quando o estoque disponível menos reservas recentes não comporta a compra.

Arquivos relevantes:

- `backend/components/store/store-product-actions.js`
- `backend/components/store/mercado-livre-storefront.js`
- `backend/lib/mercado-livre-store.js`
- `backend/lib/mercado-livre-store-core/public.js`
- `backend/lib/mercado-livre-store-core/snapshot.js`
- `backend/lib/mercado-pago-billing.js`
- `backend/app/api/mercado-pago/webhook/route.js`
- `backend/app/api/auth/register/route.js`
- `backend/lib/auth-registration.js`

## Fora do escopo do MVP

O MVP não deve tentar criar pedidos oficiais dentro do Mercado Livre.

Se o cliente final comprar pelo botão do Mercado Livre, o pedido continua dentro do Mercado Livre. Se comprar pelo checkout próprio da loja, o pedido é da loja InfraStudio/Vitrini e deve ser persistido no banco próprio do projeto.

Também fica fora do MVP:

- carrinho multi-produto;
- cupom de desconto;
- painel completo de logística;
- conciliação fiscal;
- emissão de nota;
- split marketplace;
- recuperação de carrinho abandonado;
- conta completa do comprador com senha;
- integração automática com transportadoras fora do Mercado Livre.

## Domínios separados

### 1. Billing InfraStudio

Responsável por:

- planos do projeto;
- créditos avulsos;
- assinatura;
- bloqueio por limite;
- uso mensal;
- webhook atual de billing.

Não deve conhecer:

- produtos comprados na loja;
- comprador final;
- endereço de entrega;
- frete;
- status de entrega.

Fluxos existentes:

- `/api/app/projetos/[id]/billing/checkout`
- `/pagamento/sucesso`
- `/api/mercado-pago/webhook`
- `backend/lib/mercado-pago-billing.js`

Tabelas existentes:

- `projetos_checkout_intencoes`
- `projetos_assinaturas`
- `tokens_avulsos`
- `projetos_ciclos_uso`

### 2. Checkout da loja do cliente

Responsável por:

- pedido de produto da loja pública;
- comprador final;
- endereço;
- opção de frete;
- preferência Mercado Pago da compra;
- confirmação de pagamento;
- status do pedido.

Deve ter libs, rotas e webhook separados do billing.

Nomes sugeridos:

- `backend/lib/store-checkout.js`
- `backend/lib/mercado-pago-store.js`
- `backend/lib/mercado-livre-shipping.js`
- `/api/loja/[slug]/checkout`
- `/api/loja/[slug]/frete`
- `/api/mercado-pago/store-webhook`

### 3. Compradores da loja

Responsável por:

- dados mínimos do cliente final;
- histórico de pedidos da loja;
- endereço usado no pedido.

Não deve usar a tabela `usuarios`, porque essa tabela representa usuários do painel InfraStudio.

Tabela sugerida:

- `loja_clientes`

O MVP pode operar como checkout convidado, mas ainda deve persistir comprador por email/telefone para auditoria e histórico.

## Modelo financeiro

### Opção recomendada para produto final

Cada lojista conecta a própria conta Mercado Pago. O checkout da loja usa o token/credencial do lojista, não a credencial do InfraStudio.

Isso exige uma nova área de configuração:

- `Mercado Livre > Loja > Pagamentos`
- status da conexão Mercado Pago;
- modo teste/produção;
- conta conectada;
- data da última validação.

Refinamento aplicado:

- a conexão deve ser feita por OAuth Mercado Pago, não por campo manual de token;
- cada projeto/loja terá uma linha em `loja_pagamento_config`;
- o Access Token e Refresh Token devem ficar criptografados;
- o checkout sempre deve resolver o token por `projeto_id`;
- o fallback `MERCADO_PAGO_STORE_ACCESS_TOKEN` deve ser usado apenas para teste interno/homologação;
- em produção, não usar uma única conta Mercado Pago para receber pagamentos de várias lojas, salvo se houver decisão explícita de marketplace/split.

### Opção intermediária para MVP interno

Usar uma credencial Mercado Pago de teste configurada no ambiente para validar fluxo técnico.

Essa opção só serve para homologação. Não deve ir para produção como fluxo de loja de clientes sem decisão comercial explícita.

## Experiência ideal de ativação

Fluxo para o cliente:

1. Conectar Mercado Livre.
2. Sincronizar produtos.
3. Configurar loja pública.
4. Abrir `Mercado Livre > Loja > Pagamento`.
5. Clicar em `Conectar Mercado Pago`.
6. Autorizar a conta recebedora.
7. Voltar automaticamente para o projeto.
8. A loja passa a mostrar `Comprar na loja`.

Regras:

- Mercado Livre continua sendo integração de catálogo e operação.
- Mercado Pago é integração financeira da loja.
- Uma integração não substitui a outra.
- A tela deve deixar claro que pagamento da loja é separado do pagamento da InfraStudio.
- Quando Mercado Pago não estiver conectado, manter botão de compra no Mercado Livre como fallback.

## Banco de dados

Criar novo arquivo em `database/seeder/`.

Nome sugerido:

- `database/seeder/2026-05-26-store-checkout.sql`

Status:

- concluído.

Não editar `database/geral-schema.sql`.

### `loja_clientes`

Compradores finais da loja.

Campos sugeridos:

- `id uuid primary key default gen_random_uuid()`
- `projeto_id uuid not null references projetos(id) on delete cascade`
- `loja_id uuid null references mercadolivre_lojas(id) on delete set null`
- `nome text not null`
- `email text null`
- `telefone text null`
- `documento text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Índices:

- `(projeto_id, email)`
- `(projeto_id, telefone)`
- `(loja_id, created_at desc)`

RLS:

- habilitar RLS;
- policy `service_role` fail-closed.

### `loja_pedidos`

Pedido próprio da loja pública.

Campos sugeridos:

- `id uuid primary key default gen_random_uuid()`
- `public_id text not null`
- `projeto_id uuid not null references projetos(id) on delete cascade`
- `loja_id uuid null references mercadolivre_lojas(id) on delete set null`
- `cliente_id uuid null references loja_clientes(id) on delete set null`
- `status text not null default 'rascunho'`
- `payment_status text not null default 'pendente'`
- `fulfillment_status text not null default 'pendente'`
- `currency_id text not null default 'BRL'`
- `subtotal numeric(12,2) not null default 0`
- `shipping_amount numeric(12,2) not null default 0`
- `discount_amount numeric(12,2) not null default 0`
- `total_amount numeric(12,2) not null default 0`
- `buyer_name text null`
- `buyer_email text null`
- `buyer_phone text null`
- `buyer_document text null`
- `shipping_zip_code text null`
- `shipping_address jsonb not null default '{}'::jsonb`
- `shipping_option jsonb not null default '{}'::jsonb`
- `mercado_pago_preference_id text null`
- `mercado_pago_payment_id text null`
- `mercado_pago_status text null`
- `external_reference text null`
- `source text not null default 'storefront'`
- `metadata jsonb not null default '{}'::jsonb`
- `paid_at timestamptz null`
- `cancelled_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Índices:

- unique `(public_id)`
- unique `(external_reference)`
- `(projeto_id, created_at desc)`
- `(loja_id, created_at desc)`
- `(projeto_id, status, created_at desc)`
- `(mercado_pago_payment_id)`
- `(mercado_pago_preference_id)`

RLS:

- habilitar RLS;
- policy `service_role` fail-closed.

### `loja_pedido_itens`

Itens comprados.

Campos sugeridos:

- `id uuid primary key default gen_random_uuid()`
- `pedido_id uuid not null references loja_pedidos(id) on delete cascade`
- `projeto_id uuid not null references projetos(id) on delete cascade`
- `mercadolivre_item_id text null`
- `snapshot_product_id uuid null`
- `produto_slug text null`
- `titulo text not null`
- `quantidade integer not null default 1`
- `unit_price numeric(12,2) not null default 0`
- `total_price numeric(12,2) not null default 0`
- `currency_id text not null default 'BRL'`
- `thumbnail text null`
- `permalink text null`
- `raw_summary jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Índices:

- `(pedido_id)`
- `(projeto_id, mercadolivre_item_id)`

RLS:

- habilitar RLS;
- policy `service_role` fail-closed.

### `loja_pedido_pagamentos`

Histórico de pagamentos/notificações.

Campos sugeridos:

- `id uuid primary key default gen_random_uuid()`
- `pedido_id uuid null references loja_pedidos(id) on delete set null`
- `projeto_id uuid null references projetos(id) on delete cascade`
- `provider text not null default 'mercado_pago'`
- `provider_resource_type text null`
- `provider_resource_id text null`
- `status text null`
- `amount numeric(12,2) null`
- `currency_id text null`
- `raw_summary jsonb not null default '{}'::jsonb`
- `received_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`

Índices:

- `(pedido_id, created_at desc)`
- `(provider, provider_resource_id)`
- `(projeto_id, created_at desc)`

RLS:

- habilitar RLS;
- policy `service_role` fail-closed.

### `loja_pagamento_config`

Configuração de pagamento por loja/projeto.

Campos sugeridos:

- `id uuid primary key default gen_random_uuid()`
- `projeto_id uuid not null references projetos(id) on delete cascade`
- `loja_id uuid null references mercadolivre_lojas(id) on delete cascade`
- `provider text not null default 'mercado_pago'`
- `status text not null default 'desconectado'`
- `mode text not null default 'test'`
- `public_key text null`
- `access_token_encrypted text null`
- `account_email text null`
- `account_id text null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Índices:

- unique `(projeto_id, provider)`
- `(loja_id, provider)`

RLS:

- habilitar RLS;
- policy `service_role` fail-closed.

## Fluxo do MVP

### Estoque e concorrência

Esta é uma regra crítica do checkout próprio.

Como a compra fora do Mercado Livre não cria pedido oficial no ML imediatamente, o checkout precisa reduzir ao máximo o risco de dois compradores pagarem o mesmo item com estoque 1.

Regra aplicada no MVP:

- checkout limitado a 1 unidade;
- antes de criar pedido, consultar o produto live no Mercado Livre quando houver conector válido;
- usar `availableQuantity` live quando disponível;
- contar pedidos próprios recentes do mesmo `mercadolivre_item_id` nos últimos 30 minutos com status:
  - `aguardando_pagamento`;
  - `pago`;
  - pagamento `pendente`;
  - pagamento `em_analise`;
  - pagamento `aprovado`;
- bloquear o checkout se `availableQuantity - reservedQuantity < 1`.

Limite conhecido:

- isso reduz bastante o risco, mas não é uma trava transacional perfeita entre duas requisições exatamente simultâneas.

Entregue agora:

- tabela `loja_estoque_reservas` com RLS fechada para `service_role`;
- RPC `loja_reservar_estoque` com `pg_advisory_xact_lock` por projeto + item Mercado Livre;
- checkout consulta estoque live no Mercado Livre, reserva antes de criar a preferência Mercado Pago e bloqueia concorrência;
- falha ao criar pedido/item/preferência libera a reserva;
- webhook aprovado confirma a reserva;
- webhook recusado/cancelado/estornado libera a reserva.
- webhook aprovado tenta baixar o estoque no anúncio do Mercado Livre via `PUT /items/{item_id}` com `available_quantity`;
- baixa automática é idempotente por reserva: só roda quando a reserva muda de `ativa` para `confirmada`.
- produtos com variação agora exibem seleção de variação no checkout, gravam `mercadolivre_variation_id`, reservam estoque por variação e tentam baixar o estoque da variação correta no Mercado Livre.

Pendente para o teste geral:

- aplicar `database/seeder/2026-05-26-store-stock-reservations.sql` no Supabase;
- aplicar `database/seeder/2026-05-26-store-checkout-mercadopago-oauth.sql` no Supabase se o banco ainda não tiver as colunas de OAuth da loja;
- validar em produto real com variação, porque a baixa depende da permissão da aplicação Mercado Livre para editar anúncios.

### 1. Produto público

Na página do produto:

- manter botão `Mercado Livre` como fallback;
- adicionar botão `Comprar na loja`;
- se checkout da loja estiver desativado, exibir apenas fluxo atual;
- se ativo, abrir checkout próprio.

Arquivo provável:

- `backend/components/store/store-product-actions.js`

### 2. Checkout

Nova página:

- `/loja/{slug}/checkout?produto={produtoSlug}`

Campos:

- nome;
- email;
- telefone;
- CEP;
- endereço;
- número;
- complemento;
- bairro;
- cidade;
- estado;
- opção de frete;
- resumo do pedido.

Comportamento:

- carregar produto por snapshot;
- validar disponibilidade mínima;
- calcular subtotal;
- calcular frete quando CEP estiver completo;
- criar pedido pendente;
- criar preferência Mercado Pago;
- redirecionar para Mercado Pago.

### 3. Frete

Rota:

- `POST /api/loja/[slug]/frete`

Entrada:

```json
{
  "produtoSlug": "produto-exemplo",
  "zipCode": "01001000",
  "quantity": 1
}
```

Saída esperada:

```json
{
  "options": [
    {
      "id": "standard",
      "name": "Envio padrão",
      "amount": 19.9,
      "currencyId": "BRL",
      "estimatedDeliveryTime": "3 a 6 dias úteis"
    }
  ]
}
```

Implementação:

- usar `GET /items/{itemId}/shipping_options?zip_code={cep}` quando houver item Mercado Livre válido;
- limitar chamadas por interação;
- não fazer polling;
- cache curto em memória ou banco apenas se necessário;
- falhar com mensagem clara quando a API não retornar opção.

### 4. Pedido

Rota:

- `POST /api/loja/[slug]/checkout`

Responsável por:

- validar loja ativa;
- validar produto dentro do projeto da loja;
- validar dados mínimos do comprador;
- criar/atualizar `loja_clientes`;
- criar `loja_pedidos`;
- criar `loja_pedido_itens`;
- criar preferência Mercado Pago;
- gravar `external_reference`;
- retornar `checkoutUrl`.

### 5. Mercado Pago

Lib nova:

- `backend/lib/mercado-pago-store.js`

Não misturar com:

- `backend/lib/mercado-pago-billing.js`

Funções sugeridas:

- `createStoreCheckoutPreference`
- `validateStoreMercadoPagoWebhookSignature`
- `processStoreMercadoPagoWebhook`
- `fetchStoreMercadoPagoResource`
- `confirmStoreOrderPayment`

External reference sugerido:

- `infrastudio-store:order:{pedidoId}`

Notification URL:

- `${APP_URL}/api/mercado-pago/store-webhook`

### 6. Webhook da loja

Rota nova:

- `/api/mercado-pago/store-webhook`

Responsável por:

- validar assinatura;
- buscar pagamento na API Mercado Pago;
- localizar pedido pelo `external_reference`;
- atualizar `loja_pedidos`;
- inserir `loja_pedido_pagamentos`;
- logar evento;
- ser idempotente.

Não deve:

- alterar plano do projeto;
- inserir tokens avulsos;
- mexer em `projetos_assinaturas`;
- chamar `refreshProjectBillingState`.

### 7. Sucesso do pagamento

Página:

- `/loja/{slug}/pagamento/sucesso?pedido={publicId}`

Exibir:

- status do pedido;
- aviso de confirmação via Mercado Pago;
- resumo do pedido;
- dados de entrega;
- contato da loja.

## Painel administrativo

Após o MVP público funcionar, criar área no painel do projeto:

- `Mercado Livre > Loja > Pagamentos`
- `Mercado Livre > Loja > Pedidos`

### Pagamentos

Deve exibir:

- status Mercado Pago;
- modo teste/produção;
- conta conectada;
- última validação;
- botão para conectar/desconectar.

### Pedidos

Deve exibir:

- lista paginada;
- filtro por status;
- filtro por período;
- detalhe do pedido;
- comprador;
- itens;
- pagamento;
- entrega/frete;
- link do produto.

Queries devem ser enxutas:

- seleção explícita;
- `limit`;
- paginação por range;
- sem `select *`;
- sem N+1.

## Segurança e privacidade

Regras:

- não expor token Mercado Pago no cliente;
- criptografar token do Mercado Pago do lojista;
- webhook idempotente;
- assinatura do Mercado Pago validada;
- comprador da loja sem acesso ao painel;
- usuário do painel sem endpoint público para consultar pedidos de outra loja;
- rotas públicas sempre resolvem loja por slug e pedido por `public_id`;
- não retornar dados sensíveis desnecessários para o browser.

## Performance

Regras obrigatórias:

- buscar produto por slug e projeto da loja;
- não buscar catálogo inteiro no checkout;
- não fazer cálculo de frete em loop;
- limitar quantidade do MVP a 1 unidade ou validar estoque com limite simples;
- salvar payload bruto reduzido em `raw_summary`;
- não salvar resposta completa gigante do Mercado Pago ou Mercado Livre;
- usar índices por `projeto_id`, `loja_id`, `public_id`, `external_reference`.

## Riscos

- Mercado Livre pode não retornar cálculo de frete para todos os anúncios.
- Compra fora do Mercado Livre não gera pedido Mercado Livre.
- Estoque do snapshot pode estar desatualizado.
- Produto pode vender no Mercado Livre enquanto comprador está no checkout próprio.
- Dois compradores podem tentar comprar ao mesmo tempo um item com estoque 1.
- Mercado Pago do lojista exige OAuth/configuração própria para produção.
- Split/marketplace exige decisão comercial e compliance.
- Produtos com variação já estão modelados no checkout; ainda precisam ser validados em anúncio real com permissão de edição de estoque.

## Mitigações

- manter botão de compra no Mercado Livre como fallback;
- começar com produto único e quantidade 1;
- validar produto ativo e estoque do snapshot;
- carregar produto live antes de criar pedido sempre que a conexão Mercado Livre permitir;
- considerar pedidos próprios recentes como reserva temporária de estoque;
- exibir aviso quando o frete não puder ser calculado;
- separar modo teste e produção;
- criar webhook separado e idempotente;
- salvar status do pedido sempre como estado de máquina simples.

## Ordem de implementação recomendada

1. Criar seeder com tabelas da loja. Concluído no banco atualizado pelo usuário; complementos atuais em `database/seeder/2026-05-26-store-checkout-mercadopago-oauth.sql` e `database/seeder/2026-05-26-store-stock-reservations.sql`.
2. Criar lib `store-checkout.js` para pedido, comprador e validação do produto. Concluído.
3. Criar lib `mercado-livre-shipping.js`. Concluído.
4. Criar rota `POST /api/loja/[slug]/frete`. Concluído.
5. Criar lib `mercado-pago-store.js`. Concluído.
6. Criar rota `POST /api/loja/[slug]/checkout`. Concluído.
7. Criar rota `/api/mercado-pago/store-webhook`. Concluído.
8. Criar página `/loja/[slug]/checkout`. Concluído em versão inicial.
9. Criar página `/loja/[slug]/pagamento/sucesso`. Concluído em versão inicial.
10. Ajustar `store-product-actions.js` para exibir `Comprar na loja`. Concluído.
11. Criar painel mínimo de pedidos. Concluído em versão inicial.
12. Criar painel mínimo de configuração Mercado Pago da loja. Concluído em versão inicial com conexão/reconexão/desconexão.
13. Validar com loja real `Reliquias de Familia`.

## Pendências técnicas atuais

- O checkout da loja prioriza OAuth salvo em `loja_pagamento_config` e usa `MERCADO_PAGO_STORE_ACCESS_TOKEN` apenas como fallback de teste.
- O botão `Comprar na loja` aparece quando existe `MERCADO_PAGO_STORE_ACCESS_TOKEN` no ambiente ou configuração conectada em `loja_pagamento_config`.
- Falta validar o OAuth real com uma aplicação Mercado Pago configurada com redirect URI `/api/mercado-pago/store-oauth/callback`.
- Renovação de refresh token foi implementada para criação de checkout e webhook, usando `refresh_token_encrypted` e `token_expires_at`.
- O checkout está limitado a 1 unidade por pedido.
- A proteção de estoque agora usa reserva transacional forte via tabela/RPC.
- O fallback de frete a combinar existe no formulário, mas o ideal é exigir seleção de frete calculado quando a operação da loja amadurecer.
- Painel de pedidos existe com alteração manual de status de entrega, filtros por pedido/pagamento/entrega e detalhe rápido de entrega/frete/pagamento.

## Critério de pronto do MVP

O MVP estará pronto quando:

- a loja pública exibir botão de checkout próprio apenas quando habilitado;
- o comprador preencher dados mínimos;
- o frete for calculado por CEP quando possível;
- o pedido for criado no banco;
- a preferência Mercado Pago for criada com `external_reference`;
- o comprador for redirecionado para Mercado Pago;
- o webhook da loja confirmar pagamento sem tocar no billing do InfraStudio;
- a página de sucesso mostrar o pedido;
- o pedido aparecer no painel interno;
- `npm run lint` e `npm run build` passarem no `backend/`.

## Estimativa

MVP técnico:

- 5 a 8 dias úteis.

Versão operacional completa:

- 12 a 18 dias úteis.

Essa estimativa considera que o projeto já tem base de loja, produto, Mercado Pago e Mercado Livre, mas ainda precisa separar domínio financeiro, comprador final, pedido próprio, frete e painel.

## Recomendação final

Implementar primeiro o checkout próprio de produto único, mantendo o botão atual do Mercado Livre como fallback. Isso entrega valor com risco controlado e preserva o fluxo atual enquanto a operação própria da loja amadurece.
