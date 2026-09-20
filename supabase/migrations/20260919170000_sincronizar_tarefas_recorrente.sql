-- ============================================================================
-- Migration 0007: edição de recorrência reflete nas tarefas não iniciadas
-- - Extrai o cálculo do período (competência, prazo e meta) para um helper,
--   usado tanto na geração quanto na sincronização.
-- - sincronizar_tarefas_recorrente(id): copia os dados da recorrência para as
--   tarefas dela que ainda estão pendentes (não iniciadas). O prazo e a meta só
--   são recalculados na tarefa do período atual; nas pendentes de períodos
--   anteriores mantêm-se as datas originais.
-- ============================================================================

create or replace function public.periodo_recorrente(
  r public.recorrentes,
  out competencia date,
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
    prazo_dia := hoje;
  elsif r.frequencia = 'semanal' then
    competencia := date_trunc('week', hoje)::date; -- segunda-feira
    -- dias_semana: 0=domingo..6=sábado -> deslocamento a partir da segunda
    select coalesce(max((d + 6) % 7), 6) into offset_semana from unnest(r.dias_semana) as d;
    prazo_dia := competencia + offset_semana;
  else
    competencia := date_trunc('month', hoje)::date;
    ultimo_dia := (competencia + interval '1 month - 1 day')::date;
    prazo_dia := competencia + (least(coalesce(r.dia_mes, extract(day from ultimo_dia)::int),
                                      extract(day from ultimo_dia)::int) - 1);
  end if;

  prazo := (prazo_dia + r.prazo_hora) at time zone tz;
  meta := case when r.meta_hora is not null then (prazo_dia + r.meta_hora) at time zone tz else null end;
end;
$$;

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
begin
  -- Chamada por admin (pela interface) ou pela edge function (service_role).
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'Sem permissão para gerar tarefas recorrentes.';
  end if;

  for r in
    select * from public.recorrentes
    where ativo and (p_recorrente_id is null or id = p_recorrente_id)
  loop
    select * into p from public.periodo_recorrente(r);

    insert into public.tarefas (
      titulo, descricao, tipo, recorrente_id, competencia, setor_id, cliente_id,
      responsavel_tipo, responsavel_id, prioridade, status, prazo, meta
    ) values (
      r.titulo, r.descricao, 'recorrente', r.id, p.competencia, r.setor_id, r.cliente_id,
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
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'Sem permissão para sincronizar tarefas recorrentes.';
  end if;

  select * into r from public.recorrentes where id = p_recorrente_id;
  if not found then
    return 0;
  end if;

  select * into p from public.periodo_recorrente(r);

  update public.tarefas t
  set titulo = r.titulo,
      descricao = r.descricao,
      setor_id = r.setor_id,
      cliente_id = r.cliente_id,
      responsavel_tipo = r.responsavel_tipo,
      responsavel_id = case when r.responsavel_tipo = 'usuario' then r.responsavel_id else null end,
      prioridade = r.prioridade,
      prazo = case when t.competencia = p.competencia then p.prazo else t.prazo end,
      meta = case when t.competencia = p.competencia then p.meta else t.meta end
  where t.recorrente_id = r.id
    and t.status = 'pendente'
    and t.data_inicio is null;

  get diagnostics qtd = row_count;
  return qtd;
end;
$$;

revoke all on function public.periodo_recorrente(public.recorrentes) from public, anon;
revoke all on function public.sincronizar_tarefas_recorrente(uuid) from public, anon;
grant execute on function public.sincronizar_tarefas_recorrente(uuid) to authenticated, service_role;
