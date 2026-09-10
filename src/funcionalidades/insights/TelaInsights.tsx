import AvatarIniciais from "../../componentes/AvatarIniciais"
import GraficoColunas from "../../componentes/graficos/GraficoColunas"
import { IconeDireita, IconeEsquerda } from "../../componentes/icones/Icones"
import {
  DIAS_SEMANA_ABREVIADOS,
  HOJE,
  MESES_ABREVIADOS,
  MESES_POR_EXTENSO,
} from "../../dominio/constantes"
import type { Meta, StatusPeriodo } from "../../dominio/modelos"
import {
  calcularEconomiaEstimada,
  calcularOcorrenciasEvitadas,
  formatarMoeda,
} from "../../dominio/regras-financeiras"
import {
  ehSemanaAtual,
  formatarDataIso,
  formatarPeriodoDaSemana,
  obterPeriodoDoCicloFinanceiro,
} from "../../dominio/regras-temporais"

interface PropriedadesTelaInsights {
  nomeUsuario: string
  mes: Date
  statusPeriodo: StatusPeriodo
  diaFechamento: number
  gastosDoMes: number
  projecaoDoMes: number
  previsaoAteHoje: number
  diferencaPrevisao: number | null
  semana: Date
  diasDaSemana: Date[]
  valoresDaSemana: number[]
  indiceBarraSelecionada: number | null
  metas: Meta[]
  aoAbrirPerfil: () => void
  aoNavegarMes: (direcao: number) => void
  aoIrParaMesAtual: () => void
  aoAbrirProjecao: () => void
  aoAbrirComparativo: () => void
  aoNavegarSemana: (direcao: number) => void
  aoIrParaSemanaAtual: () => void
  aoSelecionarBarra: (indice: number) => void
}

const COR_AVATAR = "#1A56DB"

export default function TelaInsights({
  nomeUsuario,
  mes,
  statusPeriodo,
  diaFechamento,
  gastosDoMes,
  projecaoDoMes,
  previsaoAteHoje,
  diferencaPrevisao,
  semana,
  diasDaSemana,
  valoresDaSemana,
  indiceBarraSelecionada,
  metas,
  aoAbrirPerfil,
  aoNavegarMes,
  aoIrParaMesAtual,
  aoAbrirProjecao,
  aoAbrirComparativo,
  aoNavegarSemana,
  aoIrParaSemanaAtual,
  aoSelecionarBarra,
}: PropriedadesTelaInsights) {
  const metasComImpacto = metas.filter(
    (meta) => meta.valorMedio && meta.frequenciaMensal,
  )
  const periodoDoCiclo = obterPeriodoDoCicloFinanceiro(diaFechamento, HOJE)
  const inicioDoCiclo = `${periodoDoCiclo.inicio.getDate()} de ${
    MESES_ABREVIADOS[periodoDoCiclo.inicio.getMonth()]
  }`

  return (
    <div className="flex-1 overflow-y-auto pb-28 bg-[#EEF2F9]">
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[22px] font-semibold tracking-tight text-gray-950">
            Insights
          </h1>
          <AvatarIniciais
            nome={nomeUsuario}
            tamanho={36}
            cor={COR_AVATAR}
            aoClicar={aoAbrirPerfil}
          />
        </div>

        <div className="flex items-center gap-1 mb-3">
          <button
            onClick={() => aoNavegarMes(-1)}
            aria-label="Mês anterior"
            className="p-2.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <IconeEsquerda />
          </button>
          <button
            onClick={() => aoNavegarMes(1)}
            aria-label="Próximo mês"
            className="p-2.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <IconeDireita />
          </button>
          <span className="text-sm font-semibold text-gray-700 ml-1">
            {MESES_POR_EXTENSO[mes.getMonth()]} {mes.getFullYear()}
          </span>
          {statusPeriodo !== "atual" && (
            <button
              onClick={aoIrParaMesAtual}
              className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Mês atual
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-white/80 border border-white/60 rounded-2xl p-4 shadow-sm backdrop-blur-sm">
            <p className="text-[11px] text-gray-600 font-medium mb-2">
              {statusPeriodo === "atual"
                ? `Gasto de ${inicioDoCiclo} até hoje`
                : statusPeriodo === "passado"
                  ? `Total em ${MESES_ABREVIADOS[mes.getMonth()]}`
                  : `Previsto para ${MESES_ABREVIADOS[mes.getMonth()]}`}
            </p>
            <p className="text-2xl font-extrabold text-gray-900 leading-none">
              {formatarMoeda(gastosDoMes)}
            </p>
            {statusPeriodo === "atual" && (
              <p className="text-[11px] text-emerald-700 mt-2 font-medium">
                ↑ {periodoDoCiclo.diasDecorridos}{" "}
                {periodoDoCiclo.diasDecorridos === 1
                  ? "dia registrado"
                  : "dias registrados"}
              </p>
            )}
            {statusPeriodo === "passado" && (
              <p className="text-[11px] text-gray-600 mt-2 font-medium">
                Período encerrado
              </p>
            )}
          </div>

          <button
            onClick={aoAbrirProjecao}
            className="bg-white/80 border border-white/60 rounded-2xl p-4 text-left shadow-sm hover:bg-white/90 transition-colors backdrop-blur-sm"
          >
            <p className="text-[11px] text-gray-600 font-medium mb-2">
              {statusPeriodo === "atual"
                ? `Projeção até dia ${diaFechamento}`
                : statusPeriodo === "passado"
                  ? "Fechamento"
                  : "Estimativa"}
            </p>
            <p className="text-2xl font-extrabold text-gray-900 leading-none">
              {formatarMoeda(projecaoDoMes)}
            </p>
            {statusPeriodo === "atual" && (
              <p className="text-[11px] text-orange-600 mt-2 font-medium">
                ↑ {periodoDoCiclo.diasRestantes}{" "}
                {periodoDoCiclo.diasRestantes === 1 ? "dia" : "dias"} ·{" "}
                detalhes →
              </p>
            )}
            {statusPeriodo === "passado" && (
              <p className="text-[11px] text-gray-600 mt-2 font-medium">
                Ver detalhes →
              </p>
            )}
          </button>
        </div>

        {diferencaPrevisao !== null && (
          <button
            onClick={aoAbrirComparativo}
            className="w-full bg-white/80 border border-white/60 rounded-2xl p-4 mb-6 text-left shadow-sm hover:bg-white/90 transition-colors backdrop-blur-sm"
          >
            <p className="text-[11px] text-gray-600 font-medium mb-3">
              Comparativo da previsão de gastos
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <p className="text-[10px] text-gray-600 font-medium mb-0.5">
                  Previsão até hoje
                </p>
                <p className="text-base font-bold text-gray-900">
                  {formatarMoeda(previsaoAteHoje)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-600 font-medium mb-0.5">
                  Gasto real
                </p>
                <p className="text-base font-bold text-gray-900">
                  {formatarMoeda(gastosDoMes)}
                </p>
              </div>
            </div>
            <ResumoDiferenca valor={diferencaPrevisao} />
          </button>
        )}

        <div className="bg-white/80 border border-white/60 rounded-2xl p-4 mb-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-900">
              Gasto por dia da semana
            </p>
            {!ehSemanaAtual(semana) && (
              <button
                onClick={aoIrParaSemanaAtual}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500"
              >
                Semana atual
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => aoNavegarSemana(-1)}
              aria-label="Semana anterior"
              className="p-2.5 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
            >
              <IconeEsquerda />
            </button>
            <span className="text-xs text-gray-600 font-medium flex-1 text-center">
              {formatarPeriodoDaSemana(semana)}
            </span>
            <button
              onClick={() => aoNavegarSemana(1)}
              aria-label="Próxima semana"
              className="p-2.5 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
            >
              <IconeDireita />
            </button>
          </div>
          <GraficoColunas
            valores={valoresDaSemana}
            rotulos={DIAS_SEMANA_ABREVIADOS}
            indiceDestacado={indiceBarraSelecionada}
            aoClicar={aoSelecionarBarra}
          />
          {indiceBarraSelecionada !== null &&
            valoresDaSemana[indiceBarraSelecionada] > 0 && (
              <p className="text-xs text-gray-600 text-center mt-2 font-medium">
                {DIAS_SEMANA_ABREVIADOS[indiceBarraSelecionada]},{" "}
                {
                  formatarDataIso(diasDaSemana[indiceBarraSelecionada]).split(
                    "-",
                  )[2]
                }{" "}
                {
                  MESES_ABREVIADOS[
                    diasDaSemana[indiceBarraSelecionada].getMonth()
                  ]
                }{" "}
                · {formatarMoeda(valoresDaSemana[indiceBarraSelecionada])}
              </p>
            )}
        </div>

        {metasComImpacto.length > 0 && (
          <ImpactoDasMetas metas={metasComImpacto} />
        )}
      </div>
    </div>
  )
}

function ResumoDiferenca({ valor }: { valor: number }) {
  const estaAcima = valor > 0
  const estaAbaixo = valor < 0
  const corFundo = estaAcima
    ? "bg-red-50"
    : estaAbaixo
      ? "bg-emerald-50"
      : "bg-gray-50"
  const corTexto = estaAcima
    ? "text-red-700"
    : estaAbaixo
      ? "text-emerald-700"
      : "text-gray-700"

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${corFundo}`}>
      <span className={`text-lg font-bold ${corTexto}`} aria-hidden="true">
        {estaAcima ? "↑" : estaAbaixo ? "↓" : "="}
      </span>
      <div className="flex-1">
        <p className={`text-sm font-bold ${corTexto}`}>
          {formatarMoeda(Math.abs(valor))}
        </p>
        <p className={`text-[11px] font-semibold ${corTexto}`}>
          {estaAcima
            ? "acima da previsão"
            : estaAbaixo
              ? "abaixo da previsão"
              : "dentro da previsão"}
        </p>
      </div>
      <span className="text-gray-500">
        <IconeDireita />
      </span>
    </div>
  )
}

function ImpactoDasMetas({ metas }: { metas: Meta[] }) {
  const economiaTotal = metas.reduce(
    (acumulado, meta) => acumulado + calcularEconomiaEstimada(meta),
    0,
  )

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mt-4">
      <div className="px-4 pt-4 pb-1">
        <h2 className="text-sm font-semibold text-gray-900">
          Impacto das metas
        </h2>
      </div>
      <div className="p-3 space-y-2">
        {metas.map((meta) => (
          <div key={`meta-${meta.id}`} className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {meta.nome}
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  {meta.despesaVinculadaNome} · {meta.frequenciaMensal}×/mês
                </p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-sm font-bold text-emerald-600">
                  ≈ {formatarMoeda(calcularEconomiaEstimada(meta))}
                </p>
                <p className="text-[10px] text-gray-600">
                  {calcularOcorrenciasEvitadas(meta)} evitadas
                </p>
              </div>
            </div>
          </div>
        ))}
        <div className="bg-emerald-50 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-emerald-700">
            Total economia estimada
          </p>
          <p className="text-base font-bold text-emerald-700">
            ≈ {formatarMoeda(economiaTotal)}
          </p>
        </div>
      </div>
    </div>
  )
}
