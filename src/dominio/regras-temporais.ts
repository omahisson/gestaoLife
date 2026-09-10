import { HOJE, MESES_ABREVIADOS, MESES_POR_EXTENSO } from "./constantes"
import type { StatusPeriodo, TempoDecorrido } from "./modelos"

export function formatarDataIso(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`
}

export function formatarMesIso(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`
}

export function obterInicioDaSemana(data: Date): Date {
  const inicio = new Date(data)
  inicio.setDate(inicio.getDate() - inicio.getDay())
  inicio.setHours(0, 0, 0, 0)
  return inicio
}

export function ehSemanaAtual(semana: Date): boolean {
  return (
    formatarDataIso(obterInicioDaSemana(semana)) ===
    formatarDataIso(obterInicioDaSemana(HOJE))
  )
}

export function formatarPeriodoDaSemana(semana: Date): string {
  const inicio = obterInicioDaSemana(semana)
  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 6)

  if (inicio.getMonth() === fim.getMonth()) {
    return `${inicio.getDate()} – ${fim.getDate()} ${MESES_ABREVIADOS[inicio.getMonth()]}`
  }

  return `${inicio.getDate()} ${MESES_ABREVIADOS[inicio.getMonth()]} – ${fim.getDate()} ${MESES_ABREVIADOS[fim.getMonth()]}`
}

export function obterStatusDoMes(mes: Date): StatusPeriodo {
  if (mes.getFullYear() < HOJE.getFullYear()) return "passado"
  if (mes.getFullYear() > HOJE.getFullYear()) return "futuro"
  if (mes.getMonth() < HOJE.getMonth()) return "passado"
  if (mes.getMonth() > HOJE.getMonth()) return "futuro"
  return "atual"
}

export function calcularTempoDecorrido(dataInicio: string): TempoDecorrido {
  const diferenca = Math.max(Date.now() - new Date(dataInicio).getTime(), 0)
  const totalSegundos = Math.floor(diferenca / 1000)

  return {
    dias: Math.floor(totalSegundos / 86_400),
    horas: Math.floor((totalSegundos % 86_400) / 3_600),
    minutos: Math.floor((totalSegundos % 3_600) / 60),
    segundos: totalSegundos % 60,
  }
}

export function formatarTempoDecorrido(tempo: TempoDecorrido): string {
  const partes: string[] = []
  if (tempo.dias > 0)
    partes.push(`${tempo.dias} dia${tempo.dias !== 1 ? "s" : ""}`)
  if (tempo.horas > 0) partes.push(`${tempo.horas}h`)
  if (tempo.minutos > 0 || tempo.dias === 0) partes.push(`${tempo.minutos}min`)
  return partes.join(" ")
}

export function formatarDataPorExtenso(dataTexto: string): string {
  const data = new Date(dataTexto)
  return `${String(data.getDate()).padStart(2, "0")} de ${MESES_POR_EXTENSO[data.getMonth()]} de ${data.getFullYear()}`
}

export function formatarHora(dataTexto: string): string {
  const data = new Date(dataTexto)
  return `${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`
}

export function obterSaudacao(): string {
  const hora = new Date().getHours()
  if (hora < 12) return "Bom dia"
  if (hora < 18) return "Boa tarde"
  return "Boa noite"
}

export function obterDataEHoraAtuais(): { data: string; hora: string } {
  const momento = new Date()
  return {
    data: formatarDataIso(momento),
    hora: `${String(momento.getHours()).padStart(2, "0")}:${String(momento.getMinutes()).padStart(2, "0")}`,
  }
}

function criarDataComDiaLimitado(ano: number, mes: number, dia: number): Date {
  const ultimoDiaDoMes = new Date(ano, mes + 1, 0).getDate()
  return new Date(ano, mes, Math.min(dia, ultimoDiaDoMes))
}

export function obterPeriodoDoCicloFinanceiro(
  diaFechamento: number,
  referencia = new Date(),
): {
  inicio: Date
  fim: Date
  diasRestantes: number
  diasDecorridos: number
} {
  const hoje = new Date(
    referencia.getFullYear(),
    referencia.getMonth(),
    referencia.getDate(),
  )
  let fim = criarDataComDiaLimitado(
    hoje.getFullYear(),
    hoje.getMonth(),
    diaFechamento,
  )

  if (hoje > fim) {
    fim = criarDataComDiaLimitado(
      hoje.getFullYear(),
      hoje.getMonth() + 1,
      diaFechamento,
    )
  }

  const fechamentoAnterior = criarDataComDiaLimitado(
    fim.getFullYear(),
    fim.getMonth() - 1,
    diaFechamento,
  )
  const inicio = new Date(fechamentoAnterior)
  inicio.setDate(inicio.getDate() + 1)

  return {
    inicio,
    fim,
    diasRestantes: Math.max(
      Math.ceil((fim.getTime() - hoje.getTime()) / 86_400_000),
      0,
    ),
    diasDecorridos: Math.max(
      Math.floor((hoje.getTime() - inicio.getTime()) / 86_400_000) + 1,
      0,
    ),
  }
}
