export type TipoRecorrencia = "diaria" | "semanal" | "mensal" | "personalizada" | "avulsa"

export type TipoPagamento = "pix" | "dinheiro" | "cartao"

export type AbaPrincipal = "inicio" | "insights" | "vida" | "perfil"

export type SegmentoVida = "metas" | "notas"

export type VisaoCalendario = "semanal" | "mensal"

export type StatusPeriodo = "passado" | "atual" | "futuro"

export type PerfilAcesso = "administrador" | "usuario"

export interface UsuarioAutenticado {
  id: string
  login: string
  nome: string
  perfilAcesso: PerfilAcesso
}

export interface BlocoNota {
  id: number
  tipo: "texto" | "checkbox"
  texto: string
  concluida: boolean
  data?: string
  hora?: string
}

export interface Nota {
  id: number
  titulo: string
  blocos: BlocoNota[]
  data?: string
  fixada: boolean
  arquivada: boolean
  criadaEm: string
}

export interface Meta {
  id: number
  nome: string
  dataInicio: string
  despesaVinculadaNome?: string
  valorMedio?: number
  frequenciaMensal?: number
}

export interface Despesa {
  id: number
  padraoId?: number
  nome: string
  valor: number
  data: string
  pagamento: TipoPagamento
  cartaoNome?: string
  recorrencia: TipoRecorrencia
  ocorrenciasRestantes?: number
  metaId?: number
}

export interface DespesaPrevista {
  id: number
  nome: string
  valor: number
  pagamento?: TipoPagamento
  cartaoNome?: string
  recorrencia: TipoRecorrencia
  ocorrenciasPorCiclo?: number
  /** Campo legado, mantido para compatibilidade com dados já salvos. */
  restantes: number
}

export interface TempoDecorrido {
  dias: number
  horas: number
  minutos: number
  segundos: number
}
