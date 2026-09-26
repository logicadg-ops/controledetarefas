'use client'

import { notificarTarefasSelecionadas } from './actions'

// Fica fora da tabela, mas os checkboxes "tarefa_ids" (dentro das linhas)
// apontam para este formulário pelo atributo `form` — evita form aninhado
// dentro dos outros formulários que já existem em cada linha da tabela.
export function FormNotificar() {
  return (
    <form
      id="notificar-selecionadas"
      action={notificarTarefasSelecionadas}
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        const marcadas = document.querySelectorAll<HTMLInputElement>('input[name="tarefa_ids"]:checked')
        if (marcadas.length === 0) {
          e.preventDefault()
          alert('Selecione ao menos uma tarefa (caixa de seleção na primeira coluna) para notificar.')
        }
      }}
    >
      <button className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
        Notificar selecionadas via WhatsApp
      </button>
      <span className="text-xs text-slate-400">
        Marque as tarefas na tabela (só pendentes/em andamento) e clique aqui.
      </span>
    </form>
  )
}
