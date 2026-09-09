import { useState, type FormEvent } from "react"
import type { UsuarioAutenticado } from "../../dominio/modelos"
import { autenticarUsuario } from "../../servicos/servico-de-autenticacao"

interface PropriedadesTelaLogin {
  aoAutenticar: (usuario: UsuarioAutenticado) => void
}

export default function TelaLogin({ aoAutenticar }: PropriedadesTelaLogin) {
  const [login, definirLogin] = useState("")
  const [senha, definirSenha] = useState("")
  const [senhaVisivel, definirSenhaVisivel] = useState(false)
  const [mensagemDeErro, definirMensagemDeErro] = useState("")
  const [autenticando, definirAutenticando] = useState(false)

  async function enviarFormulario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!login.trim() || !senha) {
      definirMensagemDeErro("Informe o usuário e a senha.")
      return
    }

    definirAutenticando(true)
    definirMensagemDeErro("")

    try {
      const usuario = await autenticarUsuario(login, senha)
      if (!usuario) {
        definirMensagemDeErro("Usuário ou senha inválidos.")
        return
      }
      aoAutenticar(usuario)
    } catch {
      definirMensagemDeErro("Não foi possível realizar o acesso agora.")
    } finally {
      definirAutenticando(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#EEF2F9] flex items-center justify-center px-5 py-8">
      <section className="w-full max-w-sm overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-blue-950/10">
        <div className="relative overflow-hidden bg-[#1A56DB] px-7 pb-10 pt-9 text-white">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
          <div className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-blue-300/15" />
          <div className="relative">
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-lg font-bold text-[#1A56DB] shadow-sm">
              GL
            </div>
            <p className="text-sm font-semibold text-blue-100">Gestão Life</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Sua vida, organizada.
            </h1>
            <p className="mt-3 max-w-xs text-sm leading-6 text-blue-100">
              Entre para acompanhar suas finanças, metas e anotações em um só
              lugar.
            </p>
          </div>
        </div>

        <form className="space-y-5 px-7 pb-8 pt-7" onSubmit={enviarFormulario}>
          <div>
            <label
              className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-500"
              htmlFor="login"
            >
              Usuário
            </label>
            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 transition focus-within:border-[#1A56DB] focus-within:bg-white">
              <svg
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.12a7.5 7.5 0 0 1 15 0A17.9 17.9 0 0 1 12 21.75a17.9 17.9 0 0 1-7.5-1.63Z"
                />
              </svg>
              <input
                id="login"
                name="login"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                value={login}
                onChange={(evento) => definirLogin(evento.target.value)}
                placeholder="Digite seu usuário"
                className="h-14 w-full bg-transparent text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          <div>
            <label
              className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-500"
              htmlFor="senha"
            >
              Senha
            </label>
            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 transition focus-within:border-[#1A56DB] focus-within:bg-white">
              <svg
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 10.5h10.5A2.25 2.25 0 0 0 19.5 18.75v-6A2.25 2.25 0 0 0 17.25 10.5H6.75A2.25 2.25 0 0 0 4.5 12.75v6A2.25 2.25 0 0 0 6.75 21Z"
                />
              </svg>
              <input
                id="senha"
                name="senha"
                type={senhaVisivel ? "text" : "password"}
                autoComplete="current-password"
                value={senha}
                onChange={(evento) => definirSenha(evento.target.value)}
                placeholder="Digite sua senha"
                className="h-14 min-w-0 flex-1 bg-transparent text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={() => definirSenhaVisivel((valor) => !valor)}
                className="rounded-lg px-2 py-2 text-xs font-semibold text-[#1A56DB]"
                aria-label={senhaVisivel ? "Ocultar senha" : "Mostrar senha"}
              >
                {senhaVisivel ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          {mensagemDeErro && (
            <div
              role="alert"
              className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
            >
              {mensagemDeErro}
            </div>
          )}

          <button
            type="submit"
            disabled={autenticando}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#1A56DB] text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-[#174DBF] disabled:cursor-wait disabled:opacity-60"
          >
            {autenticando ? "Entrando..." : "Entrar"}
          </button>

          <p className="text-center text-xs leading-5 text-gray-400">
            Versão 1.0 · Seus dados permanecem vinculados ao seu usuário.
          </p>
        </form>
      </section>
    </main>
  )
}
