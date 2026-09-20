import type { Cliente, Recorrente, Setor, Usuario } from '@/lib/types'
import { DIAS_SEMANA_LABEL } from '@/lib/utils'
import { ClientesMulti } from './clientes-multi'

const inputCls =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none'

export function RecorrenteForm({
  action,
  setores,
  usuarios,
  clientes,
  recorrente,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>
  setores: Setor[]
  usuarios: Usuario[]
  clientes: Cliente[]
  recorrente?: Recorrente
  submitLabel: string
}) {
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <input
        name="titulo"
        placeholder="Título"
        required
        defaultValue={recorrente?.titulo}
        className={`w-full ${inputCls}`}
      />
      <textarea
        name="descricao"
        placeholder="Descrição (opcional)"
        rows={2}
        defaultValue={recorrente?.descricao}
        className={`w-full ${inputCls}`}
      />

      <div className="grid grid-cols-2 gap-3">
        <select name="setor_id" required defaultValue={recorrente?.setor_id} className={inputCls}>
          {setores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
        <select name="responsavel_id" defaultValue={recorrente?.responsavel_id ?? undefined} className={inputCls}>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      </div>

      {recorrente ? (
        <select name="cliente_id" defaultValue={recorrente.cliente_id ?? ''} className={`w-full ${inputCls}`}>
          <option value="">Nenhum cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      ) : (
        <ClientesMulti clientes={clientes} />
      )}

      <div className="grid grid-cols-3 gap-3">
        <select name="frequencia" defaultValue={recorrente?.frequencia ?? 'diaria'} className={inputCls}>
          <option value="diaria">Diária</option>
          <option value="semanal">Semanal</option>
          <option value="mensal">Mensal</option>
        </select>
        <input
          name="dia_mes"
          type="number"
          min={1}
          max={31}
          placeholder="Dia do mês"
          defaultValue={recorrente?.dia_mes ?? undefined}
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Hora da meta</label>
          <input
            name="meta_hora"
            type="time"
            defaultValue={recorrente ? (recorrente.meta_hora?.slice(0, 5) ?? '') : '16:00'}
            className={`w-full ${inputCls}`}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Hora do prazo</label>
          <input
            name="prazo_hora"
            type="time"
            defaultValue={recorrente ? recorrente.prazo_hora.slice(0, 5) : '18:00'}
            className={`w-full ${inputCls}`}
          />
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs text-slate-500">Dias da semana (se semanal; o prazo vale para o último dia marcado)</p>
        <div className="flex gap-2">
          {DIAS_SEMANA_LABEL.map((label, i) => (
            <label key={i} className="flex items-center gap-1 text-xs text-slate-600">
              <input
                type="checkbox"
                name="dias_semana"
                value={i}
                defaultChecked={recorrente?.dias_semana.includes(i)}
              />{' '}
              {label}
            </label>
          ))}
        </div>
      </div>

      <select name="prioridade" defaultValue={recorrente?.prioridade ?? 'media'} className={`w-full ${inputCls}`}>
        <option value="baixa">Baixa</option>
        <option value="media">Média</option>
        <option value="alta">Alta</option>
      </select>

      <button className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
        {submitLabel}
      </button>
    </form>
  )
}
