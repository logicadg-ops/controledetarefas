-- ============================================================================
-- Migration 0009: vínculos do usuário via função (sem expor linhas de outras
-- empresas em "usuarios")
--  * usuarios_select volta a ser estritamente da empresa ativa.
--  * minhas_empresas(): empresas onde a pessoa logada tem vínculo ativo
--    (alimenta o seletor de empresa).
-- ============================================================================

create or replace function public.minhas_empresas()
returns table (id uuid, nome text, role text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.nome, u.role
  from public.usuarios u
  join public.empresas e on e.id = u.empresa_id and e.ativa
  where u.auth_user_id = auth.uid() and u.ativo
  order by e.nome;
$$;

revoke all on function public.minhas_empresas() from public, anon;
grant execute on function public.minhas_empresas() to authenticated, service_role;

drop policy if exists usuarios_select on public.usuarios;
create policy usuarios_select on public.usuarios
  for select using (empresa_id = public.current_empresa_id());

drop policy if exists empresas_select on public.empresas;
create policy empresas_select on public.empresas
  for select using (
    public.is_plataforma_admin()
    or exists (select 1 from public.minhas_empresas() m where m.id = empresas.id)
  );
