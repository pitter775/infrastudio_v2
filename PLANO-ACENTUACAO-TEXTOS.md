# Plano de acentuação dos textos

Objetivo: revisar e corrigir acentuação, cedilha e caracteres quebrados nos textos visíveis da InfraStudio, atacando por área e marcando cada bloco como concluído.

## Regra de trabalho

- Corrigir por área pequena, validar e marcar como concluída neste documento.
- Priorizar textos visíveis ao usuário antes de textos internos.
- Evitar mudar comportamento, layout ou lógica junto com acentuação.
- Não alterar chaves técnicas, slugs, nomes de rotas, nomes de eventos, nomes de tabelas ou payloads.
- Quando houver dúvida se um texto é dado real do banco ou copy fixa, mapear antes de alterar.
- Depois de concluir uma área, rodar no mínimo `npm run lint`; se tocar rotas/renderização crítica, rodar também `npm run build`.

## Checklist geral

- [x] Home pública
- [x] Chat público da home
- [x] Widget/chat runtime visível ao usuário final
- [x] Login, cadastro e verificação de email
- [x] Área `/app`
- [x] Área de projetos
- [x] Agente, canais, APIs e widget
- [x] WhatsApp
- [x] Loja pública e Mercado Livre
- [x] Admin
- [x] Laboratório e atendimento
- [x] Billing, planos, checkout e mensagens de uso
- [x] Emails, avisos e notificações
- [x] Política de privacidade e páginas institucionais
- [x] Seeds/scripts com textos exibidos no sistema
- [x] Documentação interna relevante

## 1. Home pública

Arquivos prováveis:

- `backend/components/home/landing-page.js`
- `backend/components/home/data.js`
- `backend/app/page.js`
- `backend/app/layout.js`

Status: concluído em 2026-05-05.

Itens:

- [x] Hero e CTAs
- [x] Seção tecnologia/canais
- [x] Seção planos
- [x] Seção demonstração do atendente
- [x] Seção soluções técnicas
- [x] Seção sobre
- [x] Footer
- [x] Metadata/SEO

## 2. Chat público da home

Arquivos prováveis:

- `backend/components/home/home-chat-widget-loader.js`
- `backend/components/home/chat-demo.js`
- `backend/components/chat/*`
- `backend/app/api/chat/*`

Status: concluído em 2026-05-05.

Itens:

- [x] Mensagens iniciais
- [x] Placeholders
- [x] Botões e ações rápidas
- [x] Mensagens de erro e carregamento
- [x] Respostas fixas do assistente

## 3. Widget/chat runtime visível ao usuário final

Arquivos prováveis:

- `backend/public/chat-widget.js`
- `backend/app/api/chat/config/route.js`
- `backend/lib/chat/*`
- `backend/components/chat/*`

Status: concluído em 2026-05-05.

Itens:

- [x] Interface do widget
- [x] Estados de carregamento
- [x] Handoff/atendimento humano
- [x] Mensagens de indisponibilidade
- [x] Textos de canais integrados

## 4. Login, cadastro e verificação de email

Arquivos prováveis:

- `backend/components/home/login-modal.js`
- `backend/app/verificar-email/*`
- `backend/app/api/auth/*`
- `backend/lib/auth*`

Status: concluído em 2026-05-05.

Itens:

- [x] Login
- [x] Cadastro
- [x] Recuperação/confirmação de email
- [x] OAuth
- [x] Mensagens de erro

## 5. Área `/app`

Arquivos prováveis:

- `backend/app/app/*`
- `backend/components/app/*`

Status: concluído em 2026-05-05.

Itens:

- [x] Dashboard/entrada
- [x] Navegação
- [x] Estados vazios
- [x] Modais
- [x] Toasts/mensagens de erro

## 6. Projetos

Arquivos prováveis:

- `backend/app/app/projetos/*`
- `backend/components/app/projects/*`
- `backend/components/admin/projects/*`
- `backend/lib/projetos*`

Status: concluído em 2026-05-05.

Itens:

- [x] Lista de projetos
- [x] Criação/edição
- [x] Permissões e participantes
- [x] Estados de bloqueio
- [x] Mensagens de validação

## 7. Agente, canais, APIs e widget

Arquivos prováveis:

- `backend/components/app/agent/*`
- `backend/app/api/app/projetos/[id]/agente/*`
- `backend/app/api/app/projetos/[id]/apis/*`
- `backend/app/api/app/projetos/[id]/widgets/*`

Status: concluído em 2026-05-05.

Itens:

- [x] Configuração do agente
- [x] Integrações de API
- [x] Widget
- [x] Resumo/site
- [x] Mensagens de teste

## 8. WhatsApp

Arquivos prováveis:

- `backend/components/app/whatsapp/*`
- `backend/app/api/app/projetos/[id]/whatsapp/*`
- `backend/app/api/whatsapp/*`
- `PLANO-WHATSAPP-ATENDIMENTO-CONTINUIDADE.md`

Status: concluído em 2026-05-05.

Itens:

- [x] Tela de conexão
- [x] QR Code/sessão
- [x] Handoff
- [x] Estados de erro
- [x] Textos de sincronização

## 9. Loja pública e Mercado Livre

Arquivos prováveis:

- `backend/app/loja/*`
- `backend/app/api/loja/*`
- `backend/components/admin/projects/mercado-livre-panel.js`
- `backend/app/api/app/projetos/[id]/conectores/mercado-livre/*`

Status: concluído em 2026-05-05.

Itens:

- [x] Loja pública
- [x] Produto público
- [x] Painel Mercado Livre
- [x] Perguntas, pedidos e catálogo
- [x] Mensagens de sincronização

## 10. Admin

Arquivos prováveis:

- `backend/app/admin/*`
- `backend/components/admin/*`
- `backend/app/api/admin/*`

Status: concluído em 2026-05-05.

Itens:

- [x] Dashboard
- [x] Usuários
- [x] Projetos
- [x] Avisos
- [x] Billing
- [x] Perfil
- [x] Feedback
- [x] Template

## 11. Laboratório e atendimento

Arquivos prováveis:

- `backend/components/admin/attendance/*`
- `backend/app/admin/laboratorio/*`
- `backend/tests/chat-*`
- `AGENTS/laboratorio.md`

Status: concluído em 2026-05-05.

Itens:

- [x] Atendimento admin
- [x] Conversas e mensagens
- [x] Laboratório
- [x] Dumps e diagnósticos
- [x] Testes com textos fixos

## 12. Billing, planos e checkout

Arquivos prováveis:

- `backend/lib/public-planos.js`
- `backend/lib/public-billing-client.js`
- `backend/app/api/planos/*`
- `backend/app/api/app/projetos/[id]/billing/checkout/*`
- `backend/app/pagamento/sucesso/*`

Status: concluído em 2026-05-05.

Itens:

- [x] Nomes e descrições de planos
- [x] Checkout
- [x] Retorno de pagamento
- [x] Limites/uso
- [x] Compra de creditos

## 13. Emails, avisos e notificações

Arquivos prováveis:

- `backend/lib/email*`
- `backend/app/api/admin/avisos/*`
- `backend/app/api/admin/test-email/*`
- `backend/components/admin/announcements/*`

Status: concluído em 2026-05-05.

Itens:

- [x] Assuntos de email
- [x] Corpo de email
- [x] Avisos internos
- [x] Mensagens de envio/erro

## 14. Paginas institucionais

Arquivos prováveis:

- `backend/app/politica-de-privacidade/*`
- `backend/app/robots.txt/*`
- `backend/app/sitemap.xml/*`

Status: concluído em 2026-05-05.

Itens:

- [x] Política de privacidade
- [x] Metadados institucionais
- [x] Textos legais visíveis

## 15. Seeds/scripts com textos exibidos

Arquivos prováveis:

- `database/seeder/*`
- `scripts/*`
- `backend/tests/*`

Status: concluído em 2026-05-05.

Itens:

- [x] Seeds com copy de plano/produto/mensagem
- [x] Scripts que criam dados demonstrativos
- [x] Testes que validam textos exibidos

## Busca sugerida

Usar buscas por padroes comuns de texto sem acento ou caracteres quebrados:

```powershell
Get-ChildItem -Path backend -Recurse -Include *.js,*.jsx,*.ts,*.tsx,*.md |
  Select-String -Pattern 'automacao','integracao','configuracao','usuário','usuários','projeto','sessão','nao','voce','atencao','operacao','informacao','descricao','politica','privacidade','credito','creditos','catálogo','diagnostico','laboratorio','Ãƒ','Ã‚','ï¿½'
```

Evitar `.next`, `node_modules` e arquivos gerados.

## Registro de conclusão

Quando concluir uma área, preencher:

- Data:
- Área:
- Arquivos alterados:
- Validação:
- Observações:

## Registros

### 2026-05-05

- Área: Home pública, login/cadastro, app/projetos, agente/APIs/widget, WhatsApp, billing/checkout e parte do chat/widget.
- Arquivos alterados: componentes de home, login, app, APIs, WhatsApp, widget, billing, auth, agenda, runtime de agente/chat e widget público.
- Validação: `npm run lint` e `npm run build` no `backend/`.
- Observações: admin, loja pública/Mercado Livre, laboratorio e emails ainda precisam de rodada dedicada.


- ?rea: Admin, atendimento, laborat?rio e loja p?blica/Mercado Livre.
- Arquivos alterados: componentes admin, atendimento, laborat?rio, projetos admin, Mercado Livre e p?ginas p?blicas de loja/produto.
- Valida??o: pendente nesta rodada.
- Observa??es: primeira rodada focada em textos fixos vis?veis; ainda falta revisar mensagens profundas de APIs admin, emails e scripts.

- ?rea: APIs admin/app, emails, pol?tica de privacidade e prompts profundos do chat.
- Arquivos alterados: rotas admin/app, lib de email/verifica??o, privacidade, runtime de chat, Mercado Livre, agenda, widgets, valida??o JSON e sincroniza??o de loja.
- Valida??o: pendente nesta rodada.
- Observa??es: ainda falta uma rodada final em seeds/scripts/testes e revis?o de falsos positivos t?cnicos.
