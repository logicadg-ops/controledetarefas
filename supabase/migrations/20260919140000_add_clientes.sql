-- ============================================================================
-- Migration 0004: cadastro de clientes + vínculo com tarefas
-- Permite medir o tempo demandado por cliente (dia/mês/ano), somando o
-- tempo de execução (data_inicio -> data_conclusao) das tarefas vinculadas.
-- ============================================================================

create table if not exists public.clientes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  ativo      boolean not null default true,
  exemplo    boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.tarefas
  add column if not exists cliente_id uuid references public.clientes (id) on delete set null;

create index if not exists tarefas_cliente_id_idx on public.tarefas (cliente_id);

-- ---------------------------------------------------------------------------
-- RLS: mesma regra de "setores" — leitura aberta a autenticados, escrita só admin.
-- ---------------------------------------------------------------------------
alter table public.clientes enable row level security;

create policy clientes_select on public.clientes
  for select using (auth.role() = 'authenticated');
create policy clientes_insert on public.clientes
  for insert with check (public.is_admin());
create policy clientes_update on public.clientes
  for update using (public.is_admin()) with check (public.is_admin());
create policy clientes_delete on public.clientes
  for delete using (public.is_admin());
