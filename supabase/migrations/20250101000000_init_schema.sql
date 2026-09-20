-- ============================================================================
-- Painel de Tarefas — Condomais PE
-- Migration 0001: schema inicial (tabelas, funções auxiliares, RLS)
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- SETORES
-- ---------------------------------------------------------------------------
create table if not exists public.setores (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  ativo      boolean not null default true,
  exemplo    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- USUARIOS
-- Cada linha representa uma pessoa da equipe (o "usuário" demandado).
-- auth_user_id fica NULL até a pessoa aceitar o convite do Supabase Auth
-- com o mesmo e-mail cadastrado aqui (ver trigger link_usuario_on_signup).
-- ---------------------------------------------------------------------------
create table if not exists public.usuarios (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  nome          text not null,
  email         text,
  whatsapp      text,
  cargo         text,
  setor_id      uuid references public.setores (id) on delete restrict,
  role          text not null default 'comum' check (role in ('admin', 'comum')),
  ativo         boolean not null default true,
  exemplo       boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists usuarios_setor_id_idx on public.usuarios (setor_id);
create index if not exists usuarios_auth_user_id_idx on public.usuarios (auth_user_id);

-- ---------------------------------------------------------------------------
-- RECORRENTES
-- Modelos de tarefa recorrente. Uma função agendada (edge function
-- "daily-tasks") gera as instâncias do dia na tabela "tarefas".
-- ---------------------------------------------------------------------------
create table if not exists public.recorrentes (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null,
  descricao         text not null default '',
  setor_id          uuid not null references public.setores (id) on delete restrict,
  responsavel_tipo  text not null default 'usuario' check (responsavel_tipo in ('usuario', 'setor')),
  responsavel_id    uuid references public.usuarios (id) on delete restrict,
  frequencia        text not null check (frequencia in ('diaria', 'semanal', 'mensal')),
  dias_semana       int[] not null default '{}',   -- 0=domingo .. 6=sábado (frequencia = 'semanal')
  dia_mes           int,                            -- 1..31 (frequencia = 'mensal')
  prazo_hora        time not null default '18:00',
  prioridade        text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  ativo             boolean not null default true,
  exemplo           boolean not null default false,
  created_at        timestamptz not null default now(),
  constraint recorrentes_responsavel_check check (
    (responsavel_tipo = 'usuario' and responsavel_id is not null) or
    (responsavel_tipo = 'setor')
  )
);

create index if not exists recorrentes_setor_id_idx on public.recorrentes (setor_id);

-- ---------------------------------------------------------------------------
-- TAREFAS
-- Tarefas avulsas e instâncias geradas de recorrências.
-- ---------------------------------------------------------------------------
create table if not exists public.tarefas (
  id                uuid primary key default gen_random_uuid(),
  titulo            text not null,
  descricao         text not null default '',
  tipo              text not null default 'avulsa' check (tipo in ('avulsa', 'recorrente')),
  recorrente_id     uuid references public.recorrentes (id) on delete set null,
  competencia       date,                            -- data de referência da instância recorrente
  setor_id          uuid not null references public.setores (id) on delete restrict,
  responsavel_tipo  text not null default 'usuario' check (responsavel_tipo in ('usuario', 'setor')),
  responsavel_id    uuid references public.usuarios (id) on delete restrict,
  prioridade        text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  status            text not null default 'pendente' check (status in ('pendente', 'andamento', 'concluida', 'cancelada')),
  prazo             timestamptz not null,
  data_criacao      timestamptz not null default now(),
  data_conclusao    timestamptz,
  no_prazo          boolean,                         -- calculado no momento da conclusão
  criado_por        uuid references public.usuarios (id) on delete set null,
  concluido_por     uuid references public.usuarios (id) on delete set null,
  exemplo           boolean not null default false,
  constraint tarefas_responsavel_check check (
    (responsavel_tipo = 'usuario' and responsavel_id is not null) or
    (responsavel_tipo = 'setor')
  )
);

create index if not exists tarefas_setor_id_idx on public.tarefas (setor_id);
create index if not exists tarefas_responsavel_id_idx on public.tarefas (responsavel_id);
create index if not exists tarefas_status_idx on public.tarefas (status);
create index if not exists tarefas_prazo_idx on public.tarefas (prazo);

-- Evita gerar duas vezes a mesma instância de uma recorrência no mesmo dia.
create unique index if not exists tarefas_recorrente_competencia_unica
  on public.tarefas (recorrente_id, competencia)
  where recorrente_id is not null;

-- ---------------------------------------------------------------------------
-- CONFIG_GERAL (linha única de configuração: webhook do WhatsApp/n8n etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.config_geral (
  id                    int primary key default 1 check (id = 1),
  webhook_url           text not null default '',
  antecedencia_horas    int not null default 24,
  notificar_whatsapp    boolean not null default false,
  updated_at            timestamptz not null default now()
);
insert into public.config_geral (id) values (1) on conflict (id) do nothing;

-- ============================================================================
-- FUNÇÕES AUXILIARES (usadas nas policies de RLS)
-- ============================================================================

create or replace function public.current_usuario_id()
returns uuid
language sql
stable
as $$
  select id from public.usuarios where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.current_usuario_setor_id()
returns uuid
language sql
stable
as $$
  select setor_id from public.usuarios where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (select role = 'admin' from public.usuarios where auth_user_id = auth.uid()),
    false
  );
$$;

-- Vincula automaticamente um usuário do Supabase Auth ao cadastro em
-- "usuarios" com o mesmo e-mail, assim que essa pessoa aceita o convite
-- e cria a própria conta.
create or replace function public.link_usuario_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.usuarios
     set auth_user_id = new.id
   where email = new.email
     and auth_user_id is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_usuario_on_signup();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.setores      enable row level security;
alter table public.usuarios     enable row level security;
alter table public.recorrentes  enable row level security;
alter table public.tarefas      enable row level security;
alter table public.config_geral enable row level security;

-- SETORES: qualquer pessoa autenticada lê; só admin escreve.
create policy setores_select on public.setores
  for select using (auth.role() = 'authenticated');
create policy setores_insert on public.setores
  for insert with check (public.is_admin());
create policy setores_update on public.setores
  for update using (public.is_admin()) with check (public.is_admin());
create policy setores_delete on public.setores
  for delete using (public.is_admin());

-- USUARIOS: leitura aberta (nomes/setores precisam aparecer em toda a UI);
-- só admin cria, edita papel/vínculo ou exclui.
create policy usuarios_select on public.usuarios
  for select using (auth.role() = 'authenticated');
create policy usuarios_insert on public.usuarios
  for insert with check (public.is_admin());
create policy usuarios_update on public.usuarios
  for update using (public.is_admin()) with check (public.is_admin());
create policy usuarios_delete on public.usuarios
  for delete using (public.is_admin());

-- RECORRENTES: gestão é assunto de administrador.
create policy recorrentes_select on public.recorrentes
  for select using (public.is_admin());
create policy recorrentes_insert on public.recorrentes
  for insert with check (public.is_admin());
create policy recorrentes_update on public.recorrentes
  for update using (public.is_admin()) with check (public.is_admin());
create policy recorrentes_delete on public.recorrentes
  for delete using (public.is_admin());

-- CONFIG_GERAL: só administrador vê/edita (contém a URL do webhook).
create policy config_select on public.config_geral
  for select using (public.is_admin());
create policy config_update on public.config_geral
  for update using (public.is_admin()) with check (public.is_admin());

-- TAREFAS: o coração do controle de acesso.
--   Admin vê e gerencia tudo.
--   Usuário comum vê só o que foi demandado para ele OU para o setor dele,
--   só cria tarefas para si mesmo (dentro do próprio setor) e não exclui.
create policy tarefas_select on public.tarefas
  for select using (
    public.is_admin()
    or (responsavel_tipo = 'usuario' and responsavel_id = public.current_usuario_id())
    or (responsavel_tipo = 'setor' and setor_id = public.current_usuario_setor_id())
  );

create policy tarefas_insert on public.tarefas
  for insert with check (
    public.is_admin()
    or (
      responsavel_tipo = 'usuario'
      and responsavel_id = public.current_usuario_id()
      and setor_id = public.current_usuario_setor_id()
    )
  );

create policy tarefas_update on public.tarefas
  for update using (
    public.is_admin()
    or (responsavel_tipo = 'usuario' and responsavel_id = public.current_usuario_id())
    or (responsavel_tipo = 'setor' and setor_id = public.current_usuario_setor_id())
  ) with check (
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
  );

create policy tarefas_delete on public.tarefas
  for delete using (public.is_admin());
