import assert from "node:assert/strict"
import test from "node:test"

import type { DadosDoUsuario } from "./repositorio-remoto"
import {
  criarDocumentoDeExportacao,
  lerDocumentoDeImportacao,
} from "./transferencia-de-dados"

const dadosValidos: DadosDoUsuario = {
  nomeUsuario: "Pessoa",
  diaFechamento: 22,
  cartoes: [{ id: 1, nome: "Principal" }],
  despesas: [
    {
      id: 2,
      nome: "Academia",
      valor: 100,
      data: "2026-09-20",
      pagamento: "cartao",
      cartaoId: 1,
      cartaoNome: "Principal",
      recorrencia: "mensal",
    },
  ],
  despesasPrevistas: [
    {
      id: 3,
      nome: "Academia",
      valor: 100,
      recorrencia: "mensal",
      restantes: 1,
    },
  ],
  notas: [
    {
      id: 4,
      titulo: "Lembrete",
      blocos: [
        {
          id: 5,
          tipo: "checkbox",
          texto: "Fazer algo",
          concluida: false,
          data: "2026-09-26",
          hora: "12:30",
        },
      ],
      fixada: false,
      arquivada: false,
      criadaEm: "2026-09-26T12:00:00.000Z",
    },
  ],
  metas: [
    {
      id: 6,
      nome: "Meta",
      dataInicio: "2026-09-26T12:00:00.000Z",
    },
  ],
}

test("exporta e valida um documento aberto compatível", () => {
  const documento = criarDocumentoDeExportacao(dadosValidos)
  assert.deepEqual(
    lerDocumentoDeImportacao(JSON.stringify(documento)),
    dadosValidos,
  )
})

test("rejeita uma coleção com campos internos inválidos", () => {
  const documento = criarDocumentoDeExportacao(dadosValidos) as unknown as {
    dados: { despesas: unknown[] }
  }
  documento.dados.despesas = [{ id: 2 }]
  assert.throws(
    () => lerDocumentoDeImportacao(JSON.stringify(documento)),
    /não é uma exportação compatível/,
  )
})

test("rejeita identificadores duplicados dentro de uma coleção", () => {
  const documento = criarDocumentoDeExportacao(dadosValidos) as unknown as {
    dados: { cartoes: unknown[] }
  }
  documento.dados.cartoes = [
    { id: 1, nome: "Primeiro" },
    { id: 1, nome: "Segundo" },
  ]
  assert.throws(
    () => lerDocumentoDeImportacao(JSON.stringify(documento)),
    /não é uma exportação compatível/,
  )
})
