import type { TipoPagamento, TipoRecorrencia } from "./modelos"

export const HOJE = new Date()

export const MESES_ABREVIADOS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
]
export const MESES_POR_EXTENSO = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]
export const DIAS_SEMANA_ABREVIADOS = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
]
export const CABECALHO_MENSAL = DIAS_SEMANA_ABREVIADOS

export const ROTULOS_PAGAMENTO: Record<TipoPagamento, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
}

export const EMOJIS_PAGAMENTO: Record<TipoPagamento, string> = {
  pix: "⚡",
  dinheiro: "💵",
  cartao: "💳",
}

export const ROTULOS_RECORRENCIA: Record<TipoRecorrencia, string> = {
  diaria: "Diária",
  semanal: "Semanal",
  mensal: "Mensal",
  personalizada: "Personalizada",
  avulsa: "Avulsa",
}

export const CORES_GRAFICO_PIZZA = [
  "#1A56DB",
  "#3B82F6",
  "#60A5FA",
  "#93C5FD",
  "#BFDBFE",
  "#2563EB",
  "#1D4ED8",
]
