'use client'

// Sem estado próprio: só marca/desmarca todas as caixas "tarefa_ids" que
// existem na página (cada uma associada ao formulário via o atributo
// `form`, já que elas ficam dentro das linhas da tabela, fora deste form).
export function SelecionarTodas() {
  return (
    <input
      type="checkbox"
      aria-label="Selecionar todas as tarefas visíveis"
      title="Selecionar todas"
      onChange={(e) => {
        document
          .querySelectorAll<HTMLInputElement>('input[name="tarefa_ids"]')
          .forEach((cb) => (cb.checked = e.target.checked))
      }}
    />
  )
}
