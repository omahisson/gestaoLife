import AvatarIniciais from "../../componentes/AvatarIniciais"
import {
  IlustracaoSemMetas,
  IlustracaoSemNotas,
} from "../../componentes/feedback/IlustracoesVazias"
import {
  IconeAlfinete,
  IconeEditar,
  IconeLixeira,
  IconeMais,
} from "../../componentes/icones/Icones"
import type { Meta, Nota, SegmentoVida } from "../../dominio/modelos"
import {
  calcularEconomiaEstimada,
  calcularOcorrenciasEvitadas,
  formatarMoeda,
} from "../../dominio/regras-financeiras"
import {
  calcularTempoDecorrido,
  formatarDataPorExtenso,
  formatarHora,
  formatarTempoDecorrido,
} from "../../dominio/regras-temporais"

interface PropriedadesTelaVida {
  nomeUsuario: string
  segmentoAtual: SegmentoVida
  metas: Meta[]
  notas: Nota[]
  aoAbrirPerfil: () => void
  aoSelecionarSegmento: (segmento: SegmentoVida) => void
  aoCriarMeta: () => void
  aoAbrirMeta: (meta: Meta) => void
  aoEditarMeta: (meta: Meta) => void
  aoExcluirMeta: (identificador: number) => void
  aoAbrirNota: (nota: Nota) => void
  aoAlternarFixacaoDaNota: (identificador: number) => void
}

interface PropriedadesCartaoNota {
  nota: Nota
  compacto?: boolean
  aoAbrir: (nota: Nota) => void
  aoAlternarFixacao: (identificador: number) => void
}

const COR_AVATAR = "#1A56DB"

export default function TelaVida({
  nomeUsuario,
  segmentoAtual,
  metas,
  notas,
  aoAbrirPerfil,
  aoSelecionarSegmento,
  aoCriarMeta,
  aoAbrirMeta,
  aoEditarMeta,
  aoExcluirMeta,
  aoAbrirNota,
  aoAlternarFixacaoDaNota,
}: PropriedadesTelaVida) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden pt-14 bg-[#EEF2F9]">
      <div className="flex-shrink-0 px-5 pt-4 pb-3 bg-[#EEF2F9]">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-[22px] font-semibold tracking-tight text-gray-950">
            Life
          </h1>
          <AvatarIniciais
            nome={nomeUsuario}
            tamanho={36}
            cor={COR_AVATAR}
            aoClicar={aoAbrirPerfil}
          />
        </div>
        <div className="flex items-center bg-gray-900/8 rounded-2xl p-1">
          <button
            onClick={() => aoSelecionarSegmento("metas")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              segmentoAtual === "metas"
                ? "bg-[#1A56DB] text-white shadow-sm"
                : "text-gray-500"
            }`}
          >
            Metas
          </button>
          <button
            onClick={() => aoSelecionarSegmento("notas")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              segmentoAtual === "notas"
                ? "bg-[#1A56DB] text-white shadow-sm"
                : "text-gray-500"
            }`}
          >
            Notas
          </button>
        </div>
      </div>

      {segmentoAtual === "metas" ? (
        <ListaDeMetas
          metas={metas}
          aoCriar={aoCriarMeta}
          aoAbrir={aoAbrirMeta}
          aoEditar={aoEditarMeta}
          aoExcluir={aoExcluirMeta}
        />
      ) : (
        <ListaDeNotas
          notas={notas}
          aoAbrir={aoAbrirNota}
          aoAlternarFixacao={aoAlternarFixacaoDaNota}
        />
      )}
    </div>
  )
}

function ListaDeMetas({
  metas,
  aoCriar,
  aoAbrir,
  aoEditar,
  aoExcluir,
}: {
  metas: Meta[]
  aoCriar: () => void
  aoAbrir: (meta: Meta) => void
  aoEditar: (meta: Meta) => void
  aoExcluir: (identificador: number) => void
}) {
  const possuiImpactoFinanceiro = metas.some(
    (meta) => meta.valorMedio && meta.frequenciaMensal,
  )
  const economiaTotal = metas.reduce(
    (acumulado, meta) => acumulado + calcularEconomiaEstimada(meta),
    0,
  )

  return (
    <div className="flex-1 px-5 pb-28 overflow-y-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-950">Metas</h2>
        <button
          onClick={aoCriar}
          className="flex items-center gap-1.5 bg-black text-white text-sm font-semibold px-3.5 py-2 rounded-full hover:bg-gray-800 transition-colors"
        >
          <IconeMais cor="white" /> Nova meta
        </button>
      </div>

      {possuiImpactoFinanceiro && (
        <div className="bg-[#1A56DB] rounded-2xl p-5 mb-4 text-white">
          <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-1">
            Economia estimada total
          </p>
          <p className="text-3xl font-bold tracking-tight">
            ≈ {formatarMoeda(economiaTotal)}
          </p>
          <p className="text-xs text-blue-200 mt-2">
            baseado nas metas ativas com impacto financeiro
          </p>
        </div>
      )}

      {metas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <span className="illus-enter">
            <IlustracaoSemMetas />
          </span>
          <p className="text-sm font-semibold text-gray-700 mt-3 mb-1 illus-enter-text">
            Nenhuma meta ainda
          </p>
          <p className="text-xs text-gray-600 illus-enter-text">
            Crie sua primeira meta para acompanhar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {metas.map((meta) => {
            const tempoDecorrido = calcularTempoDecorrido(meta.dataInicio)
            const economia = calcularEconomiaEstimada(meta)

            return (
              <div
                key={`meta-${meta.id}`}
                className="bg-white/80 border border-white/60 rounded-2xl p-4 shadow-sm backdrop-blur-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <button
                    onClick={() => aoAbrir(meta)}
                    className="text-left flex-1 min-w-0"
                  >
                    <p className="text-sm font-semibold text-gray-900">
                      {meta.nome}
                    </p>
                    {meta.despesaVinculadaNome && (
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        vinculada a · {meta.despesaVinculadaNome}
                      </p>
                    )}
                  </button>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      onClick={() => aoEditar(meta)}
                      aria-label="Editar meta"
                      className="p-2.5 text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <IconeEditar />
                    </button>
                    <button
                      onClick={() => aoExcluir(meta.id)}
                      aria-label="Excluir meta"
                      className="p-2.5 text-gray-500 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors"
                    >
                      <IconeLixeira />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => aoAbrir(meta)}
                  className="w-full text-left"
                >
                  <p className="text-2xl font-bold text-gray-950 tracking-tight">
                    {formatarTempoDecorrido(tempoDecorrido)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Desde {formatarDataPorExtenso(meta.dataInicio)} às{" "}
                    {formatarHora(meta.dataInicio)}
                  </p>
                </button>
                {economia > 0 && (
                  <div className="mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                    <span className="text-xs font-semibold text-emerald-700">
                      ≈ {formatarMoeda(economia)} economizados
                    </span>
                    <span className="text-[10px] text-emerald-700 ml-auto">
                      {calcularOcorrenciasEvitadas(meta)}x evitado
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ListaDeNotas({
  notas,
  aoAbrir,
  aoAlternarFixacao,
}: {
  notas: Nota[]
  aoAbrir: (nota: Nota) => void
  aoAlternarFixacao: (identificador: number) => void
}) {
  const notasAtivas = notas
    .filter((nota) => !nota.arquivada)
    .filter(
      (nota, indice, lista) =>
        lista.findIndex((item) => item.id === nota.id) === indice,
    )
  const notasFixadas = notasAtivas.filter((nota) => nota.fixada)
  const notasNaoFixadas = notasAtivas.filter((nota) => !nota.fixada)

  if (notasFixadas.length === 0 && notasNaoFixadas.length === 0) {
    return (
      <div className="flex-1 px-5 pb-28 overflow-y-auto">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <span className="illus-enter">
            <IlustracaoSemNotas />
          </span>
          <p className="text-sm font-semibold text-gray-700 mt-3 mb-1 illus-enter-text">
            Nenhuma nota ainda
          </p>
          <p className="text-xs text-gray-600 illus-enter-text">
            Toque no lápis para criar sua primeira nota.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 px-5 pb-28 overflow-y-auto">
      <div className="space-y-5">
        {notasFixadas.length > 0 && (
          <div>
            <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-3">
              Fixadas
            </p>
            <div className="space-y-2">
              {notasFixadas.map((nota) => (
                <CartaoNota
                  key={`nota-${nota.id}`}
                  nota={nota}
                  aoAbrir={aoAbrir}
                  aoAlternarFixacao={aoAlternarFixacao}
                />
              ))}
            </div>
          </div>
        )}
        {notasNaoFixadas.length > 0 && (
          <div>
            {notasFixadas.length > 0 && (
              <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-3">
                Todas as notas
              </p>
            )}
            <div className="space-y-2">
              {notasNaoFixadas.map((nota) => (
                <CartaoNota
                  key={`nota-${nota.id}`}
                  nota={nota}
                  compacto
                  aoAbrir={aoAbrir}
                  aoAlternarFixacao={aoAlternarFixacao}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CartaoNota({
  nota,
  compacto,
  aoAbrir,
  aoAlternarFixacao,
}: PropriedadesCartaoNota) {
  const tarefas = nota.blocos.filter((bloco) => bloco.tipo === "checkbox")
  const quantidadeTotal = tarefas.length
  const quantidadeConcluida = tarefas.filter((bloco) => bloco.concluida).length
  const percentual =
    quantidadeTotal > 0
      ? Math.round((quantidadeConcluida / quantidadeTotal) * 100)
      : 0
  const resumo =
    nota.blocos.find((bloco) => bloco.tipo === "texto" && bloco.texto.trim())
      ?.texto ?? ""

  return (
    <div className="relative bg-white/80 border border-white/60 rounded-2xl shadow-sm backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => aoAbrir(nota)}
        className="w-full text-left p-4 pr-12 hover:bg-white/60 transition-colors active:scale-[0.99]"
      >
        <p className="text-sm font-semibold text-gray-900 mb-1 pr-2">
          {nota.titulo}
        </p>
        {!compacto && resumo && (
          <p className="text-xs text-gray-600 line-clamp-2 mb-2">{resumo}</p>
        )}
        {quantidadeTotal > 0 && (
          <div className="mt-2">
            <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full bg-[#1A56DB] rounded-full transition-all"
                style={{ width: `${percentual}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-600">
              {quantidadeConcluida} de {quantidadeTotal} tarefas concluídas ·{" "}
              {percentual}%
            </p>
          </div>
        )}
      </button>
      <button
        onClick={(evento) => {
          evento.stopPropagation()
          aoAlternarFixacao(nota.id)
        }}
        className={`absolute top-3 right-3 p-1.5 rounded-xl transition-colors ${
          nota.fixada
            ? "text-[#1A56DB] bg-[#EFF6FF]"
            : "text-gray-500 hover:text-gray-500 hover:bg-gray-100"
        }`}
        aria-label={nota.fixada ? "Desafixar nota" : "Fixar nota"}
      >
        <IconeAlfinete ativo={nota.fixada} />
      </button>
    </div>
  )
}
