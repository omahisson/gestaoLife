import type {
  Cartao,
  Despesa,
  DespesaPrevista,
  Meta,
  Nota,
  PerfilAcesso,
} from "../dominio/modelos"

export interface UsuarioDoBanco {
  id: string
  login: string
  senhaHash: string
  nome: string
  perfilAcesso: PerfilAcesso
  ativo: boolean
  criadoEm: string
}

export interface DadosDoUsuarioNoBanco {
  id: string
  usuarioId: string
  diaFechamento: number
  cartoes: Array<Cartao | string>
  despesas: Despesa[]
  despesasPrevistas: DespesaPrevista[]
  notas: Nota[]
  metas: Meta[]
}

export interface BancoDeDados {
  versao: string
  usuarios: UsuarioDoBanco[]
  dadosUsuarios: DadosDoUsuarioNoBanco[]
}
