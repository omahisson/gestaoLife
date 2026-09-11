import AvatarIniciais from "../../componentes/AvatarIniciais"
import IconePagamento from "../../componentes/IconePagamento"
import { IlustracaoSemDespesas } from "../../componentes/feedback/IlustracoesVazias"
import GraficoPizza from "../../componentes/graficos/GraficoPizza"
import {
  IconeCalendario,
  IconeDireita,
  IconeEsquerda,
  IconeFechar,
} from "../../componentes/icones/Icones"
import {
  CABECALHO_MENSAL,
  DIAS_SEMANA_ABREVIADOS,
  HOJE,
  MESES_ABREVIADOS,
  MESES_POR_EXTENSO,
  ROTULOS_PAGAMENTO,
  ROTULOS_RECORRENCIA,
} from "../../dominio/constantes"
import type { Despesa, VisaoCalendario } from "../../dominio/modelos"
import { formatarMoeda } from "../../dominio/regras-financeiras"
import { formatarDataIso, obterSaudacao } from "../../dominio/regras-temporais"

interface ItemGraficoPizza {
  nome: string
  valor: number
}

interface PropriedadesTelaInicio {
  nomeUsuario: string
  mesInsights: Date
  gastosDoMes: number
  diferencaPrevisao: number | null
  visao: VisaoCalendario
  mesCalendario: Date
  diaSelecionado: Date
  inicioIntervalo: Date | null
  fimIntervalo: Date | null
  dataFimDoCiclo: string
  despesas: Despesa[]
  despesasDaVisao: Despesa[]
  totalDaVisao: number
  itensDoGrafico: ItemGraficoPizza[]
  agruparGraficoPorPagamento: boolean
  aoAbrirPerfil: () => void
  aoAbrirInsights: () => void
  aoNavegarPeriodoAnterior: () => void
  aoNavegarProximoPeriodo: () => void
  aoIrParaHoje: () => void
  aoSelecionarVisaoMensal: () => void
  aoSelecionarVisaoSemanal: () => void
  aoSelecionarDiaMensal: (dia: Date) => void
  aoSelecionarDiaSemanal: (dia: Date) => void
  aoLimparIntervalo: () => void
  aoAlternarAgrupamentoDoGrafico: () => void
  aoAbrirDespesa: (despesa: Despesa) => void
  contarTarefasPorData: (data: string) => number
}

const COR_AVATAR = "#1A56DB"

export default function TelaInicio({
  nomeUsuario,
  mesInsights,
  gastosDoMes,
  diferencaPrevisao,
  visao,
  mesCalendario,
  diaSelecionado,
  inicioIntervalo,
  fimIntervalo,
  dataFimDoCiclo,
  despesas,
  despesasDaVisao,
  totalDaVisao,
  itensDoGrafico,
  agruparGraficoPorPagamento,
  aoAbrirPerfil,
  aoAbrirInsights,
  aoNavegarPeriodoAnterior,
  aoNavegarProximoPeriodo,
  aoIrParaHoje,
  aoSelecionarVisaoMensal,
  aoSelecionarVisaoSemanal,
  aoSelecionarDiaMensal,
  aoSelecionarDiaSemanal,
  aoLimparIntervalo,
  aoAlternarAgrupamentoDoGrafico,
  aoAbrirDespesa,
  contarTarefasPorData,
}: PropriedadesTelaInicio) {
  const periodoSelecionado = obterRotuloDoPeriodoSelecionado(
    visao,
    mesCalendario,
    diaSelecionado,
    inicioIntervalo,
    fimIntervalo,
  )
  const tituloGrafico = obterTituloDoGrafico(
    visao,
    mesCalendario,
    diaSelecionado,
    inicioIntervalo,
    fimIntervalo,
  )
  const diasDoMes = obterDiasDoMes(mesCalendario)
  const diasDaSemana = obterDiasDaSemana(diaSelecionado)

  function calcularTotalPorData(data: string) {
    return despesas
      .filter((despesa) => despesa.data === data)
      .reduce((total, despesa) => total + despesa.valor, 0)
  }

  function estaNoIntervalo(dia: Date) {
    if (!inicioIntervalo || !fimIntervalo) return false
    const data = formatarDataIso(dia)
    return (
      data > formatarDataIso(inicioIntervalo) &&
      data < formatarDataIso(fimIntervalo)
    )
  }

  function estaNaBordaDoIntervalo(dia: Date) {
    if (!inicioIntervalo) return false
    const data = formatarDataIso(dia)
    return (
      data === formatarDataIso(inicioIntervalo) ||
      (!!fimIntervalo && data === formatarDataIso(fimIntervalo))
    )
  }

  return (
    <>
      <div className="px-5 pt-14 pb-3 flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-600 font-medium mb-0.5">
            {obterSaudacao()},
          </p>
          <h1 className="text-[22px] font-semibold tracking-tight text-gray-950">
            {nomeUsuario.split(" ")[0]} 👋
          </h1>
        </div>
        <div className="mt-1">
          <AvatarIniciais
            nome={nomeUsuario}
            tamanho={38}
            cor={COR_AVATAR}
            aoClicar={aoAbrirPerfil}
          />
        </div>
      </div>

      <div className="mx-4 mb-3">
        <div className="bg-[#1A56DB] rounded-3xl px-5 py-5 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute right-6 top-16 w-20 h-20 rounded-full bg-white/5" />
          <p className="text-[11px] font-bold text-blue-200 uppercase tracking-widest mb-1 relative">
            Gasto em {MESES_ABREVIADOS[mesInsights.getMonth()]}
          </p>
          <p className="text-[38px] font-black text-white tracking-tight leading-none relative">
            {formatarMoeda(gastosDoMes)}
          </p>
          {diferencaPrevisao !== null && (
            <p
              className={`text-xs font-semibold mt-2 relative ${
                diferencaPrevisao > 0
                  ? "text-red-200"
                  : diferencaPrevisao < 0
                    ? "text-emerald-200"
                    : "text-blue-200"
              }`}
            >
              {diferencaPrevisao > 0
                ? `↑ ${formatarMoeda(Math.abs(diferencaPrevisao))} acima da previsão`
                : diferencaPrevisao < 0
                  ? `↓ ${formatarMoeda(Math.abs(diferencaPrevisao))} abaixo`
                  : "Dentro da previsão"}
            </p>
          )}
          <button
            onClick={aoAbrirInsights}
            className="mt-4 inline-flex items-center gap-1 bg-white/15 hover:bg-white/25 transition-colors text-white text-xs font-semibold px-4 py-2 rounded-full relative"
          >
            Ver análise →
          </button>
        </div>
      </div>

      <div className="mx-4 mb-3">
        <div className="bg-white/80 rounded-3xl px-4 pt-3 pb-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-1 mb-3">
            <button
              onClick={aoNavegarPeriodoAnterior}
              aria-label="Período anterior"
              className="p-2.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            >
              <IconeEsquerda />
            </button>
            <button
              onClick={aoNavegarProximoPeriodo}
              aria-label="Próximo período"
              className="p-2.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
            >
              <IconeDireita />
            </button>
            <div className="flex items-center gap-1.5 text-sm text-gray-500 ml-0.5">
              <IconeCalendario />
              <span className="font-medium">
                {obterCabecalhoDeNavegacao(visao, mesCalendario, diasDaSemana)}
              </span>
            </div>
            <button
              onClick={aoIrParaHoje}
              className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-full bg-[#DBEAFE] hover:bg-[#BFDBFE] transition-colors text-[#1D4ED8]"
            >
              Hoje
            </button>
          </div>

          <div className="flex bg-gray-900/8 rounded-full p-1 mb-3">
            <button
              onClick={aoSelecionarVisaoMensal}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-full transition-all duration-200 ${
                visao === "mensal"
                  ? "bg-[#1A56DB] text-white shadow-sm"
                  : "text-gray-600"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={aoSelecionarVisaoSemanal}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-full transition-all duration-200 ${
                visao === "semanal"
                  ? "bg-[#1A56DB] text-white shadow-sm"
                  : "text-gray-600"
              }`}
            >
              Diário
            </button>
          </div>

          {visao === "mensal" ? (
            <CalendarioMensal
              dias={diasDoMes}
              diaSelecionado={diaSelecionado}
              inicioIntervalo={inicioIntervalo}
              fimIntervalo={fimIntervalo}
              dataFimDoCiclo={dataFimDoCiclo}
              calcularTotalPorData={calcularTotalPorData}
              contarTarefasPorData={contarTarefasPorData}
              estaNoIntervalo={estaNoIntervalo}
              estaNaBordaDoIntervalo={estaNaBordaDoIntervalo}
              aoSelecionarDia={aoSelecionarDiaMensal}
              aoLimparIntervalo={aoLimparIntervalo}
            />
          ) : (
            <CalendarioSemanal
              dias={diasDaSemana}
              diaSelecionado={diaSelecionado}
              calcularTotalPorData={calcularTotalPorData}
              contarTarefasPorData={contarTarefasPorData}
              aoSelecionarDia={aoSelecionarDiaSemanal}
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-44">
        {itensDoGrafico.length > 0 && (
          <div className="bg-white/80 rounded-3xl p-4 mb-3 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-900">
                {tituloGrafico}
              </p>
              <button
                onClick={aoAlternarAgrupamentoDoGrafico}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                  agruparGraficoPorPagamento
                    ? "bg-[#1A56DB] text-white border-[#1A56DB]"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {agruparGraficoPorPagamento ? "Pagamento" : "Gastos"}
              </button>
            </div>
            <GraficoPizza itens={itensDoGrafico} />
          </div>
        )}

        {despesasDaVisao.length > 0 && (
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs text-gray-600 font-semibold uppercase tracking-wider truncate mr-2">
              {periodoSelecionado}
            </span>
            <span className="text-sm font-bold text-gray-900 shrink-0">
              {formatarMoeda(totalDaVisao)}
            </span>
          </div>
        )}

        {despesasDaVisao.length === 0 ? (
          <div className="bg-white/80 rounded-3xl flex flex-col items-center justify-center py-10 text-center shadow-sm backdrop-blur-sm">
            <span className="illus-enter">
              <IlustracaoSemDespesas />
            </span>
            <p className="text-sm font-medium text-gray-600 mt-3 illus-enter-text">
              {inicioIntervalo && !fimIntervalo
                ? "Selecione a data de fim."
                : "Nenhuma despesa neste período."}
            </p>
          </div>
        ) : (
          <ListaDeDespesas
            despesas={despesasDaVisao}
            aoAbrirDespesa={aoAbrirDespesa}
          />
        )}
      </div>
    </>
  )
}

function CalendarioMensal({
  dias,
  diaSelecionado,
  inicioIntervalo,
  fimIntervalo,
  dataFimDoCiclo,
  calcularTotalPorData,
  contarTarefasPorData,
  estaNoIntervalo,
  estaNaBordaDoIntervalo,
  aoSelecionarDia,
  aoLimparIntervalo,
}: {
  dias: (Date | null)[]
  diaSelecionado: Date
  inicioIntervalo: Date | null
  fimIntervalo: Date | null
  dataFimDoCiclo: string
  calcularTotalPorData: (data: string) => number
  contarTarefasPorData: (data: string) => number
  estaNoIntervalo: (dia: Date) => boolean
  estaNaBordaDoIntervalo: (dia: Date) => boolean
  aoSelecionarDia: (dia: Date) => void
  aoLimparIntervalo: () => void
}) {
  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {CABECALHO_MENSAL.map((dia) => (
          <div
            key={dia}
            className="text-center text-[11px] text-gray-600 font-medium py-1"
          >
            {dia}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((dia, indice) => {
          if (!dia) return <div key={indice} className="aspect-square" />
          const data = formatarDataIso(dia)
          const ehHoje = data === formatarDataIso(HOJE)
          const ehFimDoCiclo = data === dataFimDoCiclo
          const estaNaBorda = estaNaBordaDoIntervalo(dia)
          const estaDentro = estaNoIntervalo(dia)
          const total = calcularTotalPorData(data)
          const estaSelecionado =
            !inicioIntervalo && data === formatarDataIso(diaSelecionado)
          const quantidadeTarefas = contarTarefasPorData(data)

          return (
            <button
              key={indice}
              onClick={() => aoSelecionarDia(dia)}
              className="flex flex-col items-center py-0.5 group"
            >
              <span
                className={`w-8 h-8 flex items-center justify-center rounded-full text-[13px] transition-all font-medium ${
                  estaNaBorda
                    ? "bg-[#1A56DB] text-white font-bold"
                    : estaSelecionado
                      ? "bg-[#1A56DB] text-white font-bold"
                      : estaDentro
                        ? "bg-[#DBEAFE] text-[#1D4ED8]"
                        : ehHoje
                          ? "text-[#1A56DB] font-bold ring-1 ring-[#1A56DB]/30"
                          : ehFimDoCiclo
                            ? "text-[#1A56DB] font-bold group-hover:bg-blue-50"
                            : "text-gray-700 group-hover:bg-gray-100"
                }`}
              >
                {String(dia.getDate()).padStart(2, "0")}
              </span>
              <span
                className={`text-[8px] leading-tight mt-0.5 font-medium ${
                  total > 0 ? "text-gray-600" : "text-transparent"
                }`}
              >
                {total > 0 ? `R$${Math.round(total)}` : "—"}
              </span>
              <span
                className={`text-[7px] leading-none font-bold ${
                  quantidadeTarefas > 0 ? "text-[#3B82F6]" : "text-transparent"
                }`}
              >
                {"●".repeat(Math.min(quantidadeTarefas, 3)) || "●"}
              </span>
            </button>
          )
        })}
      </div>
      {inicioIntervalo && !fimIntervalo && (
        <p className="text-xs text-gray-600 text-center mt-2 animate-pulse">
          Selecione a data de fim
        </p>
      )}
      {inicioIntervalo && fimIntervalo && (
        <div className="flex items-center justify-center mt-2">
          <button
            onClick={aoLimparIntervalo}
            className="text-xs text-gray-600 hover:text-gray-700 flex items-center gap-1 transition-colors"
          >
            <IconeFechar />
            <span>Limpar seleção</span>
          </button>
        </div>
      )}
    </div>
  )
}

function CalendarioSemanal({
  dias,
  diaSelecionado,
  calcularTotalPorData,
  contarTarefasPorData,
  aoSelecionarDia,
}: {
  dias: Date[]
  diaSelecionado: Date
  calcularTotalPorData: (data: string) => number
  contarTarefasPorData: (data: string) => number
  aoSelecionarDia: (dia: Date) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-0.5">
      {dias.map((dia, indice) => {
        const data = formatarDataIso(dia)
        const ehHoje = data === formatarDataIso(HOJE)
        const estaSelecionado = data === formatarDataIso(diaSelecionado)
        const total = calcularTotalPorData(data)
        const quantidadeTarefas = contarTarefasPorData(data)

        return (
          <button
            key={indice}
            onClick={() => aoSelecionarDia(dia)}
            className="flex flex-col items-center py-2 gap-0.5 rounded-2xl transition-all hover:bg-gray-50"
          >
            <span className="text-[11px] text-gray-600 font-medium">
              {DIAS_SEMANA_ABREVIADOS[dia.getDay()]}
            </span>
            <span
              className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-semibold transition-all ${
                estaSelecionado
                  ? "bg-[#1A56DB] text-white"
                  : ehHoje
                    ? "text-[#1A56DB] font-bold"
                    : "text-gray-700"
              }`}
            >
              {dia.getDate()}
            </span>
            <span
              className={`text-[9px] font-medium leading-none ${
                total > 0 ? "text-gray-600" : "text-transparent"
              }`}
            >
              {total > 0 ? `R$${Math.round(total)}` : "—"}
            </span>
            <span
              className={`text-[8px] leading-none font-bold ${
                quantidadeTarefas > 0 ? "text-[#3B82F6]" : "text-transparent"
              }`}
            >
              {"●".repeat(Math.min(quantidadeTarefas, 3)) || "●"}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ListaDeDespesas({
  despesas,
  aoAbrirDespesa,
}: {
  despesas: Despesa[]
  aoAbrirDespesa: (despesa: Despesa) => void
}) {
  const despesasPorData = new Map<string, Despesa[]>()
  despesas.forEach((despesa) => {
    if (!despesasPorData.has(despesa.data))
      despesasPorData.set(despesa.data, [])
    despesasPorData.get(despesa.data)!.push(despesa)
  })
  const datas = [...despesasPorData.keys()].sort((primeira, segunda) =>
    segunda.localeCompare(primeira),
  )
  const mostrarCabecalho = datas.length > 1

  return (
    <div className="space-y-2">
      {datas.map((dataTexto) => {
        const grupo = despesasPorData.get(dataTexto)!
        const totalDoGrupo = grupo.reduce(
          (total, despesa) => total + despesa.valor,
          0,
        )
        const data = new Date(`${dataTexto}T12:00:00`)

        return (
          <div
            key={dataTexto}
            className="bg-white/80 rounded-3xl overflow-hidden shadow-sm backdrop-blur-sm"
          >
            {mostrarCabecalho && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <span className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">
                  {DIAS_SEMANA_ABREVIADOS[data.getDay()]}, {data.getDate()}{" "}
                  {MESES_ABREVIADOS[data.getMonth()]}
                </span>
                <span className="text-[11px] font-bold text-gray-500">
                  {formatarMoeda(totalDoGrupo)}
                </span>
              </div>
            )}
            <div className="px-4">
              {grupo.map((despesa) => (
                <button
                  key={`despesa-${despesa.id}`}
                  onClick={() => aoAbrirDespesa(despesa)}
                  className="w-full flex items-center gap-3 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-1 px-1 rounded-xl transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <IconePagamento tipo={despesa.pagamento} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {despesa.nome}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5 truncate">
                      {despesa.cartaoNome ??
                        ROTULOS_PAGAMENTO[despesa.pagamento]}{" "}
                      · {ROTULOS_RECORRENCIA[despesa.recorrencia]}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm font-bold text-gray-900">
                      {formatarMoeda(despesa.valor)}
                    </span>
                    <span className="text-gray-500">
                      <IconeDireita />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function obterDiasDoMes(mes: Date): (Date | null)[] {
  const primeiroDia = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const ultimoDia = new Date(mes.getFullYear(), mes.getMonth() + 1, 0)
  const dias: (Date | null)[] = Array(primeiroDia.getDay()).fill(null)
  for (let numero = 1; numero <= ultimoDia.getDate(); numero++)
    dias.push(new Date(mes.getFullYear(), mes.getMonth(), numero))
  return dias
}

function obterDiasDaSemana(diaSelecionado: Date): Date[] {
  return Array.from({ length: 7 }, (_, indice) => {
    const dia = new Date(diaSelecionado)
    dia.setDate(dia.getDate() - 3 + indice)
    return dia
  })
}

function obterCabecalhoDeNavegacao(
  visao: VisaoCalendario,
  mes: Date,
  diasDaSemana: Date[],
): string {
  if (visao === "mensal")
    return `${MESES_ABREVIADOS[mes.getMonth()]} ${mes.getFullYear()}`
  const inicio = diasDaSemana[0]
  const fim = diasDaSemana[6]
  if (inicio.getMonth() === fim.getMonth())
    return `${MESES_ABREVIADOS[inicio.getMonth()]} ${inicio.getFullYear()}`
  return `${MESES_ABREVIADOS[inicio.getMonth()]} ${inicio.getFullYear()} — ${MESES_ABREVIADOS[fim.getMonth()]} ${fim.getFullYear()}`
}

function obterRotuloDoPeriodoSelecionado(
  visao: VisaoCalendario,
  mes: Date,
  diaSelecionado: Date,
  inicio: Date | null,
  fim: Date | null,
): string {
  if (visao === "semanal")
    return `${DIAS_SEMANA_ABREVIADOS[diaSelecionado.getDay()]}, ${diaSelecionado.getDate()} de ${MESES_POR_EXTENSO[diaSelecionado.getMonth()]}`
  if (inicio && fim) {
    if (formatarDataIso(inicio) === formatarDataIso(fim))
      return `${inicio.getDate()} de ${MESES_POR_EXTENSO[inicio.getMonth()]}`
    if (inicio.getMonth() === fim.getMonth())
      return `${inicio.getDate()} – ${fim.getDate()} de ${MESES_POR_EXTENSO[inicio.getMonth()]}`
    return `${inicio.getDate()} ${MESES_ABREVIADOS[inicio.getMonth()]} – ${fim.getDate()} ${MESES_ABREVIADOS[fim.getMonth()]}`
  }
  if (inicio)
    return `${inicio.getDate()} de ${MESES_POR_EXTENSO[inicio.getMonth()]} (selecione o fim)`
  return `${MESES_POR_EXTENSO[mes.getMonth()]} ${mes.getFullYear()}`
}

function obterTituloDoGrafico(
  visao: VisaoCalendario,
  mes: Date,
  diaSelecionado: Date,
  inicio: Date | null,
  fim: Date | null,
): string {
  return obterRotuloDoPeriodoSelecionado(
    visao,
    mes,
    diaSelecionado,
    inicio,
    fim,
  )
}
