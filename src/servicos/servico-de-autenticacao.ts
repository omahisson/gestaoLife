import type { UsuarioAutenticado } from "../dominio/modelos"
import {
  buscarUsuariosPorLogin,
  criarContaNoBanco,
} from "../dados/repositorio-remoto"

const chaveDaSessao = "gestao-life:usuario-autenticado"

export interface NovoUsuario {
  login: string
  senha: string
  nome: string
}

async function gerarHashDaSenha(senha: string): Promise<string> {
  const conteudo = new TextEncoder().encode(senha)
  const resumo = await crypto.subtle.digest("SHA-256", conteudo)
  return Array.from(new Uint8Array(resumo))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export async function autenticarUsuario(
  login: string,
  senha: string,
): Promise<UsuarioAutenticado | null> {
  const loginNormalizado = login.trim().toLowerCase()
  const senhaHash = await gerarHashDaSenha(senha)
  const usuarios = await buscarUsuariosPorLogin(loginNormalizado)
  const usuario = usuarios.find(
    (item) =>
      item.ativo &&
      item.login.toLowerCase() === loginNormalizado &&
      item.senhaHash === senhaHash,
  )

  if (!usuario) return null

  const usuarioAutenticado: UsuarioAutenticado = {
    id: usuario.id,
    login: usuario.login,
    nome: usuario.nome,
    perfilAcesso: usuario.perfilAcesso,
  }
  sessionStorage.setItem(chaveDaSessao, JSON.stringify(usuarioAutenticado))
  return usuarioAutenticado
}

/**
 * Prepara o cadastro de novas contas sem acoplar a futura tela administrativa
 * ao formato interno do banco.
 */
export async function cadastrarUsuario({
  login,
  senha,
  nome,
}: NovoUsuario): Promise<UsuarioAutenticado> {
  const loginNormalizado = login.trim().toLowerCase()
  const nomeNormalizado = nome.trim()

  if (!loginNormalizado || !senha || !nomeNormalizado) {
    throw new Error("Nome, usuário e senha são obrigatórios.")
  }
  const usuariosExistentes = await buscarUsuariosPorLogin(loginNormalizado)
  if (usuariosExistentes.length > 0) {
    throw new Error("Este nome de usuário já está em uso.")
  }

  const usuarioId = crypto.randomUUID()
  const usuario = {
    id: usuarioId,
    login: loginNormalizado,
    senhaHash: await gerarHashDaSenha(senha),
    nome: nomeNormalizado,
    perfilAcesso: "usuario" as const,
    ativo: true,
    criadoEm: new Date().toISOString(),
  }

  await criarContaNoBanco(usuario, {
    id: usuarioId,
    usuarioId,
    diaFechamento: 30,
    cartoes: [],
    despesas: [],
    despesasPrevistas: [],
    notas: [],
    metas: [],
  })

  return {
    id: usuario.id,
    login: usuario.login,
    nome: usuario.nome,
    perfilAcesso: usuario.perfilAcesso,
  }
}

export function recuperarUsuarioAutenticado(): UsuarioAutenticado | null {
  try {
    const sessao = sessionStorage.getItem(chaveDaSessao)
    if (!sessao) return null

    const usuarioDaSessao = JSON.parse(sessao) as UsuarioAutenticado
    if (!usuarioDaSessao.id || !usuarioDaSessao.login) return null
    return usuarioDaSessao
  } catch {
    return null
  }
}

export function encerrarSessao(): void {
  sessionStorage.removeItem(chaveDaSessao)
}
