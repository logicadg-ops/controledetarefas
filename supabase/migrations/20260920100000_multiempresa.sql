-- ============================================================================
-- Migration 0008: multiempresa
-- Um único banco atende várias empresas, isoladas por "empresa_id" + RLS.
--
--  * empresas: cadastro das empresas (a atual vira "Condomais PE").
--  * plataforma_admins: donos da plataforma (criam/gerem empresas).
--  * usuarios continua sendo o "vínculo" pessoa x empresa: a mesma pessoa
--    (auth_user_id) pode ter uma linha em cada empresa.
--  * Empresa ativa da sessão: cabeçalho "x-empresa-id" enviado pelo app,
--    validado contra os vínculos da pessoa (não dá para escolher empresa
--    alheia). Sem cabeçalho, vale o vínculo mais antigo.
--  * Todo dado existente é vinculado à Condomais PE.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Empresas e donos da plataforma
-- ---------------------------------------------------------------------------
create table if not exists public.empresas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  cnpj          text,
  proprietario  text,
  email_admin   text,
  ativa         boolean not null default true,
  created_at    timestamptz not null default now()
);

create unique index if not exists empresas_cnpj_unico on public.empresas (cnpj) where cnpj is not null;

create table if not exists public.plataforma_admins (
  auth_user_id uuid primary key references auth.users (id) on delete cascade
);

insert into public.empresas (nome, cnpj, proprietario, email_admin)
select 'Condomais PE', '42.687.956/0001-53', 'Alex Ferreira Silva', 'alexfspe@gmail.com'
where not exists (select 1 from public.empresas where cnpj = '42.687.956/0001-53');

-- O dono da plataforma é quem administra a Condomais PE hoje.
insert into public.plataforma_admins (auth_user_id)
select auth_user_id from public.usuarios
where email = 'alexfspe@gmail.com' and auth_user_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2) empresa_id em todas as tabelas (dados atuais -> Condomais PE)
-- ---------------------------------------------------------------------------
alter table public.setores     add column if not exists empresa_id uuid references public.empresas (id) on delete restrict;
alter table public.usuarios    add column if not exists empresa_id uuid references public.empresas (id) on delete restrict;
alter table public.clientes    add column if not exists empresa_id uuid references public.empresas (id) on delete restrict;
alter table public.recorrentes add column if not exists empresa_id uuid references public.empresas (id) on delete restrict;
alter table public.tarefas     add column if not exists empresa_id uuid references public.empresas (id) on delete restrict;

update public.setores     set empresa_id = (select id from public.empresas where cnpj = '42.687.956/0001-53') where empresa_id is null;
update public.usuarios    set empresa_id = (select id from public.empresas where cnpj = '42.687.956/0001-53') where empresa_id is null;
update public.clientes    set empresa_id = (select id from public.empresas where cnpj = '42.687.956/0001-53') where empresa_id is null;
update public.recorrentes set empresa_id = (select id from public.empresas where cnpj = '42.687.956/0001-53') where empresa_id is null;
update public.tarefas     set empresa_id = (select id from public.empresas where cnpj = '42.687.956/0001-53') where empresa_id is null;

alter table public.setores     alter column empresa_id set not null;
alter table public.usuarios    alter column empresa_id set not null;
alter table public.clientes    alter column empresa_id set not null;
alter table public.recorrentes alter column empresa_id set not null;
alter table public.tarefas     alter column empresa_id set not null;

create index if not exists setores_empresa_id_idx     on public.setores (empresa_id);
create index if not exists usuarios_empresa_id_idx    on public.usuarios (empresa_id);
create index if not exists clientes_empresa_id_idx    on public.clientes (empresa_id);
create index if not exists recorrentes_empresa_id_idx on public.recorrentes (empresa_id);
create index if not exists tarefas_empresa_id_idx     on public.tarefas (empresa_id);

-- config_geral deixa de ser linha única: uma por empresa.
alter table public.config_geral add column if not exists empresa_id uuid references public.empresas (id) on delete cascade;
update public.config_geral set empresa_id = (select id from public.empresas where cnpj = '42.687.956/0001-53') where empresa_id is null;
alter table public.config_geral drop column if exists id;
alter table public.config_geral alter column empresa_id set not null;
alter table public.config_geral add primary key (empresa_id);

-- Uma pessoa pode ter vínculo em várias empresas, mas só um por empresa.
alter table public.usuarios drop constraint if exists usuarios_auth_user_id_key;
create unique index if not exists usuarios_empresa_auth_unico
  on public.usuarios (empresa_id, auth_user_id) where auth_user_id is not null;
create unique index if not exists usuarios_empresa_email_unico
  on public.usuarios (empresa_id, lower(email)) where email is not null;

-- ---------------------------------------------------------------------------
-- 3) Funções auxiliares (SECURITY DEFINER: as policies de "usuarios" chamam
--    estas funções, que por sua vez leem "usuarios" — evita recursão de RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_plataforma_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.plataforma_admins where auth_user_id = auth.uid());
$$;

create or replace function public.current_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select u.empresa_id
      from public.usuarios u
      join public.empresas e on e.id = u.empresa_id and e.ativa
      where u.auth_user_id = auth.uid()
        and u.ativo
        and u.empresa_id::text = nullif(coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-empresa-id', '')
    ),
    (
      select u.empresa_id
      from public.usuarios u
      join public.empresas e on e.id = u.empresa_id and e.ativa
      where u.auth_user_id = auth.uid() and u.ativo
      order by u.created_at, u.id
      limit 1
    )
  );
$$;

create or replace function public.current_usuario_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.usuarios
  where auth_user_id = auth.uid() and empresa_id = public.current_empresa_id()
  limit 1;
$$;

create or replace function public.current_usuario_setor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select setor_id from public.usuarios
  where auth_user_id = auth.uid() and empresa_id = public.current_empresa_id()
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.usuarios
     where auth_user_id = auth.uid() and empresa_id = public.current_empresa_id()),
    false
  );
$$;

-- Novos registros herdam a empresa ativa da sessão automaticamente.
alter table public.setores     alter column empresa_id set default public.current_empresa_id();
alter table public.usuarios    alter column empresa_id set default public.current_empresa_id();
alter table public.clientes    alter column empresa_id set default public.current_empresa_id();
alter table public.recorrentes alter column empresa_id set default public.current_empresa_id();
alter table public.tarefas     alter column empresa_id set default public.current_empresa_id();

-- Toda empresa nova nasce com a sua configuração.
create or replace function public.criar_config_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.config_geral (empresa_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists empresas_criar_config on public.empresas;
create trigger empresas_criar_config
  after insert on public.empresas
  for each row execute function public.criar_config_empresa();

-- ---------------------------------------------------------------------------
-- 4) Integridade: setor/cliente/responsável precisam ser da mesma empresa
-- ---------------------------------------------------------------------------
create or replace function public.checar_mesma_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  j jsonb := to_jsonb(new);
begin
  if j ->> 'setor_id' is not null and not exists (
    select 1 from public.setores where id = (j ->> 'setor_id')::uuid and empresa_id = new.empresa_id
  ) then
    raise exception 'O setor informado pertence a outra empresa.';
  end if;

  if j ->> 'cliente_id' is not null and not exists (
    select 1 from public.clientes where id = (j ->> 'cliente_id')::uuid and empresa_id = new.empresa_id
  ) then
    raise exception 'O cliente informado pertence a outra empresa.';
  end if;

  if j ->> 'responsavel_id' is not null and not exists (
    select 1 from public.usuarios where id = (j ->> 'responsavel_id')::uuid and empresa_id = new.empresa_id
  ) then
    raise exception 'O responsável informado pertence a outra empresa.';
  end if;

  return new;
end;
$$;

drop trigger if exists usuarios_mesma_empresa on public.usuarios;
create trigger usuarios_mesma_empresa
  before insert or update on public.usuarios
  for each row execute function public.checar_mesma_empresa();

drop trigger if exists recorrentes_mesma_empresa on public.recorrentes;
create trigger recorrentes_mesma_empresa
  before insert or update on public.recorrentes
  for each row execute function public.checar_mesma_empresa();

drop trigger if exists tarefas_mesma_empresa on public.tarefas;
create trigger tarefas_mesma_empresa
  before insert or update on public.tarefas
  for each row execute function public.checar_mesma_empresa();

-- ---------------------------------------------------------------------------
-- 5) RLS: tudo restrito à empresa ativa
-- ---------------------------------------------------------------------------
alter table public.empresas          enable row level security;
alter table public.plataforma_admins enable row level security;

-- EMPRESAS: cada pessoa vê as empresas onde tem vínculo; o dono da plataforma vê todas.
drop policy if exists empresas_select on public.empresas;
drop policy if exists empresas_insert on public.empresas;
drop policy if exists empresas_update on public.empresas;
drop policy if exists empresas_delete on public.empresas;
create policy empresas_select on public.empresas
  for select using (
    public.is_plataforma_admin()
    or exists (
      select 1 from public.usuarios u
      where u.auth_user_id = auth.uid() and u.empresa_id = empresas.id
    )
  );
create policy empresas_insert on public.empresas
  for insert with check (public.is_plataforma_admin());
create policy empresas_update on public.empresas
  for update using (public.is_plataforma_admin()) with check (public.is_plataforma_admin());
create policy empresas_delete on public.empresas
  for delete using (public.is_plataforma_admin());

drop policy if exists plataforma_admins_select on public.plataforma_admins;
create policy plataforma_admins_select on public.plataforma_admins
  for select using (auth_user_id = auth.uid());

-- SETORES
drop policy if exists setores_select on public.setores;
drop policy if exists setores_insert on public.setores;
drop policy if exists setores_update on public.setores;
drop policy if exists setores_delete on public.setores;
create policy setores_select on public.setores
  for select using (empresa_id = public.current_empresa_id());
create policy setores_insert on public.setores
  for insert with check (empresa_id = public.current_empresa_id() and public.is_admin());
create policy setores_update on public.setores
  for update using (empresa_id = public.current_empresa_id() and public.is_admin())
  with check (empresa_id = public.current_empresa_id() and public.is_admin());
create policy setores_delete on public.setores
  for delete using (empresa_id = public.current_empresa_id() and public.is_admin());

-- CLIENTES
drop policy if exists clientes_select on public.clientes;
drop policy if exists clientes_insert on public.clientes;
drop policy if exists clientes_update on public.clientes;
drop policy if exists clientes_delete on public.clientes;
create policy clientes_select on public.clientes
  for select using (empresa_id = public.current_empresa_id());
create policy clientes_insert on public.clientes
  for insert with check (empresa_id = public.current_empresa_id() and public.is_admin());
create policy clientes_update on public.clientes
  for update using (empresa_id = public.current_empresa_id() and public.is_admin())
  with check (empresa_id = public.current_empresa_id() and public.is_admin());
create policy clientes_delete on public.clientes
  for delete using (empresa_id = public.current_empresa_id() and public.is_admin());

-- USUARIOS: vê a equipe da empresa ativa + os próprios vínculos (seletor de empresa).
drop policy if exists usuarios_select on public.usuarios;
drop policy if exists usuarios_insert on public.usuarios;
drop policy if exists usuarios_update on public.usuarios;
drop policy if exists usuarios_delete on public.usuarios;
create policy usuarios_select on public.usuarios
  for select using (empresa_id = public.current_empresa_id() or auth_user_id = auth.uid());
create policy usuarios_insert on public.usuarios
  for insert with check (empresa_id = public.current_empresa_id() and public.is_admin());
create policy usuarios_update on public.usuarios
  for update using (empresa_id = public.current_empresa_id() and public.is_admin())
  with check (empresa_id = public.current_empresa_id() and public.is_admin());
create policy usuarios_delete on public.usuarios
  for delete using (empresa_id = public.current_empresa_id() and public.is_admin());

-- RECORRENTES
drop policy if exists recorrentes_select on public.recorrentes;
drop policy if exists recorrentes_insert on public.recorrentes;
drop policy if exists recorrentes_update on public.recorrentes;
drop policy if exists recorrentes_delete on public.recorrentes;
create policy recorrentes_select on public.recorrentes
  for select using (empresa_id = public.current_empresa_id() and public.is_admin());
create policy recorrentes_insert on public.recorrentes
  for insert with check (empresa_id = public.current_empresa_id() and public.is_admin());
create policy recorrentes_update on public.recorrentes
  for update using (empresa_id = public.current_empresa_id() and public.is_admin())
  with check (empresa_id = public.current_empresa_id() and public.is_admin());
create policy recorrentes_delete on public.recorrentes
  for delete using (empresa_id = public.current_empresa_id() and public.is_admin());

-- CONFIG_GERAL
drop policy if exists config_select on public.config_geral;
drop policy if exists config_update on public.config_geral;
create policy config_select on public.config_geral
  for select using (empresa_id = public.current_empresa_id() and public.is_admin());
create policy config_update on public.config_geral
  for update using (empresa_id = public.current_empresa_id() and public.is_admin())
  with check (empresa_id = public.current_empresa_id() and public.is_admin());

-- TAREFAS
drop policy if exists tarefas_select on public.tarefas;
drop policy if exists tarefas_insert on public.tarefas;
drop policy if exists tarefas_update on public.tarefas;
drop policy if exists tarefas_delete on public.tarefas;
create policy tarefas_select on public.tarefas
  for select using (
    empresa_id = public.current_empresa_id()
    and (
      public.is_admin()
      or (responsavel_tipo = 'usuario' and responsavel_id = public.current_usuario_id())
      or (responsavel_tipo = 'setor' and setor_id = public.current_usuario_setor_id())
    )
  );
create policy tarefas_insert on public.tarefas
  for insert with check (
    empresa_id = public.current_empresa_id()
    and (
      public.is_admin()
      or (
        responsavel_tipo = 'usuario'
        and responsavel_id = public.current_usuario_id()
        and setor_id = public.current_usuario_setor_id()
      )
    )
  );
create policy tarefas_update on public.tarefas
  for update using (
    empresa_id = public.current_empresa_id()
    and (
      public.is_admin()
      or (responsavel_tipo = 'usuario' and responsavel_id = public.current_usuario_id())
      or (responsavel_tipo = 'setor' and setor_id = public.current_usuario_setor_id())
    )
  ) with check (
    empresa_id = public.current_empresa_id()
    and (
      public.is_admin()
      or (
        responsavel_tipo = 'usuario'
        and responsavel_id = public.current_usuario_id()
        and setor_id = public.current_usuario_setor_id()
      )
      or (
        responsavel_tipo = 'setor'
        and setor_id = public.current_usuario_setor_id()
      )
    )
  );
create policy tarefas_delete on public.tarefas
  for delete using (empresa_id = public.current_empresa_id() and public.is_admin());

-- ---------------------------------------------------------------------------
-- 6) Geração/sincronização de recorrentes respeitam a empresa
--    service_role (edge function) percorre todas as empresas ativas;
--    admin pela interface só alcança as recorrências da própria empresa.
-- ---------------------------------------------------------------------------
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

revoke all on function public.is_plataforma_admin() from public, anon;
revoke all on function public.current_empresa_id() from public, anon;
grant execute on function public.is_plataforma_admin() to authenticated, service_role;
grant execute on function public.current_empresa_id() to authenticated, service_role;
