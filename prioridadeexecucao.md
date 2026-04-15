entenda o projeto em C:\Projetos\infrastudio_v2\AGENTS.md

OBJETIVO:
Corrigir bugs + finalizar fluxo para produção

---

## 1. ATENDIMENTO (CHAT)

* Corrigir sheet mobile:

  * abrir acima do chat (z-index)
  * evitar abrir por baixo

* Implementar:

  * botão voltar (mobile) fecha sheet

* Ajustar balões:

  * suportar formatação estilo WhatsApp
  * multiline + negrito

---

## 2. WHATSAPP

* Criar flag:

  * responder apenas contatos NÃO salvos

* Corrigir:

  * envio mensagem atendimento → WhatsApp
  * envio anexos (bidirecional)

---

## 3. BILLING / PLANOS


* Plano FREE:

  * sem pagamento ativo
  * bloquear ao atingir limite

* Corrigir:

  * cálculo de custo (tokens + uso)
  * billing não está contabilizando

* Adicionar:

  * compra de créditos
  * alerta via WhatsApp quando créditos acabando

----

remover efeito que deixa o campo de texto branco quando o navegador tem opcao de preenchimento 

---

## 4. MERCADO LIVRE

* Capturar seller_id:

  * ler do HTML da página
  * aguardar ~5s antes de buscar

* Corrigir fluxo:

  * não perder estado ao abrir tutorial (sheet)

* Adicionar:

  * link oficial para APP_ID / CLIENT

* Ao adicionar produto:

  * iniciar cadastro automaticamente no link do produto tem o seller_id no codigo fonte aguardar ~5s antes de buscar



---

## 6. NOTIFICAÇÕES

* Corrigir sino (topbar) colocar para funcionar aviso com numeros 

* Regras:

  * admin → tudo
  * usuário → apenas seus eventos

* Criar:

  * página /avisos com histórico


---


no menu principal os botoes atendimento - feedback e notificacoes se tiver algo novo aparece a quantidade pequena em cima do botao 




## 7. USUÁRIO

* Atualizar perfil:

  * foto via login social
   adicionar a opcao de subir foto manual no perfil
  * upload manual

  adicionar a foto no lugar do avatar onde puder 

---

## 8. UI / FLUXO

* Ao clicar em plano:

  * abrir modal login/cadastro

* Definir regras plano FREE

---


---

## 11. LOGIN SOCIAL

* Google ✔️
* Facebook ✔️ remover instagram

Callback:
https://infrastudio.pro/api/auth/oauth/callback


ADICIONAR NO ENV os dados do login pelo facebook

ID do Aplicativo
953631767383610

	
Chave Secreta do Aplicativo
b1c2a00cb209c2a74ab747224cbe1fec


criar uma pagina publica de Política de Privacidade
---

## REGRAS IMPORTANTES

* código simples e direto
* evitar libs desnecessárias
* priorizar funcionamento
* evitar reescrever estrutura existente
* manter padrão atual do projeto

---

## PRIORIDADE

1. Atendimento funcionando
2. WhatsApp estável
3. Billing correto
4. Integrações externas
5. UI/UX final

---

no final de tudo 
atualizar todo o contexto do AGENTS com a nova realidade  AGENTS SO codex usa e nao o usuario 