begin;

-- Limpeza manual de demos de teste.
-- Preserva somente o projeto template oficial configurado em DEMO_TEMPLATE_PROJECT_ID.
-- Template preservado: 5da7e3e5-f5fb-449d-b135-c78a19daaf5b
--
-- Escopo:
-- - remove projetos demo de teste
-- - remove dados relacionados a esses projetos
-- - remove usuarios demo de teste (email demonstracao_*) que sobrarem sem projeto/membership
--
-- Nao remove:
-- - usuarios reais
-- - projeto template oficial
-- - owner real do projeto template
--
-- Observacao:
-- Esta SQL limpa banco. Arquivos em storage (ex.: chat-attachments / agente-assets)
-- devem ser limpos pelo backend quando necessario.

create temp table tmp_demo_projects_to_delete on commit drop as
select p.id
from projetos p
where p.is_demo = true
  and p.id <> '5da7e3e5-f5fb-449d-b135-c78a19daaf5b';

create temp table tmp_demo_users_to_consider on commit drop as
select u.id
from usuarios u
where lower(coalesce(u.email, '')) like 'demonstracao\_%' escape '\'
  and not exists (
    select 1
    from projetos template
    where template.id = '5da7e3e5-f5fb-449d-b135-c78a19daaf5b'
      and template.owner_user_id = u.id
  );

create temp table tmp_demo_chats_to_delete on commit drop as
select c.id
from chats c
join tmp_demo_projects_to_delete p on p.id = c.projeto_id;

create temp table tmp_demo_apis_to_delete on commit drop as
select a.id
from apis a
join tmp_demo_projects_to_delete p on p.id = a.projeto_id;

create temp table tmp_demo_agents_to_delete on commit drop as
select a.id
from agentes a
join tmp_demo_projects_to_delete p on p.id = a.projeto_id;

delete from chat_handoff_eventos
where chat_id in (select id from tmp_demo_chats_to_delete);

delete from chat_handoffs
where chat_id in (select id from tmp_demo_chats_to_delete);

delete from mensagens
where chat_id in (select id from tmp_demo_chats_to_delete);

delete from agente_api
where api_id in (select id from tmp_demo_apis_to_delete)
   or agente_id in (select id from tmp_demo_agents_to_delete);

delete from api_campos
where api_id in (select id from tmp_demo_apis_to_delete);

delete from projetos_assinaturas
where projeto_id in (select id from tmp_demo_projects_to_delete);

delete from projetos_ciclos_uso
where projeto_id in (select id from tmp_demo_projects_to_delete);

delete from projetos_planos
where projeto_id in (select id from tmp_demo_projects_to_delete);

delete from usuarios_limites_ia
where projeto_id in (select id from tmp_demo_projects_to_delete);

delete from consumos
where projeto_id in (select id from tmp_demo_projects_to_delete);

delete from logs
where projeto_id in (select id from tmp_demo_projects_to_delete);

delete from segredos
where projeto_id in (select id from tmp_demo_projects_to_delete);

delete from whatsapp_handoff_contatos
where projeto_id in (select id from tmp_demo_projects_to_delete);

delete from chat_widgets
where projeto_id in (select id from tmp_demo_projects_to_delete);

delete from canais_whatsapp
where projeto_id in (select id from tmp_demo_projects_to_delete);

delete from conectores
where projeto_id in (select id from tmp_demo_projects_to_delete);

delete from agente_arquivos
where projeto_id in (select id from tmp_demo_projects_to_delete);

delete from usuarios_projetos
where projeto_id in (select id from tmp_demo_projects_to_delete);

delete from chats
where id in (select id from tmp_demo_chats_to_delete);

delete from apis
where id in (select id from tmp_demo_apis_to_delete);

delete from agentes
where id in (select id from tmp_demo_agents_to_delete);

delete from projetos
where id in (select id from tmp_demo_projects_to_delete);

delete from usuarios_projetos
where usuario_id in (select id from tmp_demo_users_to_consider);

delete from usuarios u
where u.id in (select id from tmp_demo_users_to_consider)
  and not exists (
    select 1
    from usuarios_projetos up
    where up.usuario_id = u.id
  )
  and not exists (
    select 1
    from projetos p
    where p.owner_user_id = u.id
  );

commit;
