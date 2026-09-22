-- ============================================================================
-- Migration 0012: anexos de tarefas
-- Permite anexar documentos a uma tarefa antes de iniciada (pendente) ou
-- durante a execução (andamento). Depois de concluída/cancelada, os anexos
-- já enviados continuam visíveis (histórico), mas não é possível enviar
-- novos nem excluir os existentes.
--
--  * tarefa_anexos: metadados (nome original, caminho no Storage, tamanho,
--    tipo, quem enviou).
--  * Bucket "tarefa-anexos" (privado): arquivos em "{tarefa_id}/{uuid}.ext".
--    O nome do arquivo não entra no caminho (evita acentos/espaços na key);
--    o nome original fica em tarefa_anexos.nome_arquivo.
--  * Quem pode enviar/ver/excluir segue a mesma regra de quem pode agir na
--    tarefa (admin, ou o responsável, ou alguém do setor responsável).
-- ============================================================================

create table if not exists public.tarefa_anexos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null default public.current_empresa_id() references public.empresas (id) on delete restrict,
  tarefa_id     uuid not null references public.tarefas (id) on delete cascade,
  nome_arquivo  text not null,
  caminho       text not null unique,
  tamanho_bytes bigint not null,
  tipo_mime     text,
  enviado_por   uuid default public.current_usuario_id() references public.usuarios (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists tarefa_anexos_tarefa_id_idx on public.tarefa_anexos (tarefa_id);
create index if not exists tarefa_anexos_empresa_id_idx on public.tarefa_anexos (empresa_id);

alter table public.tarefa_anexos enable row level security;

-- SELECT: quem já pode ver a tarefa (a subconsulta em "tarefas" aplica a
-- própria RLS de tarefas_select, então isto já fica isolado por empresa).
drop policy if exists tarefa_anexos_select on public.tarefa_anexos;
create policy tarefa_anexos_select on public.tarefa_anexos
  for select using (
    empresa_id = public.current_empresa_id()
    and exists (select 1 from public.tarefas t where t.id = tarefa_anexos.tarefa_id)
  );

-- INSERT: só enquanto a tarefa está pendente ou em andamento, e só quem
-- pode agir nela (admin, o responsável, ou o setor responsável).
drop policy if exists tarefa_anexos_insert on public.tarefa_anexos;
create policy tarefa_anexos_insert on public.tarefa_anexos
  for insert with check (
    empresa_id = public.current_empresa_id()
    and enviado_por = public.current_usuario_id()
    and exists (
      select 1 from public.tarefas t
      where t.id = tarefa_anexos.tarefa_id
        and t.empresa_id = public.current_empresa_id()
        and t.status in ('pendente', 'andamento')
        and (
          public.is_admin()
          or (t.responsavel_tipo = 'usuario' and t.responsavel_id = public.current_usuario_id())
          or (t.responsavel_tipo = 'setor' and t.setor_id = public.current_usuario_setor_id())
        )
    )
  );

-- DELETE: admin, ou quem enviou — e só enquanto a tarefa não foi concluída.
drop policy if exists tarefa_anexos_delete on public.tarefa_anexos;
create policy tarefa_anexos_delete on public.tarefa_anexos
  for delete using (
    empresa_id = public.current_empresa_id()
    and (public.is_admin() or enviado_por = public.current_usuario_id())
    and exists (
      select 1 from public.tarefas t
      where t.id = tarefa_anexos.tarefa_id
        and t.empresa_id = public.current_empresa_id()
        and t.status <> 'concluida'
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: bucket privado + políticas em storage.objects
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tarefa-anexos', 'tarefa-anexos', false, 20971520, -- 20 MB
  array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'application/zip'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS em storage.objects já vem ativado por padrão em todo projeto Supabase
-- (a tabela pertence ao papel supabase_storage_admin; não temos permissão
-- para alterá-la, só para criar policies nela).

-- name = "{tarefa_id}/{uuid}.ext" -> foldername(name)[1] é o tarefa_id.
drop policy if exists tarefa_anexos_storage_select on storage.objects;
create policy tarefa_anexos_storage_select on storage.objects
  for select using (
    bucket_id = 'tarefa-anexos'
    and exists (
      select 1 from public.tarefas t
      join public.usuarios u on u.empresa_id = t.empresa_id and u.auth_user_id = auth.uid() and u.ativo
      where t.id::text = (storage.foldername(objects.name))[1]
        and (
          u.role = 'admin'
          or (t.responsavel_tipo = 'usuario' and t.responsavel_id = u.id)
          or (t.responsavel_tipo = 'setor' and t.setor_id = u.setor_id)
        )
    )
  );

drop policy if exists tarefa_anexos_storage_insert on storage.objects;
create policy tarefa_anexos_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'tarefa-anexos'
    and exists (
      select 1 from public.tarefas t
      join public.usuarios u on u.empresa_id = t.empresa_id and u.auth_user_id = auth.uid() and u.ativo
      where t.id::text = (storage.foldername(objects.name))[1]
        and t.status in ('pendente', 'andamento')
        and (
          u.role = 'admin'
          or (t.responsavel_tipo = 'usuario' and t.responsavel_id = u.id)
          or (t.responsavel_tipo = 'setor' and t.setor_id = u.setor_id)
        )
    )
  );

-- DELETE do arquivo: precisa da linha em tarefa_anexos (por isso a exclusão,
-- no código, apaga o arquivo do Storage ANTES de apagar a linha de metadados).
drop policy if exists tarefa_anexos_storage_delete on storage.objects;
create policy tarefa_anexos_storage_delete on storage.objects
  for delete using (
    bucket_id = 'tarefa-anexos'
    and exists (
      select 1 from public.tarefa_anexos a
      join public.tarefas t on t.id = a.tarefa_id
      join public.usuarios u on u.empresa_id = t.empresa_id and u.auth_user_id = auth.uid() and u.ativo
      where a.caminho = objects.name
        and t.status <> 'concluida'
        and (u.role = 'admin' or a.enviado_por = u.id)
    )
  );
