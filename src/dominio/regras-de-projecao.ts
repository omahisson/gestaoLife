import type { Despesa, DespesaPrevista } from "./modelos"

const MILISSEGUNDOS_POR_DIA = 86_400_000
export const ANCORA_SEMANAL_ISO = "2026-01-04"

export interface OcorrenciaPrevista {
  chave: string
  inicio: string
  fim: string
}

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
      normalizarNome(despesa.nome) === normalizarNome(padrao.nome) &&
      (!padrao.vigenteDesde || despesa.data >= padrao.vigenteDesde) &&
      (!padrao.vigenteAte || despesa.data <= padrao.vigenteAte))
  )
}

function converterDataIso(dataIso: string) {
  return new Date(`${dataIso}T12:00:00Z`)
}

function formatarDataIsoUtc(data: Date) {
  return data.toISOString().slice(0, 10)
}

function adicionarDias(data: Date, quantidade: number) {
  return new Date(data.getTime() + quantidade * MILISSEGUNDOS_POR_DIA)
}

function limitarData(valor: Date, minimo: Date, maximo: Date) {
  if (valor < minimo) return minimo
  if (valor > maximo) return maximo
  return valor
}

function obterLimitesAtivos(
  padrao: DespesaPrevista,
  inicioPeriodoIso: string,
  fimPeriodoIso: string,
) {
  const inicioPeriodo = converterDataIso(inicioPeriodoIso)
  const fimPeriodo = converterDataIso(fimPeriodoIso)

  if (
    !padrao.vigenteDesde &&
    padrao.dataInicio &&
    converterDataIso(padrao.dataInicio) > fimPeriodo
  )
    return null

  const inicioAtivo = padrao.vigenteDesde
    ? limitarData(
        converterDataIso(padrao.vigenteDesde),
        inicioPeriodo,
        fimPeriodo,
      )
    : inicioPeriodo
  const fimAtivo = padrao.vigenteAte
    ? limitarData(
        converterDataIso(padrao.vigenteAte),
        inicioPeriodo,
        fimPeriodo,
      )
    : fimPeriodo

  if (
    (padrao.vigenteDesde &&
      converterDataIso(padrao.vigenteDesde) > fimPeriodo) ||
    (padrao.vigenteAte &&
      converterDataIso(padrao.vigenteAte) < inicioPeriodo) ||
    inicioAtivo > fimAtivo
  )
    return null

  return { inicioPeriodo, fimPeriodo, inicioAtivo, fimAtivo }
}

function criarOcorrencia(
  inicio: Date,
  fim: Date,
  sufixoDaChave?: number,
): OcorrenciaPrevista {
  const inicioIso = formatarDataIsoUtc(inicio)
  return {
    chave: sufixoDaChave ? `${inicioIso}#${sufixoDaChave}` : inicioIso,
    inicio: inicioIso,
    fim: formatarDataIsoUtc(fim),
  }
}

export function obterOcorrenciasPrevistasNoPeriodo(
  padrao: DespesaPrevista,
  inicioPeriodoIso: string,
  fimPeriodoIso: string,
): OcorrenciaPrevista[] {
  if (padrao.recorrencia === "avulsa") return []
  const limites = obterLimitesAtivos(padrao, inicioPeriodoIso, fimPeriodoIso)
  if (!limites) return []
  const { inicioPeriodo, fimPeriodo, inicioAtivo, fimAtivo } = limites

  if (padrao.recorrencia === "diaria") {
    const ocorrencias: OcorrenciaPrevista[] = []
    for (
      let data = inicioAtivo;
      data <= fimAtivo;
      data = adicionarDias(data, 1)
    )
      ocorrencias.push(criarOcorrencia(data, data))
    return ocorrencias
  }

  if (padrao.recorrencia === "semanal") {
    const ancora = converterDataIso(ANCORA_SEMANAL_ISO)
    const diasDesdeAncora = Math.floor(
      (inicioPeriodo.getTime() - ancora.getTime()) / MILISSEGUNDOS_POR_DIA,
    )
    const deslocamento = ((diasDesdeAncora % 7) + 7) % 7
    let domingo = adicionarDias(
      inicioPeriodo,
      deslocamento === 0 ? 0 : 7 - deslocamento,
    )
    const ocorrencias: OcorrenciaPrevista[] = []
    while (domingo <= fimPeriodo) {
      if (domingo >= inicioAtivo && domingo <= fimAtivo) {
        const sabado = limitarData(adicionarDias(domingo, 6), domingo, fimAtivo)
        ocorrencias.push(criarOcorrencia(domingo, sabado))
      }
      domingo = adicionarDias(domingo, 7)
    }
    return ocorrencias
  }

  if (padrao.recorrencia === "mensal") {
    return [criarOcorrencia(inicioAtivo, fimAtivo)]
  }

  const quantidade = Math.max(
    Math.min(padrao.ocorrenciasPorCiclo ?? padrao.restantes ?? 1, 10_000),
    1,
  )
  const diasDoPeriodo =
    Math.floor(
      (fimPeriodo.getTime() - inicioPeriodo.getTime()) / MILISSEGUNDOS_POR_DIA,
    ) + 1
  const ocorrencias: OcorrenciaPrevista[] = []
  for (let indice = 0; indice < quantidade; indice++) {
    const inicio = adicionarDias(
      inicioPeriodo,
      Math.floor((indice * diasDoPeriodo) / quantidade),
    )
    const fim = adicionarDias(
      inicioPeriodo,
      Math.max(Math.floor(((indice + 1) * diasDoPeriodo) / quantidade) - 1, 0),
    )
    if (fim < inicioAtivo || inicio > fimAtivo) continue
    ocorrencias.push(
      criarOcorrencia(
        limitarData(inicio, inicioAtivo, fimAtivo),
        limitarData(fim, inicioAtivo, fimAtivo),
        indice + 1,
      ),
    )
  }
  return ocorrencias
}

export function obterTotalPrevistoNoPeriodo(
  padrao: DespesaPrevista,
  inicioPeriodoIso: string,
  fimPeriodoIso: string,
  _despesas: Despesa[] = [],
) {
  return obterOcorrenciasPrevistasNoPeriodo(
    padrao,
    inicioPeriodoIso,
    fimPeriodoIso,
  ).length
}

function atribuirDespesasAsOcorrencias(
  ocorrencias: OcorrenciaPrevista[],
  despesas: Despesa[],
) {
  const disponiveis = new Map(
    ocorrencias.map((ocorrencia) => [ocorrencia.chave, ocorrencia]),
  )
  const chavesDoPeriodo = new Set(disponiveis.keys())
  const inicioDoPeriodo = ocorrencias[0]?.inicio
  const fimDoPeriodo = ocorrencias.at(-1)?.fim
  let extras = 0

  for (const despesa of [...despesas].sort(
    (a, b) => a.data.localeCompare(b.data) || Number(a.id) - Number(b.id),
  )) {
    if (despesa.ocorrenciaPrevistaEm) {
      if (despesa.ocorrenciaPrevistaEm === "extra") {
        extras += 1
        continue
      }
      const ocorrenciaVinculada = disponiveis.get(despesa.ocorrenciaPrevistaEm)
      if (ocorrenciaVinculada) disponiveis.delete(ocorrenciaVinculada.chave)
      else if (chavesDoPeriodo.has(despesa.ocorrenciaPrevistaEm)) extras += 1
      // A despesa pode ter sido feita nos primeiros dias do mês, mas consumir
      // a semana iniciada no mês anterior. Nesse caso ela não deve consumir
      // novamente uma ocorrência do período consultado.
      continue
    }
    if (
      !inicioDoPeriodo ||
      !fimDoPeriodo ||
      despesa.data < inicioDoPeriodo ||
      despesa.data > fimDoPeriodo
    )
      continue
    let ocorrencia: OcorrenciaPrevista | undefined
    ocorrencia ??= [...disponiveis.values()].find(
      (item) => despesa.data >= item.inicio && despesa.data <= item.fim,
    )
    ocorrencia ??= [...disponiveis.values()].find(
      (item) => item.fim >= despesa.data,
    )
    ocorrencia ??= [...disponiveis.values()].at(-1)
    if (!ocorrencia) extras += 1
    else disponiveis.delete(ocorrencia.chave)
  }
  return { disponiveis, extras }
}

export function calcularDistribuicaoDoPadrao({
  padrao,
  inicioPeriodoIso,
  fimPeriodoIso,
  despesas,
  dataReferenciaIso,
}: {
  padrao: DespesaPrevista
  inicioPeriodoIso: string
  fimPeriodoIso: string
  despesas: Despesa[]
  dataReferenciaIso: string
}) {
  const ocorrencias = obterOcorrenciasPrevistasNoPeriodo(
    padrao,
    inicioPeriodoIso,
    fimPeriodoIso,
  )
  const relacionadas = despesas.filter((despesa) =>
    despesaPertenceAoPadrao(despesa, padrao),
  )
  const atribuicao = atribuirDespesasAsOcorrencias(ocorrencias, relacionadas)
  const encerrado =
    !!padrao.vigenteAte && padrao.vigenteAte <= dataReferenciaIso
  let naoGastas = 0
  let restantes = 0
  for (const ocorrencia of atribuicao.disponiveis.values()) {
    if (encerrado || ocorrencia.fim < dataReferenciaIso) naoGastas += 1
    else restantes += 1
  }
  const gastas = ocorrencias.length - atribuicao.disponiveis.size
  return {
    gastas,
    naoGastas,
    restantes,
    disponiveis: encerrado ? 0 : atribuicao.disponiveis.size,
    excedentes: atribuicao.extras,
    totalPrevisto: ocorrencias.length,
  }
}

export function obterOcorrenciaParaNovaDespesa({
  padrao,
  inicioPeriodoIso,
  fimPeriodoIso,
  despesas,
  dataDespesaIso,
  hojeIso,
}: {
  padrao: DespesaPrevista
  inicioPeriodoIso: string
  fimPeriodoIso: string
  despesas: Despesa[]
  dataDespesaIso: string
  hojeIso: string
}) {
  const ocorrencias = obterOcorrenciasPrevistasNoPeriodo(
    padrao,
    inicioPeriodoIso,
    fimPeriodoIso,
  )
  const atribuicao = atribuirDespesasAsOcorrencias(
    ocorrencias,
    despesas.filter((despesa) => despesaPertenceAoPadrao(despesa, padrao)),
  )
  const disponiveis = [...atribuicao.disponiveis.values()]

  if (dataDespesaIso < hojeIso) {
    const correspondente = disponiveis.find(
      (item) =>
        dataDespesaIso >= item.inicio &&
        dataDespesaIso <= item.fim &&
        item.fim < hojeIso,
    )
    if (correspondente) return correspondente.chave
  }
  return (
    disponiveis.find((item) => item.fim >= hojeIso)?.chave ??
    [...disponiveis].reverse().find((item) => item.fim < hojeIso)?.chave
  )
}

/** Mantido para compatibilidade de consumidores antigos e testes de migração. */
export function calcularDistribuicaoDasOcorrencias({
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
  const decorridas = Math.min(
    total,
    Math.ceil(
      (total * Math.max(diasDecorridos, 0)) /
        Math.max(quantidadeDiasDoPeriodo, 1),
    ),
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
