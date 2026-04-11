Deixei o fallback legado desligável por flag e o v2 mais pronto para operar como pipeline principal.

O que entrou em backend/lib/chat/service.js (line 1):

isLegacyChatFallbackEnabled()
processChatRequest() agora:
tenta fluxo principal do v2
tenta executor local da IA
só cai no legado se a flag permitir
Também mantive a base de anexos integrada:

backend/lib/chat-attachments.js (line 1)
Cobertura:

backend/tests/chat-intelligence.smoke.ts (line 1) subiu para 36 smoke tests
adicionei teste para desligar o fallback legado por CHAT_ALLOW_LEGACY_FALLBACK=false
Validação:

npm run test:chat-intelligence ok com 36 smoke tests
npm run test:chat-intelligence:scenarios ok
npm run build ok
relatório novo em backend/analises/chat-intelligence-2026-04-11T20-36-10-829Z.md (line 1)
Estado real agora:

o v2 já está local-first
o legado virou fallback controlado
já dá para começar a testar o chat com a fallback flag desligada em ambiente controlado
Percentual atualizado:

base da inteligência/orquestração: ~98%
autonomia do backend de chat frente ao legado: ~95%
Próximo passo lógico:

testar POST /api/chat com CHAT_ALLOW_LEGACY_FALLBACK=false
se o comportamento estiver estável, o próximo corte é remover de vez a dependência do chat-service.ts legado


Hoje no v2 temos um harness bom de sustentação, mas o gap para o legado está na largura dos cenários, não mais na estrutura dos testes.

Arquivos atuais no v2:

backend/tests/chat-intelligence.smoke.ts (line 1)
backend/tests/chat-intelligence.scenarios.ts (line 1)
backend/tests/chat-source.ts (line 1)
backend/tests/chat-test-fixtures.ts (line 1)
Estado atual:

smoke: 36 testes
scenario runner: 6 cenários
categorias atuais do runner:
catalog: 2
api: 1
handoff: 1
whatsapp: 1
service: 1
No legado, o que existe de referência prática está nos relatórios em:

analise-chat-test-2026-04-06T03-08-46-113Z.md (line 1)
analise-chat-test-2026-04-06T00-43-35-686Z.md (line 1)
Cobertura de cenários do legado nesses relatórios:

