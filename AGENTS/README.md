# AGENTS

Objetivo:

- manter a leitura rapida para o Codex
- evitar um `AGENTS.md` gigante
- separar contexto por assunto

Ordem recomendada de leitura:

1. `basico.md`
2. `chat-runtime.md` se a tarefa tocar IA/chat/widget
3. `runtime-intent-refactor.md` se a tarefa tocar orquestrador, intencao, billing, catalogo, API runtime ou qualquer regressao causada por heuristica
4. `laboratorio.md` se a tarefa exigir validacao/regressao
5. `roadmap.md` se a tarefa exigir continuidade
6. `melhorias.md` para ideias, backlog e operacao
7. `../PLANO-LOJA-MERCADO-LIVRE.md` se a tarefa envolver loja publica do Mercado Livre

Arquivos:

- [basico.md](C:\Projetos\infrastudio_v2\AGENTS\basico.md): regras base do workspace, stack e limites
- [chat-runtime.md](C:\Projetos\infrastudio_v2\AGENTS\chat-runtime.md): contrato, arquivos-chave e estado atual do cerebro
- [runtime-intent-refactor.md](C:\Projetos\infrastudio_v2\AGENTS\runtime-intent-refactor.md): arquivo de continuidade obrigatorio para reduzir heuristicas e migrar o runtime para estado + intent stage + handlers deterministas
- [laboratorio.md](C:\Projetos\infrastudio_v2\AGENTS\laboratorio.md): baseline, comandos, logs reais e pontos de falha mapeados no admin
- [roadmap.md](C:\Projetos\infrastudio_v2\AGENTS\roadmap.md): foco de retomada, backlog principal, bases entregues e ordem de ataque
- [melhorias.md](C:\Projetos\infrastudio_v2\AGENTS\melhorias.md): melhorias pendentes e oportunidades de produto/operacao

## Loja real para teste

- existe uma base real de teste da loja Mercado Livre em `Projeto Vitoria Rocha`
- nome publico da loja: `Reliquias de Familia`
- o comando para preparar essa base automaticamente e devolver URLs prontas e:
  - `cd backend && npm run prepare:mercado-livre-test-store -- --query "Reliquia"`
- esse preparo deve:
  - localizar projeto/loja por nome ou slug, mesmo sem acento
  - garantir widget vinculado e ativo
  - garantir loja ativa
  - religar `chat_widget_id`
  - sincronizar snapshot
  - devolver URLs de loja, produto e widget contract
