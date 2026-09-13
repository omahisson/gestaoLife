export interface EnvelopeDoCofre {
  saltKdf: string
  parametrosKdf: string
  nonceChave: string
  chaveCriptografada: string
}

export interface BlocoRecebido {
  revisaoEsperada: number
  nonce: string
  conteudo: string
}

export interface DadosDeAtivacao {
  login: string
  codigo: string
  senha: string
  cofre: EnvelopeDoCofre
}
