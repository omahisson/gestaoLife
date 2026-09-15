import type { Despesa, DespesaPrevista } from "./modelos"

const MILISSEGUNDOS_POR_DIA = 86_400_000

export function normalizarNome(nome: string) {
  return nome.trim().toLocaleLowerCase("pt-BR")
}

export function despesaPertenceAoPadrao(
  despesa: Despesa,
  padrao: DespesaPrevista,
) {
  return (
    despesa.padraoId === padrao.id ||
    (despesa.padraoId == null &&
      normalizarNome(despesa.nome) === normalizarNome(padrao.nome))
  )
}

function converterDataIso(dataIso: string) {
  return new Date(`${dataIso}T12:00:00Z`)
}

function obterDataInicialDoPadrao(
  padrao: DespesaPrevista,
  despesas: Despesa[],
) {
  if (padrao.dataInicio) return padrao.dataInicio
  return despesas
    .filter((despesa) => despesaPertenceAoPadrao(despesa, padrao))
    .map((despesa) => despesa.data)
    .sort()[0]
}

export function obterTotalPrevistoNoPeriodo(
  padrao: DespesaPrevista,
  inicioPeriodoIso: string,
  fimPeriodoIso: string,
  despesas: Despesa[] = [],
) {
  if (padrao.recorrencia === "avulsa") return 0

  const inicioPeriodo = converterDataIso(inicioPeriodoIso)
  const fimPeriodo = converterDataIso(fimPeriodoIso)
  const dataInicialIso = obterDataInicialDoPadrao(padrao, despesas)
  const dataInicial = dataInicialIso
    ? converterDataIso(dataInicialIso)
    : inicioPeriodo

  if (dataInicial > fimPeriodo) return 0
  if (padrao.recorrencia === "personalizada")
    return Math.max(padrao.ocorrenciasPorCiclo ?? padrao.restantes ?? 1, 1)
  if (padrao.recorrencia === "mensal") return 1
  const quantidadeDias =
    Math.floor(
      (fimPeriodo.getTime() - inicioPeriodo.getTime()) / MILISSEGUNDOS_POR_DIA,
    ) + 1
  if (padrao.recorrencia === "diaria") return quantidadeDias
  return Math.ceil(quantidadeDias / 7)
}

export function calcularDistribuicaoDasOcorrencias({
  recorrencia,
  totalPrevisto,
  quantidadeRegistrada,
  diasDecorridos,
  quantidadeDiasDoPeriodo,
}: {
  recorrencia: DespesaPrevista["recorrencia"]
  totalPrevisto: number
  quantidadeRegistrada: number
  diasDecorridos: number
  quantidadeDiasDoPeriodo: number
}) {
  const total = Math.max(totalPrevisto, 0)
  const diasNoPeriodo = Math.max(quantidadeDiasDoPeriodo, 1)
  const diasPassados = Math.min(Math.max(diasDecorridos, 0), diasNoPeriodo)
  let decorridas = total

  if (recorrencia === "diaria") decorridas = Math.min(total, diasPassados)
  else if (recorrencia === "semanal")
    decorridas = Math.min(total, Math.ceil(diasPassados / 7))
  else if (recorrencia === "mensal" || recorrencia === "personalizada")
    decorridas = Math.min(
      total,
      Math.ceil((total * diasPassados) / diasNoPeriodo),
    )

  const gastas = Math.min(Math.max(quantidadeRegistrada, 0), total)
  const naoGastas = Math.max(decorridas - gastas, 0)
  const restantes = Math.max(total - gastas - naoGastas, 0)

  return {
    gastas,
    naoGastas,
    restantes,
    disponiveis: Math.max(total - gastas, 0),
    excedentes: Math.max(quantidadeRegistrada - total, 0),
  }
}

export function obterFrequenciaMensalDoPadrao(padrao: DespesaPrevista) {
  if (padrao.recorrencia === "diaria") return 30
  if (padrao.recorrencia === "semanal") return 4
  if (padrao.recorrencia === "mensal") return 1
  if (padrao.recorrencia === "personalizada")
    return Math.max(padrao.ocorrenciasPorCiclo ?? padrao.restantes ?? 1, 1)
  return 0
}
