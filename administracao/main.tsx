import React, { useEffect, useState, type FormEvent } from "react"
import { createRoot } from "react-dom/client"
import "../src/index.css"

interface Usuario {
  id: string
  login: string
  nome: string
  perfilAcesso: "administrador" | "usuario"
  status: "pendente" | "ativo" | "inativo"
  inapagavel: boolean
}

interface Sessao {
  csrfToken: string
}

let csrfToken = ""

async function requisitar<T>(caminho: string, opcoes: RequestInit = {}) {
  const resposta = await fetch(`/api${caminho}`, {
    ...opcoes,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(opcoes.body ? { "Content-Type": "application/json" } : {}),
      ...(opcoes.method && opcoes.method !== "GET"
        ? { "X-CSRF-Token": csrfToken }
        : {}),
      ...opcoes.headers,
    },
  })
  if (!resposta.ok) {
    const dados = await resposta.json().catch(() => undefined)
    throw new Error(dados?.erro ?? "Não foi possível concluir a operação.")
  }
  if (resposta.status === 204) return undefined as T
  return resposta.json() as Promise<T>
}

function AplicacaoAdministrativa() {
  const [usuarios, definirUsuarios] = useState<Usuario[]>([])
  const [nome, definirNome] = useState("")
  const [login, definirLogin] = useState("")
  const [codigo, definirCodigo] = useState("")
  const [usuarioEmEdicao, definirUsuarioEmEdicao] = useState<string | null>(
    null,
  )
  const [nomeEmEdicao, definirNomeEmEdicao] = useState("")
  const [loginEmEdicao, definirLoginEmEdicao] = useState("")
  const [erro, definirErro] = useState("")
  const [carregando, definirCarregando] = useState(true)

  async function carregar() {
    try {
      const sessao = await requisitar<Sessao>("/sessao")
      csrfToken = sessao.csrfToken
      definirUsuarios(await requisitar<Usuario[]>("/admin/usuarios"))
      definirErro("")
    } catch (falha) {
      definirErro(
        falha instanceof Error ? falha.message : "Acesso indisponível.",
      )
    } finally {
      definirCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [])

  async function criarUsuario(evento: FormEvent) {
    evento.preventDefault()
    definirErro("")
    try {
      const criado = await requisitar<Usuario & { codigoAtivacao: string }>(
        "/admin/usuarios",
        { method: "POST", body: JSON.stringify({ nome, login }) },
      )
      definirCodigo(criado.codigoAtivacao)
      definirNome("")
      definirLogin("")
      await carregar()
    } catch (falha) {
      definirErro(
        falha instanceof Error ? falha.message : "Não foi possível criar.",
      )
    }
  }

  async function alternarStatus(usuario: Usuario) {
    const status = usuario.status === "inativo" ? "ativo" : "inativo"
    if (
      !window.confirm(
        `${status === "inativo" ? "Desativar" : "Ativar"} @${usuario.login}?`,
      )
    )
      return
    try {
      await requisitar<void>(`/admin/usuarios/${usuario.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      await carregar()
    } catch (falha) {
      definirErro(
        falha instanceof Error ? falha.message : "Não foi possível alterar.",
      )
    }
  }

  function iniciarEdicao(usuario: Usuario) {
    definirUsuarioEmEdicao(usuario.id)
    definirNomeEmEdicao(usuario.nome)
    definirLoginEmEdicao(usuario.login)
    definirErro("")
  }

  function cancelarEdicao() {
    definirUsuarioEmEdicao(null)
    definirNomeEmEdicao("")
    definirLoginEmEdicao("")
  }

  async function salvarEdicao(evento: FormEvent) {
    evento.preventDefault()
    if (!usuarioEmEdicao) return
    definirErro("")
    try {
      await requisitar<void>(`/admin/usuarios/${usuarioEmEdicao}`, {
        method: "PATCH",
        body: JSON.stringify({ nome: nomeEmEdicao, login: loginEmEdicao }),
      })
      cancelarEdicao()
      await carregar()
    } catch (falha) {
      definirErro(
        falha instanceof Error ? falha.message : "Não foi possível editar.",
      )
    }
  }

  async function excluirUsuario(usuario: Usuario) {
    if (
      !window.confirm(
        `Excluir a conta @${usuario.login} e todos os dados dela PARA SEMPRE? Esta ação não pode ser desfeita.`,
      )
    ) {
      return
    }
    definirErro("")
    try {
      await requisitar<void>(`/admin/usuarios/${usuario.id}`, {
        method: "DELETE",
      })
      if (usuarioEmEdicao === usuario.id) cancelarEdicao()
      definirCodigo("")
      await carregar()
    } catch (falha) {
      definirErro(
        falha instanceof Error ? falha.message : "Não foi possível excluir.",
      )
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[#EEF2F9] px-5 pb-10 pt-8 text-gray-900">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#1A56DB]">
              Administração
            </p>
            <h1 className="mt-1 text-2xl font-bold">Gerenciar usuários</h1>
          </div>
          <button
            type="button"
            onClick={() =>
              window.parent.postMessage(
                "gestao-life:fechar-administracao",
                window.location.origin,
              )
            }
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl text-gray-500 shadow-sm"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={criarUsuario}
          className="space-y-3 rounded-3xl bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-bold">Adicionar pessoa</h2>
          <input
            value={nome}
            onChange={(evento) => definirNome(evento.target.value)}
            placeholder="Nome"
            className="h-12 w-full rounded-xl bg-gray-100 px-4 text-base outline-none focus:ring-2 focus:ring-[#1A56DB]/30"
          />
          <input
            value={login}
            onChange={(evento) => definirLogin(evento.target.value)}
            placeholder="Nome de usuário"
            autoCapitalize="none"
            className="h-12 w-full rounded-xl bg-gray-100 px-4 text-base outline-none focus:ring-2 focus:ring-[#1A56DB]/30"
          />
          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-[#1A56DB] text-sm font-bold text-white"
          >
            Criar acesso
          </button>
        </form>

        {codigo && (
          <section className="mt-3 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
              Código exibido uma única vez
            </p>
            <p className="mt-2 break-all font-mono text-lg font-bold text-amber-950">
              {codigo}
            </p>
            <p className="mt-2 text-xs leading-5 text-amber-800">
              Envie este código à pessoa. Ele expira em 24 horas.
            </p>
          </section>
        )}

        {erro && (
          <div
            role="alert"
            className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
          >
            {erro}
          </div>
        )}

        <section className="mt-6 space-y-3">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-widest text-gray-500">
            Contas
          </h2>
          {carregando ? (
            <p className="px-1 text-sm text-gray-500">Carregando...</p>
          ) : (
            usuarios.map((usuario) => (
              <article
                key={usuario.id}
                className="rounded-2xl bg-white p-4 shadow-sm"
              >
                {usuarioEmEdicao === usuario.id ? (
                  <form className="space-y-3" onSubmit={salvarEdicao}>
                    <input
                      value={nomeEmEdicao}
                      onChange={(evento) =>
                        definirNomeEmEdicao(evento.target.value)
                      }
                      placeholder="Nome"
                      autoFocus
                      className="h-12 w-full rounded-xl bg-gray-100 px-4 text-base outline-none focus:ring-2 focus:ring-[#1A56DB]/30"
                    />
                    <input
                      value={loginEmEdicao}
                      onChange={(evento) =>
                        definirLoginEmEdicao(evento.target.value)
                      }
                      placeholder="Nome de usuário"
                      autoCapitalize="none"
                      className="h-12 w-full rounded-xl bg-gray-100 px-4 text-base outline-none focus:ring-2 focus:ring-[#1A56DB]/30"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={cancelarEdicao}
                        className="h-11 rounded-xl bg-gray-100 text-sm font-bold text-gray-600"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="h-11 rounded-xl bg-[#1A56DB] text-sm font-bold text-white"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 font-bold text-[#1A56DB]">
                        {usuario.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-bold">
                            {usuario.nome}
                          </p>
                          {usuario.inapagavel && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-[#1A56DB]">
                              Conta principal
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-gray-500">
                          @{usuario.login} · {usuario.status}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
                      <button
                        type="button"
                        onClick={() => iniciarEdicao(usuario)}
                        className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-[#1A56DB]"
                      >
                        Editar
                      </button>
                      {usuario.perfilAcesso === "usuario" &&
                        usuario.status !== "pendente" && (
                          <button
                            type="button"
                            onClick={() => alternarStatus(usuario)}
                            className={`rounded-xl px-3 py-2 text-xs font-bold ${
                              usuario.status === "inativo"
                                ? "bg-blue-50 text-[#1A56DB]"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {usuario.status === "inativo"
                              ? "Ativar"
                              : "Desativar"}
                          </button>
                        )}
                      {!usuario.inapagavel && (
                        <button
                          type="button"
                          onClick={() => excluirUsuario(usuario)}
                          className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  )
}

createRoot(document.getElementById("administracao")!).render(
  <React.StrictMode>
    <AplicacaoAdministrativa />
  </React.StrictMode>,
)
