# Plano de Continuidade: Limites de Produtos do Mercado Livre

## Objetivo

Reduzir egress e evitar abuso do modo Free limitando quantos produtos do Mercado Livre entram no snapshot, na loja pública e no chat widget.

## Regra de produto

- Free: últimos 10 produtos.
- Basic: últimos 50 produtos.
- Plus: últimos 200 produtos.
- Pro: ilimitado.
- Scale: ilimitado.

## Implementado

- Limites centralizados em `backend/lib/public-planos.js`.
- Resolução server-side do limite em `backend/lib/mercado-livre-product-limits.js`.
- Sincronização do snapshot respeita o limite do plano e remove produtos fora da janela sincronizada.
- Busca do chat Mercado Livre respeita o limite do plano e não pagina além da cota.
- Loja pública limita a vitrine aos produtos permitidos pelo plano.
- API de snapshot retorna `snapshot.productLimit`.
- Box amarelo da aba Mercado Livre mostra o limite do plano e botão de upgrade.
- Sheet de planos mostra a capacidade de produtos Mercado Livre em cada plano.

## Cuidados para próximas alterações

- Não aumentar `poolLimit`, `limit` ou paginação do Mercado Livre sem aplicar o limite do plano.
- Não buscar todos os produtos para depois filtrar em memória.
- Se criar nova listagem pública ou nova ação do chat usando produtos ML, reutilizar `getMercadoLivreProductLimitForProject`.
- Manter a ordenação por produtos mais recentes como fonte principal.
- Se adicionar coluna de limite no banco futuramente, manter fallback para os valores acima.

## Próximos passos sugeridos

- Persistir o limite por plano no cadastro de planos, caso vire configuração comercial editável.
- Exibir aviso quando o snapshot antigo tiver mais itens que o limite até a próxima sincronização.
- Aplicar o mesmo limite nos facets de categorias, se a loja passar a exibir categorias de produtos antigos.
