-- ============================================================================
-- Migration 0010: edição de recorrência alcança todas as tarefas do período
-- Problema: a sincronização só recalculava prazo/meta das tarefas cuja
-- "competencia" fosse exatamente o início do período. Tarefas antigas (criadas
-- quando a competência era o dia da geração, ex.: 14/09 em vez de 01/09) ficavam
-- de fora e, pior, a geração criava uma segunda tarefa para o mesmo período.
--
-- Agora:
--  * periodo_recorrente() também devolve o fim do período;
--  * gerar_tarefas_recorrentes() não cria tarefa se já existe uma no período;
--  * sincronizar_tarefas_recorrente():
--      1) remove duplicata legada pendente/não iniciada quando já existe a
--         tarefa "canônica" do período;
--      2) normaliza a competência da legada (quando não há canônica);
--      3) copia os dados da recorrência para todas as pendentes não iniciadas
--         e recalcula prazo/meta das que estão no período atual.
-- ============================================================================

drop function if exists public.periodo_recorrente(public.recorrentes);

create or replace function public.periodo_recorrente(
  r public.recorrentes,
  out competencia date,
  out fim date,
  out prazo timestamptz,
  out meta timestamptz
)
language plpgsql
stable
as $$
declare
  tz constant text := 'America/Sao_Paulo';
  hoje date := (now() at time zone tz)::date;
  ultimo_dia date;
  prazo_dia date;
  offset_semana int;
begin
  if r.frequencia = 'diaria' then
    competencia := hoje;
    fim := hoje;
    prazo_dia := hoje;
  elsif r.frequencia = 'semanal' then
    competencia := date_trunc('week', hoje)::date; -- segunda-feira
    fim := competencia + 6;
    -- dias_semana: 0=domingo..6=sábado -> deslocamento a partir da segunda
    select coalesce(max((d + 6) % 7), 6) into offset_semana from unnest(r.dias_semana) as d;
    prazo_dia := competencia + offset_semana;
  else
    competencia := date_trunc('month', hoje)::date;
    ultimo_dia := (competencia + interval '1 month - 1 day')::date;
    fim := ultimo_dia;
    prazo_dia := competencia + (least(coalesce(r.dia_mes, extract(day from ultimo_dia)::int),
                                      extract(day from ultimo_dia)::int) - 1);
  end if;

  prazo := (prazo_dia + r.prazo_hora) at time zone tz;
  meta := case when r.meta_hora is not null then (prazo_dia + r.meta_hora) at time zone tz else null end;
end;
$$;

revoke all on function public.periodo_recorrente(public.recorrentes) from public, anon;

create or replace function public.gerar_tarefas_recorrentes(p_recorrente_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.recorrentes%rowtype;
  p record;
  qtd int;
  total int := 0;
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if not v_service and not public.is_admin() then
    raise exception 'Sem permissão para gerar tarefas recorrentes.';
  end if;

  for r in
    select rec.* from public.recorrentes rec
    join public.empresas e on e.id = rec.empresa_id and e.ativa
    where rec.ativo
      and (p_recorrente_id is null or rec.id = p_recorrente_id)
      and (v_service or rec.empresa_id = public.current_empresa_id())
  loop
    select * into p from public.periodo_recorrente(r);

    -- Não cria se o período já tem tarefa (inclusive as antigas, com competência
    -- diferente do início do período).
    if exists (
      select 1 from public.tarefas t
      where t.recorrente_id = r.id and t.competencia between p.competencia and p.fim
    ) then
      continue;
    end if;

    insert into public.tarefas (
      empresa_id, titulo, descricao, tipo, recorrente_id, competencia, setor_id, cliente_id,
      responsavel_tipo, responsavel_id, prioridade, status, prazo, meta
    ) values (
      r.empresa_id, r.titulo, r.descricao, 'recorrente', r.id, p.competencia, r.setor_id, r.cliente_id,
      r.responsavel_tipo,
      case when r.responsavel_tipo = 'usuario' then r.responsavel_id else null end,
      r.prioridade, 'pendente', p.prazo, p.meta
    )
    on conflict (recorrente_id, competencia) where recorrente_id is not null do nothing;

    get diagnostics qtd = row_count;
    total := total + qtd;
  end loop;

  return total;
end;
$$;

create or replace function public.sincronizar_tarefas_recorrente(p_recorrente_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.recorrentes%rowtype;
  p record;
  qtd int;
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if not v_service and not public.is_admin() then
    raise exception 'Sem permissão para sincronizar tarefas recorrentes.';
  end if;

  select * into r from public.recorrentes
  where id = p_recorrente_id
    and (v_service or empresa_id = public.current_empresa_id());
  if not found then
    return 0;
  end if;

  select * into p from public.periodo_recorrente(r);

  -- 1) Duplicata legada: pendente/não iniciada no período, já existindo a
  --    tarefa canônica (competência = início do período).
  delete from public.tarefas t
  where t.recorrente_id = r.id
    and t.status = 'pendente'
    and t.data_inicio is null
    and t.competencia between p.competencia and p.fim
    and t.competencia <> p.competencia
    and exists (
      select 1 from public.tarefas c
      where c.recorrente_id = r.id and c.competencia = p.competencia
    );

  -- 2) Legada sem canônica: passa a valer como a tarefa do período.
  update public.tarefas t
  set competencia = p.competencia
  where t.id = (
      select x.id from public.tarefas x
      where x.recorrente_id = r.id
        and x.status = 'pendente'
        and x.data_inicio is null
        and x.competencia between p.competencia and p.fim
        and x.competencia <> p.competencia
      order by x.competencia, x.id
      limit 1
    )
    and not exists (
      select 1 from public.tarefas c
      where c.recorrente_id = r.id and c.competencia = p.competencia
    );

  -- 3) Dados da recorrência -> todas as pendentes não iniciadas; prazo/meta
  --    recalculados nas do período atual.
  update public.tarefas t
  set titulo = r.titulo,
      descricao = r.descricao,
      setor_id = r.setor_id,
      cliente_id = r.cliente_id,
      responsavel_tipo = r.responsavel_tipo,
      responsavel_id = case when r.responsavel_tipo = 'usuario' then r.responsavel_id else null end,
      prioridade = r.prioridade,
      prazo = case when t.competencia between p.competencia and p.fim then p.prazo else t.prazo end,
      meta = case when t.competencia between p.competencia and p.fim then p.meta else t.meta end
  where t.recorrente_id = r.id
    and t.status = 'pendente'
    and t.data_inicio is null;

  get diagnostics qtd = row_count;
  return qtd;
end;
$$;
