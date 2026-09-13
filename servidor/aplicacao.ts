import { readFile } from "node:fs/promises"
import { extname, resolve, sep } from "node:path"
import cookie from "@fastify/cookie"
import rateLimit from "@fastify/rate-limit"
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify"
import type { DatabaseSync } from "node:sqlite"
import {
  buscarSessao,
  buscarUsuarioPorLogin,
  excluirSessoesExpiradas,
  type PerfilAcesso,
} from "./banco.js"
import {
  compararResumos,
  conferirSenha,
  gerarCodigoDeAtivacao,
  gerarToken,
  normalizarLogin,
  protegerSenha,
  resumirToken,
} from "./seguranca.js"
import type {
  BlocoRecebido,
  DadosDeAtivacao,
  EnvelopeDoCofre,
} from "./tipos.js"

const nomeDoCookie = "gestao_life_sessao"
const duracaoDaSessaoEmMs = 12 * 60 * 60 * 1_000

interface OpcoesDaAplicacao {
  banco: DatabaseSync
  producao?: boolean
  diretorioAdministracao?: string
}

interface SessaoValida {
  usuarioId: string
  login: string
  nome: string
  perfil: PerfilAcesso
  csrfToken: string
}

function respostaDoUsuario(sessao: SessaoValida) {
  return {
    usuario: {
      id: sessao.usuarioId,
      login: sessao.login,
      nome: sessao.nome,
      perfilAcesso: sessao.perfil,
    },
    csrfToken: sessao.csrfToken,
  }
}

function validarTextoBase64(valor: unknown, maximo = 2_000_000) {
  return (
    typeof valor === "string" &&
    valor.length > 0 &&
    valor.length <= maximo &&
    /^[A-Za-z0-9+/=_-]+$/.test(valor)
  )
}

function validarEnvelope(valor: unknown): valor is EnvelopeDoCofre {
  if (!valor || typeof valor !== "object") return false
  const cofre = valor as Record<string, unknown>
  return (
    validarTextoBase64(cofre.saltKdf, 256) &&
    typeof cofre.parametrosKdf === "string" &&
    cofre.parametrosKdf.length <= 500 &&
    validarTextoBase64(cofre.nonceChave, 256) &&
    validarTextoBase64(cofre.chaveCriptografada, 1_000)
  )
}

function criarSessao(
  banco: DatabaseSync,
  usuario: { id: string; login: string; nome: string; perfil: PerfilAcesso },
  resposta: FastifyReply,
  producao: boolean,
) {
  const token = gerarToken()
  const csrfToken = gerarToken()
  const agora = new Date()
  const expiraEm = new Date(agora.getTime() + duracaoDaSessaoEmMs)
  banco
    .prepare(
      "INSERT INTO sessoes (token_hash, usuario_id, csrf_token, expira_em, criado_em) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      resumirToken(token),
      usuario.id,
      csrfToken,
      expiraEm.toISOString(),
      agora.toISOString(),
    )
  resposta.setCookie(nomeDoCookie, token, {
    httpOnly: true,
    secure: producao,
    sameSite: "strict",
    path: "/",
    expires: expiraEm,
  })
  return { ...usuario, usuarioId: usuario.id, csrfToken }
}

function obterSessao(
  banco: DatabaseSync,
  requisicao: FastifyRequest,
): SessaoValida | null {
  const token = requisicao.cookies[nomeDoCookie]
  if (!token) return null
  const registro = buscarSessao(banco, resumirToken(token))
  if (!registro) return null
  return {
    usuarioId: registro.usuario_id,
    login: registro.login,
    nome: registro.nome,
    perfil: registro.perfil,
    csrfToken: registro.csrf_token,
  }
}

function exigirSessao(
  banco: DatabaseSync,
  requisicao: FastifyRequest,
  resposta: FastifyReply,
) {
  const sessao = obterSessao(banco, requisicao)
  if (!sessao) {
    resposta.code(401).send({ erro: "Sessão inválida ou expirada." })
    return null
  }
  return sessao
}

function exigirMutacaoAutenticada(
  banco: DatabaseSync,
  requisicao: FastifyRequest,
  resposta: FastifyReply,
) {
  const sessao = exigirSessao(banco, requisicao, resposta)
  if (!sessao) return null
  const csrf = requisicao.headers["x-csrf-token"]
  if (
    typeof csrf !== "string" ||
    !compararResumos(resumirToken(csrf), resumirToken(sessao.csrfToken))
  ) {
    resposta.code(403).send({ erro: "Proteção da sessão inválida." })
    return null
  }
  return sessao
}

function exigirAdministrador(
  banco: DatabaseSync,
  requisicao: FastifyRequest,
  resposta: FastifyReply,
  mutacao = false,
) {
  const sessao = mutacao
    ? exigirMutacaoAutenticada(banco, requisicao, resposta)
    : exigirSessao(banco, requisicao, resposta)
  if (!sessao) return null
  if (sessao.perfil !== "administrador") {
    resposta.code(403).send({ erro: "Acesso não autorizado." })
    return null
  }
  return sessao
}

function tipoDeConteudo(caminho: string) {
  const tipos: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
  }
  return tipos[extname(caminho)] ?? "application/octet-stream"
}

export async function construirAplicacao({
  banco,
  producao = false,
  diretorioAdministracao = resolve(process.cwd(), "dist-admin"),
}: OpcoesDaAplicacao): Promise<FastifyInstance> {
  const aplicacao = Fastify({
    logger: producao,
    bodyLimit: 2_000_000,
    trustProxy: producao,
  })
  await aplicacao.register(cookie)
  await aplicacao.register(rateLimit, {
    global: false,
    max: 8,
    timeWindow: "1 minute",
  })

  aplicacao.addHook("onRequest", async (requisicao, resposta) => {
    resposta.header("X-Content-Type-Options", "nosniff")
    resposta.header("Referrer-Policy", "no-referrer")
    resposta.header("Cache-Control", "no-store")
    const origem = requisicao.headers["sec-fetch-site"]
    if (
      !["GET", "HEAD", "OPTIONS"].includes(requisicao.method) &&
      origem &&
      origem !== "same-origin"
    ) {
      return resposta.code(403).send({ erro: "Origem não autorizada." })
    }
  })

  aplicacao.get("/api/saude", async () => ({ status: "ok" }))

  aplicacao.post(
    "/api/sessao",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (requisicao, resposta) => {
      const corpo = requisicao.body as { login?: unknown; senha?: unknown }
      if (
        typeof corpo?.login !== "string" ||
        corpo.login.length > 80 ||
        typeof corpo?.senha !== "string" ||
        corpo.senha.length > 256
      ) {
        return resposta.code(400).send({ erro: "Credenciais inválidas." })
      }
      const usuario = buscarUsuarioPorLogin(banco, normalizarLogin(corpo.login))
      if (
        !usuario ||
        usuario.status !== "ativo" ||
        !usuario.senha_hash ||
        !(await conferirSenha(usuario.senha_hash, corpo.senha))
      ) {
        return resposta.code(401).send({ erro: "Usuário ou senha inválidos." })
      }
      excluirSessoesExpiradas(banco)
      const sessao = criarSessao(banco, usuario, resposta, producao)
      return resposta.send(respostaDoUsuario(sessao))
    },
  )

  aplicacao.get("/api/sessao", async (requisicao, resposta) => {
    const sessao = exigirSessao(banco, requisicao, resposta)
    if (!sessao) return
    return resposta.send(respostaDoUsuario(sessao))
  })

  aplicacao.delete("/api/sessao", async (requisicao, resposta) => {
    const sessao = exigirMutacaoAutenticada(banco, requisicao, resposta)
    if (!sessao) return
    const token = requisicao.cookies[nomeDoCookie]
    if (token) {
      banco
        .prepare("DELETE FROM sessoes WHERE token_hash = ?")
        .run(resumirToken(token))
    }
    resposta.clearCookie(nomeDoCookie, { path: "/" })
    return resposta.code(204).send()
  })

  aplicacao.post(
    "/api/ativacoes/preparar",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (requisicao, resposta) => {
      const corpo = requisicao.body as { login?: unknown; codigo?: unknown }
      if (
        typeof corpo?.login !== "string" ||
        corpo.login.length > 80 ||
        typeof corpo?.codigo !== "string" ||
        corpo.codigo.length > 100
      ) {
        return resposta.code(400).send({ erro: "Dados de ativação inválidos." })
      }
      const registro = banco
        .prepare(`
          SELECT id, status, codigo_ativacao_hash, codigo_ativacao_expira_em
            FROM usuarios WHERE login = ?
        `)
        .get(normalizarLogin(corpo.login)) as {
        id: string
        status: string
        codigo_ativacao_hash: string | null
        codigo_ativacao_expira_em: string | null
      } | undefined
      if (
        !registro ||
        registro.status !== "pendente" ||
        !registro.codigo_ativacao_hash ||
        !registro.codigo_ativacao_expira_em ||
        registro.codigo_ativacao_expira_em <= new Date().toISOString() ||
        !compararResumos(
          resumirToken(corpo.codigo.trim().toUpperCase()),
          registro.codigo_ativacao_hash,
        )
      ) {
        return resposta.code(401).send({ erro: "Código inválido ou expirado." })
      }
      return resposta.send({ usuarioId: registro.id })
    },
  )

  aplicacao.post(
    "/api/ativacoes",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (requisicao, resposta) => {
      const corpo = requisicao.body as Partial<DadosDeAtivacao>
      if (
        typeof corpo.login !== "string" ||
        corpo.login.length > 80 ||
        typeof corpo.codigo !== "string" ||
        corpo.codigo.length > 100 ||
        typeof corpo.senha !== "string" ||
        corpo.senha.length < 12 ||
        corpo.senha.length > 256 ||
        !validarEnvelope(corpo.cofre)
      ) {
        return resposta.code(400).send({ erro: "Dados de ativação inválidos." })
      }
      const login = normalizarLogin(corpo.login)
      const registro = banco
        .prepare(`
          SELECT id, login, nome, perfil, status, codigo_ativacao_hash, codigo_ativacao_expira_em
            FROM usuarios WHERE login = ?
        `)
        .get(login) as {
        id: string
        login: string
        nome: string
        perfil: PerfilAcesso
        status: string
        codigo_ativacao_hash: string | null
        codigo_ativacao_expira_em: string | null
      } | undefined
      if (
        !registro ||
        registro.status !== "pendente" ||
        !registro.codigo_ativacao_hash ||
        !registro.codigo_ativacao_expira_em ||
        registro.codigo_ativacao_expira_em <= new Date().toISOString() ||
        !compararResumos(
          resumirToken(corpo.codigo.trim().toUpperCase()),
          registro.codigo_ativacao_hash,
        )
      ) {
        return resposta.code(401).send({ erro: "Código inválido ou expirado." })
      }
      const senhaHash = await protegerSenha(corpo.senha)
      banco.exec("BEGIN IMMEDIATE")
      try {
        banco
          .prepare(`
            UPDATE usuarios
               SET senha_hash = ?, status = 'ativo', codigo_ativacao_hash = NULL,
                   codigo_ativacao_expira_em = NULL
             WHERE id = ? AND status = 'pendente'
          `)
          .run(senhaHash, registro.id)
        banco
          .prepare(`
            INSERT INTO cofres
              (usuario_id, salt_kdf, parametros_kdf, nonce_chave, chave_criptografada)
            VALUES (?, ?, ?, ?, ?)
          `)
          .run(
            registro.id,
            corpo.cofre.saltKdf,
            corpo.cofre.parametrosKdf,
            corpo.cofre.nonceChave,
            corpo.cofre.chaveCriptografada,
          )
        banco.exec("COMMIT")
      } catch (erro) {
        banco.exec("ROLLBACK")
        throw erro
      }
      const sessao = criarSessao(banco, registro, resposta, producao)
      return resposta.code(201).send(respostaDoUsuario(sessao))
    },
  )

  aplicacao.get("/api/cofre", async (requisicao, resposta) => {
    const sessao = exigirSessao(banco, requisicao, resposta)
    if (!sessao) return
    const cofre = banco
      .prepare(`
        SELECT salt_kdf AS saltKdf, parametros_kdf AS parametrosKdf,
               nonce_chave AS nonceChave, chave_criptografada AS chaveCriptografada
          FROM cofres WHERE usuario_id = ?
      `)
      .get(sessao.usuarioId)
    if (!cofre)
      return resposta.code(404).send({ erro: "Cofre não configurado." })
    return resposta.send(cofre)
  })

  aplicacao.get("/api/blocos", async (requisicao, resposta) => {
    const sessao = exigirSessao(banco, requisicao, resposta)
    if (!sessao) return
    const blocos = banco
      .prepare(`
        SELECT tipo_bloco AS tipo, revisao, nonce, conteudo
          FROM blocos_criptografados
         WHERE usuario_id = ? ORDER BY tipo_bloco
      `)
      .all(sessao.usuarioId)
    return resposta.send(blocos)
  })

  aplicacao.put<{ Params: { tipo: string } }>(
    "/api/blocos/:tipo",
    async (requisicao, resposta) => {
      const sessao = exigirMutacaoAutenticada(banco, requisicao, resposta)
      if (!sessao) return
      const tipo = decodeURIComponent(requisicao.params.tipo)
      const corpo = requisicao.body as Partial<BlocoRecebido>
      if (
        !/^[a-z0-9:-]{1,80}$/.test(tipo) ||
        !Number.isSafeInteger(corpo.revisaoEsperada) ||
        (corpo.revisaoEsperada ?? -1) < 0 ||
        !validarTextoBase64(corpo.nonce, 256) ||
        !validarTextoBase64(corpo.conteudo)
      ) {
        return resposta.code(400).send({ erro: "Bloco inválido." })
      }
      const atual = banco
        .prepare(
          "SELECT revisao FROM blocos_criptografados WHERE usuario_id = ? AND tipo_bloco = ?",
        )
        .get(sessao.usuarioId, tipo) as { revisao: number } | undefined
      const revisaoAtual = atual?.revisao ?? 0
      if (revisaoAtual !== corpo.revisaoEsperada) {
        return resposta
          .code(409)
          .send({ erro: "Bloco alterado em outra sessão.", revisaoAtual })
      }
      const novaRevisao = revisaoAtual + 1
      banco
        .prepare(`
          INSERT INTO blocos_criptografados
            (usuario_id, tipo_bloco, revisao, nonce, conteudo)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(usuario_id, tipo_bloco) DO UPDATE SET
            revisao = excluded.revisao,
            nonce = excluded.nonce,
            conteudo = excluded.conteudo
        `)
        .run(
          sessao.usuarioId,
          tipo,
          novaRevisao,
          corpo.nonce as string,
          corpo.conteudo as string,
        )
      return resposta.send({ revisao: novaRevisao })
    },
  )

  aplicacao.delete<{ Params: { tipo: string } }>(
    "/api/blocos/:tipo",
    async (requisicao, resposta) => {
      const sessao = exigirMutacaoAutenticada(banco, requisicao, resposta)
      if (!sessao) return
      banco
        .prepare(
          "DELETE FROM blocos_criptografados WHERE usuario_id = ? AND tipo_bloco = ?",
        )
        .run(sessao.usuarioId, decodeURIComponent(requisicao.params.tipo))
      return resposta.code(204).send()
    },
  )

  aplicacao.get("/api/admin/usuarios", async (requisicao, resposta) => {
    if (!exigirAdministrador(banco, requisicao, resposta)) return
    return resposta.send(
      banco
        .prepare(
          "SELECT id, login, nome, perfil AS perfilAcesso, status FROM usuarios ORDER BY nome, login",
        )
        .all(),
    )
  })

  aplicacao.post("/api/admin/usuarios", async (requisicao, resposta) => {
    if (!exigirAdministrador(banco, requisicao, resposta, true)) return
    const corpo = requisicao.body as { login?: unknown; nome?: unknown }
    const login =
      typeof corpo?.login === "string" ? normalizarLogin(corpo.login) : ""
    const nome = typeof corpo?.nome === "string" ? corpo.nome.trim() : ""
    if (
      !/^[a-z0-9._-]{3,40}$/.test(login) ||
      nome.length < 2 ||
      nome.length > 80
    ) {
      return resposta.code(400).send({ erro: "Nome ou usuário inválido." })
    }
    const codigo = gerarCodigoDeAtivacao()
    const id = crypto.randomUUID()
    try {
      banco
        .prepare(`
          INSERT INTO usuarios
            (id, login, nome, perfil, status, codigo_ativacao_hash,
             codigo_ativacao_expira_em, criado_em)
          VALUES (?, ?, ?, 'usuario', 'pendente', ?, ?, ?)
        `)
        .run(
          id,
          login,
          nome,
          resumirToken(codigo),
          new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
          new Date().toISOString(),
        )
    } catch {
      return resposta.code(409).send({ erro: "Este usuário já existe." })
    }
    return resposta.code(201).send({ id, login, nome, codigoAtivacao: codigo })
  })

  aplicacao.patch<{ Params: { id: string } }>(
    "/api/admin/usuarios/:id/status",
    async (requisicao, resposta) => {
      const administrador = exigirAdministrador(
        banco,
        requisicao,
        resposta,
        true,
      )
      if (!administrador) return
      const corpo = requisicao.body as { status?: unknown }
      if (!["ativo", "inativo"].includes(String(corpo?.status))) {
        return resposta.code(400).send({ erro: "Status inválido." })
      }
      if (requisicao.params.id === administrador.usuarioId) {
        return resposta
          .code(400)
          .send({ erro: "A conta atual não pode ser desativada aqui." })
      }
      banco
        .prepare(
          "UPDATE usuarios SET status = ? WHERE id = ? AND perfil = 'usuario'",
        )
        .run(String(corpo.status), requisicao.params.id)
      if (corpo.status === "inativo") {
        banco
          .prepare("DELETE FROM sessoes WHERE usuario_id = ?")
          .run(requisicao.params.id)
      }
      return resposta.code(204).send()
    },
  )

  aplicacao.get<{ Params: { "*": string } }>(
    "/api/administracao/*",
    async (requisicao, resposta) => {
      if (!exigirAdministrador(banco, requisicao, resposta)) return
      const relativo = requisicao.params["*"] || "index.html"
      const caminho = resolve(diretorioAdministracao, relativo)
      const raiz = resolve(diretorioAdministracao) + sep
      if (!caminho.startsWith(raiz)) return resposta.code(404).send()
      try {
        return resposta
          .type(tipoDeConteudo(caminho))
          .send(await readFile(caminho))
      } catch {
        return resposta.code(404).send({ erro: "Arquivo não encontrado." })
      }
    },
  )

  return aplicacao
}
