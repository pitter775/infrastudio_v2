# Plano Loja Mercado Livre

Este arquivo agora lista somente o que ainda falta implementar.

## Estado atual ja entregue

- aba `Mercado Livre > Loja` criada
- configuracao de loja salva no banco
- landing publica `/loja/{slug}` pronta em tema claro
- pagina SSR de produto `/loja/{slug}/produto/{produtoSlug}` pronta
- `sheet` de produto na navegacao interna da loja
- vitrine baseada em `mercadolivre_produtos_snapshot`
- busca, filtros simples, ordenacao e paginação basica prontas
- chatwidget do projeto carregando na loja
- base de sync manual do snapshot pronta no backend
- indices aditivos do snapshot preparados em `database/seeder/`

## Pendencias pos-MVP

- validar a loja publica com uma loja ativa e dados reais
- revisar pequenos ajustes de UX que aparecerem no uso real
- avaliar se o `sheet` atual do produto precisa de mais informacao visual
- fortalecer SEO da loja
- avaliar landing por categoria
- avaliar analytics da loja
- avaliar dominio proprio
- estudar variacoes futuras de layout

## Regras que continuam valendo

- nunca usar `select *`
- sempre buscar apenas os campos necessarios
- sempre usar `limit` nas listagens
- manter paginação nas consultas de produto
- nao chamar API do Mercado Livre na renderizacao publica
- manter sync manual/controlado antes de qualquer automacao
- usar lazy loading em imagens sempre que possivel
