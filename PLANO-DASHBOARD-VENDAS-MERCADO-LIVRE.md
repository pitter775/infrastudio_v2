# Plano: Dashboard de Vendas do Mercado Livre

## Objetivo

Criar um dashboard de vendas para lojas conectadas ao Mercado Livre dentro do InfraStudio, usando pedidos reais da conta autorizada via OAuth.

O dashboard deve ajudar o usuário a acompanhar faturamento, pedidos, ticket médio, produtos vendidos, cancelamentos e evolução das vendas sem depender de consulta direta e repetida à API do Mercado Livre em cada abertura de tela.

## Contexto atual do projeto

O projeto já possui base funcional para Mercado Livre:

- OAuth do Mercado Livre.
- Conector por projeto.
- Consulta de itens.
- Consulta de pedidos recentes.
- Consulta e resposta de perguntas.
- Loja pública baseada em snapshot.
- Aba `Mercado Livre` no painel do projeto.
- Rota atual de pedidos:
  - `backend/app/api/app/projetos/[id]/conectores/mercado-livre/orders/route.js`
- Função atual de listagem:
  - `listMercadoLivreOrdersForUser`
  - `listMercadoLivreOrders`
- Mapper atual de pedido:
  - `backend/lib/mercado-livre/mappers.js`
  - `mapMercadoLivreOrder`

Hoje a listagem de pedidos é ao vivo, paginada e pequena. Isso é suficiente para validação operacional, mas não é ideal para dashboard analítico.

## Decisão técnica principal

O dashboard não deve consultar a API do Mercado Livre diretamente para montar todos os gráficos em tempo real.

A abordagem recomendada é criar uma camada de snapshot/persistência dos pedidos no banco e montar o dashboard a partir do Supabase.

Motivos:

- Reduz chamadas externas ao Mercado Livre.
- Melhora performance da tela.
- Evita paginação pesada em tempo real.
- Permite histórico confiável.
- Permite agregações por período.
- Evita egress e payload desnecessário.
- Segue a política do projeto de consultas enxutas, com `limit`, seleção explícita e sem `select *`.

## Regras do AGENTS aplicadas

- Não criar estrutura paralela.
- Reaproveitar o conector atual do Mercado Livre.
- Reaproveitar componentes e padrões existentes do painel.
- Não editar `database/geral-schema.sql`.
- Qualquer ajuste de banco deve entrar em `database/seeder/`.
- Toda query deve buscar apenas o necessário.
- Evitar N+1.
- Evitar polling sem controle.
- Usar `limit`, filtros por projeto e filtros por período.
- Textos visíveis ao usuário devem estar em português correto, com acentos e cedilha.
- Performance deve ser tratada como regra, principalmente em banco, egress e queries.
- Não fazer push sem pedido explícito.

## Escopo do MVP

### Comportamento no painel Mercado Livre

O dashboard deve ser a primeira experiência da aba Mercado Livre quando a loja já estiver conectada e tiver dados de vendas sincronizados.

Fluxo esperado:

- Se a loja ainda não estiver conectada:
  - mostrar primeiro o fluxo de conexão.
  - orientar o usuário a conectar a conta Mercado Livre.
- Se a loja estiver conectada, mas ainda não houver vendas sincronizadas:
  - mostrar estado vazio do dashboard.
  - oferecer ação clara para sincronizar vendas.
  - manter acesso à conexão para revisão dos dados OAuth.
- Se a loja estiver conectada e houver vendas:
  - abrir primeiro no dashboard.
  - exibir KPIs, gráficos e análises.
  - manter as demais áreas acessíveis pelo menu do topo.

### Menu superior da aba Mercado Livre

Adicionar o botão/aba `Dashboard` no menu superior do sheet Mercado Livre.

Ordem desejada:

1. `Dashboard`
2. `Conexão`
3. `Teste`
4. `Loja`
5. `Pedidos`
6. `Perguntas`
7. `Ajuda`

Observação:

- A aba `Pedidos` deve ser mantida por enquanto.
- O dashboard passa a concentrar a visão completa de vendas.
- A aba `Pedidos` continua útil como listagem operacional e fallback durante a evolução.

### Indicadores principais

- Faturamento bruto no período.
- Total de pedidos.
- Total de pedidos pagos/concluídos.
- Total de pedidos cancelados.
- Ticket médio.
- Total de itens vendidos.
- Produto mais vendido.
- Data da última sincronização.

### Filtros

- Período:
  - Hoje.
  - Últimos 7 dias.
  - Últimos 30 dias.
  - Mês atual.
  - Personalizado.
- Status do pedido.
- Projeto/loja conectada.

### Visualizações

- Cards de KPIs.
- Gráfico de vendas por dia.
- Gráfico de pedidos por status.
- Ranking de produtos vendidos.
- Lista dos últimos pedidos.
- Bloco de saúde da integração:
  - Conta conectada.
  - Última sincronização.
  - Erro mais recente.
  - Quantidade de pedidos sincronizados.

## Escopo posterior

- Comparativo com período anterior.
- Receita por categoria.
- Conversão entre perguntas e vendas, quando houver dado suficiente.
- Produtos com venda recorrente.
- Produtos sem venda.
- Tempo médio entre criação e fechamento do pedido.
- Projeção simples de faturamento mensal.
- Alertas operacionais:
  - queda de vendas;
  - muitos cancelamentos;
  - integração sem sincronizar;
  - aumento de perguntas sem resposta.

## Banco de dados proposto

Criar as tabelas via arquivo novo em `database/seeder/`.

Nome sugerido:

- `database/seeder/2026-05-11-mercadolivre-sales-dashboard.sql`

### Tabela `mercadolivre_pedidos_snapshot`

Campos sugeridos:

- `id uuid primary key default gen_random_uuid()`
- `projeto_id uuid not null references projetos(id) on delete cascade`
- `connector_id uuid null`
- `mercadolivre_order_id text not null`
- `status text null`
- `status_detail text null`
- `currency_id text null`
- `total_amount numeric(12,2) not null default 0`
- `paid_amount numeric(12,2) null`
- `total_items integer not null default 0`
- `buyer_id text null`
- `buyer_nickname text null`
- `shipping_id text null`
- `date_created timestamptz null`
- `date_closed timestamptz null`
- `date_last_updated timestamptz null`
- `tags jsonb not null default '[]'::jsonb`
- `raw_summary jsonb not null default '{}'::jsonb`
- `synced_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Índices:

- unique em `(projeto_id, mercadolivre_order_id)`
- índice em `(projeto_id, date_created desc)`
- índice em `(projeto_id, date_closed desc)`
- índice em `(projeto_id, status)`
- índice em `(projeto_id, synced_at desc)`

### Tabela `mercadolivre_pedido_itens_snapshot`

Campos sugeridos:

- `id uuid primary key default gen_random_uuid()`
- `projeto_id uuid not null references projetos(id) on delete cascade`
- `pedido_snapshot_id uuid not null references mercadolivre_pedidos_snapshot(id) on delete cascade`
- `mercadolivre_order_id text not null`
- `item_id text null`
- `title text null`
- `quantity integer not null default 0`
- `unit_price numeric(12,2) not null default 0`
- `currency_id text null`
- `category_id text null`
- `variation_id text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Índices:

- índice em `(projeto_id, item_id)`
- índice em `(projeto_id, title)`
- índice em `(pedido_snapshot_id)`

### Tabela opcional `mercadolivre_vendas_sync_state`

Campos sugeridos:

- `projeto_id uuid primary key references projetos(id) on delete cascade`
- `connector_id uuid null`
- `last_success_at timestamptz null`
- `last_error_at timestamptz null`
- `last_error_message text null`
- `last_order_date_created timestamptz null`
- `last_order_date_updated timestamptz null`
- `total_orders_synced integer not null default 0`
- `updated_at timestamptz not null default now()`

## Sincronização

Criar uma rotina incremental que:

1. Carrega o conector Mercado Livre do projeto.
2. Garante OAuth válido usando o fluxo atual.
3. Busca pedidos na API do Mercado Livre com paginação controlada.
4. Normaliza os campos necessários.
5. Faz upsert em `mercadolivre_pedidos_snapshot`.
6. Faz upsert/replace dos itens em `mercadolivre_pedido_itens_snapshot`.
7. Atualiza `mercadolivre_vendas_sync_state`.

### Regras de performance da sincronização

- Limitar páginas por execução.
- Limitar quantidade máxima de pedidos por execução.
- Usar busca incremental por data quando possível.
- Não salvar payload bruto completo se não for necessário.
- Salvar apenas `raw_summary` enxuto para auditoria e troubleshooting.
- Não fazer sync automático agressivo.
- Evitar polling contínuo.

### Entrypoints sugeridos

- Botão manual:
  - `POST /api/app/projetos/[id]/conectores/mercado-livre/sales/sync`
- Dados do dashboard:
  - `GET /api/app/projetos/[id]/conectores/mercado-livre/sales/dashboard`
- Lista paginada de pedidos persistidos:
  - `GET /api/app/projetos/[id]/conectores/mercado-livre/sales/orders`

## API do dashboard

Criar uma rota que recebe filtros e devolve payload agregado enxuto.

Exemplo de query params:

- `period=7d`
- `status=paid`
- `from=2026-05-01`
- `to=2026-05-11`
- `limit=10`

Payload sugerido:

```json
{
  "summary": {
    "grossRevenue": 1234.56,
    "ordersCount": 18,
    "paidOrdersCount": 15,
    "cancelledOrdersCount": 2,
    "averageTicket": 68.58,
    "itemsSold": 31
  },
  "salesByDay": [
    {
      "date": "2026-05-11",
      "revenue": 250.9,
      "ordersCount": 4
    }
  ],
  "ordersByStatus": [
    {
      "status": "paid",
      "count": 15
    }
  ],
  "topProducts": [
    {
      "itemId": "MLB123",
      "title": "Produto exemplo",
      "quantity": 5,
      "revenue": 399.5
    }
  ],
  "recentOrders": [
    {
      "id": "123456789",
      "status": "paid",
      "totalAmount": 99.9,
      "dateCreated": "2026-05-11T12:00:00.000Z",
      "firstItemTitle": "Produto exemplo"
    }
  ],
  "sync": {
    "lastSuccessAt": "2026-05-11T12:10:00.000Z",
    "lastErrorAt": null,
    "lastErrorMessage": null
  }
}
```

## UI sugerida

Adicionar uma aba nova dentro do painel Mercado Livre ou uma seção dedicada:

- `Mercado Livre > Vendas`

Nome final recomendado no produto:

- `Dashboard`

Componentes:

- Cabeçalho com loja conectada e botão `Sincronizar agora`.
- Cards de KPIs.
- Gráfico de vendas por dia.
- Gráfico de status.
- Ranking de produtos.
- Últimos pedidos.
- Estado vazio quando não houver pedidos sincronizados.
- Estado de erro quando OAuth/sync falhar.

### Gráficos premium

Esta área precisa ter acabamento visual superior ao restante das abas operacionais.

Requisitos visuais:

- Visual premium compatível com o tema escuro atual.
- Gráficos legíveis em fundo escuro.
- Cores com contraste bom, sem depender de uma paleta monocromática.
- Tooltip bem desenhado.
- Estados vazios elegantes.
- Responsivo para desktop e mobile.
- Densidade operacional, sem aparência de landing page.
- Evitar excesso de brilho, gradientes decorativos e elementos que prejudiquem leitura.

Gráficos desejados no MVP:

- Linha ou área para evolução de faturamento por dia.
- Barras para volume de pedidos por dia.
- Donut ou barras horizontais para status dos pedidos.
- Ranking visual de produtos vendidos.

Biblioteca/componente:

- A escolha final pode aguardar avaliação de componentes de gráfico.
- A integração deve respeitar o padrão do projeto, evitar peso desnecessário no bundle e funcionar bem com Next.js.
- Se for usar biblioteca externa, validar impacto no build e no carregamento da área administrativa.

Padrões visuais:

- Usar Tailwind.
- Reaproveitar `Button` e componentes existentes.
- Usar `lucide-react` para ícones.
- Não duplicar utilitários.
- Evitar cards aninhados.
- Manter layout denso e operacional.

## Arquivos prováveis

Banco:

- `database/seeder/2026-05-11-mercadolivre-sales-dashboard.sql`

Backend:

- `backend/lib/mercado-livre-sales-dashboard.js`
- `backend/app/api/app/projetos/[id]/conectores/mercado-livre/sales/sync/route.js`
- `backend/app/api/app/projetos/[id]/conectores/mercado-livre/sales/dashboard/route.js`
- `backend/app/api/app/projetos/[id]/conectores/mercado-livre/sales/orders/route.js`

UI:

- `backend/components/admin/projects/mercado-livre-panel.js`
- Possível extração:
  - `backend/components/admin/projects/mercado-livre-sales-panel.js`

Mapper:

- `backend/lib/mercado-livre/mappers.js`

## Ordem de implementação recomendada

1. Criar migration/seeder das tabelas novas em `database/seeder/`.
2. Expandir o mapper de pedido para incluir itens e campos de data relevantes.
3. Criar lib de sincronização com upsert enxuto.
4. Criar rota manual de sync.
5. Criar rota agregada do dashboard.
6. Criar UI da aba `Vendas`.
7. Validar com conta real/sandbox.
8. Ajustar índices conforme query real.
9. Avaliar automação futura via webhook ou cron controlado.

## Validação

Comandos esperados conforme impacto:

- `cd backend && npm run lint`
- `cd backend && npm run build`

Validações manuais:

- Conectar conta Mercado Livre.
- Rodar sync manual.
- Conferir pedidos persistidos.
- Abrir dashboard.
- Trocar período.
- Confirmar KPIs.
- Confirmar ranking de produtos.
- Confirmar estado vazio.
- Confirmar erro de OAuth expirado.

## Riscos

- Permissões OAuth insuficientes para pedidos em conta real.
- Diferença entre status bruto do Mercado Livre e status comercial esperado pelo usuário.
- Dados financeiros podem exigir cuidado com estorno, cancelamento, descontos e frete.
- API do Mercado Livre pode limitar paginação ou volume.
- Pedido pode mudar depois da primeira sincronização.

## Mitigações

- Começar com faturamento bruto e status simples.
- Guardar `date_last_updated` quando disponível.
- Fazer upsert por `mercadolivre_order_id`.
- Reprocessar pedidos recentes em cada sync.
- Exibir data da última sincronização.
- Tratar erro de OAuth de forma clara.
- Não prometer conciliação financeira completa no MVP.

## Critério de pronto do MVP

O MVP estará pronto quando:

- O usuário conseguir sincronizar pedidos do Mercado Livre.
- Os pedidos ficarem persistidos no banco.
- O dashboard carregar sem chamar a API do Mercado Livre para cada gráfico.
- KPIs principais aparecerem corretamente.
- Ranking de produtos funcionar.
- Últimos pedidos forem listados.
- Estados vazio, carregando e erro estiverem tratados.
- Build do backend passar.

## Conclusão

O dashboard de vendas é viável e faz sentido para o produto.

A implementação deve começar por uma base persistida e incremental de pedidos, não por gráficos montados diretamente sobre a API ao vivo. Isso mantém o projeto alinhado com as regras de performance, reduz egress, melhora experiência do usuário e abre caminho para análises comerciais mais úteis.
