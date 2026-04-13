# Melhoria: usuario comum com visual do admin

Objetivo: usuario comum deve usar o mesmo visual/layout do admin, mas sem acesso aos modulos restritos e sempre vendo apenas seus dados.

## Ordem recomendada

### 1. Unificar shell visual
- [x] Comparar `backend/components/admin/layout/shell.js` com `backend/components/app/layout/shell.js`.
- [x] Criar um shell compartilhado ou fazer `/app/layout.js` usar `AdminShell`.
- [x] Manter o mesmo fundo, sidebar, header, largura recolhida e comportamento mobile do admin.
- [ ] Evitar duplicar CSS/componente.

### 2. Menu por permissao
- [ ] Centralizar itens de menu em uma lista unica.
- [x] Marcar como `adminOnly`:
  - Adriana
  - Laboratorio
  - Usuarios
  - Billing
- [x] Usuario comum deve ver o restante:
  - Dashboard
  - Projetos
  - Atendimento
  - Feedback, se fizer sentido para dados dele
- [x] Remover link visual para modulos bloqueados quando `user.role !== "admin"`.

### 3. Bloqueio real de rotas
- [x] Em cada page/layout restrito, bloquear usuario comum:
  - `/admin/adriana`
  - `/admin/laboratorio`
  - `/admin/usuarios`
  - `/admin/billing`
- [x] Redirecionar para `/admin/projetos` ou dashboard permitido.
- [x] Nao depender apenas do menu escondido.

### 4. Dados filtrados por usuario
- [ ] Revisar `backend/lib/projetos.js`: manter `listProjectsForUser` e `getProjectForUser` usando `memberships`.
- [x] Revisar dashboard para nao somar dados globais para usuario comum.
- [x] Revisar atendimento para listar somente conversas/projetos do usuario.
- [x] Revisar feedback para listar somente dados dos projetos do usuario.
- [ ] Revisar APIs, WhatsApp, widgets e agente por `projeto_id` acessivel ao usuario.

### 5. Rotas API
- [x] Garantir que endpoints `/api/admin/*` validem permissao.
- [x] Endpoints restritos devem exigir `role === "admin"`.
- [x] Endpoints de atendimento e feedback aceitam usuario comum somente no escopo permitido.

### 6. Teste minimo
- [ ] Login admin: visual igual ao atual e todos os menus aparecem.
- [ ] Login usuario comum: mesmo visual, sem Adriana/Laboratorio/Usuarios/Billing.
- [ ] Usuario comum acessando rota restrita direto deve ser bloqueado.
- [ ] Usuario comum deve ver apenas seus projetos/dados.
- [ ] Admin continua vendo dados globais.

## Esforco estimado

- So visual + menu: 3-4h.
- Visual + bloqueio de rota + dados seguros: 6-10h.

## Regra de execucao

Fazer nesta ordem para economizar retrabalho:

1. Shell compartilhado.
2. Menu filtrado.
3. Bloqueio de rotas.
4. Filtro de dados.
5. Teste manual curto.
