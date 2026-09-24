import ExcelJS from 'exceljs'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUsuarioLogado } from '@/lib/data'
import { CABECALHOS, ORDEM_COLUNAS } from '@/app/(app)/recorrentes/planilha'

export const dynamic = 'force-dynamic'

// Gera o modelo (.xlsx) para importação em massa, já com listas suspensas
// ligadas aos setores/clientes/usuários ativos da empresa — preenchendo pelo
// modelo, o nome digitado bate com o cadastro quase sempre de primeira.
export async function GET() {
  const usuario = await getUsuarioLogado()
  if (usuario?.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores.' }, { status: 403 })
  }

  const supabase = await createClient()
  const [{ data: s }, { data: c }, { data: u }] = await Promise.all([
    supabase.from('setores').select('nome').eq('ativo', true).order('nome'),
    supabase.from('clientes').select('nome').eq('ativo', true).order('nome'),
    supabase.from('usuarios').select('nome').eq('ativo', true).order('nome'),
  ])
  const setores = (s ?? []).map((x) => x.nome)
  const clientes = (c ?? []).map((x) => x.nome)
  const usuarios = (u ?? []).map((x) => x.nome)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Painel de Tarefas'

  // -------------------------------------------------------------------
  // Aba "Listas": fonte das listas suspensas (fica escondida).
  // -------------------------------------------------------------------
  const listas = wb.addWorksheet('Listas', { state: 'veryHidden' })
  listas.getColumn(1).values = ['Setores', ...setores]
  listas.getColumn(2).values = ['Clientes', ...clientes]
  listas.getColumn(3).values = ['Responsáveis', ...usuarios]
  listas.getColumn(4).values = ['Frequência', 'Diária', 'Semanal', 'Mensal']
  listas.getColumn(5).values = ['Prioridade', 'Baixa', 'Média', 'Alta']

  const faixa = (col: number, qtd: number) => {
    const letra = String.fromCharCode(64 + col)
    return `Listas!$${letra}$2:$${letra}$${qtd + 1}`
  }

  // -------------------------------------------------------------------
  // Aba principal
  // -------------------------------------------------------------------
  const ws = wb.addWorksheet('Recorrentes', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = ORDEM_COLUNAS.map((chave) => ({
    header: CABECALHOS[chave],
    key: chave,
    width: chave === 'descricao' ? 34 : chave === 'titulo' ? 28 : 18,
  }))
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

  // Uma linha de exemplo (linha 2), fácil de apagar.
  ws.addRow({
    titulo: 'Emissão de taxa de condomínio',
    descricao: 'Emissão da taxa do mês',
    setor: setores[0] ?? '',
    cliente: clientes[0] ?? '',
    responsavel: '',
    frequencia: 'Mensal',
    diasSemana: '',
    diaMes: 26,
    prazoHora: '18:00',
    metaHora: '16:00',
    prioridade: 'Média',
  })
  ws.getRow(2).font = { italic: true, color: { argb: 'FF94A3B8' } }

  // Formata as colunas de hora como texto, para o Excel não converter
  // "18:00" num horário serial — a leitura espera o texto literal.
  ws.getColumn('prazoHora').numFmt = '@'
  ws.getColumn('metaHora').numFmt = '@'

  const ULTIMA_LINHA = 500 // linhas disponíveis para preenchimento no modelo
  const colunaDe = (chave: (typeof ORDEM_COLUNAS)[number]) => ORDEM_COLUNAS.indexOf(chave) + 1

  const validar = (
    chave: (typeof ORDEM_COLUNAS)[number],
    formulae: string[],
    erro: { title: string; message: string }
  ) => {
    const col = colunaDe(chave)
    for (let linha = 2; linha <= ULTIMA_LINHA; linha++) {
      ws.getCell(linha, col).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae,
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: erro.title,
        error: erro.message,
      }
    }
  }

  if (setores.length > 0) {
    validar('setor', [faixa(1, setores.length)], {
      title: 'Setor',
      message: 'Escolha um setor da lista (aba "Setores" no cadastro).',
    })
  }
  if (clientes.length > 0) {
    validar('cliente', [faixa(2, clientes.length)], {
      title: 'Cliente',
      message: 'Escolha um cliente da lista, ou deixe em branco.',
    })
  }
  if (usuarios.length > 0) {
    validar('responsavel', [faixa(3, usuarios.length)], {
      title: 'Responsável',
      message: 'Escolha um usuário da lista, ou deixe em branco para o setor inteiro.',
    })
  }
  validar('frequencia', [faixa(4, 3)], {
    title: 'Frequência',
    message: 'Escolha Diária, Semanal ou Mensal.',
  })
  validar('prioridade', [faixa(5, 3)], {
    title: 'Prioridade',
    message: 'Escolha Baixa, Média ou Alta.',
  })

  // -------------------------------------------------------------------
  // Aba de instruções
  // -------------------------------------------------------------------
  const inst = wb.addWorksheet('Instruções')
  inst.getColumn(1).width = 22
  inst.getColumn(2).width = 90
  const linhas: [string, string][] = [
    ['Título', 'Obrigatório. Nome da tarefa recorrente.'],
    ['Descrição', 'Opcional.'],
    ['Setor', 'Obrigatório. Precisa ser exatamente o nome de um setor ativo (use a lista suspensa).'],
    ['Cliente', 'Opcional. Nome de um cliente ativo (lista suspensa). Em branco = sem cliente.'],
    [
      'Responsável',
      'Opcional. Nome de um usuário ativo (lista suspensa). Em branco = a tarefa fica para o setor inteiro.',
    ],
    ['Frequência', 'Obrigatório. Diária, Semanal ou Mensal.'],
    [
      'Dias da semana',
      'Só para frequência Semanal. Dias separados por vírgula: Dom, Seg, Ter, Qua, Qui, Sex, Sáb. Em branco = domingo.',
    ],
    ['Dia do mês', 'Só para frequência Mensal. Número de 1 a 31. Em branco = último dia do mês.'],
    ['Hora do prazo', 'Formato HH:MM (ex.: 18:00). Em branco = 18:00.'],
    ['Hora da meta', 'Opcional. Formato HH:MM. Precisa ser igual ou anterior à hora do prazo.'],
    ['Prioridade', 'Baixa, Média ou Alta. Em branco = Média.'],
    ['', ''],
    ['Como funciona', 'Cada linha preenchida vira uma recorrência. A tarefa do período atual é criada na hora.'],
  ]
  inst.addRows(linhas)
  inst.getRow(1).font = { bold: true }
  inst.eachRow((row) => row.eachCell((cell) => (cell.alignment = { wrapText: true, vertical: 'top' })))

  const buffer = await wb.xlsx.writeBuffer()

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="modelo-recorrentes.xlsx"',
    },
  })
}
