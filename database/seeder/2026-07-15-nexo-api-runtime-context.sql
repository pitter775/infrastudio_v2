DO $$
DECLARE
  target_project_id uuid;
  target_agent_id uuid;
BEGIN
  SELECT id
    INTO target_project_id
    FROM public.projetos
   WHERE slug = 'projeto-nexo-leiloes'
   LIMIT 1;

  IF target_project_id IS NULL THEN
    RAISE NOTICE 'Projeto Nexo Leiloes nao encontrado.';
    RETURN;
  END IF;

  SELECT id
    INTO target_agent_id
    FROM public.agentes
   WHERE projeto_id = target_project_id
     AND slug = 'projeto-nexo-leiloes-assistente'
   LIMIT 1;

  IF target_agent_id IS NULL THEN
    RAISE NOTICE 'Agente Nexo Leiloes Assistente nao encontrado.';
    RETURN;
  END IF;

  UPDATE public.apis
     SET nome = U&'Buscar im\00F3veis',
         configuracoes = jsonb_build_object(
           'runtime',
           jsonb_build_object(
             'fields',
             jsonb_build_array(
               jsonb_build_object('nome', 'titulo', 'path', 'titulo', 'tipo', 'string', 'descricao', ''),
               jsonb_build_object('nome', 'descricao', 'path', 'descricao', 'tipo', 'string', 'descricao', ''),
               jsonb_build_object('nome', 'cidade', 'path', 'cidade', 'tipo', 'string', 'descricao', ''),
               jsonb_build_object('nome', 'estado', 'path', 'estado', 'tipo', 'string', 'descricao', ''),
               jsonb_build_object('nome', 'status', 'path', 'status', 'tipo', 'string', 'descricao', ''),
               jsonb_build_object('nome', 'valor_publico', 'path', 'valor_publico', 'tipo', 'number', 'descricao', ''),
               jsonb_build_object('nome', 'link_imovel', 'path', 'link_imovel', 'tipo', 'string', 'descricao', ''),
               jsonb_build_object('nome', 'imagens', 'path', 'imagens', 'tipo', 'json', 'descricao', '')
             ),
             'intentType', 'catalog_search',
             'availabilityScope', 'open_search',
             'presentation', 'list',
             'responseShape', 'list',
             'responsePath', 'imoveis',
             'autoExecute', true,
             'requiresConfirmation', false,
             'requiredFields',
             jsonb_build_array(
               jsonb_build_object('name', 'titulo', 'param', 'titulo', 'source', 'titulo', 'description', '')
             ),
             'display',
             jsonb_build_object(
               'titlePath', 'titulo',
               'descriptionPath', 'descricao',
               'pricePath', 'valor_publico',
               'imagesPath', 'imagens',
               'linkPath', 'link_imovel',
               'statusPath', 'status'
             ),
             'descriptionForIntent',
             'Busca imoveis pelo termo informado pelo cliente. Use somente em busca aberta, quando o cliente ainda nao estiver em um imovel especifico.'
           ),
           'bodyFields',
           jsonb_build_array(
             jsonb_build_object('name', 'titulo', 'type', 'string', 'required', true)
           )
         ),
         updated_at = now()
   WHERE projeto_id = target_project_id
     AND lower(nome) IN ('buscar imoveis', U&'buscar im\00F3veis');

  IF NOT EXISTS (
    SELECT 1
      FROM public.apis
     WHERE projeto_id = target_project_id
       AND lower(nome) IN ('consultar imovel', U&'consultar im\00F3vel')
  ) THEN
    INSERT INTO public.apis (
      projeto_id,
      nome,
      url,
      metodo,
      descricao,
      ativo,
      configuracoes
    )
    VALUES (
      target_project_id,
      U&'Consultar im\00F3vel',
      'https://nexo-imoveis.vercel.app/api/imoveis/{id}',
      'GET',
      U&'Consulta os dados completos do im\00F3vel aberto no site.',
      true,
      jsonb_build_object(
        'runtime',
        jsonb_build_object(
          'fields',
          jsonb_build_array(
            jsonb_build_object('nome', 'status', 'path', 'status', 'tipo', 'string', 'descricao', ''),
            jsonb_build_object('nome', 'ocupacao', 'path', 'detalhes.ocupacao', 'tipo', 'string', 'descricao', ''),
            jsonb_build_object('nome', 'riscos', 'path', 'detalhes.riscos', 'tipo', 'string', 'descricao', ''),
            jsonb_build_object('nome', 'analise', 'path', 'detalhes.analise', 'tipo', 'string', 'descricao', ''),
            jsonb_build_object('nome', 'estrategia', 'path', 'detalhes.estrategia', 'tipo', 'string', 'descricao', ''),
            jsonb_build_object('nome', 'titulo', 'path', 'titulo', 'tipo', 'string', 'descricao', ''),
            jsonb_build_object('nome', 'descricao', 'path', 'descricao', 'tipo', 'string', 'descricao', ''),
            jsonb_build_object('nome', 'matricula', 'path', 'detalhes.matricula', 'tipo', 'string', 'descricao', ''),
            jsonb_build_object('nome', 'cartorio', 'path', 'detalhes.cartorio', 'tipo', 'string', 'descricao', ''),
            jsonb_build_object('nome', 'valor_publico', 'path', 'valor_publico', 'tipo', 'number', 'descricao', ''),
            jsonb_build_object('nome', 'valor_mercado', 'path', 'detalhes.valor_mercado', 'tipo', 'number', 'descricao', ''),
            jsonb_build_object('nome', 'lance_recomendado', 'path', 'detalhes.lance_recomendado', 'tipo', 'number', 'descricao', ''),
            jsonb_build_object('nome', 'lucro_estimado', 'path', 'detalhes.lucro_estimado', 'tipo', 'number', 'descricao', ''),
            jsonb_build_object('nome', 'roi_estimado', 'path', 'detalhes.roi_estimado', 'tipo', 'number', 'descricao', ''),
            jsonb_build_object('nome', 'link_imovel', 'path', 'link_imovel', 'tipo', 'string', 'descricao', '')
          ),
          'intentType', 'lookup_by_identifier',
          'availabilityScope', 'context_item',
          'presentation', 'text',
          'responseShape', 'single_item',
          'autoExecute', true,
          'requiresConfirmation', false,
          'requiredFields',
          jsonb_build_array(
            jsonb_build_object('name', 'id', 'param', 'id', 'source', 'propertyId', 'description', 'ID do imovel aberto no site.')
          ),
          'display',
          jsonb_build_object(
            'titlePath', 'titulo',
            'descriptionPath', 'descricao',
            'pricePath', 'valor_publico',
            'linkPath', 'link_imovel',
            'statusPath', 'status'
          ),
          'descriptionForIntent',
          'Use para responder perguntas sobre o imovel atualmente aberto no site, como situacao, ocupacao, riscos, matricula, valores, estrategia e detalhes juridicos.'
        ),
        'bodyFields',
        jsonb_build_array(
          jsonb_build_object('name', 'id', 'type', 'string', 'required', true)
        )
      )
    );
  END IF;

  INSERT INTO public.agente_api (agente_id, api_id)
  SELECT target_agent_id, id
    FROM public.apis
   WHERE projeto_id = target_project_id
     AND lower(nome) IN (
       'buscar imoveis',
       U&'buscar im\00F3veis',
       'consultar imovel',
       U&'consultar im\00F3vel'
     )
     AND NOT EXISTS (
       SELECT 1
         FROM public.agente_api
        WHERE agente_id = target_agent_id
          AND api_id = public.apis.id
     );
END $$;
