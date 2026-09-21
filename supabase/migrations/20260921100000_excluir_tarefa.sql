-- ============================================================================
-- Migration 0011: exclusão de tarefas (somente administradores)
--  * excluir_tarefa(id): apaga tarefa que ainda não foi concluída, da empresa
--    ativa. Concluídas não podem ser excluídas.
--  * Ao excluir uma tarefa gerada por recorrência, o período dela fica
--    registrado em "recorrentes_puladas" para a rotina diária NÃO recriá-la
--    (senão a tarefa "ressuscitaria" no dia seguinte).
-- ============================================================================

create table if not exists public.recorrentes_puladas (
  recorrente_id uuid not null references public.recorrentes (id) on delete cascade,
  competencia   date not null,
  empresa_id    uuid not null default public.current_empresa_id() references public.empresas (id) on delete restrict,
  created_at    timestamptz not null default now(),
  primary key (recorrente_id, competencia)
);

create index if not exists recorrentes_puladas_empresa_idx on public.recorrentes_puladas (empresa_id);

alter table public.recorrentes_puladas enable row level security;

drop policy if exists recorrentes_puladas_select on public.recorrentes_puladas;
create policy recorrentes_puladas_select on public.recorrentes_puladas
  for select using (empresa_id = public.current_empresa_id() and public.is_admin());

create or replace function public.excluir_tarefa(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tarefas%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem excluir tarefas.';
  end if;

  select * into t from public.tarefas
  where id = p_id and empresa_id = public.current_empresa_id();
  if not found then
    return false;
  end if;

  if t.status = 'concluida' then
    raise exception 'Tarefas concluídas não podem ser excluídas.';
  end if;

  if t.recorrente_id is not null and t.competencia is not null then
    insert into public.recorrentes_puladas (recorrente_id, competencia, empresa_id)
    values (t.recorrente_id, t.competencia, t.empresa_id)
    on conflict do nothing;
  end if;

  delete from public.tarefas where id = p_id;
  return true;
end;
$$;

revoke all on function public.excluir_tarefa(uuid) from public, anon;
grant execute on function public.excluir_tarefa(uuid) to authenticated, service_role;

-- A geração respeita os períodos pulados.
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

    -- Já existe tarefa no período (inclusive as antigas, com competência diferente).
    if exists (
      select 1 from public.tarefas t
      where t.recorrente_id = r.id and t.competencia between p.competencia and p.fim
    ) then
      continue;
    end if;

    -- Tarefa do período foi excluída por um administrador: não recriar.
    if exists (
      select 1 from public.recorrentes_puladas x
      where x.recorrente_id = r.id and x.competencia between p.competencia and p.fim
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
