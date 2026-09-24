'use server'

import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Frequencia, Prioridade, ResponsavelTipo } from '@/lib/types'
import { ALIASES_DIA_SEMANA, ALIASES_FREQUENCIA, ALIASES_PRIORIDADE, CABECALHOS, normalizar } from './planilha'

async function assertAdmin() {
  const usuario = await getUsuarioLogado()
  if (usuario?.role !== 'admin') throw new Error('Apenas administradores podem fazer isso.')
}

// Lê e valida o formulário; em caso de erro volta para `voltarPara` com a mensagem.
function lerFormulario(formData: FormData, voltarPara: string) {
  const titulo = String(formData.get('titulo') || '').trim()
  const descricao = String(formData.get('descricao') || '').trim()
  const setorId = String(formData.get('setor_id') || '')
  const clienteId = String(formData.get('cliente_id') || '') || null
  const responsavelTipo = String(formData.get('responsavel_tipo') || 'usuario') as ResponsavelTipo
  const responsavelId = String(formData.get('responsavel_id') || '') || null
  const frequencia = String(formData.get('frequencia') || 'diaria') as Frequencia
  const diasSemana = formData.getAll('dias_semana').map((d) => Number(d))
  const diaMes = formData.get('dia_mes') ? Number(formData.get('dia_mes')) : null
  const prazoHora = String(formData.get('prazo_hora') || '18:00')
  const metaHora = String(formData.get('meta_hora') || '') || null
  const prioridade = String(formData.get('prioridade') || 'media') as Prioridade

  if (!titulo || !setorId) {
    redirect(`${voltarPara}?erro=Preencha+t%C3%ADtulo+e+setor.`)
  }

  if (metaHora && metaHora > prazoHora) {
    redirect(`${voltarPara}?erro=A+hora+da+meta+precisa+ser+igual+ou+anterior+%C3%A0+do+prazo.`)
  }

  return {
    titulo,
    descricao,
    setor_id: setorId,
    cliente_id: clienteId,
    responsavel_tipo: responsavelTipo,
    responsavel_id: responsavelTipo === 'usuario' ? responsavelId : null,
    frequencia,
    dias_semana: frequencia === 'semanal' ? diasSemana : [],
    dia_mes: frequencia === 'mensal' ? diaMes : null,
    prazo_hora: prazoHora,
    meta_hora: metaHora,
    prioridade,
  }
}

export async function criarRecorrente(formData: FormData) {
  await assertAdmin()

  const dados = lerFormulario(formData, '/recorrentes')

  // Uma recorrência por cliente selecionado; sem seleção, uma sem cliente.
  const clienteIds = formData.getAll('cliente_ids').map(String).filter(Boolean)
  const linhas = (clienteIds.length > 0 ? clienteIds : [null]).map((clienteId) => ({
    ...dados,
    cliente_id: clienteId,
  }))

  const supabase = await createClient()
  const { data: criadas, error } = await supabase.from('recorrentes').insert(linhas).select('id')

  if (error) {
    redirect(`/recorrentes?erro=${encodeURIComponent(error.message)}`)
  }

  // Cria já a tarefa do período atual; a rotina diária recria nas viradas.
  for (const criada of criadas ?? []) {
    const { error: geracaoError } = await supabase.rpc('gerar_tarefas_recorrentes', {
      p_recorrente_id: criada.id,
    })
    if (geracaoError) {
      redirect(`/recorrentes?erro=${encodeURIComponent(geracaoError.message)}`)
    }
  }

  revalidatePath('/recorrentes')
  revalidatePath('/tarefas')
}

// A edição vale para as próximas tarefas e para as já criadas que ainda não foram iniciadas.
export async function atualizarRecorrente(id: string, formData: FormData) {
  await assertAdmin()

  const dados = lerFormulario(formData, `/recorrentes/${id}`)

  const supabase = await createClient()
  const { error } = await supabase.from('recorrentes').update(dados).eq('id', id)

  if (error) {
    redirect(`/recorrentes/${id}?erro=${encodeURIComponent(error.message)}`)
  }

  const { error: syncError } = await supabase.rpc('sincronizar_tarefas_recorrente', {
    p_recorrente_id: id,
  })
  if (syncError) {
    redirect(`/recorrentes/${id}?erro=${encodeURIComponent(syncError.message)}`)
  }

  // Se a frequência mudou e o novo período ainda não tem tarefa, cria agora.
  await supabase.rpc('gerar_tarefas_recorrentes', { p_recorrente_id: id })

  revalidatePath('/recorrentes')
  revalidatePath('/tarefas')
  redirect('/recorrentes')
}

// As tarefas já geradas permanecem (recorrente_id vira null pelo ON DELETE SET NULL).
export async function excluirRecorrente(id: string) {
  await assertAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from('recorrentes').delete().eq('id', id)

  if (error) {
    redirect(`/recorrentes?erro=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/recorrentes')
}

export async function alternarRecorrente(id: string, ativo: boolean) {
  await assertAdmin()
  const supabase = await createClient()
  await supabase.from('recorrentes').update({ ativo: !ativo }).eq('id', id)
  // Ao reativar, garante a tarefa do período atual (não duplica se já existir).
  if (!ativo) await supabase.rpc('gerar_tarefas_recorrentes', { p_recorrente_id: id })
  revalidatePath('/recorrentes')
  revalidatePath('/tarefas')
}

const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

interface LinhaPlanilha {
  titulo: string
  descricao: string
  setor_id: string
  cliente_id: string | null
  responsavel_tipo: ResponsavelTipo
  responsavel_id: string | null
  frequencia: Frequencia
  dias_semana: number[]
  dia_mes: number | null
  prazo_hora: string
  meta_hora: string | null
  prioridade: Prioridade
}

// Importação em massa via planilha (.xlsx). Tudo ou nada: se qualquer linha
// preenchida tiver erro, nada é criado — a mensagem lista os primeiros erros
// para corrigir e reenviar. Reaproveita o mesmo formato/validação do
// cadastro manual (ver lerFormulario), só que lido de células em vez de FormData.
export async function importarRecorrentes(formData: FormData) {
  await assertAdmin()

  const arquivo = formData.get('planilha')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    redirect('/recorrentes?erro=Selecione+um+arquivo+.xlsx.')
  }

  const wb = new ExcelJS.Workbook()
  try {
    const buffer = Buffer.from(await arquivo.arrayBuffer())
    // Atrito de tipos entre os genéricos de Buffer do @types/node recente e a
    // definição de tipos do exceljs; em tempo de execução é o mesmo Buffer de sempre.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any)
  } catch {
    redirect(
      '/recorrentes?erro=' +
        encodeURIComponent('Não foi possível ler o arquivo. Verifique se é um .xlsx válido (baixe o modelo).')
    )
  }

  const ws =
    wb.worksheets.find((w) => normalizar(w.name) === 'recorrentes') ??
    wb.worksheets.find((w) => w.state !== 'hidden' && w.state !== 'veryHidden')
  if (!ws) {
    redirect('/recorrentes?erro=A+planilha+n%C3%A3o+tem+nenhuma+aba+leg%C3%ADvel.')
  }

  // Mapeia cabeçalho -> coluna (por nome, não por posição — a ordem das
  // colunas na planilha pode ser diferente do modelo).
  const mapaCabecalhos = new Map(
    (Object.entries(CABECALHOS) as [keyof typeof CABECALHOS, string][]).map(([chave, label]) => [
      normalizar(label),
      chave,
    ])
  )
  const colunas: Partial<Record<keyof typeof CABECALHOS, number>> = {}
  ws.getRow(1).eachCell((cell, colNumber) => {
    const chave = mapaCabecalhos.get(normalizar(String(cell.text ?? '')))
    if (chave) colunas[chave] = colNumber
  })
  if (!colunas.titulo || !colunas.setor) {
    redirect(
      '/recorrentes?erro=' +
        encodeURIComponent('A planilha precisa ter as colunas "Título" e "Setor". Baixe o modelo novamente.')
    )
  }

  const txt = (row: ExcelJS.Row, chave: keyof typeof CABECALHOS): string => {
    const col = colunas[chave]
    if (!col) return ''
    return String(row.getCell(col).text ?? '').trim()
  }
  const hora = (row: ExcelJS.Row, chave: 'prazoHora' | 'metaHora'): string => {
    const col = colunas[chave]
    if (!col) return ''
    const cell = row.getCell(col)
    const v = cell.value
    if (v instanceof Date) {
      return `${String(v.getUTCHours()).padStart(2, '0')}:${String(v.getUTCMinutes()).padStart(2, '0')}`
    }
    if (typeof v === 'number') {
      const totalMin = Math.round(v * 24 * 60)
      return `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
    }
    return String(cell.text ?? '').trim()
  }

  // Nomes -> id, só entre ativos da empresa (a RLS já restringe à empresa ativa).
  const supabase = await createClient()
  const [{ data: setoresData }, { data: clientesData }, { data: usuariosData }] = await Promise.all([
    supabase.from('setores').select('id, nome').eq('ativo', true),
    supabase.from('clientes').select('id, nome').eq('ativo', true),
    supabase.from('usuarios').select('id, nome').eq('ativo', true),
  ])
  const setoresPorNome = new Map((setoresData ?? []).map((x) => [normalizar(x.nome), x.id]))
  const clientesPorNome = new Map((clientesData ?? []).map((x) => [normalizar(x.nome), x.id]))
  const usuariosPorNome = new Map((usuariosData ?? []).map((x) => [normalizar(x.nome), x.id]))

  const erros: string[] = []
  const linhas: LinhaPlanilha[] = []
  const ultimaLinha = Math.min(ws.rowCount, 5000)

  for (let n = 2; n <= ultimaLinha; n++) {
    const row = ws.getRow(n)

    const titulo = txt(row, 'titulo')
    const setorNome = txt(row, 'setor')
    const clienteNome = txt(row, 'cliente')
    const respNome = txt(row, 'responsavel')
    const freqTextoBruto = txt(row, 'frequencia')
    const diasTexto = txt(row, 'diasSemana')
    const diaMesTexto = txt(row, 'diaMes')
    const prazoHoraBruta = hora(row, 'prazoHora')
    const metaHoraBruta = hora(row, 'metaHora')
    const prioridadeTextoBruto = txt(row, 'prioridade')
    const descricao = txt(row, 'descricao')

    const linhaVazia = [
      titulo,
      setorNome,
      clienteNome,
      respNome,
      freqTextoBruto,
      diasTexto,
      diaMesTexto,
      prazoHoraBruta,
      metaHoraBruta,
      prioridadeTextoBruto,
      descricao,
    ].every((v) => !v)
    if (linhaVazia) continue

    const problemas: string[] = []

    if (!titulo) problemas.push('título vazio')

    const setorId = setorNome ? setoresPorNome.get(normalizar(setorNome)) : undefined
    if (!setorNome) problemas.push('setor vazio')
    else if (!setorId) problemas.push(`setor "${setorNome}" não encontrado`)

    let clienteId: string | null = null
    if (clienteNome) {
      clienteId = clientesPorNome.get(normalizar(clienteNome)) ?? null
      if (!clienteId) problemas.push(`cliente "${clienteNome}" não encontrado`)
    }

    let responsavelTipo: ResponsavelTipo = 'setor'
    let responsavelId: string | null = null
    if (respNome) {
      responsavelTipo = 'usuario'
      responsavelId = usuariosPorNome.get(normalizar(respNome)) ?? null
      if (!responsavelId) problemas.push(`responsável "${respNome}" não encontrado`)
    }

    const freqTexto = freqTextoBruto || 'diaria'
    const frequencia = ALIASES_FREQUENCIA[normalizar(freqTexto)]
    if (!frequencia) problemas.push(`frequência "${freqTexto}" inválida (use Diária, Semanal ou Mensal)`)

    const diasSemana: number[] = []
    if (frequencia === 'semanal' && diasTexto) {
      for (const parte of diasTexto.split(/[,;]/).map((p) => p.trim()).filter(Boolean)) {
        const dia = ALIASES_DIA_SEMANA[normalizar(parte)]
        if (dia === undefined) problemas.push(`dia da semana "${parte}" inválido`)
        else diasSemana.push(dia)
      }
    }

    let diaMes: number | null = null
    if (frequencia === 'mensal' && diaMesTexto) {
      const n2 = Number(diaMesTexto)
      if (!Number.isInteger(n2) || n2 < 1 || n2 > 31) {
        problemas.push(`dia do mês "${diaMesTexto}" inválido (use 1 a 31)`)
      } else {
        diaMes = n2
      }
    }

    const prazoHora = prazoHoraBruta || '18:00'
    if (!HORA_RE.test(prazoHora)) problemas.push(`hora do prazo "${prazoHora}" inválida (use HH:MM)`)

    let metaHora: string | null = null
    if (metaHoraBruta) {
      if (!HORA_RE.test(metaHoraBruta)) {
        problemas.push(`hora da meta "${metaHoraBruta}" inválida (use HH:MM)`)
      } else {
        metaHora = metaHoraBruta
        if (HORA_RE.test(prazoHora) && metaHora > prazoHora) {
          problemas.push('hora da meta precisa ser igual ou anterior à hora do prazo')
        }
      }
    }

    const prioridadeTexto = prioridadeTextoBruto || 'media'
    const prioridade = ALIASES_PRIORIDADE[normalizar(prioridadeTexto)]
    if (!prioridade) problemas.push(`prioridade "${prioridadeTexto}" inválida (use Baixa, Média ou Alta)`)

    if (problemas.length > 0) {
      erros.push(`Linha ${n}: ${problemas.join('; ')}.`)
      continue
    }

    linhas.push({
      titulo,
      descricao,
      setor_id: setorId!,
      cliente_id: clienteId,
      responsavel_tipo: responsavelTipo,
      responsavel_id: responsavelId,
      frequencia: frequencia!,
      dias_semana: diasSemana,
      dia_mes: diaMes,
      prazo_hora: prazoHora,
      meta_hora: metaHora,
      prioridade: prioridade!,
    })
  }

  if (erros.length > 0) {
    const resumo =
      erros.slice(0, 6).join(' ') + (erros.length > 6 ? ` (+${erros.length - 6} outra(s) linha(s) com erro.)` : '')
    redirect(`/recorrentes?erro=${encodeURIComponent(resumo)}`)
  }
  if (linhas.length === 0) {
    redirect('/recorrentes?erro=A+planilha+n%C3%A3o+tem+nenhuma+linha+preenchida.')
  }

  const { data: criadas, error } = await supabase.from('recorrentes').insert(linhas).select('id')
  if (error) {
    redirect(`/recorrentes?erro=${encodeURIComponent(error.message)}`)
  }

  // Cria já a tarefa do período atual de cada recorrência importada.
  await Promise.all((criadas ?? []).map((c) => supabase.rpc('gerar_tarefas_recorrentes', { p_recorrente_id: c.id })))

  revalidatePath('/recorrentes')
  revalidatePath('/tarefas')
  redirect(
    '/recorrentes?aviso=' +
      encodeURIComponent(
        `${linhas.length} ${linhas.length === 1 ? 'recorrência criada' : 'recorrências criadas'} a partir da planilha.`
      )
  )
}
