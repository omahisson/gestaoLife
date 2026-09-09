import { HOJE } from "./constantes"
import type { Meta, TipoRecorrencia } from "./modelos"

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function calcularProjecao(
  valor: number,
  recorrencia: TipoRecorrencia,
  diaFechamento: number,
  ocorrenciasPersonalizadas?: number,
): number {
  const diasRestantes = Math.max(diaFechamento - HOJE.getDate(), 0)
  if (recorrencia === "diaria") return valor * diasRestantes
  if (recorrencia === "semanal") return valor * Math.ceil(diasRestantes / 7)
  if (recorrencia === "mensal") return valor
  if (recorrencia === "personalizada")
    return valor * (ocorrenciasPersonalizadas ?? 1)
  return 0
}

export function calcularEconomiaEstimada(meta: Meta): number {
  if (!meta.valorMedio || !meta.frequenciaMensal) return 0
  const diferenca = Math.max(
    Date.now() - new Date(meta.dataInicio).getTime(),
    0,
  )
  const meses = diferenca / (1000 * 60 * 60 * 24 * 30.44)
  return Math.floor(meses * meta.frequenciaMensal) * meta.valorMedio
}

export function calcularOcorrenciasEvitadas(meta: Meta): number {
  if (!meta.frequenciaMensal) return 0
  const diferenca = Math.max(
    Date.now() - new Date(meta.dataInicio).getTime(),
    0,
  )
  const meses = diferenca / (1000 * 60 * 60 * 24 * 30.44)
  return Math.floor(meses * meta.frequenciaMensal)
}
