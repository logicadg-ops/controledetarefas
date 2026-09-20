-- ============================================================================
-- Migration 0006: geração de tarefas recorrentes por período
-- A tarefa da recorrência é criada assim que ela é cadastrada e recriada na
-- virada do período: dia (diária), semana iniciada na segunda (semanal) ou
-- mês (mensal). Tudo no fuso de Brasília.
--
--   competencia = primeiro dia do período (dia / segunda-feira / dia 1º)
--   prazo       = diária: hoje | semanal: último dia da semana selecionado
--                 (sem seleção: domingo) | mensal: dia_mes (limitado ao fim
--                 do mês; sem dia_mes: último dia), sempre às prazo_hora
--   meta        = mesmo dia do prazo, às meta_hora
--
-- É idempotente: o índice único (recorrente_id, competencia) impede duplicar.
-- ============================================================================

create or replace function public.gerar_tarefas_recorrentes(p_recorrente_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  tz constant text := 'America/Sao_Paulo';
  hoje date := (now() at time zone tz)::date;
  r public.recorrentes%rowtype;
  comp date;
  ultimo_dia date;
  prazo_dia date;
  offset_semana int;
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
    if r.frequencia = 'diaria' then
      comp := hoje;
      prazo_dia := hoje;
    elsif r.frequencia = 'semanal' then
      comp := date_trunc('week', hoje)::date; -- segunda-feira
      -- dias_semana: 0=domingo..6=sábado -> deslocamento a partir da segunda
      select coalesce(max((d + 6) % 7), 6) into offset_semana from unnest(r.dias_semana) as d;
      prazo_dia := comp + offset_semana;
    else
      comp := date_trunc('month', hoje)::date;
      ultimo_dia := (comp + interval '1 month - 1 day')::date;
      prazo_dia := comp + (least(coalesce(r.dia_mes, extract(day from ultimo_dia)::int),
                                 extract(day from ultimo_dia)::int) - 1);
    end if;

    insert into public.tarefas (
      titulo, descricao, tipo, recorrente_id, competencia, setor_id, cliente_id,
      responsavel_tipo, responsavel_id, prioridade, status, prazo, meta
    ) values (
      r.titulo, r.descricao, 'recorrente', r.id, comp, r.setor_id, r.cliente_id,
      r.responsavel_tipo,
      case when r.responsavel_tipo = 'usuario' then r.responsavel_id else null end,
      r.prioridade, 'pendente',
      (prazo_dia + r.prazo_hora) at time zone tz,
      case when r.meta_hora is not null then (prazo_dia + r.meta_hora) at time zone tz else null end
    )
    on conflict (recorrente_id, competencia) where recorrente_id is not null do nothing;

    get diagnostics qtd = row_count;
    total := total + qtd;
  end loop;

  return total;
end;
$$;

revoke all on function public.gerar_tarefas_recorrentes(uuid) from public, anon;
grant execute on function public.gerar_tarefas_recorrentes(uuid) to authenticated, service_role;
