import { importarRecorrentes } from './actions'

// A ação sempre termina em redirect (sucesso ou erro), então a página
// recarrega e o campo de arquivo já volta vazio sozinho — sem precisar de
// componente client para "resetar" o formulário.
export function ImportarPlanilha() {
  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-medium text-slate-900">
        Importar várias recorrências de uma vez (planilha)
      </summary>

      <div className="mt-3 space-y-3">
        <p className="text-sm text-slate-500">
          Baixe o modelo, preencha uma linha por recorrência (os nomes de setor, cliente e responsável
          já vêm com lista suspensa) e envie o arquivo de volta.
        </p>

        <a
          href="/api/recorrentes/modelo"
          className="inline-block rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Baixar modelo (.xlsx)
        </a>

        <form action={importarRecorrentes} className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            name="planilha"
            accept=".xlsx"
            required
            className="text-sm text-slate-600 file:mr-2 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-2 file:py-1 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
          />
          <button className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            Importar
          </button>
        </form>

        <p className="text-xs text-slate-400">
          Tudo ou nada: se alguma linha preenchida tiver um erro, nada é criado — a mensagem indica
          quais linhas corrigir.
        </p>
      </div>
    </details>
  )
}
