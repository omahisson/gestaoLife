import assert from "node:assert/strict"
import { test } from "node:test"
import { abrirBanco } from "./banco.js"
import { construirAplicacao } from "./aplicacao.js"
import { protegerSenha, resumirToken } from "./seguranca.js"

function inserirUsuario(
  banco: ReturnType<typeof abrirBanco>,
  dados: { id: string; login: string; perfil: "administrador" | "usuario" },
  senhaHash: string,
) {
  banco
    .prepare(`
      INSERT INTO usuarios
        (id, login, nome, perfil, status, senha_hash, criado_em)
      VALUES (?, ?, ?, ?, 'ativo', ?, ?)
    `)
    .run(
      dados.id,
      dados.login,
      dados.login,
      dados.perfil,
      senhaHash,
      new Date().toISOString(),
    )
  banco
    .prepare(`
      INSERT INTO cofres
        (usuario_id, salt_kdf, parametros_kdf, nonce_chave, chave_criptografada)
      VALUES (?, 'c2FsdA==', '{}', 'bm9uY2U=', 'Y2hhdmU=')
    `)
    .run(dados.id)
}

function cookieDaResposta(cabecalho: string | string[] | undefined) {
  const valor = Array.isArray(cabecalho) ? cabecalho[0] : cabecalho
  return valor?.split(";", 1)[0] ?? ""
}

test("isola blocos pela conta da sessão e exige CSRF", async () => {
  const banco = abrirBanco(":memory:")
  const senhaHash = await protegerSenha("senha-com-12-caracteres")
  inserirUsuario(
    banco,
    { id: "usuario-a", login: "pessoa-a", perfil: "administrador" },
    senhaHash,
  )
  inserirUsuario(
    banco,
    { id: "usuario-b", login: "pessoa-b", perfil: "usuario" },
    senhaHash,
  )
  const api = await construirAplicacao({ banco })

  const loginA = await api.inject({
    method: "POST",
    url: "/api/sessao",
    payload: { login: "pessoa-a", senha: "senha-com-12-caracteres" },
  })
  assert.equal(loginA.statusCode, 200)
  const cookieA = cookieDaResposta(loginA.headers["set-cookie"])
  const csrfA = loginA.json().csrfToken as string

  const semCsrf = await api.inject({
    method: "PUT",
    url: "/api/blocos/notas:0001",
    headers: { cookie: cookieA },
    payload: {
      revisaoEsperada: 0,
      nonce: "bm9uY2U=",
      conteudo: "c2VncmVkbw==",
    },
  })
  assert.equal(semCsrf.statusCode, 403)

  const salvamento = await api.inject({
    method: "PUT",
    url: "/api/blocos/notas:0001",
    headers: { cookie: cookieA, "x-csrf-token": csrfA },
    payload: {
      revisaoEsperada: 0,
      nonce: "bm9uY2U=",
      conteudo: "c2VncmVkbw==",
    },
  })
  assert.equal(salvamento.statusCode, 200)

  const loginB = await api.inject({
    method: "POST",
    url: "/api/sessao",
    payload: { login: "pessoa-b", senha: "senha-com-12-caracteres" },
  })
  const blocosB = await api.inject({
    method: "GET",
    url: "/api/blocos",
    headers: { cookie: cookieDaResposta(loginB.headers["set-cookie"]) },
  })
  assert.deepEqual(blocosB.json(), [])

  const administracaoB = await api.inject({
    method: "GET",
    url: "/api/admin/usuarios",
    headers: { cookie: cookieDaResposta(loginB.headers["set-cookie"]) },
  })
  assert.equal(administracaoB.statusCode, 403)

  const arquivosAdministrativosB = await api.inject({
    method: "GET",
    url: "/api/administracao/index.html",
    headers: { cookie: cookieDaResposta(loginB.headers["set-cookie"]) },
  })
  assert.equal(arquivosAdministrativosB.statusCode, 403)

  await api.close()
  banco.close()
})

test("impede sobrescrita de uma revisão desatualizada", async () => {
  const banco = abrirBanco(":memory:")
  const senhaHash = await protegerSenha("senha-com-12-caracteres")
  inserirUsuario(
    banco,
    { id: "usuario-c", login: "pessoa-c", perfil: "usuario" },
    senhaHash,
  )
  const api = await construirAplicacao({ banco })
  const login = await api.inject({
    method: "POST",
    url: "/api/sessao",
    payload: { login: "pessoa-c", senha: "senha-com-12-caracteres" },
  })
  const headers = {
    cookie: cookieDaResposta(login.headers["set-cookie"]),
    "x-csrf-token": login.json().csrfToken as string,
  }
  const payload = {
    revisaoEsperada: 0,
    nonce: "bm9uY2U=",
    conteudo: "YmxvY28=",
  }
  assert.equal(
    (
      await api.inject({
        method: "PUT",
        url: "/api/blocos/metas",
        headers,
        payload,
      })
    ).statusCode,
    200,
  )
  assert.equal(
    (
      await api.inject({
        method: "PUT",
        url: "/api/blocos/metas",
        headers,
        payload,
      })
    ).statusCode,
    409,
  )
  await api.close()
  banco.close()
})

test("ativa uma conta pendente sem receber a frase do cofre", async () => {
  const banco = abrirBanco(":memory:")
  const codigo = "CODIGO-ATIVACAO"
  banco
    .prepare(`
      INSERT INTO usuarios
        (id, login, nome, perfil, status, codigo_ativacao_hash,
         codigo_ativacao_expira_em, criado_em)
      VALUES ('usuario-pendente', 'pendente', 'Pessoa', 'usuario', 'pendente', ?, ?, ?)
    `)
    .run(
      resumirToken(codigo),
      new Date(Date.now() + 60_000).toISOString(),
      new Date().toISOString(),
    )
  const api = await construirAplicacao({ banco })
  const preparacao = await api.inject({
    method: "POST",
    url: "/api/ativacoes/preparar",
    payload: { login: "pendente", codigo },
  })
  assert.equal(preparacao.statusCode, 200)
  assert.equal(preparacao.json().usuarioId, "usuario-pendente")

  const ativacao = await api.inject({
    method: "POST",
    url: "/api/ativacoes",
    payload: {
      login: "pendente",
      codigo,
      senha: "senha-de-acesso-segura",
      cofre: {
        saltKdf: "c2FsdA==",
        parametrosKdf: '{"versao":1}',
        nonceChave: "bm9uY2U=",
        chaveCriptografada: "Y2hhdmU=",
      },
    },
  })
  assert.equal(ativacao.statusCode, 201)
  const usuario = banco
    .prepare(
      "SELECT status, codigo_ativacao_hash FROM usuarios WHERE id = 'usuario-pendente'",
    )
    .get() as { status: string; codigo_ativacao_hash: string | null }
  assert.equal(usuario.status, "ativo")
  assert.equal(usuario.codigo_ativacao_hash, null)
  assert.ok(
    banco
      .prepare(
        "SELECT usuario_id FROM cofres WHERE usuario_id = 'usuario-pendente'",
      )
      .get(),
  )

  await api.close()
  banco.close()
})
