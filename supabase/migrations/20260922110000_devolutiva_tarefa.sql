-- ============================================================================
-- Migration 0013: devolutiva da tarefa
-- Campo de texto livre para quem executa explicar algo extra sobre a
-- conclusão (ou o andamento) da tarefa. Reaproveita a policy de UPDATE já
-- existente em "tarefas" (tarefas_update): admin, o responsável, ou alguém
-- do setor responsável — nenhuma policy nova é necessária.
-- ============================================================================

alter table public.tarefas
  add column if not exists devolutiva text;
