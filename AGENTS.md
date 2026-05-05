# AGENTS.md

Este arquivo agora e apenas o ponto de entrada rapido.

Leia primeiro:

1. [AGENTS/README.md](C:\Projetos\infrastudio_v2\AGENTS\README.md)
2. [AGENTS/basico.md](C:\Projetos\infrastudio_v2\AGENTS\basico.md)

Se a tarefa envolver chat/IA:

3. [AGENTS/chat-runtime.md](C:\Projetos\infrastudio_v2\AGENTS\chat-runtime.md)
4. [AGENTS/laboratorio.md](C:\Projetos\infrastudio_v2\AGENTS\laboratorio.md)

Se a tarefa envolver planos, checkout ou recarga de tokens:

5. [backend/lib/public-planos.js](C:\Projetos\infrastudio_v2\backend\lib\public-planos.js) - https://mpago.la/2sTv19y (1 real pra teste)

Se a tarefa envolver continuidade, backlog ou prioridades:

6. [AGENTS/roadmap.md](C:\Projetos\infrastudio_v2\AGENTS\roadmap.md)
7. [AGENTS/melhorias.md](C:\Projetos\infrastudio_v2\AGENTS\melhorias.md)

Regras minimas que nunca mudam:

- este projeto e o `infrastudio_v2`
- nao criar estrutura paralela
- nao duplicar componente ou utilitario existente
- nao reintroduzir imports do legado `C:\Projetos\infrastudio`
- o projeto usa UTF-8; textos visiveis ao usuario devem ser escritos em portugues correto, com acentos e cedilha
- toda evolucao do sistema deve tratar performance como regra, com foco especial em banco, egress e queries otimizadas
- toda leitura no banco deve buscar apenas o necessario, com `limit`, selecao enxuta e evitando `select *`, N+1 e polling sem controle
- novos ajustes de banco entram em `database/seeder/`, nunca em `database/geral-schema.sql`
- so fazer push se o usuario pedir
- remover de [AGENTS/melhorias.md] o que foi concluido
