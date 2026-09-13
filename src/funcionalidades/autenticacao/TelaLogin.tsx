import { useState, type FormEvent } from "react"
import type { UsuarioAutenticado } from "../../dominio/modelos"
import {
  abrirCofreDoUsuario,
  ativarUsuario,
  autenticarUsuario,
  encerrarSessao,
} from "../../servicos/servico-de-autenticacao"

interface PropriedadesTelaLogin {
  usuarioDaSessao?: UsuarioAutenticado | null
  aoAutenticar: (usuario: UsuarioAutenticado) => void
  aoEncerrarSessao: () => void
}

type Etapa = "acesso" | "cofre" | "ativacao"

export default function TelaLogin({
  usuarioDaSessao,
  aoAutenticar,
  aoEncerrarSessao,
}: PropriedadesTelaLogin) {
  const [etapa, definirEtapa] = useState<Etapa>(
    usuarioDaSessao ? "cofre" : "acesso",
  )
  const [usuarioPendente, definirUsuarioPendente] =
    useState<UsuarioAutenticado | null>(usuarioDaSessao ?? null)
  const [login, definirLogin] = useState(usuarioDaSessao?.login ?? "")
  const [senha, definirSenha] = useState("")
  const [confirmacaoSenha, definirConfirmacaoSenha] = useState("")
  const [codigo, definirCodigo] = useState("")
  const [frase, definirFrase] = useState("")
  const [confirmacaoFrase, definirConfirmacaoFrase] = useState("")
  const [mensagemDeErro, definirMensagemDeErro] = useState("")
  const [processando, definirProcessando] = useState(false)

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    definirMensagemDeErro("")
    definirProcessando(true)
    try {
      if (etapa === "acesso") {
        if (!login.trim() || !senha)
          throw new Error("Informe o usuário e a senha.")
        const usuario = await autenticarUsuario(login, senha)
        definirUsuarioPendente(usuario)
        definirFrase("")
        definirEtapa("cofre")
        return
      }

      if (etapa === "cofre") {
        if (!usuarioPendente || !frase) {
          throw new Error("Informe a frase de proteção.")
        }
        await abrirCofreDoUsuario(usuarioPendente, frase)
        aoAutenticar(usuarioPendente)
        return
      }

      if (!login.trim() || !codigo.trim()) {
        throw new Error("Informe o usuário e o código de ativação.")
      }
      if (senha.length < 12) {
        throw new Error("A senha deve ter pelo menos 12 caracteres.")
      }
      if (senha !== confirmacaoSenha)
        throw new Error("As senhas não coincidem.")
      if (frase.length < 12) {
        throw new Error(
          "A frase de proteção deve ter pelo menos 12 caracteres.",
        )
      }
      if (frase !== confirmacaoFrase) {
        throw new Error("As frases de proteção não coincidem.")
      }
      const usuario = await ativarUsuario({
        login,
        codigo,
        senha,
        fraseDoCofre: frase,
      })
      aoAutenticar(usuario)
    } catch (erro) {
      if (etapa === "cofre" && erro instanceof DOMException) {
        definirMensagemDeErro("Frase de proteção incorreta.")
      } else {
        definirMensagemDeErro(
          erro instanceof Error
            ? erro.message
            : "Não foi possível concluir agora.",
        )
      }
    } finally {
      definirProcessando(false)
    }
  }

  async function trocarConta() {
    await encerrarSessao()
    definirUsuarioPendente(null)
    definirSenha("")
    definirFrase("")
    definirEtapa("acesso")
    aoEncerrarSessao()
  }

  const titulo =
    etapa === "ativacao"
      ? "Ativar conta"
      : etapa === "cofre"
        ? "Desbloquear dados"
        : "Entrar"

  return (
    <main className="min-h-[100dvh] bg-[#EEF2F9] flex items-center justify-center sm:px-5 sm:py-8">
      <section className="w-full min-h-[100dvh] overflow-hidden bg-white sm:min-h-0 sm:max-w-sm sm:rounded-[2rem] sm:shadow-xl sm:shadow-blue-950/10">
        <div className="relative overflow-hidden bg-[#1A56DB] px-7 pb-9 pt-9 text-white">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
          <div className="relative">
            <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-lg font-bold text-[#1A56DB]">
              GL
            </div>
            <p className="text-sm font-semibold text-blue-100">Gestão Life</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{titulo}</h1>
            <p className="mt-3 text-sm leading-6 text-blue-100">
              {etapa === "cofre"
                ? `Sessão de @${usuarioPendente?.login}. A frase abre seus dados somente neste aparelho.`
                : etapa === "ativacao"
                  ? "Use o código recebido e crie dois segredos diferentes."
                  : "Acesse suas finanças, metas e anotações."}
            </p>
          </div>
        </div>

        <form className="space-y-4 px-7 pb-8 pt-7" onSubmit={enviar}>
          {etapa !== "cofre" && (
            <Campo
              id="login"
              rotulo="Usuário"
              valor={login}
              aoAlterar={definirLogin}
              autocomplete="username"
            />
          )}
          {etapa === "ativacao" && (
            <Campo
              id="codigo"
              rotulo="Código de ativação"
              valor={codigo}
              aoAlterar={definirCodigo}
              autocomplete="one-time-code"
            />
          )}
          {etapa !== "cofre" && (
            <Campo
              id="senha"
              rotulo={etapa === "ativacao" ? "Crie a senha de acesso" : "Senha"}
              valor={senha}
              aoAlterar={definirSenha}
              tipo="password"
              autocomplete={
                etapa === "ativacao" ? "new-password" : "current-password"
              }
            />
          )}
          {etapa === "ativacao" && (
            <Campo
              id="confirmacao-senha"
              rotulo="Confirme a senha"
              valor={confirmacaoSenha}
              aoAlterar={definirConfirmacaoSenha}
              tipo="password"
              autocomplete="new-password"
            />
          )}
          {(etapa === "cofre" || etapa === "ativacao") && (
            <Campo
              id="frase"
              rotulo={
                etapa === "ativacao"
                  ? "Crie a frase de proteção"
                  : "Frase de proteção"
              }
              valor={frase}
              aoAlterar={definirFrase}
              tipo="password"
              autocomplete="off"
              focoAutomatico
            />
          )}
          {etapa === "ativacao" && (
            <Campo
              id="confirmacao-frase"
              rotulo="Confirme a frase de proteção"
              valor={confirmacaoFrase}
              aoAlterar={definirConfirmacaoFrase}
              tipo="password"
              autocomplete="off"
            />
          )}

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
            disabled={processando}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#1A56DB] text-sm font-bold text-white shadow-lg shadow-blue-600/20 disabled:cursor-wait disabled:opacity-60"
          >
            {processando
              ? "Processando..."
              : etapa === "ativacao"
                ? "Ativar e entrar"
                : etapa === "cofre"
                  ? "Desbloquear"
                  : "Continuar"}
          </button>

          {etapa === "acesso" && (
            <button
              type="button"
              onClick={() => definirEtapa("ativacao")}
              className="w-full py-2 text-sm font-semibold text-[#1A56DB]"
            >
              Ativar uma conta
            </button>
          )}
          {etapa === "ativacao" && (
            <button
              type="button"
              onClick={() => definirEtapa("acesso")}
              className="w-full py-2 text-sm font-semibold text-[#1A56DB]"
            >
              Voltar ao acesso
            </button>
          )}
          {etapa === "cofre" && (
            <button
              type="button"
              onClick={trocarConta}
              className="w-full py-2 text-sm font-semibold text-gray-500"
            >
              Trocar de conta
            </button>
          )}
        </form>
      </section>
    </main>
  )
}

function Campo({
  id,
  rotulo,
  valor,
  aoAlterar,
  tipo = "text",
  autocomplete,
  focoAutomatico = false,
}: {
  id: string
  rotulo: string
  valor: string
  aoAlterar: (valor: string) => void
  tipo?: "text" | "password"
  autocomplete: string
  focoAutomatico?: boolean
}) {
  return (
    <div>
      <label
        className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-500"
        htmlFor={id}
      >
        {rotulo}
      </label>
      <input
        id={id}
        type={tipo}
        autoComplete={autocomplete}
        autoCapitalize="none"
        autoFocus={focoAutomatico}
        value={valor}
        onChange={(evento) => aoAlterar(evento.target.value)}
        className="h-14 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-base font-medium text-gray-900 outline-none transition focus:border-[#1A56DB] focus:bg-white"
      />
    </div>
  )
}
