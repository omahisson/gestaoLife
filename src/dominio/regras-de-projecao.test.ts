import assert from "node:assert/strict"
import test from "node:test"

import type { Despesa, DespesaPrevista } from "./modelos"
import {
  calcularDistribuicaoDasOcorrencias,
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

test("padrão semanal cobre o ciclo inteiro mesmo quando é criado no meio", () => {
  assert.equal(
    obterTotalPrevistoNoPeriodo(
      padraoSemanal,
      "2026-09-01",
      "2026-09-28",
    ),
    4,
  )
})

test("tempo decorrido separa gastos, não gastos e restantes", () => {
  const despesas = [
    criarDespesa(1, "2026-09-14", "semanal"),
  ]
  const totalPrevisto = obterTotalPrevistoNoPeriodo(
    padraoSemanal,
    "2026-09-01",
    "2026-09-28",
    despesas,
  )
  const usadas = despesas.filter((despesa) =>
    despesaPertenceAoPadrao(despesa, padraoSemanal),
  ).length
  const distribuicao = calcularDistribuicaoDasOcorrencias({
    recorrencia: "semanal",
    totalPrevisto,
    quantidadeRegistrada: usadas,
    diasDecorridos: 15,
    quantidadeDiasDoPeriodo: 28,
  })

  assert.deepEqual(distribuicao, {
    gastas: 1,
    naoGastas: 2,
    restantes: 1,
    disponiveis: 3,
    excedentes: 0,
  })
})

test("despesa avulsa vinculada substitui uma ocorrência não gasta", () => {
  const primeiraDistribuicao = calcularDistribuicaoDasOcorrencias({
    recorrencia: "semanal",
    totalPrevisto: 4,
    quantidadeRegistrada: 1,
    diasDecorridos: 28,
    quantidadeDiasDoPeriodo: 28,
  })
  const despesas = [
    criarDespesa(1, "2026-09-14", "semanal"),
    criarDespesa(2, "2026-09-28", "avulsa"),
  ]
  const quantidadeRegistrada = despesas.filter((despesa) =>
    despesaPertenceAoPadrao(despesa, padraoSemanal),
  ).length
  const segundaDistribuicao = calcularDistribuicaoDasOcorrencias({
    recorrencia: "semanal",
    totalPrevisto: 4,
    quantidadeRegistrada,
    diasDecorridos: 28,
    quantidadeDiasDoPeriodo: 28,
  })

  assert.equal(primeiraDistribuicao.naoGastas, 3)
  assert.equal(segundaDistribuicao.gastas, 2)
  assert.equal(segundaDistribuicao.naoGastas, 2)
  assert.equal(segundaDistribuicao.disponiveis, 2)
})
