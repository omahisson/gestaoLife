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

  if (padrao.recorrencia === "diaria") {
    const primeiraOcorrencia =
      dataInicial > inicioPeriodo ? dataInicial : inicioPeriodo
    return (
      Math.floor(
        (fimPeriodo.getTime() - primeiraOcorrencia.getTime()) /
          MILISSEGUNDOS_POR_DIA,
      ) + 1
    )
  }

  const intervaloSemanal = 7 * MILISSEGUNDOS_POR_DIA
  let primeiraOcorrencia = dataInicial
  if (primeiraOcorrencia < inicioPeriodo) {
    const intervalosAteOPeriodo = Math.ceil(
      (inicioPeriodo.getTime() - primeiraOcorrencia.getTime()) /
        intervaloSemanal,
    )
    primeiraOcorrencia = new Date(
      primeiraOcorrencia.getTime() + intervalosAteOPeriodo * intervaloSemanal,
    )
  }

  if (primeiraOcorrencia > fimPeriodo) return 0
  return (
    Math.floor(
      (fimPeriodo.getTime() - primeiraOcorrencia.getTime()) / intervaloSemanal,
    ) + 1
  )
}

export function obterFrequenciaMensalDoPadrao(padrao: DespesaPrevista) {
  if (padrao.recorrencia === "diaria") return 30
  if (padrao.recorrencia === "semanal") return 4
  if (padrao.recorrencia === "mensal") return 1
  if (padrao.recorrencia === "personalizada")
    return Math.max(padrao.ocorrenciasPorCiclo ?? padrao.restantes ?? 1, 1)
  return 0
}
