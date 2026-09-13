import { useEffect, useRef, useState } from "react"
import AvatarIniciais from "../../componentes/AvatarIniciais"
import {
  IconeConfirmar,
  IconeEditar,
  IconeLixeira,
  IconeMais,
} from "../../componentes/icones/Icones"
import { MESES_ABREVIADOS } from "../../dominio/constantes"
import type { Cartao, PerfilAcesso } from "../../dominio/modelos"
import { obterPeriodoDoCicloFinanceiro } from "../../dominio/regras-temporais"

interface PropriedadesTelaPerfil {
  nomeUsuario: string
  loginUsuario: string
  perfilAcesso: PerfilAcesso
  quantidadeDespesas: number
  quantidadeMetas: number
  quantidadeNotas: number
  diaFechamento: number
  cartoes: Cartao[]
  aoAlterarNome: (nome: string) => void
  aoAlterarDiaFechamento: (dia: number) => void
  aoAdicionarCartao: (nome: string) => void
  aoRenomearCartao: (cartaoId: number, novoNome: string) => void
  aoRemoverCartao: (cartaoId: number) => void
  aoSair: () => void
}

export default function TelaPerfil({
  nomeUsuario,
  loginUsuario,
  perfilAcesso,
  quantidadeDespesas,
  quantidadeMetas,
  quantidadeNotas,
  diaFechamento,
  cartoes,
  aoAlterarNome,
  aoAlterarDiaFechamento,
  aoAdicionarCartao,
  aoRenomearCartao,
  aoRemoverCartao,
  aoSair,
}: PropriedadesTelaPerfil) {
  const [editandoNome, definirEditandoNome] = useState(false)
  const [nomeTemporario, definirNomeTemporario] = useState(nomeUsuario)
  const [editandoCiclo, definirEditandoCiclo] = useState(false)
  const [diaTemporario, definirDiaTemporario] = useState(diaFechamento)
  const [adicionandoCartao, definirAdicionandoCartao] = useState(false)
  const [novoCartao, definirNovoCartao] = useState("")
  const [cartaoEmEdicao, definirCartaoEmEdicao] = useState<number | null>(null)
  const [nomeCartaoTemporario, definirNomeCartaoTemporario] = useState("")
  const [administracaoAberta, definirAdministracaoAberta] = useState(false)
  const temporizadorAdministracao = useRef<ReturnType<typeof setTimeout> | null>(null)
  const periodoDoCiclo = obterPeriodoDoCicloFinanceiro(diaFechamento)

  useEffect(() => {
    function receberMensagem(evento: MessageEvent) {
      if (
        evento.origin === window.location.origin &&
        evento.data === "gestao-life:fechar-administracao"
      ) {
        definirAdministracaoAberta(false)
      }
    }
    window.addEventListener("message", receberMensagem)
    return () => {
      window.removeEventListener("message", receberMensagem)
      if (temporizadorAdministracao.current) {
        clearTimeout(temporizadorAdministracao.current)
      }
    }
  }, [])

  function iniciarPressionamentoAdministrativo() {
    if (perfilAcesso !== "administrador") return
    temporizadorAdministracao.current = setTimeout(
      () => definirAdministracaoAberta(true),
      3_000,
    )
  }

  function cancelarPressionamentoAdministrativo() {
    if (temporizadorAdministracao.current) {
      clearTimeout(temporizadorAdministracao.current)
      temporizadorAdministracao.current = null
    }
  }

  function formatarDataDoCiclo(data: Date) {
    return `${data.getDate()} de ${MESES_ABREVIADOS[data.getMonth()]}`
  }

  function confirmarNome() {
    aoAlterarNome(nomeTemporario.trim() || nomeUsuario)
    definirEditandoNome(false)
  }

  function iniciarEdicaoDoNome() {
    definirNomeTemporario(nomeUsuario)
    definirEditandoNome(true)
  }

  function confirmarDiaDeFechamento() {
    aoAlterarDiaFechamento(diaTemporario)
    definirEditandoCiclo(false)
  }

  function adicionarCartao() {
    const nome = novoCartao.trim()
    if (!nome) {
      definirNovoCartao("")
      definirAdicionandoCartao(false)
      return
    }
    aoAdicionarCartao(nome)
    definirNovoCartao("")
    definirAdicionandoCartao(false)
  }

  function salvarNomeDoCartao() {
    if (cartaoEmEdicao == null) return
    const novoNome = nomeCartaoTemporario.trim()
    if (novoNome) aoRenomearCartao(cartaoEmEdicao, novoNome)
    definirCartaoEmEdicao(null)
    definirNomeCartaoTemporario("")
  }

  return (
    <div className="flex-1 pt-14 pb-28 overflow-y-auto bg-[#EEF2F9]">
      <div className="px-5 pt-4 pb-5">
        <div className="bg-[#1A56DB] rounded-3xl p-5 shadow-sm flex items-center gap-4 relative overflow-hidden">
          {perfilAcesso === "administrador" ? (
            <button
              type="button"
              className="absolute -right-8 -top-8 h-32 w-32 touch-none rounded-full bg-white/10"
              aria-label="Abrir gerenciamento de usuários mantendo pressionado"
              onPointerDown={iniciarPressionamentoAdministrativo}
              onPointerUp={cancelarPressionamentoAdministrativo}
              onPointerCancel={cancelarPressionamentoAdministrativo}
              onPointerLeave={cancelarPressionamentoAdministrativo}
              onContextMenu={(evento) => evento.preventDefault()}
            />
          ) : (
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          )}
          <AvatarIniciais
            nome={nomeUsuario}
            tamanho={64}
            cor="white"
            corTexto="#1A56DB"
          />
          <div className="flex-1 min-w-0">
            {editandoNome ? (
              <div
                className="flex items-center gap-2"
                onBlur={(evento) => {
                  if (
                    !evento.currentTarget.contains(
                      evento.relatedTarget as Node | null,
                    )
                  )
                    confirmarNome()
                }}
              >
                <input
                  type="text"
                  value={nomeTemporario}
                  onChange={(evento) =>
                    definirNomeTemporario(evento.target.value)
                  }
                  onKeyDown={(evento) => {
                    if (evento.key === "Enter") confirmarNome()
                    if (evento.key === "Escape") definirEditandoNome(false)
                  }}
                  autoFocus
                  className="flex-1 text-lg font-bold text-white outline-none border-b-2 border-white/60 bg-transparent placeholder-white/50"
                />
                <button
                  onClick={confirmarNome}
                  className="text-white p-1"
                  aria-label="Confirmar nome"
                >
                  <IconeConfirmar />
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-white truncate">
                    {nomeUsuario}
                  </p>
                  <button
                    onClick={iniciarEdicaoDoNome}
                    className="text-white/60 hover:text-white transition-colors shrink-0"
                    aria-label="Editar nome"
                  >
                    <IconeEditar />
                  </button>
                </div>
                <p className="mt-0.5 text-xs font-medium text-blue-100">
                  @{loginUsuario}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 mt-3">
          <ResumoPerfil valor={quantidadeDespesas} rotulo="despesas" />
          <ResumoPerfil valor={quantidadeMetas} rotulo="metas" />
          <ResumoPerfil valor={quantidadeNotas} rotulo="notas" />
        </div>
      </div>

      <div className="px-5 pb-6 pt-0 space-y-3">
        <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest px-1">
          Configurações
        </p>

        <div className="bg-white/80 border border-white/60 rounded-2xl overflow-hidden shadow-sm backdrop-blur-sm">
          <button
            onClick={() => {
              definirEditandoCiclo((valorAtual) => !valorAtual)
              definirDiaTemporario(diaFechamento)
            }}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">
                Ciclo financeiro
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Dia de fechamento ou recebimento
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-11 h-11 rounded-xl bg-[#1A56DB] flex items-center justify-center text-white font-bold text-lg">
                {diaFechamento}
              </div>
              <span className="text-gray-500 text-xs">
                {editandoCiclo ? "▲" : "▼"}
              </span>
            </div>
          </button>

          {editandoCiclo ? (
            <div className="border-t border-gray-100 p-4">
              <p className="text-xs text-gray-600 font-medium mb-3">
                Escolha o dia de fechamento
              </p>
              <div className="grid grid-cols-7 gap-1.5 mb-4">
                {Array.from({ length: 31 }, (_, indice) => indice + 1).map(
                  (dia) => (
                    <button
                      key={dia}
                      onClick={() => definirDiaTemporario(dia)}
                      className={`h-9 rounded-xl text-sm font-semibold transition-all ${
                        diaTemporario === dia
                          ? "bg-black text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {dia}
                    </button>
                  ),
                )}
              </div>
              <button
                onClick={confirmarDiaDeFechamento}
                className="w-full py-3 bg-[#1A56DB] text-white text-sm font-bold rounded-xl"
              >
                Confirmar dia {diaTemporario}
              </button>
            </div>
          ) : (
            <div className="border-t border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-600">
                Seu ciclo vai de{" "}
                <strong className="text-gray-700">
                  {formatarDataDoCiclo(periodoDoCiclo.inicio)}
                </strong>{" "}
                até{" "}
                <strong className="text-gray-700">
                  {formatarDataDoCiclo(periodoDoCiclo.fim)}
                </strong>
                . Restam{" "}
                <strong className="text-gray-700">
                  {periodoDoCiclo.diasRestantes}{" "}
                  {periodoDoCiclo.diasRestantes === 1 ? "dia" : "dias"}
                </strong>{" "}
                para o fechamento.
              </p>
            </div>
          )}
        </div>

        <div className="bg-white/80 border border-white/60 rounded-2xl overflow-hidden shadow-sm backdrop-blur-sm">
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Meus cartões
              </p>
            </div>
            <button
              onClick={() => {
                if (adicionandoCartao) {
                  definirNovoCartao("")
                  definirAdicionandoCartao(false)
                  return
                }
                definirAdicionandoCartao(true)
              }}
              className="w-8 h-8 rounded-full bg-[#1A56DB] flex items-center justify-center text-white hover:bg-[#1D4ED8] transition-colors"
              aria-label="Adicionar cartão"
            >
              <IconeMais cor="white" />
            </button>
          </div>

          {adicionandoCartao && (
            <div
              className="border-t border-gray-100 p-4 flex gap-2"
              onBlur={(evento) => {
                if (
                  !evento.currentTarget.contains(
                    evento.relatedTarget as Node | null,
                  )
                )
                  adicionarCartao()
              }}
            >
              <input
                type="text"
                placeholder="Ex: Cartão principal"
                value={novoCartao}
                onChange={(evento) => definirNovoCartao(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === "Enter") adicionarCartao()
                  if (evento.key === "Escape") {
                    definirNovoCartao("")
                    definirAdicionandoCartao(false)
                  }
                }}
                autoFocus
                className="flex-1 px-3 py-2.5 bg-gray-100 rounded-xl text-sm outline-none placeholder-gray-400"
              />
              <button
                onClick={adicionarCartao}
                disabled={!novoCartao.trim()}
                className="px-3 py-2.5 bg-[#1A56DB] text-white rounded-xl text-sm font-semibold disabled:opacity-30"
                aria-label="Confirmar cartão"
              >
                <IconeConfirmar />
              </button>
            </div>
          )}

          {cartoes.length === 0 ? (
            <div className="border-t border-gray-100 px-4 py-6 text-center">
              <p className="text-sm text-gray-600">Nenhum cartão cadastrado.</p>
            </div>
          ) : (
            <div className="border-t border-gray-100">
              {cartoes.map((cartao) => (
                <div
                  key={cartao.id}
                  className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 last:border-0"
                >
                  <span className="text-lg">💳</span>
                  {cartaoEmEdicao === cartao.id ? (
                    <div
                      className="flex flex-1 items-center gap-2 min-w-0"
                      onBlur={(evento) => {
                        if (
                          !evento.currentTarget.contains(
                            evento.relatedTarget as Node | null,
                          )
                        )
                          salvarNomeDoCartao()
                      }}
                    >
                      <input
                        type="text"
                        value={nomeCartaoTemporario}
                        onChange={(evento) =>
                          definirNomeCartaoTemporario(evento.target.value)
                        }
                        onKeyDown={(evento) => {
                          if (evento.key === "Enter") salvarNomeDoCartao()
                          if (evento.key === "Escape")
                            definirCartaoEmEdicao(null)
                        }}
                        autoFocus
                        className="min-w-0 flex-1 rounded-xl bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 outline-none ring-[#1A56DB]/30 focus:ring-2"
                        aria-label={`Novo nome de ${cartao.nome}`}
                      />
                      <button
                        type="button"
                        onClick={salvarNomeDoCartao}
                        className="rounded-xl bg-[#1A56DB] p-2.5 text-white"
                        aria-label="Salvar nome do cartão"
                      >
                        <IconeConfirmar />
                      </button>
                    </div>
                  ) : (
                    <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                      {cartao.nome}
                    </span>
                  )}
                  {cartaoEmEdicao !== cartao.id && (
                    <button
                      type="button"
                      onClick={() => {
                        definirCartaoEmEdicao(cartao.id)
                        definirNomeCartaoTemporario(cartao.nome)
                      }}
                      aria-label={`Editar nome do cartão ${cartao.nome}`}
                      className="text-gray-500 hover:text-[#1A56DB] transition-colors p-2.5 rounded-xl hover:bg-blue-50"
                    >
                      <IconeEditar />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Excluir o cartão "${cartao.nome}"? As despesas históricas serão mantidas, mas ele deixará de estar disponível em novos lançamentos.`,
                        )
                      )
                        aoRemoverCartao(cartao.id)
                    }}
                    aria-label={`Remover cartão ${cartao.nome}`}
                    className="text-gray-500 hover:text-red-500 transition-colors p-2.5 rounded-xl hover:bg-red-50"
                  >
                    <IconeLixeira />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "Sair da conta? Você precisará entrar novamente para acessar seus dados.",
              )
            )
              aoSair()
          }}
          className="w-full rounded-2xl border border-red-100 bg-white/80 px-4 py-3.5 text-sm font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50"
        >
          Sair da conta
        </button>
      </div>

      {administracaoAberta && (
        <div className="fixed inset-0 z-[100] bg-[#EEF2F9]">
          <iframe
            title="Gerenciamento de usuários"
            src="/api/administracao/index.html"
            className="h-full w-full border-0"
          />
        </div>
      )}
    </div>
  )
}

function ResumoPerfil({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div className="bg-white/80 rounded-2xl p-3 text-center shadow-sm backdrop-blur-sm">
      <p className="text-xl font-bold text-gray-900">{valor}</p>
      <p className="text-[10px] text-gray-600 font-medium mt-0.5">{rotulo}</p>
    </div>
  )
}
