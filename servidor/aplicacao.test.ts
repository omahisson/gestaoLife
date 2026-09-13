import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { test } from "node:test"
import { criarOuReemitirAdministradorPendente } from "./administradores.js"
import { abrirBanco } from "./banco.js"
import { construirAplicacao } from "./aplicacao.js"
import { protegerSenha, resumirToken } from "./seguranca.js"

interface UsuarioAtivadoNoBanco {
  status: string
  codigo_ativacao_hash: string | null
}

interface AdministradorPendenteNoBanco {
  nome: string
  codigo_ativacao_hash: string
}

interface UsuarioDaAdministracao {
  id: string
  login: string
  nome: string
  inapagavel: boolean
}

interface ContaEditadaNoBanco {
  login: string
  nome: string
}

function inserirUsuario(
  banco: ReturnType<typeof abrirBanco>,
  dados: {
    id: string
    login: string
    perfil: "administrador" | "usuario"
  },
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

  const cofre = {
    saltKdf: "c2FsdA==",
    parametrosKdf: '{"versao":1}',
    nonceChave: "bm9uY2U=",
    chaveCriptografada: "Y2hhdmU=",
  }
  const senhaCurta = await api.inject({
    method: "POST",
    url: "/api/ativacoes",
    payload: {
      login: "pendente",
      codigo,
      senha: "abcd",
      cofre,
    },
  })
  assert.equal(senhaCurta.statusCode, 400)

  const ativacao = await api.inject({
    method: "POST",
    url: "/api/ativacoes",
    payload: {
      login: "pendente",
      codigo,
      senha: "abcde",
      cofre,
    },
  })
  assert.equal(ativacao.statusCode, 201)
  const usuario = banco
    .prepare(
      "SELECT status, codigo_ativacao_hash FROM usuarios WHERE id = 'usuario-pendente'",
    )
    .get() as UsuarioAtivadoNoBanco
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

test("reemitir ativação administrativa invalida o código anterior", () => {
  const banco = abrirBanco(":memory:")
  const codigoAnterior = "CODIGO-ANTERIOR"
  banco
    .prepare(`
      INSERT INTO usuarios
        (id, login, nome, perfil, status, codigo_ativacao_hash,
         codigo_ativacao_expira_em, criado_em)
      VALUES ('administrador-pendente', 'admin', 'Administrador',
              'administrador', 'pendente', ?, ?, ?)
    `)
    .run(
      resumirToken(codigoAnterior),
      new Date(Date.now() + 60_000).toISOString(),
      new Date().toISOString(),
    )

  const resultado = criarOuReemitirAdministradorPendente(
    banco,
    "admin",
    "Novo nome",
  )
  const usuario = banco
    .prepare(`
      SELECT nome, codigo_ativacao_hash
        FROM usuarios
       WHERE id = 'administrador-pendente'
    `)
    .get() as AdministradorPendenteNoBanco

  assert.equal(resultado.reemitido, true)
  assert.equal(usuario.nome, "Novo nome")
  assert.notEqual(usuario.codigo_ativacao_hash, resumirToken(codigoAnterior))
  assert.equal(usuario.codigo_ativacao_hash, resumirToken(resultado.codigo))
  banco.close()
})

test("administra contas e impede excluir a primeira", async () => {
  const banco = abrirBanco(":memory:")
  const senha = "senha-administrativa"
  const senhaHash = await protegerSenha(senha)
  inserirUsuario(
    banco,
    { id: "conta-principal", login: "admin", perfil: "administrador" },
    senhaHash,
  )
  const api = await construirAplicacao({ banco })
  const autenticacao = await api.inject({
    method: "POST",
    url: "/api/sessao",
    payload: { login: "admin", senha },
  })
  const headers = {
    cookie: cookieDaResposta(autenticacao.headers["set-cookie"]),
    "x-csrf-token": autenticacao.json().csrfToken as string,
  }

  const criacao = await api.inject({
    method: "POST",
    url: "/api/admin/usuarios",
    headers,
    payload: { nome: "Nova pessoa", login: "nova.pessoa" },
  })
  assert.equal(criacao.statusCode, 201)
  const contaCriada = criacao.json() as { id: string }

  const listagem = await api.inject({
    method: "GET",
    url: "/api/admin/usuarios",
    headers,
  })
  const usuarios = listagem.json() as UsuarioDaAdministracao[]
  assert.equal(
    usuarios.find((usuario) => usuario.id === "conta-principal")?.inapagavel,
    true,
  )
  assert.equal(
    usuarios.find((usuario) => usuario.id === contaCriada.id)?.inapagavel,
    false,
  )

  const edicao = await api.inject({
    method: "PATCH",
    url: `/api/admin/usuarios/${contaCriada.id}`,
    headers,
    payload: { nome: "Pessoa editada", login: "pessoa.editada" },
  })
  assert.equal(edicao.statusCode, 204)
  const contaEditada = banco
    .prepare("SELECT login, nome FROM usuarios WHERE id = ?")
    .get(contaCriada.id) as ContaEditadaNoBanco
  assert.equal(contaEditada.login, "pessoa.editada")
  assert.equal(contaEditada.nome, "Pessoa editada")

  const exclusaoPrincipal = await api.inject({
    method: "DELETE",
    url: "/api/admin/usuarios/conta-principal",
    headers,
  })
  assert.equal(exclusaoPrincipal.statusCode, 400)

  const exclusao = await api.inject({
    method: "DELETE",
    url: `/api/admin/usuarios/${contaCriada.id}`,
    headers,
  })
  assert.equal(exclusao.statusCode, 204)
  assert.equal(
    banco.prepare("SELECT id FROM usuarios WHERE id = ?").get(contaCriada.id),
    undefined,
  )

  await api.close()
  banco.close()
})

test("migra a base existente e protege a conta mais antiga", () => {
  const diretorio = mkdtempSync(join(tmpdir(), "gestao-life-migracao-"))
  const caminho = join(diretorio, "base.sqlite")
  try {
    const bancoAntigo = new DatabaseSync(caminho)
    bancoAntigo.exec(`
      CREATE TABLE usuarios (
        id TEXT PRIMARY KEY,
        login TEXT NOT NULL UNIQUE,
        nome TEXT NOT NULL,
        perfil TEXT NOT NULL,
        status TEXT NOT NULL,
        senha_hash TEXT,
        codigo_ativacao_hash TEXT,
        codigo_ativacao_expira_em TEXT,
        criado_em TEXT NOT NULL
      ) STRICT;
      INSERT INTO usuarios
        (id, login, nome, perfil, status, criado_em)
      VALUES
        ('primeira', 'admin', 'Administrador', 'administrador', 'ativo',
         '2026-01-01T00:00:00.000Z'),
        ('segunda', 'pessoa', 'Pessoa', 'usuario', 'ativo',
         '2026-01-02T00:00:00.000Z');
      PRAGMA user_version = 1;
    `)
    bancoAntigo.close()

    const bancoMigrado = abrirBanco(caminho)
    const principal = bancoMigrado
      .prepare("SELECT id FROM usuarios WHERE conta_principal = 1")
      .get() as { id: string }
    assert.equal(principal.id, "primeira")
    assert.throws(
      () =>
        bancoMigrado
          .prepare("DELETE FROM usuarios WHERE id = 'primeira'")
          .run(),
      /primeira conta não pode ser excluída/,
    )
    assert.equal(
      (bancoMigrado.prepare("PRAGMA user_version").get() as {
        user_version: number
      }).user_version,
      2,
    )
    bancoMigrado.close()
  } finally {
    rmSync(diretorio, { recursive: true, force: true })
  }
})
