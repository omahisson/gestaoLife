import assert from "node:assert/strict"
import test from "node:test"

import type { Despesa, DespesaPrevista } from "./modelos"
import {
  despesaPertenceAoPadrao,
  obterTotalPrevistoNoPeriodo,
} from "./regras-de-projecao"

const padraoSemanal: DespesaPrevista = {
  id: 10,
  nome: "Academia",
  dataInicio: "2026-09-14",
  valor: 100,
  recorrencia: "semanal",
  restantes: 3,
}

function criarDespesa(
  id: number,
  data: string,
  recorrencia: Despesa["recorrencia"],
): Despesa {
  return {
    id,
    padraoId: padraoSemanal.id,
    nome: padraoSemanal.nome,
    valor: 100,
    data,
    pagamento: "pix",
    recorrencia,
  }
}

test("padrão semanal começa na primeira ocorrência e não no início do ciclo", () => {
  assert.equal(
    obterTotalPrevistoNoPeriodo(
      padraoSemanal,
      "2026-09-01",
      "2026-09-30",
    ),
    3,
  )
})

test("despesa avulsa vinculada consome uma ocorrência do padrão", () => {
  const despesas = [
    criarDespesa(1, "2026-09-14", "semanal"),
    criarDespesa(2, "2026-09-15", "avulsa"),
  ]
  const totalPrevisto = obterTotalPrevistoNoPeriodo(
    padraoSemanal,
    "2026-09-01",
    "2026-09-30",
    despesas,
  )
  const usadas = despesas.filter((despesa) =>
    despesaPertenceAoPadrao(despesa, padraoSemanal),
  ).length

  assert.equal(totalPrevisto, 3)
  assert.equal(usadas, 2)
  assert.equal(Math.max(totalPrevisto - usadas, 0), 1)
})

test("padrão antigo infere sua âncora pela primeira despesa vinculada", () => {
  const padraoAntigo = { ...padraoSemanal, dataInicio: undefined }
  const despesas = [criarDespesa(1, "2026-09-14", "semanal")]

  assert.equal(
    obterTotalPrevistoNoPeriodo(
      padraoAntigo,
      "2026-09-01",
      "2026-09-30",
      despesas,
    ),
    3,
  )
})
