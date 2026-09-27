import assert from "node:assert/strict"
import test from "node:test"

import type { Despesa, DespesaPrevista } from "./modelos"
import {
  calcularDistribuicaoDoPadrao,
  despesaPertenceAoPadrao,
  obterOcorrenciaParaNovaDespesa,
  obterOcorrenciasPrevistasNoPeriodo,
  obterTotalPrevistoNoPeriodo,
} from "./regras-de-projecao"

const padraoSemanal: DespesaPrevista = {
  id: 10,
  nome: "Academia",
  dataInicio: "2026-09-14",
  vigenteDesde: "2026-09-01",
  valor: 100,
  recorrencia: "semanal",
  restantes: 4,
}

function criarDespesa(
  id: number,
  data: string,
  ocorrenciaPrevistaEm?: string,
): Despesa {
  return {
    id,
    padraoId: padraoSemanal.id,
    nome: padraoSemanal.nome,
    valor: 100,
    data,
    pagamento: "pix",
    recorrencia: "avulsa",
    ocorrenciaPrevistaEm,
  }
}

function distribuir(despesas: Despesa[], padrao = padraoSemanal) {
  return calcularDistribuicaoDoPadrao({
    padrao,
    inicioPeriodoIso: "2026-09-01",
    fimPeriodoIso: "2026-09-30",
    despesas,
    dataReferenciaIso: "2026-09-23",
  })
}

test("padrões com o mesmo nome respeitam o corte da exclusão", () => {
  const antigo: DespesaPrevista = {
    ...padraoSemanal,
    id: 1,
    vigenteDesde: "2026-09-01",
    vigenteAte: "2026-09-10",
    excluidoEm: "2026-09-10",
  }
  const novo: DespesaPrevista = {
    ...padraoSemanal,
    id: 2,
    vigenteDesde: "2026-09-11",
  }
  const anterior: Despesa = {
    ...criarDespesa(1, "2026-09-05"),
    padraoId: undefined,
  }
  const posterior: Despesa = {
    ...criarDespesa(2, "2026-09-12"),
    padraoId: undefined,
  }

  assert.equal(despesaPertenceAoPadrao(anterior, antigo), true)
  assert.equal(despesaPertenceAoPadrao(anterior, novo), false)
  assert.equal(despesaPertenceAoPadrao(posterior, antigo), false)
  assert.equal(despesaPertenceAoPadrao(posterior, novo), true)
})

test("padrão semanal cobre o ciclo inteiro mesmo quando foi criado no meio", () => {
  assert.equal(
    obterTotalPrevistoNoPeriodo(
      { ...padraoSemanal, vigenteDesde: undefined },
      "2026-09-01",
      "2026-09-30",
    ),
    4,
  )
})

test("semanas pertencem ao mês do domingo e não são contadas duas vezes", () => {
  assert.deepEqual(
    obterOcorrenciasPrevistasNoPeriodo(
      { ...padraoSemanal, vigenteDesde: undefined },
      "2026-09-01",
      "2026-09-30",
    ).map((ocorrencia) => ocorrencia.chave),
    ["2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"],
  )
  assert.deepEqual(
    obterOcorrenciasPrevistasNoPeriodo(
      { ...padraoSemanal, vigenteDesde: undefined },
      "2026-10-01",
      "2026-10-31",
    ).map((ocorrencia) => ocorrencia.chave),
    ["2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25"],
  )
})

test("despesa no começo do mês consome somente a semana iniciada no mês anterior", () => {
  const despesaDaSemanaAnterior = criarDespesa(
    1,
    "2026-10-01",
    "2026-09-27",
  )
  assert.equal(distribuir([despesaDaSemanaAnterior]).gastas, 1)
  assert.equal(
    calcularDistribuicaoDoPadrao({
      padrao: padraoSemanal,
      inicioPeriodoIso: "2026-10-01",
      fimPeriodoIso: "2026-10-31",
      despesas: [despesaDaSemanaAnterior],
      dataReferenciaIso: "2026-10-10",
    }).gastas,
    0,
  )
})

test("despesas legadas de outros períodos não consomem o ciclo consultado", () => {
  assert.equal(distribuir([criarDespesa(1, "2026-08-10")]).gastas, 0)
})

test("recorrência personalizada mantém uma chave por ocorrência no mesmo dia", () => {
  const ocorrencias = obterOcorrenciasPrevistasNoPeriodo(
    {
      ...padraoSemanal,
      recorrencia: "personalizada",
      ocorrenciasPorCiclo: 40,
    },
    "2026-09-01",
    "2026-09-30",
  )
  assert.equal(ocorrencias.length, 40)
  assert.equal(new Set(ocorrencias.map((item) => item.chave)).size, 40)
})

test("novas despesas consomem futuro, depois não gasto e por fim viram extras", () => {
  const despesas: Despesa[] = []
  assert.deepEqual(distribuir(despesas), {
    gastas: 0,
    naoGastas: 2,
    restantes: 2,
    disponiveis: 4,
    excedentes: 0,
    totalPrevisto: 4,
  })

  despesas.push(criarDespesa(1, "2026-09-21", "2026-09-20"))
  assert.deepEqual(distribuir(despesas), {
    gastas: 1,
    naoGastas: 2,
    restantes: 1,
    disponiveis: 3,
    excedentes: 0,
    totalPrevisto: 4,
  })

  const segunda = obterOcorrenciaParaNovaDespesa({
    padrao: padraoSemanal,
    inicioPeriodoIso: "2026-09-01",
    fimPeriodoIso: "2026-09-30",
    despesas,
    dataDespesaIso: "2026-09-24",
    hojeIso: "2026-09-23",
  })
  assert.equal(segunda, "2026-09-27")
  despesas.push(criarDespesa(2, "2026-09-24", segunda))
  assert.equal(distribuir(despesas).restantes, 0)
  assert.equal(distribuir(despesas).naoGastas, 2)

  const terceira = obterOcorrenciaParaNovaDespesa({
    padrao: padraoSemanal,
    inicioPeriodoIso: "2026-09-01",
    fimPeriodoIso: "2026-09-30",
    despesas,
    dataDespesaIso: "2026-09-24",
    hojeIso: "2026-09-23",
  })
  assert.equal(terceira, "2026-09-13")
  despesas.push(criarDespesa(3, "2026-09-24", terceira))
  assert.equal(distribuir(despesas).naoGastas, 1)

  const quarta = obterOcorrenciaParaNovaDespesa({
    padrao: padraoSemanal,
    inicioPeriodoIso: "2026-09-01",
    fimPeriodoIso: "2026-09-30",
    despesas,
    dataDespesaIso: "2026-09-24",
    hojeIso: "2026-09-23",
  })
  assert.equal(quarta, "2026-09-06")
  despesas.push(criarDespesa(4, "2026-09-24", quarta))
  assert.equal(distribuir(despesas).naoGastas, 0)

  const quinta = obterOcorrenciaParaNovaDespesa({
    padrao: padraoSemanal,
    inicioPeriodoIso: "2026-09-01",
    fimPeriodoIso: "2026-09-30",
    despesas,
    dataDespesaIso: "2026-09-24",
    hojeIso: "2026-09-23",
  })
  assert.equal(quinta, undefined)
  despesas.push(criarDespesa(5, "2026-09-24", "extra"))
  assert.equal(distribuir(despesas).excedentes, 1)
})

test("lançamento retroativo consome a ocorrência não gasta correspondente", () => {
  const despesas = [criarDespesa(1, "2026-09-21", "2026-09-20")]
  assert.equal(
    obterOcorrenciaParaNovaDespesa({
      padrao: padraoSemanal,
      inicioPeriodoIso: "2026-09-01",
      fimPeriodoIso: "2026-09-30",
      despesas,
      dataDespesaIso: "2026-09-14",
      hojeIso: "2026-09-23",
    }),
    "2026-09-13",
  )
})

test("padrão encerrado preserva o período histórico e não projeta o futuro", () => {
  const encerrado = {
    ...padraoSemanal,
    vigenteAte: "2026-09-23",
    excluidoEm: "2026-09-23",
  }
  assert.deepEqual(distribuir([], encerrado), {
    gastas: 0,
    naoGastas: 3,
    restantes: 0,
    disponiveis: 0,
    excedentes: 0,
    totalPrevisto: 3,
  })
  assert.equal(
    obterTotalPrevistoNoPeriodo(encerrado, "2026-10-01", "2026-10-31"),
    0,
  )
})
