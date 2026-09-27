import assert from "node:assert/strict"
import test from "node:test"

import { formatarDataPorExtenso } from "./regras-temporais"

test("data sem horário mantém o dia no fuso de Brasília", () => {
  const fusoAnterior = process.env.TZ
  process.env.TZ = "America/Sao_Paulo"
  try {
    assert.equal(
      formatarDataPorExtenso("2026-09-27"),
      "27 de Setembro de 2026",
    )
  } finally {
    process.env.TZ = fusoAnterior
  }
})
