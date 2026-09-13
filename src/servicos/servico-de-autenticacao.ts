import type { UsuarioAutenticado } from "../dominio/modelos"
import {
  bloquearCofre,
  criarCofre,
  desbloquearCofre,
  type EnvelopeDoCofre,
} from "../seguranca/cofre"
import { definirTokenCsrf, limparTokenCsrf, requisitarApi } from "./cliente-api"

interface RespostaDaSessao {
  usuario: UsuarioAutenticado
  csrfToken: string
}

export async function autenticarUsuario(login: string, senha: string) {
  const sessao = await requisitarApi<RespostaDaSessao>("/api/sessao", {
    method: "POST",
    body: JSON.stringify({ login: login.trim(), senha }),
  })
  definirTokenCsrf(sessao.csrfToken)
  return sessao.usuario
}

export async function recuperarUsuarioAutenticado() {
  try {
    const sessao = await requisitarApi<RespostaDaSessao>("/api/sessao")
    definirTokenCsrf(sessao.csrfToken)
    return sessao.usuario
  } catch {
    limparTokenCsrf()
    return null
  }
}

export async function abrirCofreDoUsuario(
  usuario: UsuarioAutenticado,
  frase: string,
) {
  const envelope = await requisitarApi<EnvelopeDoCofre>("/api/cofre")
  await desbloquearCofre(frase, usuario.id, envelope)
}

export async function ativarUsuario(dados: {
  login: string
  codigo: string
  senha: string
  fraseDoCofre: string
}) {
  const preparacao = await requisitarApi<{ usuarioId: string }>(
    "/api/ativacoes/preparar",
    {
      method: "POST",
      body: JSON.stringify({ login: dados.login, codigo: dados.codigo }),
    },
  )
  const cofre = await criarCofre(dados.fraseDoCofre, preparacao.usuarioId)
  try {
    const sessao = await requisitarApi<RespostaDaSessao>("/api/ativacoes", {
      method: "POST",
      body: JSON.stringify({
        login: dados.login,
        codigo: dados.codigo,
        senha: dados.senha,
        cofre,
      }),
    })
    definirTokenCsrf(sessao.csrfToken)
    if (sessao.usuario.id !== preparacao.usuarioId) {
      throw new Error("O cofre não corresponde à conta ativada.")
    }
    return sessao.usuario
  } catch (erro) {
    bloquearCofre()
    throw erro
  }
}

export async function encerrarSessao() {
  try {
    await requisitarApi<void>("/api/sessao", { method: "DELETE" })
  } catch {
    // A limpeza local continua mesmo se a sessão já tiver expirado no servidor.
  } finally {
    bloquearCofre()
    limparTokenCsrf()
  }
}
