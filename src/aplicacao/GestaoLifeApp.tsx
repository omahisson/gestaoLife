import { useEffect, useMemo, useRef, useState, type RefObject } from "react"

import useAtualizacaoPeriodica from "../compartilhado/ganchos/useAtualizacaoPeriodica"
import useDadosDoUsuario from "../compartilhado/ganchos/useDadosDoUsuario"
import useGeradorDeIdentificador from "../compartilhado/ganchos/useGeradorDeIdentificador"
import IconePagamento from "../componentes/IconePagamento"
import BarraSegmentada, {
  COR_RESTANTE,
  COR_UTILIZADA,
} from "../componentes/graficos/BarraSegmentada"
import {
  IconeAlfinete,
  IconeConfirmar,
  IconeEditar,
  IconeEsquerda,
  IconeFechar,
  IconeLapis,
  IconeLixeira,
  IconeMeta,
  IconeRelogio,
} from "../componentes/icones/Icones"
import NavegacaoPrincipal from "../componentes/layout/NavegacaoPrincipal"
import {
  DIAS_SEMANA_ABREVIADOS,
  HOJE,
  MESES_POR_EXTENSO,
  ROTULOS_PAGAMENTO,
  ROTULOS_RECORRENCIA,
} from "../dominio/constantes"
import type {
  AbaPrincipal,
  BlocoNota,
  Despesa,
  DespesaPrevista,
  Meta,
  Nota,
  SegmentoVida,
  TipoPagamento,
  TipoRecorrencia,
  UsuarioAutenticado,
  VisaoCalendario,
} from "../dominio/modelos"
import {
  calcularEconomiaEstimada,
  calcularOcorrenciasEvitadas,
  calcularProjecao,
  formatarMoeda,
} from "../dominio/regras-financeiras"
import {
  calcularTempoDecorrido,
  formatarDataIso,
  formatarDataPorExtenso,
  formatarHora,
  formatarMesIso,
  obterDataEHoraAtuais,
  obterInicioDaSemana,
  obterPeriodoDoCicloFinanceiro,
  obterStatusDoMes,
} from "../dominio/regras-temporais"
import PainelTarefas from "../funcionalidades/notas/PainelTarefas"
import { agruparBlocosDeNota } from "../funcionalidades/notas/regras-de-notas"
import TelaInicio from "../funcionalidades/inicio/TelaInicio"
import TelaInsights from "../funcionalidades/insights/TelaInsights"
import TelaPerfil from "../funcionalidades/perfil/TelaPerfil"
import TelaVida from "../funcionalidades/vida/TelaVida"

interface PropriedadesGestaoLifeApp {
  usuario: UsuarioAutenticado
  aoSair: () => void
}

function normalizarNome(nome: string) {
  return nome.trim().toLocaleLowerCase("pt-BR")
}

function despesaPertenceAoPadrao(despesa: Despesa, padrao: DespesaPrevista) {
  return (
    despesa.padraoId === padrao.id ||
    (despesa.padraoId == null &&
      normalizarNome(despesa.nome) === normalizarNome(padrao.nome))
  )
}

function useCampoVisivelAoAbrir(
  aberto: boolean,
  campoRef: RefObject<HTMLInputElement | null>,
) {
  useEffect(() => {
    const campo = aberto ? campoRef.current : null
    if (!campo) return

    const elementoRaiz = document.documentElement
    const viewport = window.visualViewport
    const atualizarAreaVisual = () => {
      elementoRaiz.style.setProperty(
        "--altura-area-visual",
        `${viewport?.height ?? window.innerHeight}px`,
      )
      elementoRaiz.style.setProperty(
        "--topo-area-visual",
        `${viewport?.offsetTop ?? 0}px`,
      )
    }

    atualizarAreaVisual()
    const quadroDoFoco = requestAnimationFrame(() => {
      campo.focus({ preventScroll: true })
      atualizarAreaVisual()
    })
    viewport?.addEventListener("resize", atualizarAreaVisual)
    viewport?.addEventListener("scroll", atualizarAreaVisual)
    window.addEventListener("resize", atualizarAreaVisual)

    return () => {
      cancelAnimationFrame(quadroDoFoco)
      viewport?.removeEventListener("resize", atualizarAreaVisual)
      viewport?.removeEventListener("scroll", atualizarAreaVisual)
      window.removeEventListener("resize", atualizarAreaVisual)
      elementoRaiz.style.removeProperty("--altura-area-visual")
      elementoRaiz.style.removeProperty("--topo-area-visual")
    }
  }, [aberto, campoRef])
}

function obterTotalPrevistoNoCiclo(
  padrao: DespesaPrevista,
  quantidadeDiasDoCiclo: number,
) {
  if (padrao.recorrencia === "diaria") return quantidadeDiasDoCiclo
  if (padrao.recorrencia === "semanal")
    return Math.ceil(quantidadeDiasDoCiclo / 7)
  if (padrao.recorrencia === "mensal") return 1
  if (padrao.recorrencia === "personalizada")
    return Math.max(padrao.ocorrenciasPorCiclo ?? padrao.restantes ?? 1, 1)
  return 0
}

// ── Componente principal ──────────────────────────────────────────────────
export default function GestaoLifeApp({
  usuario,
  aoSair,
}: PropriedadesGestaoLifeApp) {
  useAtualizacaoPeriodica(1_000)

  const {
    nomeUsuario,
    definirNomeUsuario,
    diaFechamento,
    definirDiaFechamento,
    cartoes,
    definirCartoes,
    despesas,
    definirDespesas,
    despesasPrevistas,
    definirDespesasPrevistas,
    notas,
    definirNotas,
    metas,
    definirMetas,
    dadosCarregados,
    erroDosDados,
    recarregarDados,
  } = useDadosDoUsuario(usuario.id, usuario.nome)
  const gerarProximoIdentificador = useGeradorDeIdentificador()

  const [aba, definirAba] = useState<AbaPrincipal>("inicio")
  const [visao, definirVisao] = useState<VisaoCalendario>("mensal")
  const [mesCalendario, definirMesCalendario] = useState(
    new Date(HOJE.getFullYear(), HOJE.getMonth(), 1),
  )
  const [diaSelecionado, definirDiaSelecionado] = useState<Date>(HOJE)

  // Seleção de intervalo (view mensal)
  const [inicioIntervalo, definirInicioIntervalo] = useState<Date | null>(null)
  const [fimIntervalo, definirFimIntervalo] = useState<Date | null>(null)

  // Detalhe / edição de despesa registrada
  const [despesaAberta, definirDespesaAberta] = useState<Despesa | null>(null)
  const [modoDetalhe, definirModoDetalhe] = useState<"ver" | "editar">("ver")
  const [valorEdicaoDespesa, definirValorEdicaoDespesa] = useState("")
  const [pagamentoEdicaoDespesa, definirPagamentoEdicaoDespesa] =
    useState<TipoPagamento>("pix")
  const [cartaoEdicaoDespesa, definirCartaoEdicaoDespesa] =
    useState<number | null>(null)
  const [recorrenciaEdicaoDespesa, definirRecorrenciaEdicaoDespesa] =
    useState<TipoRecorrencia>("avulsa")

  // Edição inline de template na tela de projeção
  const [identificadorPrevisaoEmEdicao, definirIdentificadorPrevisaoEmEdicao] =
    useState<number | null>(null)
  const [valorPrevisaoEmEdicao, definirValorPrevisaoEmEdicao] = useState("")
  const [nomePrevisaoEmEdicao, definirNomePrevisaoEmEdicao] = useState("")
  const [pagamentoPrevisaoEmEdicao, definirPagamentoPrevisaoEmEdicao] =
    useState<TipoPagamento>("pix")
  const [cartaoPrevisaoEmEdicao, definirCartaoPrevisaoEmEdicao] =
    useState<number | null>(null)
  const [recorrenciaPrevisaoEmEdicao, definirRecorrenciaPrevisaoEmEdicao] =
    useState<TipoRecorrencia>("mensal")
  const [
    ocorrenciasPersonalizadasPrevisao,
    definirOcorrenciasPersonalizadasPrevisao,
  ] = useState("1")

  // Insights — mês e semana são sincronizados
  const [mesInsights, definirMesInsights] = useState(
    new Date(HOJE.getFullYear(), HOJE.getMonth(), 1),
  )
  const [semanaInsights, definirSemanaInsights] = useState<Date>(HOJE)
  const [indiceBarraSelecionada, definirIndiceBarraSelecionada] =
    useState<number | null>(HOJE.getDay())
  const [projecaoAberta, definirProjecaoAberta] = useState(false)

  // Nova despesa
  const [modalDespesaAberto, definirModalDespesaAberto] = useState(false)
  const [nomeDespesa, definirNomeDespesa] = useState("")
  const [valorDespesa, definirValorDespesa] = useState("")
  const [dataDespesa, definirDataDespesa] = useState(formatarDataIso(HOJE))
  const [pagamento, definirPagamento] = useState<TipoPagamento>("pix")
  const [cartaoSelecionado, definirCartaoSelecionado] = useState<number | null>(
    null,
  )
  const [recorrencia, definirRecorrencia] = useState<TipoRecorrencia>("avulsa")
  const [ocorrenciasPersonalizadas, definirOcorrenciasPersonalizadas] =
    useState("1")
  const [sugestoes, definirSugestoes] = useState<string[]>([])
  const [padraoSelecionadoId, definirPadraoSelecionadoId] =
    useState<number | null>(null)
  const [erroNovaDespesa, definirErroNovaDespesa] = useState("")
  const campoNomeNovaDespesaRef = useRef<HTMLInputElement>(null)

  // Pizza toggle
  const [pizzaPorPagamento, definirPizzaPorPagamento] = useState(false)

  // Modal comparativo previsão vs realidade
  const [comparativoAberto, definirComparativoAberto] = useState(false)

  // ── Vida — segmento ────────────────────────────────────────────────────
  const [segmentoVida, definirSegmentoVida] = useState<SegmentoVida>("notas")

  // ── Notas ───────────────────────────────────────────────────────────────
  const [blocoEditandoData, definirBlocoEditandoData] = useState<number | null>(
    null,
  )
  const [notaAberta, definirNotaAberta] = useState<Nota | null>(null)
  const [modalNovaNotaAberta, definirModalNovaNotaAberta] = useState(false)
  // Formulário nova nota
  const [tituloNovaNota, definirTituloNovaNota] = useState("")
  const [blocosNovaNota, definirBlocosNovaNota] = useState<BlocoNota[]>([
    { id: 200, tipo: "texto", texto: "", concluida: false },
  ])
  const [dataNovaNota, definirDataNovaNota] = useState("")
  const [novaNotaFixada, definirNovaNotaFixada] = useState(false)

  // ── Metas ──────────────────────────────────────────────────────────────
  const [metaAberta, definirMetaAberta] = useState<Meta | null>(null)
  const [modalNovaMetaAberta, definirModalNovaMetaAberta] = useState(false)
  const [nomeNovaMeta, definirNomeNovaMeta] = useState("")
  const [dataNovaMeta, definirDataNovaMeta] = useState(
    obterDataEHoraAtuais().data,
  )
  const [horaNovaMeta, definirHoraNovaMeta] = useState(
    obterDataEHoraAtuais().hora,
  )

  // Edit meta modal
  const [modalEdicaoMetaAberta, definirModalEdicaoMetaAberta] = useState(false)
  const [metaParaEditar, definirMetaParaEditar] = useState<Meta | null>(null)
  const [nomeMetaEmEdicao, definirNomeMetaEmEdicao] = useState("")
  const [dataMetaEmEdicao, definirDataMetaEmEdicao] = useState("")
  const [horaMetaEmEdicao, definirHoraMetaEmEdicao] = useState("")
  const [impactoMetaEmEdicao, definirImpactoMetaEmEdicao] = useState(false)
  const [despesaMetaEmEdicao, definirDespesaMetaEmEdicao] = useState("")
  const [valorMetaEmEdicao, definirValorMetaEmEdicao] = useState("")
  const [frequenciaMetaEmEdicao, definirFrequenciaMetaEmEdicao] = useState("")

  // Create meta — impacto financeiro fields
  const [impactoNovaMeta, definirImpactoNovaMeta] = useState(false)
  const [despesaNovaMeta, definirDespesaNovaMeta] = useState("")
  const [valorNovaMeta, definirValorNovaMeta] = useState("")
  const [frequenciaNovaMeta, definirFrequenciaNovaMeta] = useState("")
  const campoNomeNovaMetaRef = useRef<HTMLInputElement>(null)
  const campoTituloNovaNotaRef = useRef<HTMLInputElement>(null)
  const selecaoAntesDoRelogioRef = useRef<{
    campoId: string
    inicio: number
    fim: number
  } | null>(null)

  // Quebra de meta dialog
  const [informacoesQuebraMeta, definirInformacoesQuebraMeta] = useState<{
    meta: Meta
  } | null>(null)

  useCampoVisivelAoAbrir(modalNovaMetaAberta, campoNomeNovaMetaRef)
  useCampoVisivelAoAbrir(modalNovaNotaAberta, campoTituloNovaNotaRef)
  useCampoVisivelAoAbrir(modalDespesaAberto, campoNomeNovaDespesaRef)

  // ── Dados derivados ────────────────────────────────────────────────────
  const periodoFinanceiroAtual = obterPeriodoDoCicloFinanceiro(
    diaFechamento,
    new Date(),
  )
  const inicioCicloIso = formatarDataIso(periodoFinanceiroAtual.inicio)
  const fimCicloIso = formatarDataIso(periodoFinanceiroAtual.fim)
  const quantidadeDiasDoCiclo =
    Math.floor(
      (periodoFinanceiroAtual.fim.getTime() -
        periodoFinanceiroAtual.inicio.getTime()) /
        86_400_000,
    ) + 1
  const despesasVisao = useMemo(() => {
    if (visao === "semanal")
      return despesas.filter((d) => d.data === formatarDataIso(diaSelecionado))
    if (inicioIntervalo) {
      const ini = formatarDataIso(inicioIntervalo)
      const fim = fimIntervalo ? formatarDataIso(fimIntervalo) : ini
      return despesas.filter((d) => d.data >= ini && d.data <= fim)
    }
    return despesas.filter((d) =>
      d.data.startsWith(formatarMesIso(mesCalendario)),
    )
  }, [
    despesas,
    visao,
    diaSelecionado,
    inicioIntervalo,
    fimIntervalo,
    mesCalendario,
  ])

  const totalVisao = useMemo(
    () => despesasVisao.reduce((a, d) => a + d.valor, 0),
    [despesasVisao],
  )

  const itensPizzaInicio = useMemo(() => {
    const mapa = new Map<string, number>()
    despesasVisao.forEach((d) => {
      const chave = pizzaPorPagamento
        ? (d.cartaoNome ?? ROTULOS_PAGAMENTO[d.pagamento])
        : d.nome
      mapa.set(chave, (mapa.get(chave) ?? 0) + d.valor)
    })
    return [...mapa.entries()].map(([nome, valor]) => ({ nome, valor }))
  }, [despesasVisao, pizzaPorPagamento])

  // Insights — mês
  const mesInsightsIso = formatarMesIso(mesInsights)
  const statusPeriodo = obterStatusDoMes(mesInsights)

  const gastosDoMesInsights = useMemo(
    () =>
      despesas
        .filter((d) => d.data.startsWith(mesInsightsIso))
        .reduce((a, d) => a + d.valor, 0),
    [despesas, mesInsightsIso],
  )
  const despesasDoCicloAtual = useMemo(
    () =>
      despesas.filter(
        (despesa) =>
          despesa.data >= inicioCicloIso && despesa.data <= fimCicloIso,
      ),
    [despesas, fimCicloIso, inicioCicloIso],
  )
  const despesasDoPeriodoInsights = useMemo(
    () =>
      statusPeriodo === "atual"
        ? despesasDoCicloAtual
        : despesas.filter((despesa) => despesa.data.startsWith(mesInsightsIso)),
    [despesas, despesasDoCicloAtual, mesInsightsIso, statusPeriodo],
  )
  const gastosDoPeriodoInsights = useMemo(
    () =>
      despesasDoPeriodoInsights.reduce((total, item) => total + item.valor, 0),
    [despesasDoPeriodoInsights],
  )

  // A projeção é sempre derivada do padrão do ciclo. Não persistimos um saldo
  // mutável, evitando que excluir uma despesa infle a quantidade planejada.
  const gruposProjecao = useMemo(() => {
    return despesasPrevistas
      .map((padrao) => {
        const usadas = despesasDoPeriodoInsights.filter((despesa) =>
          despesaPertenceAoPadrao(despesa, padrao),
        ).length
        const totalPrevisto = obterTotalPrevistoNoCiclo(
          padrao,
          quantidadeDiasDoCiclo,
        )
        const restantes = Math.max(totalPrevisto - usadas, 0)
        const ultimaDespesa = [...despesas]
          .filter((despesa) => despesaPertenceAoPadrao(despesa, padrao))
          .sort(
            (a, b) =>
              b.data.localeCompare(a.data) || Number(b.id) - Number(a.id),
          )[0]
        return {
          id: padrao.id,
          nome: padrao.nome,
          valor: padrao.valor,
          pagamento: padrao.pagamento ?? ultimaDespesa?.pagamento ?? "pix",
          cartaoId: padrao.cartaoId ?? ultimaDespesa?.cartaoId,
          cartaoNome: padrao.cartaoNome ?? ultimaDespesa?.cartaoNome,
          recorrencia: padrao.recorrencia,
          totalPrevisto,
          usadas,
          restantes,
          projecaoValor: padrao.valor * restantes,
        }
      })
      .sort((a, b) => b.projecaoValor - a.projecaoValor)
  }, [
    despesas,
    despesasDoPeriodoInsights,
    despesasPrevistas,
    quantidadeDiasDoCiclo,
  ])

  const projecaoDoMesInsights = useMemo(() => {
    if (statusPeriodo === "passado") return gastosDoPeriodoInsights
    return (
      gastosDoPeriodoInsights +
      gruposProjecao.reduce((total, grupo) => total + grupo.projecaoValor, 0)
    )
  }, [gastosDoPeriodoInsights, gruposProjecao, statusPeriodo])

  // Previsão proporcional até hoje (baseada nos padrões do ciclo).
  const previsaoAteHoje = useMemo(() => {
    if (statusPeriodo !== "atual") return 0
    const diasDecorridos = Math.min(
      periodoFinanceiroAtual.diasDecorridos,
      quantidadeDiasDoCiclo,
    )
    const previstoRecorrente = despesasPrevistas.reduce((total, padrao) => {
      const totalNoCiclo = obterTotalPrevistoNoCiclo(
        padrao,
        quantidadeDiasDoCiclo,
      )
      let ocorrenciasAteHoje = totalNoCiclo
      if (padrao.recorrencia === "diaria")
        ocorrenciasAteHoje = Math.min(totalNoCiclo, diasDecorridos)
      else if (padrao.recorrencia === "semanal")
        ocorrenciasAteHoje = Math.min(
          totalNoCiclo,
          Math.ceil(diasDecorridos / 7),
        )
      else if (padrao.recorrencia === "personalizada")
        ocorrenciasAteHoje = Math.min(
          totalNoCiclo,
          Math.ceil((totalNoCiclo * diasDecorridos) / quantidadeDiasDoCiclo),
        )
      return total + padrao.valor * ocorrenciasAteHoje
    }, 0)
    return previstoRecorrente
  }, [
    despesasPrevistas,
    periodoFinanceiroAtual.diasDecorridos,
    quantidadeDiasDoCiclo,
    statusPeriodo,
  ])

  // Comparativo previsão vs realidade por categoria
  const comparativoItens = useMemo(() => {
    if (statusPeriodo !== "atual") return []
    const diasDecorridos = Math.min(
      periodoFinanceiroAtual.diasDecorridos,
      quantidadeDiasDoCiclo,
    )
    const categorias = new Map<string, {
      nome: string
      previsto: number
      recorrencias: Set<TipoRecorrencia>
      padroes: DespesaPrevista[]
    }>()
    despesasPrevistas.forEach((padrao) => {
      const totalNoCiclo = obterTotalPrevistoNoCiclo(
        padrao,
        quantidadeDiasDoCiclo,
      )
      let ocorrenciasAteHoje = totalNoCiclo
      if (padrao.recorrencia === "diaria")
        ocorrenciasAteHoje = Math.min(totalNoCiclo, diasDecorridos)
      else if (padrao.recorrencia === "semanal")
        ocorrenciasAteHoje = Math.min(
          totalNoCiclo,
          Math.ceil(diasDecorridos / 7),
        )
      else if (padrao.recorrencia === "personalizada")
        ocorrenciasAteHoje = Math.min(
          totalNoCiclo,
          Math.ceil((totalNoCiclo * diasDecorridos) / quantidadeDiasDoCiclo),
        )
      const chave = normalizarNome(padrao.nome)
      const categoria = categorias.get(chave) ?? {
        nome: padrao.nome,
        previsto: 0,
        recorrencias: new Set<TipoRecorrencia>(),
        padroes: [],
      }
      categoria.previsto += padrao.valor * ocorrenciasAteHoje
      categoria.recorrencias.add(padrao.recorrencia)
      categoria.padroes.push(padrao)
      categorias.set(chave, categoria)
    })
    const itens = [...categorias.entries()]
      .map(([, categoria]) => {
        const real = despesasDoPeriodoInsights
          .filter((despesa) =>
            categoria.padroes.some((padrao) =>
              despesaPertenceAoPadrao(despesa, padrao),
            ),
          )
          .reduce((total, despesa) => total + despesa.valor, 0)
        const recorrencias = [...categoria.recorrencias]
        const diff = real - categoria.previsto
        return {
          nome: categoria.nome,
          rotuloRecorrencia:
            recorrencias.length === 1
              ? ROTULOS_RECORRENCIA[recorrencias[0]]
              : "Padrões combinados",
          previsto: categoria.previsto,
          real,
          diff,
        }
      })
      .filter((i) => i.previsto > 0 || i.real > 0)
    // Ordem: acima (diff > 0) primeiro, abaixo (diff < 0) segundo, zero terceiro
    return itens.sort((a, b) => {
      const grupoA = a.diff > 0 ? 0 : a.diff < 0 ? 1 : 2
      const grupoB = b.diff > 0 ? 0 : b.diff < 0 ? 1 : 2
      if (grupoA !== grupoB) return grupoA - grupoB
      if (grupoA === 0) return b.diff - a.diff // acima: maior primeiro
      if (grupoA === 1) return a.diff - b.diff // abaixo: mais negativo primeiro
      return 0
    })
  }, [
    despesasDoPeriodoInsights,
    despesasPrevistas,
    periodoFinanceiroAtual.diasDecorridos,
    quantidadeDiasDoCiclo,
    statusPeriodo,
  ])

  const gastoRealComparativo = useMemo(
    () => comparativoItens.reduce((total, item) => total + item.real, 0),
    [comparativoItens],
  )

  // Insights — semana
  const diasDaSemanaInsights: Date[] = useMemo(() => {
    const ini = obterInicioDaSemana(semanaInsights)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ini)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [semanaInsights])

  const valoresSemana = useMemo(
    () =>
      diasDaSemanaInsights.map((d) =>
        despesas
          .filter((x) => x.data === formatarDataIso(d))
          .reduce((a, x) => a + x.valor, 0),
      ),
    [despesas, diasDaSemanaInsights],
  )

  const valorProjecaoDaDespesa = useMemo(() => {
    const v = parseFloat(valorDespesa.replace(",", "."))
    if (isNaN(v) || v <= 0) return 0
    const occ =
      recorrencia === "personalizada"
        ? parseInt(ocorrenciasPersonalizadas) || 1
        : undefined
    return calcularProjecao(
      v,
      recorrencia,
      periodoFinanceiroAtual.diasRestantes,
      occ,
    )
  }, [
    valorDespesa,
    recorrencia,
    ocorrenciasPersonalizadas,
    periodoFinanceiroAtual.diasRestantes,
  ])

  // ── Operações do calendário ─────────────────────────────────────────────
  function navegarParaPeriodoAnterior() {
    if (visao === "mensal")
      definirMesCalendario(
        new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() - 1, 1),
      )
    else {
      const diaAnterior = new Date(diaSelecionado)
      diaAnterior.setDate(diaAnterior.getDate() - 7)
      definirDiaSelecionado(diaAnterior)
    }
  }

  function navegarParaProximoPeriodo() {
    if (visao === "mensal")
      definirMesCalendario(
        new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 1),
      )
    else {
      const proximoDia = new Date(diaSelecionado)
      proximoDia.setDate(proximoDia.getDate() + 7)
      definirDiaSelecionado(proximoDia)
    }
  }

  function selecionarDiaDoMes(dia: Date) {
    if (!inicioIntervalo || fimIntervalo) {
      definirInicioIntervalo(dia)
      definirFimIntervalo(null)
    } else if (formatarDataIso(dia) >= formatarDataIso(inicioIntervalo)) {
      definirFimIntervalo(dia)
    } else {
      definirInicioIntervalo(dia)
      definirFimIntervalo(null)
    }
    definirDiaSelecionado(dia)
  }

  function limparIntervalo() {
    definirInicioIntervalo(null)
    definirFimIntervalo(null)
    definirDiaSelecionado(HOJE)
  }

  // ── Navegação sincronizada de Insights ───────────────────────────────
  function navegarSemanaInsights(dir: number) {
    const nova = new Date(semanaInsights)
    nova.setDate(nova.getDate() + dir * 7)
    definirSemanaInsights(nova)
    definirIndiceBarraSelecionada(null)
    definirMesInsights(new Date(nova.getFullYear(), nova.getMonth(), 1))
  }
  function navegarMesInsights(dir: number) {
    const novo = new Date(
      mesInsights.getFullYear(),
      mesInsights.getMonth() + dir,
      1,
    )
    definirMesInsights(novo)
    definirSemanaInsights(novo)
    definirIndiceBarraSelecionada(null)
  }
  function irParaMesAtual() {
    definirMesInsights(new Date(HOJE.getFullYear(), HOJE.getMonth(), 1))
    definirSemanaInsights(HOJE)
    definirIndiceBarraSelecionada(HOJE.getDay())
  }

  // ── Detalhe / edição de despesa registrada ─────────────────────────────
  function abrirDetalhe(d: Despesa) {
    definirDespesaAberta(d)
    definirModoDetalhe("ver")
  }
  function iniciarEdicao() {
    if (!despesaAberta) return
    definirValorEdicaoDespesa(String(despesaAberta.valor))
    definirPagamentoEdicaoDespesa(despesaAberta.pagamento)
    definirCartaoEdicaoDespesa(despesaAberta.cartaoId ?? null)
    definirRecorrenciaEdicaoDespesa(despesaAberta.recorrencia)
    definirModoDetalhe("editar")
  }
  function salvarEdicao() {
    if (!despesaAberta) return
    const v = parseFloat(valorEdicaoDespesa.replace(",", "."))
    if (isNaN(v) || v <= 0) return
    const cartaoDaEdicao = cartoes.find(
      (cartao) => cartao.id === cartaoEdicaoDespesa,
    )
    if (pagamentoEdicaoDespesa === "cartao" && !cartaoDaEdicao) return
    // Nome intocável; não altera template
    definirDespesas((prev) =>
      prev.map((d) =>
        d.id === despesaAberta.id
          ? {
              ...d,
              valor: v,
              pagamento: pagamentoEdicaoDespesa,
              cartaoId:
                pagamentoEdicaoDespesa === "cartao"
                  ? cartaoDaEdicao?.id
                  : undefined,
              cartaoNome:
                pagamentoEdicaoDespesa === "cartao"
                  ? cartaoDaEdicao?.nome
                  : undefined,
              recorrencia: recorrenciaEdicaoDespesa,
            }
          : d,
      ),
    )
    definirDespesaAberta(null)
  }
  function excluirDespesa() {
    if (!despesaAberta) return
    if (
      !window.confirm(
        `Excluir a despesa "${despesaAberta.nome}"? Esta ação não pode ser desfeita.`,
      )
    )
      return
    definirDespesas((prev) => prev.filter((d) => d.id !== despesaAberta.id))
    definirDespesaAberta(null)
  }

  // ── CRUD de template (tela de projeção) ────────────────────────────────
  function iniciarEdicaoDaPrevisao(g: {
    id: number
    nome: string
    valor: number
    pagamento: TipoPagamento
    cartaoId?: number
    cartaoNome?: string
    totalPrevisto: number
    recorrencia: TipoRecorrencia
  }) {
    definirIdentificadorPrevisaoEmEdicao(g.id)
    definirNomePrevisaoEmEdicao(g.nome)
    definirValorPrevisaoEmEdicao(String(g.valor))
    definirPagamentoPrevisaoEmEdicao(g.pagamento)
    definirCartaoPrevisaoEmEdicao(g.cartaoId ?? null)
    definirRecorrenciaPrevisaoEmEdicao(g.recorrencia)
    definirOcorrenciasPersonalizadasPrevisao(
      g.recorrencia === "personalizada" ? String(g.totalPrevisto || 1) : "1",
    )
  }
  function salvarEdicaoDaPrevisao() {
    if (identificadorPrevisaoEmEdicao == null) return
    const padraoAnterior = despesasPrevistas.find(
      (padrao) => padrao.id === identificadorPrevisaoEmEdicao,
    )
    if (!padraoAnterior) return
    const nome = nomePrevisaoEmEdicao.trim()
    const v = parseFloat(valorPrevisaoEmEdicao.replace(",", "."))
    const cartaoDoPadrao = cartoes.find(
      (cartao) => cartao.id === cartaoPrevisaoEmEdicao,
    )
    if (
      !nome ||
      isNaN(v) ||
      v <= 0 ||
      (pagamentoPrevisaoEmEdicao === "cartao" && !cartaoDoPadrao)
    )
      return
    const nomeJaUsado = despesasPrevistas.some(
      (padrao) =>
        padrao.id !== identificadorPrevisaoEmEdicao &&
        normalizarNome(padrao.nome) === normalizarNome(nome),
    )
    if (nomeJaUsado) return
    const totalPrevisto = obterTotalPrevistoNoCiclo(
      {
        id: identificadorPrevisaoEmEdicao,
        nome,
        valor: v,
        pagamento: pagamentoPrevisaoEmEdicao,
        cartaoId:
          pagamentoPrevisaoEmEdicao === "cartao"
            ? cartaoDoPadrao?.id
            : undefined,
        cartaoNome:
          pagamentoPrevisaoEmEdicao === "cartao"
            ? cartaoDoPadrao?.nome
            : undefined,
        recorrencia: recorrenciaPrevisaoEmEdicao,
        ocorrenciasPorCiclo:
          recorrenciaPrevisaoEmEdicao === "personalizada"
            ? Math.max(parseInt(ocorrenciasPersonalizadasPrevisao) || 1, 1)
            : undefined,
        restantes: 1,
      },
      quantidadeDiasDoCiclo,
    )
    definirDespesasPrevistas((prev) =>
      prev.map((p) =>
        p.id === identificadorPrevisaoEmEdicao
          ? {
              ...p,
              nome,
              valor: v,
              pagamento: pagamentoPrevisaoEmEdicao,
              cartaoId:
                pagamentoPrevisaoEmEdicao === "cartao"
                  ? cartaoDoPadrao?.id
                  : undefined,
              cartaoNome:
                pagamentoPrevisaoEmEdicao === "cartao"
                  ? cartaoDoPadrao?.nome
                  : undefined,
              recorrencia: recorrenciaPrevisaoEmEdicao,
              ocorrenciasPorCiclo:
                recorrenciaPrevisaoEmEdicao === "personalizada"
                  ? totalPrevisto
                  : undefined,
              restantes: totalPrevisto,
            }
          : p,
      ),
    )
    definirDespesas((prev) =>
      prev.map((despesa) =>
        despesaPertenceAoPadrao(despesa, padraoAnterior)
          ? {
              ...despesa,
              padraoId: identificadorPrevisaoEmEdicao,
              nome,
            }
          : despesa,
      ),
    )
    definirMetas((prev) =>
      prev.map((meta) =>
        meta.despesaVinculadaNome &&
        normalizarNome(meta.despesaVinculadaNome) ===
          normalizarNome(padraoAnterior.nome)
          ? { ...meta, despesaVinculadaNome: nome }
          : meta,
      ),
    )
    definirIdentificadorPrevisaoEmEdicao(null)
  }
  function excluirPrevisao(id: number) {
    definirDespesasPrevistas((prev) => prev.filter((p) => p.id !== id))
    definirDespesas((prev) =>
      prev.map((despesa) =>
        despesa.padraoId === id ? { ...despesa, padraoId: undefined } : despesa,
      ),
    )
    if (identificadorPrevisaoEmEdicao === id)
      definirIdentificadorPrevisaoEmEdicao(null)
  }

  // ── Metas ──────────────────────────────────────────────────────────────
  function abrirModalMeta() {
    const a = obterDataEHoraAtuais()
    definirNomeNovaMeta("")
    definirDataNovaMeta(a.data)
    definirHoraNovaMeta(a.hora)
    definirImpactoNovaMeta(false)
    definirDespesaNovaMeta("")
    definirValorNovaMeta("")
    definirFrequenciaNovaMeta("")
    definirModalNovaMetaAberta(true)
  }
  function salvarMeta() {
    const nome = nomeNovaMeta.trim()
    if (!nome) return
    const dataInicio = `${dataNovaMeta}T${horaNovaMeta}:00`
    const valorMedio =
      impactoNovaMeta && valorNovaMeta
        ? parseFloat(valorNovaMeta.replace(",", "."))
        : undefined
    const frequenciaMensal =
      impactoNovaMeta && frequenciaNovaMeta
        ? parseInt(frequenciaNovaMeta)
        : undefined
    const despesaVinculadaNome =
      impactoNovaMeta && despesaNovaMeta.trim()
        ? despesaNovaMeta.trim()
        : undefined
    const novoMetaId = gerarProximoIdentificador()
    definirMetas((prev) => [
      ...prev,
      {
        id: novoMetaId,
        nome,
        dataInicio,
        despesaVinculadaNome,
        valorMedio,
        frequenciaMensal,
      },
    ])
    definirModalNovaMetaAberta(false)
  }
  function excluirMeta(id: number) {
    const meta = metas.find((item) => item.id === id)
    if (
      !window.confirm(
        `Excluir a meta${
          meta ? ` "${meta.nome}"` : ""
        }? Esta ação não pode ser desfeita.`,
      )
    )
      return
    definirMetas((prev) => prev.filter((m) => m.id !== id))
    if (metaAberta?.id === id) definirMetaAberta(null)
  }
  function abrirEditarMeta(meta: Meta) {
    definirMetaParaEditar(meta)
    definirNomeMetaEmEdicao(meta.nome)
    const d = new Date(meta.dataInicio)
    definirDataMetaEmEdicao(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    )
    definirHoraMetaEmEdicao(
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    )
    definirImpactoMetaEmEdicao(!!meta.despesaVinculadaNome)
    definirDespesaMetaEmEdicao(meta.despesaVinculadaNome ?? "")
    definirValorMetaEmEdicao(meta.valorMedio ? String(meta.valorMedio) : "")
    definirFrequenciaMetaEmEdicao(
      meta.frequenciaMensal ? String(meta.frequenciaMensal) : "",
    )
    definirModalEdicaoMetaAberta(true)
  }
  function salvarEditarMeta() {
    if (!metaParaEditar) return
    const nome = nomeMetaEmEdicao.trim()
    if (!nome) return
    const dataInicio = `${dataMetaEmEdicao}T${horaMetaEmEdicao}:00`
    definirMetas((prev) =>
      prev.map((m) =>
        m.id === metaParaEditar.id
          ? {
              ...m,
              nome,
              dataInicio,
              despesaVinculadaNome:
                impactoMetaEmEdicao && despesaMetaEmEdicao.trim()
                  ? despesaMetaEmEdicao.trim()
                  : undefined,
              valorMedio:
                impactoMetaEmEdicao && valorMetaEmEdicao
                  ? parseFloat(valorMetaEmEdicao.replace(",", ".")) || undefined
                  : undefined,
              frequenciaMensal:
                impactoMetaEmEdicao && frequenciaMetaEmEdicao
                  ? parseInt(frequenciaMetaEmEdicao) || undefined
                  : undefined,
            }
          : m,
      ),
    )
    definirModalEdicaoMetaAberta(false)
    definirMetaParaEditar(null)
  }
  function reiniciarMeta(metaId: number) {
    const a = obterDataEHoraAtuais()
    definirMetas((prev) =>
      prev.map((m) =>
        m.id === metaId ? { ...m, dataInicio: `${a.data}T${a.hora}:00` } : m,
      ),
    )
    definirInformacoesQuebraMeta(null)
  }

  // ── Helpers de notas/tarefas ──────────────────────────────────────────
  function tarefasParaIntervalo(
    dataInicial: string,
    dataFinal = dataInicial,
  ): Array<{ bloco: BlocoNota; nota: Nota }> {
    const result: Array<{ bloco: BlocoNota; nota: Nota }> = []
    notas.forEach((nota) => {
      nota.blocos.forEach((bloco) => {
        if (
          bloco.tipo === "checkbox" &&
          bloco.data &&
          bloco.data >= dataInicial &&
          bloco.data <= dataFinal
        )
          result.push({ bloco, nota })
      })
    })
    return result.sort((a, b) =>
      `${a.bloco.data ?? ""}T${a.bloco.hora ?? ""}`.localeCompare(
        `${b.bloco.data ?? ""}T${b.bloco.hora ?? ""}`,
      ),
    )
  }

  function contarTarefasPorData(dataStr: string): number {
    let count = 0
    notas.forEach((nota) =>
      nota.blocos.forEach((b) => {
        if (b.tipo === "checkbox" && b.data === dataStr) count++
      }),
    )
    return count
  }

  function formatarDataTarefa(data?: string, hora?: string): string {
    if (!data) return ""
    const d = new Date(data + "T12:00:00")
    const dia = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
    return hora ? `${dia} ${hora}` : dia
  }

  function abrirNotaDoCalendario(nota: Nota) {
    definirNotaAberta(nota)
  }

  function alternarBlocoDoCalendario(notaId: number, blocoId: number) {
    definirNotas((ns) =>
      ns.map((n) =>
        n.id !== notaId
          ? n
          : {
              ...n,
              blocos: n.blocos.map((b) =>
                b.id !== blocoId ? b : { ...b, concluida: !b.concluida },
              ),
            },
      ),
    )
  }

  // ── Notas ───────────────────────────────────────────────────────────────
  function atualizarNota(updater: (n: Nota) => Nota) {
    definirNotaAberta((prev) => {
      if (!prev) return prev
      const next = updater(prev)
      definirNotas((notas) => notas.map((n) => (n.id === next.id ? next : n)))
      return next
    })
  }
  function alternarBloco(blocoId: number) {
    atualizarNota((prev) => ({
      ...prev,
      blocos: prev.blocos.map((b) =>
        b.id === blocoId ? { ...b, concluida: !b.concluida } : b,
      ),
    }))
  }
  function abrirModalNota() {
    definirTituloNovaNota("")
    definirBlocosNovaNota([
      {
        id: gerarProximoIdentificador(),
        tipo: "texto",
        texto: "",
        concluida: false,
      },
    ])
    definirDataNovaNota("")
    definirNovaNotaFixada(false)
    definirBlocoEditandoData(null)
    definirModalNovaNotaAberta(true)
  }
  function salvarNota() {
    const titulo = tituloNovaNota.trim() || "Sem título"
    const nid = gerarProximoIdentificador()
    definirNotas((prev) => [
      ...prev,
      {
        id: nid,
        titulo,
        blocos: blocosNovaNota,
        data: dataNovaNota || undefined,
        fixada: novaNotaFixada,
        arquivada: false,
        criadaEm: new Date().toISOString(),
      },
    ])
    definirBlocoEditandoData(null)
    definirModalNovaNotaAberta(false)
  }
  function atualizarBlocoDaNovaNota(
    blocoId: number,
    alteracoes: Partial<BlocoNota>,
  ) {
    definirBlocosNovaNota((blocos) =>
      blocos.map((bloco) =>
        bloco.id === blocoId ? { ...bloco, ...alteracoes } : bloco,
      ),
    )
  }
  function guardarSelecaoAntesDoRelogio(campoId: string) {
    const campo = document.getElementById(campoId) as HTMLInputElement | null
    if (!campo) return
    const campoEstavaAtivo = document.activeElement === campo
    const posicaoPadrao = campo.value.length
    selecaoAntesDoRelogioRef.current = {
      campoId,
      inicio: campoEstavaAtivo
        ? (campo.selectionStart ?? posicaoPadrao)
        : posicaoPadrao,
      fim: campoEstavaAtivo
        ? (campo.selectionEnd ?? posicaoPadrao)
        : posicaoPadrao,
    }
  }
  function confirmarDataEVoltarAoTexto(campoId: string) {
    const selecao = selecaoAntesDoRelogioRef.current
    const campo = document.getElementById(campoId) as HTMLInputElement | null
    if (campo) {
      const posicaoPadrao = campo.value.length
      const inicio =
        selecao?.campoId === campoId ? selecao.inicio : posicaoPadrao
      const fim = selecao?.campoId === campoId ? selecao.fim : posicaoPadrao
      campo.focus({ preventScroll: true })
      campo.setSelectionRange(inicio, fim)
    }
    selecaoAntesDoRelogioRef.current = null
    definirBlocoEditandoData(null)
  }
  function alternarFixacaoDaNota(notaId: number) {
    definirNotas((prev) =>
      prev.map((n) => (n.id === notaId ? { ...n, fixada: !n.fixada } : n)),
    )
    definirNotaAberta((prev) =>
      prev && prev.id === notaId ? { ...prev, fixada: !prev.fixada } : prev,
    )
  }
  function excluirNota(notaId: number) {
    const nota = notas.find((item) => item.id === notaId)
    if (
      !window.confirm(
        `Excluir a nota${
          nota ? ` "${nota.titulo}"` : ""
        }? Esta ação não pode ser desfeita.`,
      )
    )
      return
    definirNotas((prev) => prev.filter((n) => n.id !== notaId))
    definirNotaAberta(null)
  }

  // ── Nova despesa ───────────────────────────────────────────────────────
  function obterSugestoesRecentes(valor = "") {
    const termo = normalizarNome(valor)
    const vistos = new Set<string>()
    const nomes: string[] = []
    const despesasRecentes = [...despesas].sort(
      (a, b) => b.data.localeCompare(a.data) || Number(b.id) - Number(a.id),
    )
    ;[
      ...despesasRecentes.map((despesa) => despesa.nome),
      ...despesasPrevistas.map((padrao) => padrao.nome),
    ].forEach((nome) => {
      const chave = normalizarNome(nome)
      if (!chave || vistos.has(chave)) return
      vistos.add(chave)
      if (!termo || chave.includes(termo)) nomes.push(nome)
    })
    return nomes.slice(0, 6)
  }

  function aoDigitarNome(valor: string) {
    definirNomeDespesa(valor)
    definirErroNovaDespesa("")
    const padraoSelecionado = despesasPrevistas.find(
      (padrao) => padrao.id === padraoSelecionadoId,
    )
    if (
      padraoSelecionado &&
      normalizarNome(valor) !== normalizarNome(padraoSelecionado.nome)
    )
      definirPadraoSelecionadoId(null)
    definirSugestoes(obterSugestoesRecentes(valor))
  }
  function selecionarSugestao(nome: string) {
    campoNomeNovaDespesaRef.current?.blur()
    const chave = normalizarNome(nome)
    const prev = despesasPrevistas.find(
      (padrao) => normalizarNome(padrao.nome) === chave,
    )
    const ref = [...despesas]
      .filter((despesa) => normalizarNome(despesa.nome) === chave)
      .sort(
        (a, b) => b.data.localeCompare(a.data) || Number(b.id) - Number(a.id),
      )[0]
    definirNomeDespesa(nome)
    const valorRef = prev?.valor ?? ref?.valor
    if (valorRef != null) definirValorDespesa(String(valorRef))
    const pagamentoRef = prev?.pagamento ?? ref?.pagamento
    const cartaoRefId = prev?.cartaoId ?? ref?.cartaoId
    if (pagamentoRef) {
      definirPagamento(pagamentoRef)
      const cartaoAtivo = cartoes.find((cartao) => cartao.id === cartaoRefId)
      definirCartaoSelecionado(
        pagamentoRef === "cartao"
          ? (cartaoAtivo?.id ?? cartoes[0]?.id ?? null)
          : null,
      )
    }
    if (prev) {
      const quantidadeRegistradaNoCiclo = despesasDoCicloAtual.filter(
        (despesa) => despesaPertenceAoPadrao(despesa, prev),
      ).length
      const previsaoDoPadraoFoiConcluida =
        quantidadeRegistradaNoCiclo >=
        obterTotalPrevistoNoCiclo(prev, quantidadeDiasDoCiclo)
      definirPadraoSelecionadoId(prev.id)
      definirRecorrencia(
        previsaoDoPadraoFoiConcluida ? "avulsa" : prev.recorrencia,
      )
      if (prev.recorrencia === "personalizada")
        definirOcorrenciasPersonalizadas(
          String(obterTotalPrevistoNoCiclo(prev, quantidadeDiasDoCiclo)),
        )
    } else {
      definirPadraoSelecionadoId(null)
      if (ref) definirRecorrencia(ref.recorrencia)
    }
    definirErroNovaDespesa("")
    definirSugestoes([])
  }
  function aoSelecionarPagamento(p: TipoPagamento) {
    definirPagamento(p)
    definirErroNovaDespesa("")
    if (p === "cartao" && cartoes.length > 0 && cartaoSelecionado == null)
      definirCartaoSelecionado(cartoes[0].id)
  }
  function salvarDespesa() {
    const v = parseFloat(valorDespesa.replace(",", "."))
    const camposFaltando: string[] = []
    if (!nomeDespesa.trim()) camposFaltando.push("nome da despesa")
    if (isNaN(v) || v <= 0) camposFaltando.push("valor maior que zero")
    if (!dataDespesa) camposFaltando.push("data")
    const cartaoDaDespesa = cartoes.find(
      (cartao) => cartao.id === cartaoSelecionado,
    )
    if (pagamento === "cartao" && !cartaoDaDespesa)
      camposFaltando.push("cartão disponível")
    if (
      recorrencia === "personalizada" &&
      (!Number.isInteger(Number(ocorrenciasPersonalizadas)) ||
        Number(ocorrenciasPersonalizadas) < 1)
    )
      camposFaltando.push("quantidade de ocorrências")
    if (camposFaltando.length > 0) {
      definirErroNovaDespesa(
        `Preencha corretamente: ${camposFaltando.join(", ")}.`,
      )
      return
    }
    const occ =
      recorrencia === "personalizada"
        ? parseInt(ocorrenciasPersonalizadas)
        : undefined
    const nomeFinal = nomeDespesa.trim()
    const padraoExistente = despesasPrevistas.find(
      (padrao) => normalizarNome(padrao.nome) === normalizarNome(nomeFinal),
    )
    let padraoVinculadoId = padraoExistente?.id
    if (recorrencia !== "avulsa" && !padraoExistente) {
      const pid = gerarProximoIdentificador()
      padraoVinculadoId = pid
      const totalPrevisto = obterTotalPrevistoNoCiclo(
        {
          id: pid,
          nome: nomeFinal,
          valor: v,
          pagamento,
          cartaoId: pagamento === "cartao" ? cartaoDaDespesa?.id : undefined,
          cartaoNome:
            pagamento === "cartao" ? cartaoDaDespesa?.nome : undefined,
          recorrencia,
          ocorrenciasPorCiclo: occ,
          restantes: occ ?? 1,
        },
        quantidadeDiasDoCiclo,
      )
      definirDespesasPrevistas((prev) => [
        ...prev,
        {
          id: pid,
          nome: nomeFinal,
          valor: v,
          pagamento,
          cartaoId: pagamento === "cartao" ? cartaoDaDespesa?.id : undefined,
          cartaoNome:
            pagamento === "cartao" ? cartaoDaDespesa?.nome : undefined,
          recorrencia,
          ocorrenciasPorCiclo: occ,
          restantes: totalPrevisto,
        },
      ])
    }
    const did = gerarProximoIdentificador()
    definirDespesas((prev) => {
      const despesasVinculadas = padraoVinculadoId
        ? prev.map((despesa) =>
            normalizarNome(despesa.nome) === normalizarNome(nomeFinal)
              ? { ...despesa, padraoId: padraoVinculadoId }
              : despesa,
          )
        : prev
      return [
        ...despesasVinculadas,
        {
          id: did,
          padraoId: padraoVinculadoId,
          nome: nomeFinal,
          valor: v,
          data: dataDespesa,
          pagamento,
          cartaoId: pagamento === "cartao" ? cartaoDaDespesa?.id : undefined,
          cartaoNome:
            pagamento === "cartao" ? cartaoDaDespesa?.nome : undefined,
          recorrencia,
          ocorrenciasRestantes: occ,
        },
      ]
    })
    const nomeExp = nomeFinal
    fecharModal()
    // Check for meta match after saving
    const metaRelacionada = metas.find(
      (m) => m.despesaVinculadaNome?.toLowerCase() === nomeExp.toLowerCase(),
    )
    if (metaRelacionada) {
      definirInformacoesQuebraMeta({ meta: metaRelacionada })
    }
  }
  function fecharModal() {
    definirModalDespesaAberto(false)
    definirNomeDespesa("")
    definirValorDespesa("")
    definirPagamento("pix")
    definirCartaoSelecionado(null)
    definirRecorrencia("avulsa")
    definirOcorrenciasPersonalizadas("1")
    definirSugestoes([])
    definirPadraoSelecionadoId(null)
    definirErroNovaDespesa("")
  }
  function abrirModal() {
    definirAba("inicio")
    definirDataDespesa(formatarDataIso(diaSelecionado))
    definirModalDespesaAberto(true)
  }

  // ── Cartões ────────────────────────────────────────────────────────────
  function adicionarCartao(nome: string) {
    if (!nome) return
    const identificador = gerarProximoIdentificador()
    definirCartoes((cartoesAtuais) =>
      cartoesAtuais.some(
        (cartao) => normalizarNome(cartao.nome) === normalizarNome(nome),
      )
        ? cartoesAtuais
        : [...cartoesAtuais, { id: identificador, nome }],
    )
  }
  function removerCartao(cartaoId: number) {
    definirCartoes((prev) => prev.filter((cartao) => cartao.id !== cartaoId))
    definirCartaoSelecionado((atual) => (atual === cartaoId ? null : atual))
    definirCartaoEdicaoDespesa((atual) => (atual === cartaoId ? null : atual))
    definirCartaoPrevisaoEmEdicao((atual) =>
      atual === cartaoId ? null : atual,
    )
  }
  function renomearCartao(cartaoId: number, novoNomeInformado: string) {
    const novoNome = novoNomeInformado.trim()
    const cartaoAtual = cartoes.find((cartao) => cartao.id === cartaoId)
    if (!cartaoAtual) return
    if (
      !novoNome ||
      (normalizarNome(cartaoAtual.nome) !== normalizarNome(novoNome) &&
        cartoes.some(
          (cartao) => normalizarNome(cartao.nome) === normalizarNome(novoNome),
        ))
    )
      return
    definirCartoes((prev) =>
      prev.map((cartao) =>
        cartao.id === cartaoId ? { ...cartao, nome: novoNome } : cartao,
      ),
    )
    definirDespesas((prev) =>
      prev.map((despesa) =>
        despesa.cartaoId === cartaoId
          ? { ...despesa, cartaoNome: novoNome }
          : despesa,
      ),
    )
    definirDespesasPrevistas((prev) =>
      prev.map((padrao) =>
        padrao.cartaoId === cartaoId
          ? { ...padrao, cartaoNome: novoNome }
          : padrao,
      ),
    )
  }

  const pagamentosDisponiveis: TipoPagamento[] =
    cartoes.length > 0 ? ["pix", "dinheiro", "cartao"] : ["pix", "dinheiro"]

  // ── Diferença previsão vs realidade ────────────────────────────────────
  const diferencaPrevisao =
    statusPeriodo === "atual" ? gastoRealComparativo - previsaoAteHoje : null
  const dataInicialTarefasSelecionadas =
    visao === "semanal"
      ? formatarDataIso(diaSelecionado)
      : inicioIntervalo
        ? formatarDataIso(inicioIntervalo)
        : null
  const dataFinalTarefasSelecionadas =
    visao === "mensal" && fimIntervalo
      ? formatarDataIso(fimIntervalo)
      : dataInicialTarefasSelecionadas
  const tarefasDaDataSelecionada = dataInicialTarefasSelecionadas
    ? tarefasParaIntervalo(
        dataInicialTarefasSelecionadas,
        dataFinalTarefasSelecionadas ?? dataInicialTarefasSelecionadas,
      )
    : []
  const dataDaNovaDespesa = new Date(`${dataDespesa}T12:00:00`)
  const padraoSelecionado = despesasPrevistas.find(
    (padrao) => padrao.id === padraoSelecionadoId,
  )
  const resumoDoPadraoSelecionado = padraoSelecionado
    ? (() => {
        const despesasRegistradas = despesasDoCicloAtual.filter((despesa) =>
          despesaPertenceAoPadrao(despesa, padraoSelecionado),
        )
        const totalPrevisto = obterTotalPrevistoNoCiclo(
          padraoSelecionado,
          quantidadeDiasDoCiclo,
        )
        const previsaoDoCiclo = padraoSelecionado.valor * totalPrevisto
        const gastoNoCiclo = despesasRegistradas.reduce(
          (total, despesa) => total + despesa.valor,
          0,
        )
        const valorDaNovaDespesa = Math.max(
          parseFloat(valorDespesa.replace(",", ".")) || 0,
          0,
        )
        return {
          previsaoDoCiclo,
          aindaPrevisto:
            padraoSelecionado.valor *
            Math.max(totalPrevisto - despesasRegistradas.length, 0),
          gastoNoCiclo,
          gastoComNovaDespesa: gastoNoCiclo + valorDaNovaDespesa,
          previsaoConcluida: despesasRegistradas.length >= totalPrevisto,
        }
      })()
    : null
  const previsaoDoPadraoSelecionadoFoiConcluida =
    resumoDoPadraoSelecionado?.previsaoConcluida ?? false

  // ── Render ─────────────────────────────────────────────────────────────
  if (!dadosCarregados) {
    return (
      <main className="min-h-[100dvh] bg-[#EEF2F9] flex items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1A56DB] font-bold text-white">
            GL
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {erroDosDados ? "Servidor indisponível" : "Carregando seus dados"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            {erroDosDados || "Aguarde enquanto sincronizamos sua conta."}
          </p>
          {erroDosDados && (
            <button
              type="button"
              onClick={recarregarDados}
              className="mt-6 w-full rounded-2xl bg-[#1A56DB] px-4 py-3 text-sm font-bold text-white"
            >
              Tentar novamente
            </button>
          )}
        </div>
      </main>
    )
  }

  return (
    <div
      style={{ fontFamily: "'Inter', sans-serif" }}
      className="min-h-[100dvh] bg-[#EEF2F9] flex items-start justify-center"
    >
      {erroDosDados && (
        <div className="fixed left-1/2 top-3 z-[100] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl bg-red-600 px-4 py-3 text-center text-xs font-semibold text-white shadow-lg">
          {erroDosDados}
        </div>
      )}
      <div className="w-full min-h-[100dvh] bg-[#EEF2F9] flex flex-col relative sm:max-w-sm sm:shadow-xl">
        {/* ══════════════ ABA INÍCIO ══════════════ */}
        {aba === "inicio" && (
          <TelaInicio
            nomeUsuario={nomeUsuario}
            mesInsights={mesInsights}
            gastosDoMes={gastosDoMesInsights}
            diferencaPrevisao={diferencaPrevisao}
            visao={visao}
            mesCalendario={mesCalendario}
            diaSelecionado={diaSelecionado}
            inicioIntervalo={inicioIntervalo}
            fimIntervalo={fimIntervalo}
            dataFimDoCiclo={fimCicloIso}
            despesas={despesas}
            despesasDaVisao={despesasVisao}
            totalDaVisao={totalVisao}
            itensDoGrafico={itensPizzaInicio}
            agruparGraficoPorPagamento={pizzaPorPagamento}
            aoAbrirPerfil={() => definirAba("perfil")}
            aoAbrirInsights={() => definirAba("insights")}
            aoNavegarPeriodoAnterior={navegarParaPeriodoAnterior}
            aoNavegarProximoPeriodo={navegarParaProximoPeriodo}
            aoIrParaHoje={() => {
              definirDiaSelecionado(HOJE)
              definirMesCalendario(
                new Date(HOJE.getFullYear(), HOJE.getMonth(), 1),
              )
              limparIntervalo()
            }}
            aoSelecionarVisaoMensal={() => {
              definirVisao("mensal")
              limparIntervalo()
            }}
            aoSelecionarVisaoSemanal={() => definirVisao("semanal")}
            aoSelecionarDiaMensal={selecionarDiaDoMes}
            aoSelecionarDiaSemanal={definirDiaSelecionado}
            aoLimparIntervalo={limparIntervalo}
            aoAlternarAgrupamentoDoGrafico={() =>
              definirPizzaPorPagamento((valorAtual) => !valorAtual)
            }
            aoAbrirDespesa={abrirDetalhe}
            contarTarefasPorData={contarTarefasPorData}
          />
        )}

        {/* ══════════════ ABA INSIGHTS ══════════════ */}
        {aba === "insights" && (
          <TelaInsights
            nomeUsuario={nomeUsuario}
            mes={mesInsights}
            statusPeriodo={statusPeriodo}
            diaFechamento={diaFechamento}
            gastosDoMes={gastosDoPeriodoInsights}
            gastoRealComparativo={gastoRealComparativo}
            projecaoDoMes={projecaoDoMesInsights}
            previsaoAteHoje={previsaoAteHoje}
            diferencaPrevisao={diferencaPrevisao}
            semana={semanaInsights}
            diasDaSemana={diasDaSemanaInsights}
            valoresDaSemana={valoresSemana}
            indiceBarraSelecionada={indiceBarraSelecionada}
            metas={metas}
            aoAbrirPerfil={() => definirAba("perfil")}
            aoNavegarMes={navegarMesInsights}
            aoIrParaMesAtual={irParaMesAtual}
            aoAbrirProjecao={() => definirProjecaoAberta(true)}
            aoAbrirComparativo={() => definirComparativoAberto(true)}
            aoNavegarSemana={navegarSemanaInsights}
            aoIrParaSemanaAtual={() => {
              definirSemanaInsights(HOJE)
              definirIndiceBarraSelecionada(HOJE.getDay())
              definirMesInsights(
                new Date(HOJE.getFullYear(), HOJE.getMonth(), 1),
              )
            }}
            aoSelecionarBarra={(indice) =>
              definirIndiceBarraSelecionada((indiceAtual) =>
                indiceAtual === indice ? null : indice,
              )
            }
          />
        )}

        {/* ══════════════ ABA VIDA ══════════════ */}
        {aba === "vida" && (
          <TelaVida
            nomeUsuario={nomeUsuario}
            segmentoAtual={segmentoVida}
            metas={metas}
            notas={notas}
            aoAbrirPerfil={() => definirAba("perfil")}
            aoSelecionarSegmento={definirSegmentoVida}
            aoCriarMeta={abrirModalMeta}
            aoAbrirMeta={definirMetaAberta}
            aoEditarMeta={abrirEditarMeta}
            aoExcluirMeta={excluirMeta}
            aoAbrirNota={definirNotaAberta}
            aoAlternarFixacaoDaNota={alternarFixacaoDaNota}
          />
        )}

        {/* ══════════════ ABA PERFIL ══════════════ */}
        {aba === "perfil" && (
          <TelaPerfil
            nomeUsuario={nomeUsuario}
            loginUsuario={usuario.login}
            perfilAcesso={usuario.perfilAcesso}
            quantidadeDespesas={despesas.length}
            quantidadeMetas={metas.length}
            quantidadeNotas={notas.filter((nota) => !nota.arquivada).length}
            diaFechamento={diaFechamento}
            cartoes={cartoes}
            aoAlterarNome={definirNomeUsuario}
            aoAlterarDiaFechamento={definirDiaFechamento}
            aoAdicionarCartao={adicionarCartao}
            aoRenomearCartao={renomearCartao}
            aoRemoverCartao={removerCartao}
            aoSair={aoSair}
          />
        )}

        {aba === "inicio" && (
          <PainelTarefas
            dataSelecionada={dataInicialTarefasSelecionadas}
            dataFinalSelecionada={dataFinalTarefasSelecionadas}
            tarefas={tarefasDaDataSelecionada}
            aoAlternarTarefa={alternarBlocoDoCalendario}
            aoAbrirNota={abrirNotaDoCalendario}
          />
        )}

        <NavegacaoPrincipal
          abaAtual={aba}
          aoSelecionarAba={definirAba}
          aoCriarDespesa={abrirModal}
        />

        {/* FAB flutuante — nova nota (discreto, canto inferior direito, acima da nav) */}
        <button
          onClick={abrirModalNota}
          className="fixed z-10 bg-white border border-gray-200 text-gray-600 rounded-2xl shadow-md hover:shadow-lg hover:bg-gray-50 transition-all active:scale-95 flex items-center justify-center"
          style={{
            bottom: "70px",
            right: "20px",
            width: "46px",
            height: "46px",
          }}
          aria-label="Nova nota"
        >
          <IconeLapis />
        </button>

        {/* ══════════════ MODAL DETALHE META ══════════════ */}
        {metaAberta && (
          <div
            className="fixed inset-0 bg-black/50 z-20 flex items-end justify-center sheet-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) definirMetaAberta(null)
            }}
          >
            <div className="sheet-panel w-full max-w-sm bg-white rounded-t-3xl p-5">
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick={() => definirMetaAberta(null)}
                  aria-label="Fechar"
                  className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <IconeFechar />
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const metaSelecionada = metaAberta
                      definirMetaAberta(null)
                      abrirEditarMeta(metaSelecionada)
                    }}
                    className="flex items-center gap-1 text-xs text-[#1A56DB] font-semibold transition-colors px-2 py-1.5 rounded-lg hover:bg-blue-50"
                  >
                    <IconeEditar /> Editar
                  </button>
                  <button
                    onClick={() => excluirMeta(metaAberta.id)}
                    className="text-xs text-red-600 hover:text-red-600 font-semibold transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
                  >
                    Excluir
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-600 font-semibold uppercase tracking-widest mb-2">
                Meta ativa
              </p>
              <p className="text-xl font-bold text-gray-950 mb-6">
                {metaAberta.nome}
              </p>

              {(() => {
                const t = calcularTempoDecorrido(metaAberta.dataInicio)
                return (
                  <>
                    <div className="bg-gray-50 rounded-2xl p-5 mb-4">
                      <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-2">
                        Tempo decorrido
                      </p>
                      <div className="flex items-end gap-3">
                        {t.dias > 0 && (
                          <div className="text-center">
                            <p className="text-4xl font-bold text-gray-950 leading-none">
                              {t.dias}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              dia{t.dias !== 1 ? "s" : ""}
                            </p>
                          </div>
                        )}
                        <div className="text-center">
                          <p className="text-4xl font-bold text-gray-950 leading-none">
                            {String(t.horas).padStart(2, "0")}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">horas</p>
                        </div>
                        <p className="text-3xl font-light text-gray-500 leading-none mb-3">
                          :
                        </p>
                        <div className="text-center">
                          <p className="text-4xl font-bold text-gray-950 leading-none">
                            {String(t.minutos).padStart(2, "0")}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">min</p>
                        </div>
                        <p className="text-3xl font-light text-gray-500 leading-none mb-3">
                          :
                        </p>
                        <div className="text-center">
                          <p className="text-4xl font-bold text-gray-600 leading-none">
                            {String(t.segundos).padStart(2, "0")}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">seg</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">
                      Desde{" "}
                      <span className="font-semibold text-gray-700">
                        {formatarDataPorExtenso(metaAberta.dataInicio)}
                      </span>{" "}
                      às{" "}
                      <span className="font-semibold text-gray-700">
                        {formatarHora(metaAberta.dataInicio)}
                      </span>
                    </p>
                    {metaAberta.despesaVinculadaNome &&
                      metaAberta.valorMedio &&
                      metaAberta.frequenciaMensal &&
                      (() => {
                        const economia = calcularEconomiaEstimada(metaAberta)
                        const evitadas = calcularOcorrenciasEvitadas(metaAberta)
                        return (
                          <div className="mt-4 space-y-3">
                            <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest">
                              Impacto financeiro
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-gray-50 rounded-xl p-3">
                                <p className="text-[10px] text-gray-600 mb-1">
                                  Despesa vinculada
                                </p>
                                <p className="text-sm font-semibold text-gray-900">
                                  {metaAberta.despesaVinculadaNome}
                                </p>
                              </div>
                              <div className="bg-gray-50 rounded-xl p-3">
                                <p className="text-[10px] text-gray-600 mb-1">
                                  Valor médio
                                </p>
                                <p className="text-sm font-semibold text-gray-900">
                                  {formatarMoeda(metaAberta.valorMedio)}
                                </p>
                              </div>
                              <div className="bg-gray-50 rounded-xl p-3">
                                <p className="text-[10px] text-gray-600 mb-1">
                                  Frequência
                                </p>
                                <p className="text-sm font-semibold text-gray-900">
                                  {metaAberta.frequenciaMensal}×/mês
                                </p>
                              </div>
                              <div className="bg-gray-50 rounded-xl p-3">
                                <p className="text-[10px] text-gray-600 mb-1">
                                  Ocorrências evitadas
                                </p>
                                <p className="text-sm font-semibold text-gray-900">
                                  {evitadas}×
                                </p>
                              </div>
                            </div>
                            {economia > 0 && (
                              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                                <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-widest mb-1">
                                  Economia potencial estimada
                                </p>
                                <p className="text-2xl font-bold text-emerald-700">
                                  ≈ {formatarMoeda(economia)}
                                </p>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                  </>
                )
              })()}
            </div>
          </div>
        )}

        {/* ══════════════ MODAL DETALHE NOTA ══════════════ */}
        {notaAberta && (
          <div
            className="fixed inset-0 bg-black/50 z-20 flex items-end justify-center sheet-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                definirNotaAberta(null)
                definirBlocoEditandoData(null)
              }
            }}
          >
            <div
              className="sheet-panel w-full max-w-sm bg-white rounded-t-3xl flex flex-col"
              style={{ maxHeight: "94dvh" }}
            >
              {/* Header */}
              <div className="flex-shrink-0 flex items-center justify-between px-5 pt-5 pb-3">
                <button
                  onClick={() => {
                    definirNotaAberta(null)
                    definirBlocoEditandoData(null)
                  }}
                  aria-label="Fechar"
                  className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <IconeFechar />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => alternarFixacaoDaNota(notaAberta.id)}
                    className={`p-2 rounded-xl transition-colors ${
                      notaAberta.fixada
                        ? "bg-[#1A56DB] text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <IconeAlfinete ativo={notaAberta.fixada} />
                  </button>
                  <button
                    onClick={() => excluirNota(notaAberta.id)}
                    className="p-2 rounded-xl text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <IconeLixeira />
                  </button>
                </div>
              </div>

              {/* Conteúdo scrollável */}
              <div className="flex-1 overflow-y-auto px-5 pb-8">
                <p className="text-[11px] text-gray-600 mb-2">
                  {formatarDataPorExtenso(notaAberta.criadaEm)} às{" "}
                  {formatarHora(notaAberta.criadaEm)}
                  {notaAberta.data &&
                    ` · vence ${formatarDataPorExtenso(notaAberta.data)}`}
                </p>
                <input
                  type="text"
                  value={notaAberta.titulo ?? ""}
                  onChange={(e) => {
                    const t = e.target.value
                    atualizarNota((prev) => ({ ...prev, titulo: t }))
                  }}
                  className="w-full text-xl font-bold text-gray-950 outline-none bg-transparent mb-4"
                />

                {/* Block editor */}
                <div className="space-y-0.5">
                  {agruparBlocosDeNota(notaAberta.blocos).map((grupo) => {
                    if (grupo.tipo === "texto") {
                      const bloco = grupo.bloco
                      return (
                        <input
                          key={`b-${bloco.id}`}
                          id={`bloco-${bloco.id}`}
                          type="text"
                          value={bloco.texto}
                          placeholder={
                            notaAberta.blocos.length === 1 &&
                            notaAberta.blocos.every(
                              (item) => !item.texto.trim(),
                            ) &&
                            notaAberta.blocos[0]?.id === bloco.id
                              ? "Escreva algo…"
                              : undefined
                          }
                          className="bg-transparent text-sm text-gray-600 outline-none w-full"
                          onChange={(e) => {
                            const val = e.target.value
                            const bid = bloco.id
                            if (val.includes("[]")) {
                              const idx2 = val.indexOf("[]")
                              const antes = val.slice(0, idx2)
                              const depois = val.slice(idx2 + 2)
                              const newId = gerarProximoIdentificador()
                              atualizarNota((prev) => {
                                const blocos2 = prev.blocos.map((b) =>
                                  b.id === bid ? { ...b, texto: antes } : b,
                                )
                                const pos2 = blocos2.findIndex(
                                  (b) => b.id === bid,
                                )
                                blocos2.splice(pos2 + 1, 0, {
                                  id: newId,
                                  tipo: "checkbox",
                                  texto: depois,
                                  concluida: false,
                                })
                                return { ...prev, blocos: blocos2 }
                              })
                              setTimeout(() => {
                                ;(document.getElementById(
                                  `bloco-${newId}`,
                                ) as HTMLInputElement)?.focus()
                              }, 0)
                            } else {
                              atualizarNota((prev) => ({
                                ...prev,
                                blocos: prev.blocos.map((b) =>
                                  b.id === bid ? { ...b, texto: val } : b,
                                ),
                              }))
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              const currentVal = e.currentTarget.value
                              const pos =
                                e.currentTarget.selectionStart ??
                                currentVal.length
                              const antes = currentVal.slice(0, pos)
                              const depois = currentVal.slice(pos)
                              const newId = gerarProximoIdentificador()
                              const bid = bloco.id
                              atualizarNota((prev) => {
                                const blocos2 = prev.blocos.map((b) =>
                                  b.id === bid ? { ...b, texto: antes } : b,
                                )
                                const idx2 = blocos2.findIndex(
                                  (b) => b.id === bid,
                                )
                                blocos2.splice(idx2 + 1, 0, {
                                  id: newId,
                                  tipo: "texto",
                                  texto: depois,
                                  concluida: false,
                                })
                                return { ...prev, blocos: blocos2 }
                              })
                              setTimeout(() => {
                                ;(document.getElementById(
                                  `bloco-${newId}`,
                                ) as HTMLInputElement)?.focus()
                              }, 0)
                            }
                            if (
                              e.key === "Backspace" &&
                              e.currentTarget.value === ""
                            ) {
                              const bid = bloco.id
                              atualizarNota((prev) => {
                                const idx2 = prev.blocos.findIndex(
                                  (b) => b.id === bid,
                                )
                                if (idx2 > 0) {
                                  const prevBloco = prev.blocos[idx2 - 1]
                                  setTimeout(() => {
                                    ;(document.getElementById(
                                      `bloco-${prevBloco.id}`,
                                    ) as HTMLInputElement)?.focus()
                                  }, 0)
                                  return {
                                    ...prev,
                                    blocos: prev.blocos.filter(
                                      (b) => b.id !== bid,
                                    ),
                                  }
                                }
                                return prev
                              })
                            }
                          }}
                        />
                      )
                    } else {
                      const checkboxes = grupo.blocos
                      const total = checkboxes.length
                      const feitas = checkboxes.filter(
                        (b) => b.concluida,
                      ).length
                      const pct =
                        total > 0 ? Math.round((feitas / total) * 100) : 0
                      return (
                        <div key={`bg-${checkboxes[0].id}`}>
                          {checkboxes.map((b) => (
                            <div key={`b-${b.id}`}>
                              <div className="flex items-center gap-2 py-1">
                                <button
                                  onClick={() => alternarBloco(b.id)}
                                  className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                    b.concluida
                                      ? "bg-[#1A56DB] border-[#1A56DB]"
                                      : "border-gray-300"
                                  }`}
                                  style={{ minWidth: 18 }}
                                >
                                  {b.concluida && <IconeConfirmar />}
                                </button>
                                <input
                                  id={`bloco-${b.id}`}
                                  type="text"
                                  value={b.texto}
                                  className={`flex-1 bg-transparent text-sm outline-none transition-colors ${
                                    b.concluida
                                      ? "line-through text-gray-500"
                                      : "text-gray-800"
                                  }`}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    const bid = b.id
                                    atualizarNota((prev) => ({
                                      ...prev,
                                      blocos: prev.blocos.map((x) =>
                                        x.id === bid ? { ...x, texto: val } : x,
                                      ),
                                    }))
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault()
                                      const currentVal = e.currentTarget.value
                                      const pos =
                                        e.currentTarget.selectionStart ??
                                        currentVal.length
                                      const antes = currentVal.slice(0, pos)
                                      const depois = currentVal.slice(pos)
                                      const newId = gerarProximoIdentificador()
                                      const bid = b.id
                                      atualizarNota((prev) => {
                                        const blocos2 = prev.blocos.map((x) =>
                                          x.id === bid
                                            ? { ...x, texto: antes }
                                            : x,
                                        )
                                        const idx2 = blocos2.findIndex(
                                          (x) => x.id === bid,
                                        )
                                        blocos2.splice(idx2 + 1, 0, {
                                          id: newId,
                                          tipo: "checkbox",
                                          texto: depois,
                                          concluida: false,
                                        })
                                        return { ...prev, blocos: blocos2 }
                                      })
                                      setTimeout(() => {
                                        ;(document.getElementById(
                                          `bloco-${newId}`,
                                        ) as HTMLInputElement)?.focus()
                                      }, 0)
                                    }
                                    if (
                                      e.key === "Backspace" &&
                                      e.currentTarget.value === ""
                                    ) {
                                      const bid = b.id
                                      atualizarNota((prev) => {
                                        const idx2 = prev.blocos.findIndex(
                                          (x) => x.id === bid,
                                        )
                                        if (idx2 > 0) {
                                          const prevBloco =
                                            prev.blocos[idx2 - 1]
                                          if (prevBloco.tipo === "texto") {
                                            setTimeout(() => {
                                              ;(document.getElementById(
                                                `bloco-${prevBloco.id}`,
                                              ) as HTMLInputElement)?.focus()
                                            }, 0)
                                            return {
                                              ...prev,
                                              blocos: prev.blocos.filter(
                                                (x) => x.id !== bid,
                                              ),
                                            }
                                          } else {
                                            setTimeout(() => {
                                              ;(document.getElementById(
                                                `bloco-${bid}`,
                                              ) as HTMLInputElement)?.focus()
                                            }, 0)
                                            return {
                                              ...prev,
                                              blocos: prev.blocos.map((x) =>
                                                x.id === bid
                                                  ? { ...x, tipo: "texto" }
                                                  : x,
                                              ),
                                            }
                                          }
                                        }
                                        return {
                                          ...prev,
                                          blocos: prev.blocos.map((x) =>
                                            x.id === bid
                                              ? { ...x, tipo: "texto" }
                                              : x,
                                          ),
                                        }
                                      })
                                    }
                                  }}
                                />
                                {/* Botão para abrir/fechar seletor de data */}
                                <button
                                  onPointerDown={() =>
                                    guardarSelecaoAntesDoRelogio(
                                      `bloco-${b.id}`,
                                    )
                                  }
                                  onClick={() => {
                                    const abrindoSeletor =
                                      blocoEditandoData !== b.id
                                    if (abrindoSeletor && !b.data) {
                                      const bid = b.id
                                      atualizarNota((prev) => ({
                                        ...prev,
                                        blocos: prev.blocos.map((x) =>
                                          x.id === bid
                                            ? {
                                                ...x,
                                                data: formatarDataIso(HOJE),
                                              }
                                            : x,
                                        ),
                                      }))
                                    }
                                    definirBlocoEditandoData(
                                      abrindoSeletor ? b.id : null,
                                    )
                                  }}
                                  className={`p-1 rounded-lg transition-colors shrink-0 ${
                                    b.data
                                      ? "text-[#3B82F6]"
                                      : "text-gray-500 hover:text-gray-600"
                                  }`}
                                  title="Definir data"
                                >
                                  <IconeRelogio tamanho={13} />
                                </button>
                              </div>
                              {/* Tag de data (quando definida e não editando) */}
                              {b.data && blocoEditandoData !== b.id && (
                                <div className="flex items-center gap-1 ml-7 mb-1">
                                  <span className="text-[10px] text-[#3B82F6] font-medium bg-[#EFF6FF] px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <IconeRelogio tamanho={9} />
                                    {formatarDataTarefa(b.data, b.hora)}
                                  </span>
                                  <button
                                    onClick={() => {
                                      const bid = b.id
                                      atualizarNota((prev) => ({
                                        ...prev,
                                        blocos: prev.blocos.map((x) =>
                                          x.id === bid
                                            ? {
                                                ...x,
                                                data: undefined,
                                                hora: undefined,
                                              }
                                            : x,
                                        ),
                                      }))
                                    }}
                                    className="text-gray-500 hover:text-gray-500 transition-colors"
                                  >
                                    <IconeFechar />
                                  </button>
                                </div>
                              )}
                              {/* Seletor de data inline */}
                              {blocoEditandoData === b.id && (
                                <div className="ml-7 mb-2 p-3 bg-gray-50 rounded-2xl space-y-2">
                                  <div>
                                    <p className="text-[11px] text-gray-700 font-semibold mb-1">
                                      Data
                                    </p>
                                    <input
                                      type="date"
                                      value={b.data ?? ""}
                                      onChange={(e) => {
                                        const val = e.target.value
                                        const bid = b.id
                                        atualizarNota((prev) => ({
                                          ...prev,
                                          blocos: prev.blocos.map((x) =>
                                            x.id === bid
                                              ? { ...x, data: val || undefined }
                                              : x,
                                          ),
                                        }))
                                      }}
                                      className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-800 outline-none w-full"
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-gray-700 font-semibold mb-1">
                                      Horário (opcional)
                                    </p>
                                    <input
                                      type="time"
                                      value={b.hora ?? ""}
                                      onChange={(e) => {
                                        const val = e.target.value
                                        const bid = b.id
                                        atualizarNota((prev) => ({
                                          ...prev,
                                          blocos: prev.blocos.map((x) =>
                                            x.id === bid
                                              ? { ...x, hora: val || undefined }
                                              : x,
                                          ),
                                        }))
                                      }}
                                      className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-800 outline-none w-full"
                                    />
                                  </div>
                                  <button
                                    onClick={() =>
                                      confirmarDataEVoltarAoTexto(
                                        `bloco-${b.id}`,
                                      )
                                    }
                                    className="w-full py-1.5 text-xs font-semibold bg-[#1A56DB] text-white rounded-xl"
                                  >
                                    Confirmar
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                          {total > 0 && (
                            <div className="mt-1 mb-2">
                              <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mb-1">
                                <div
                                  className="h-full bg-[#1A56DB] rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className="text-[10px] text-gray-600">
                                {feitas} de {total} concluídas
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    }
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ MODAL NOVA NOTA ══════════════ */}
        {modalNovaNotaAberta && (
          <div
            className="fixed inset-0 bg-black/50 z-20 flex items-end justify-center sheet-backdrop sheet-backdrop-com-teclado"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                definirModalNovaNotaAberta(false)
                definirBlocoEditandoData(null)
              }
            }}
          >
            <div
              className="sheet-panel sheet-panel-com-teclado w-full max-w-sm bg-white rounded-t-3xl flex flex-col"
              style={{ maxHeight: "94dvh" }}
            >
              <div className="flex-shrink-0 flex items-center justify-between px-5 pt-5 pb-3">
                <button
                  onClick={() => {
                    definirModalNovaNotaAberta(false)
                    definirBlocoEditandoData(null)
                  }}
                  aria-label="Fechar"
                  className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <IconeFechar />
                </button>
                <h2 className="text-base font-semibold text-gray-900">
                  Nova nota
                </h2>
                <div className="w-8" />
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
                {/* Título */}
                <input
                  ref={campoTituloNovaNotaRef}
                  type="text"
                  autoFocus
                  value={tituloNovaNota}
                  onChange={(e) => definirTituloNovaNota(e.target.value)}
                  placeholder="Título"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      const firstBlocoId = blocosNovaNota[0]?.id
                      if (firstBlocoId)
                        (document.getElementById(
                          `nb-${firstBlocoId}`,
                        ) as HTMLInputElement)?.focus()
                    }
                  }}
                  className="w-full text-xl font-bold text-gray-950 outline-none placeholder:text-gray-200 bg-transparent"
                />

                {/* Block editor */}
                <div className="space-y-0.5">
                  {agruparBlocosDeNota(blocosNovaNota).map((grupo) => {
                    if (grupo.tipo === "texto") {
                      const bloco = grupo.bloco
                      const isFirst = blocosNovaNota[0]?.id === bloco.id
                      return (
                        <input
                          key={`b-${bloco.id}`}
                          id={`nb-${bloco.id}`}
                          type="text"
                          value={bloco.texto}
                          placeholder={
                            isFirst && blocosNovaNota.length === 1
                              ? "Escreva algo…"
                              : undefined
                          }
                          className="bg-transparent text-sm text-gray-600 outline-none w-full placeholder:text-gray-500"
                          onChange={(e) => {
                            const val = e.target.value
                            if (val.includes("[]")) {
                              const idx2 = val.indexOf("[]")
                              const antes = val.slice(0, idx2)
                              const depois = val.slice(idx2 + 2)
                              const newId = gerarProximoIdentificador()
                              const blocos2 = blocosNovaNota.map((b) =>
                                b.id === bloco.id ? { ...b, texto: antes } : b,
                              )
                              const pos2 = blocos2.findIndex(
                                (b) => b.id === bloco.id,
                              )
                              blocos2.splice(pos2 + 1, 0, {
                                id: newId,
                                tipo: "checkbox",
                                texto: depois,
                                concluida: false,
                              })
                              definirBlocosNovaNota(blocos2)
                              setTimeout(() => {
                                ;(document.getElementById(
                                  `nb-${newId}`,
                                ) as HTMLInputElement)?.focus()
                              }, 0)
                            } else {
                              definirBlocosNovaNota((prev) =>
                                prev.map((b) =>
                                  b.id === bloco.id ? { ...b, texto: val } : b,
                                ),
                              )
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              const currentVal = e.currentTarget.value
                              const pos =
                                e.currentTarget.selectionStart ??
                                currentVal.length
                              const antes = currentVal.slice(0, pos)
                              const depois = currentVal.slice(pos)
                              const newId = gerarProximoIdentificador()
                              const bid = bloco.id
                              definirBlocosNovaNota((prev) => {
                                const blocos2 = prev.map((b) =>
                                  b.id === bid ? { ...b, texto: antes } : b,
                                )
                                const idx2 = blocos2.findIndex(
                                  (b) => b.id === bid,
                                )
                                blocos2.splice(idx2 + 1, 0, {
                                  id: newId,
                                  tipo: "texto",
                                  texto: depois,
                                  concluida: false,
                                })
                                return blocos2
                              })
                              setTimeout(() => {
                                ;(document.getElementById(
                                  `nb-${newId}`,
                                ) as HTMLInputElement)?.focus()
                              }, 0)
                            }
                            if (
                              e.key === "Backspace" &&
                              e.currentTarget.value === ""
                            ) {
                              const bid = bloco.id
                              definirBlocosNovaNota((prev) => {
                                const idx2 = prev.findIndex((b) => b.id === bid)
                                if (idx2 > 0) {
                                  const prevBloco = prev[idx2 - 1]
                                  setTimeout(() => {
                                    ;(document.getElementById(
                                      `nb-${prevBloco.id}`,
                                    ) as HTMLInputElement)?.focus()
                                  }, 0)
                                  return prev.filter((b) => b.id !== bid)
                                }
                                return prev
                              })
                            }
                          }}
                        />
                      )
                    } else {
                      const checkboxes = grupo.blocos
                      const total = checkboxes.length
                      const feitas = checkboxes.filter(
                        (b) => b.concluida,
                      ).length
                      const pct =
                        total > 0 ? Math.round((feitas / total) * 100) : 0
                      return (
                        <div key={`bg-${checkboxes[0].id}`}>
                          {checkboxes.map((b) => (
                            <div key={`b-${b.id}`}>
                              <div className="flex items-center gap-2 py-1">
                                <button
                                  onClick={() =>
                                    atualizarBlocoDaNovaNota(b.id, {
                                      concluida: !b.concluida,
                                    })
                                  }
                                  className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                    b.concluida
                                      ? "bg-[#1A56DB] border-[#1A56DB]"
                                      : "border-gray-300"
                                  }`}
                                  style={{ minWidth: 18 }}
                                >
                                  {b.concluida && <IconeConfirmar />}
                                </button>
                                <input
                                  id={`nb-${b.id}`}
                                  type="text"
                                  value={b.texto}
                                  className={`flex-1 bg-transparent text-sm outline-none transition-colors ${
                                    b.concluida
                                      ? "line-through text-gray-500"
                                      : "text-gray-800"
                                  }`}
                                  onChange={(e) =>
                                    atualizarBlocoDaNovaNota(b.id, {
                                      texto: e.target.value,
                                    })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault()
                                      const currentVal = e.currentTarget.value
                                      const pos =
                                        e.currentTarget.selectionStart ??
                                        currentVal.length
                                      const antes = currentVal.slice(0, pos)
                                      const depois = currentVal.slice(pos)
                                      const newId = gerarProximoIdentificador()
                                      const bid = b.id
                                      definirBlocosNovaNota((prev) => {
                                        const blocos2 = prev.map((x) =>
                                          x.id === bid
                                            ? { ...x, texto: antes }
                                            : x,
                                        )
                                        const idx2 = blocos2.findIndex(
                                          (x) => x.id === bid,
                                        )
                                        blocos2.splice(idx2 + 1, 0, {
                                          id: newId,
                                          tipo: "checkbox",
                                          texto: depois,
                                          concluida: false,
                                        })
                                        return blocos2
                                      })
                                      setTimeout(() => {
                                        ;(document.getElementById(
                                          `nb-${newId}`,
                                        ) as HTMLInputElement)?.focus()
                                      }, 0)
                                    }
                                    if (
                                      e.key === "Backspace" &&
                                      e.currentTarget.value === ""
                                    ) {
                                      const bid = b.id
                                      definirBlocosNovaNota((prev) => {
                                        const idx2 = prev.findIndex(
                                          (x) => x.id === bid,
                                        )
                                        if (idx2 > 0) {
                                          const prevBloco = prev[idx2 - 1]
                                          if (prevBloco.tipo === "texto") {
                                            setTimeout(() => {
                                              ;(document.getElementById(
                                                `nb-${prevBloco.id}`,
                                              ) as HTMLInputElement)?.focus()
                                            }, 0)
                                            return prev.filter(
                                              (x) => x.id !== bid,
                                            )
                                          } else {
                                            setTimeout(() => {
                                              ;(document.getElementById(
                                                `nb-${bid}`,
                                              ) as HTMLInputElement)?.focus()
                                            }, 0)
                                            return prev.map((x) =>
                                              x.id === bid
                                                ? { ...x, tipo: "texto" }
                                                : x,
                                            )
                                          }
                                        }
                                        return prev.map((x) =>
                                          x.id === bid
                                            ? { ...x, tipo: "texto" }
                                            : x,
                                        )
                                      })
                                    }
                                  }}
                                />
                                <button
                                  onPointerDown={() =>
                                    guardarSelecaoAntesDoRelogio(`nb-${b.id}`)
                                  }
                                  onClick={() => {
                                    const abrindoSeletor =
                                      blocoEditandoData !== b.id
                                    if (abrindoSeletor && !b.data)
                                      atualizarBlocoDaNovaNota(b.id, {
                                        data: formatarDataIso(HOJE),
                                      })
                                    definirBlocoEditandoData(
                                      abrindoSeletor ? b.id : null,
                                    )
                                  }}
                                  className={`p-1 rounded-lg transition-colors shrink-0 ${
                                    b.data
                                      ? "text-[#3B82F6]"
                                      : "text-gray-500 hover:text-gray-600"
                                  }`}
                                  aria-label="Definir data e horário"
                                >
                                  <IconeRelogio tamanho={13} />
                                </button>
                              </div>
                              {b.data && blocoEditandoData !== b.id && (
                                <div className="flex items-center gap-1 ml-7 mb-1">
                                  <span className="text-[10px] text-[#3B82F6] font-medium bg-[#EFF6FF] px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <IconeRelogio tamanho={9} />
                                    {formatarDataTarefa(b.data, b.hora)}
                                  </span>
                                  <button
                                    onClick={() =>
                                      atualizarBlocoDaNovaNota(b.id, {
                                        data: undefined,
                                        hora: undefined,
                                      })
                                    }
                                    className="text-gray-500 hover:text-gray-600 transition-colors"
                                    aria-label="Remover data e horário"
                                  >
                                    <IconeFechar />
                                  </button>
                                </div>
                              )}
                              {blocoEditandoData === b.id && (
                                <div className="ml-7 mb-2 p-3 bg-gray-50 rounded-2xl space-y-2">
                                  <div>
                                    <p className="text-[11px] text-gray-700 font-semibold mb-1">
                                      Data
                                    </p>
                                    <input
                                      type="date"
                                      value={b.data ?? ""}
                                      onChange={(e) =>
                                        atualizarBlocoDaNovaNota(b.id, {
                                          data: e.target.value || undefined,
                                        })
                                      }
                                      className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-800 outline-none w-full"
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[11px] text-gray-700 font-semibold mb-1">
                                      Horário (opcional)
                                    </p>
                                    <input
                                      type="time"
                                      value={b.hora ?? ""}
                                      onChange={(e) =>
                                        atualizarBlocoDaNovaNota(b.id, {
                                          hora: e.target.value || undefined,
                                        })
                                      }
                                      className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-800 outline-none w-full"
                                    />
                                  </div>
                                  <button
                                    onClick={() =>
                                      confirmarDataEVoltarAoTexto(`nb-${b.id}`)
                                    }
                                    className="w-full py-1.5 text-xs font-semibold bg-[#1A56DB] text-white rounded-xl"
                                  >
                                    Confirmar
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                          {total > 0 && (
                            <div className="mt-1 mb-2">
                              <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mb-1">
                                <div
                                  className="h-full bg-[#1A56DB] rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className="text-[10px] text-gray-600">
                                {feitas} de {total} concluídas
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    }
                  })}
                </div>

                {/* Fixar */}
                <button
                  onClick={() => definirNovaNotaFixada((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3.5 border border-gray-100 rounded-2xl"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={
                        novaNotaFixada ? "text-gray-900" : "text-gray-600"
                      }
                    >
                      <IconeAlfinete ativo={novaNotaFixada} />
                    </span>
                    <p className="text-sm font-semibold text-gray-900">
                      Fixar nota
                    </p>
                  </div>
                  <div
                    className={`w-10 h-6 rounded-full transition-colors relative ${
                      novaNotaFixada ? "bg-[#1A56DB]" : "bg-gray-200"
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                        novaNotaFixada ? "left-5" : "left-1"
                      }`}
                    />
                  </div>
                </button>

                <button
                  onClick={salvarNota}
                  className="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-sm hover:bg-gray-800 transition-colors"
                >
                  Salvar nota
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ MODAL NOVA META ══════════════ */}
        {modalNovaMetaAberta && (
          <div
            className="fixed inset-0 bg-black/50 z-20 flex items-end justify-center sheet-backdrop sheet-backdrop-com-teclado"
            onClick={(e) => {
              if (e.target === e.currentTarget)
                definirModalNovaMetaAberta(false)
            }}
          >
            <div className="sheet-panel sheet-panel-com-teclado w-full max-w-sm bg-white rounded-t-3xl p-5 max-h-[94dvh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => definirModalNovaMetaAberta(false)}
                  aria-label="Fechar"
                  className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <IconeFechar />
                </button>
                <h2 className="text-base font-semibold text-gray-900">
                  Nova meta
                </h2>
                <div className="w-8" />
              </div>

              <div className="space-y-4">
                {/* Nome */}
                <div className="bg-gray-100 rounded-2xl px-4 py-3.5">
                  <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-1">
                    Nome da meta
                  </p>
                  <input
                    ref={campoNomeNovaMetaRef}
                    type="text"
                    autoFocus
                    value={nomeNovaMeta}
                    onChange={(e) => definirNomeNovaMeta(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && salvarMeta()}
                    placeholder="Ex: Parei de fumar"
                    className="w-full bg-transparent text-sm font-medium outline-none text-gray-900 placeholder:text-gray-500"
                  />
                </div>

                {/* Data e hora de início */}
                <div className="bg-gray-100 rounded-2xl px-4 py-3.5">
                  <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-2">
                    Início
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="date"
                      value={dataNovaMeta}
                      onChange={(e) => definirDataNovaMeta(e.target.value)}
                      className="flex-1 bg-transparent text-sm font-medium outline-none text-gray-900"
                    />
                    <input
                      type="time"
                      value={horaNovaMeta}
                      onChange={(e) => definirHoraNovaMeta(e.target.value)}
                      className="bg-transparent text-sm font-medium outline-none text-gray-900"
                    />
                  </div>
                </div>

                {/* Impacto financeiro toggle */}
                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => definirImpactoNovaMeta((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3.5"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900 text-left">
                        Impacto financeiro
                      </p>
                      <p className="text-[10px] text-gray-600 text-left">
                        Vincular a uma despesa e estimar economia
                      </p>
                    </div>
                    <div
                      className={`w-10 h-6 rounded-full transition-colors relative ${
                        impactoNovaMeta ? "bg-[#1A56DB]" : "bg-gray-200"
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                          impactoNovaMeta ? "left-5" : "left-1"
                        }`}
                      />
                    </div>
                  </button>
                  {impactoNovaMeta && (
                    <div className="border-t border-gray-100 p-4 space-y-3">
                      <div className="bg-gray-100 rounded-xl px-3 py-2.5">
                        <p className="text-[11px] text-gray-700 font-semibold mb-1">
                          Despesa vinculada
                        </p>
                        <input
                          type="text"
                          value={despesaNovaMeta}
                          onChange={(e) => {
                            definirDespesaNovaMeta(e.target.value)
                            // auto-fill valor médio from despesas history
                            const ref = despesas.filter(
                              (d) =>
                                d.nome.toLowerCase() ===
                                e.target.value.toLowerCase(),
                            )
                            if (ref.length > 0) {
                              const avg =
                                ref.reduce((a, d) => a + d.valor, 0) /
                                ref.length
                              definirValorNovaMeta(avg.toFixed(2))
                            }
                          }}
                          placeholder="Nome da despesa (ex: Cerveja)"
                          className="w-full bg-transparent text-sm font-medium outline-none text-gray-900 placeholder:text-gray-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-gray-100 rounded-xl px-3 py-2.5">
                          <p className="text-[11px] text-gray-700 font-semibold mb-1">
                            Valor médio (R$)
                          </p>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={valorNovaMeta}
                            onChange={(e) =>
                              definirValorNovaMeta(e.target.value)
                            }
                            placeholder="0,00"
                            className="w-full bg-transparent text-sm font-medium outline-none text-gray-900 placeholder:text-gray-500"
                          />
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-xl px-3 py-2.5">
                          <p className="text-[11px] text-gray-700 font-semibold mb-1">
                            Frequência (×/mês)
                          </p>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={frequenciaNovaMeta}
                            onChange={(e) =>
                              definirFrequenciaNovaMeta(e.target.value)
                            }
                            placeholder="0"
                            className="w-full bg-transparent text-sm font-medium outline-none text-gray-900 placeholder:text-gray-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={salvarMeta}
                  disabled={!nomeNovaMeta.trim()}
                  className="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-sm hover:bg-gray-800 transition-colors disabled:opacity-40"
                >
                  Criar meta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ MODAL EDITAR META ══════════════ */}
        {modalEdicaoMetaAberta && metaParaEditar && (
          <div
            className="fixed inset-0 bg-black/50 z-20 flex items-end justify-center sheet-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                definirModalEdicaoMetaAberta(false)
                definirMetaParaEditar(null)
              }
            }}
          >
            <div className="sheet-panel w-full max-w-sm bg-white rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => {
                    definirModalEdicaoMetaAberta(false)
                    definirMetaParaEditar(null)
                  }}
                  aria-label="Fechar"
                  className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <IconeFechar />
                </button>
                <h2 className="text-base font-semibold text-gray-900">
                  Editar meta
                </h2>
                <div className="w-8" />
              </div>
              <div className="space-y-4">
                <div className="bg-gray-100 rounded-2xl px-4 py-3.5">
                  <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-1">
                    Nome da meta
                  </p>
                  <input
                    type="text"
                    value={nomeMetaEmEdicao}
                    onChange={(e) => definirNomeMetaEmEdicao(e.target.value)}
                    className="w-full bg-transparent text-sm font-medium outline-none text-gray-900"
                  />
                </div>
                <div className="bg-gray-100 rounded-2xl px-4 py-3.5">
                  <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-2">
                    Início
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="date"
                      value={dataMetaEmEdicao}
                      onChange={(e) => definirDataMetaEmEdicao(e.target.value)}
                      className="flex-1 bg-transparent text-sm font-medium outline-none text-gray-900"
                    />
                    <input
                      type="time"
                      value={horaMetaEmEdicao}
                      onChange={(e) => definirHoraMetaEmEdicao(e.target.value)}
                      className="bg-transparent text-sm font-medium outline-none text-gray-900"
                    />
                  </div>
                </div>
                {/* Impacto financeiro toggle */}
                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => definirImpactoMetaEmEdicao((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3.5"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900 text-left">
                        Impacto financeiro
                      </p>
                      <p className="text-[10px] text-gray-600 text-left">
                        Vincular a uma despesa e estimar economia
                      </p>
                    </div>
                    <div
                      className={`w-10 h-6 rounded-full transition-colors relative ${
                        impactoMetaEmEdicao ? "bg-[#1A56DB]" : "bg-gray-200"
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                          impactoMetaEmEdicao ? "left-5" : "left-1"
                        }`}
                      />
                    </div>
                  </button>
                  {impactoMetaEmEdicao && (
                    <div className="border-t border-gray-100 p-4 space-y-3">
                      <div className="bg-gray-100 rounded-xl px-3 py-2.5">
                        <p className="text-[11px] text-gray-700 font-semibold mb-1">
                          Despesa vinculada
                        </p>
                        <input
                          type="text"
                          value={despesaMetaEmEdicao}
                          onChange={(e) => {
                            definirDespesaMetaEmEdicao(e.target.value)
                            const ref = despesas.filter(
                              (d) =>
                                d.nome.toLowerCase() ===
                                e.target.value.toLowerCase(),
                            )
                            if (ref.length > 0) {
                              const avg =
                                ref.reduce((a, d) => a + d.valor, 0) /
                                ref.length
                              definirValorMetaEmEdicao(avg.toFixed(2))
                            }
                          }}
                          placeholder="Nome da despesa"
                          className="w-full bg-transparent text-sm font-medium outline-none text-gray-900 placeholder:text-gray-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-gray-100 rounded-xl px-3 py-2.5">
                          <p className="text-[11px] text-gray-700 font-semibold mb-1">
                            Valor médio (R$)
                          </p>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={valorMetaEmEdicao}
                            onChange={(e) =>
                              definirValorMetaEmEdicao(e.target.value)
                            }
                            className="w-full bg-transparent text-sm font-medium outline-none text-gray-900"
                          />
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-xl px-3 py-2.5">
                          <p className="text-[11px] text-gray-700 font-semibold mb-1">
                            Frequência (×/mês)
                          </p>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={frequenciaMetaEmEdicao}
                            onChange={(e) =>
                              definirFrequenciaMetaEmEdicao(e.target.value)
                            }
                            className="w-full bg-transparent text-sm font-medium outline-none text-gray-900"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={salvarEditarMeta}
                  disabled={!nomeMetaEmEdicao.trim()}
                  className="w-full py-3.5 bg-black text-white font-semibold rounded-2xl text-sm hover:bg-gray-800 transition-colors disabled:opacity-40"
                >
                  Salvar alterações
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ MODAL QUEBRA DE META ══════════════ */}
        {informacoesQuebraMeta && (
          <div className="fixed inset-0 bg-black/60 z-30 flex items-center justify-center px-5">
            <div className="w-full max-w-sm bg-white rounded-3xl p-6">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-4 mx-auto">
                <IconeMeta />
              </div>
              <h2 className="text-base font-bold text-gray-950 text-center mb-1">
                Despesa relacionada a uma meta
              </h2>
              <p className="text-sm text-gray-500 text-center mb-6">
                Esta despesa está vinculada à sua meta{" "}
                <strong className="text-gray-900">
                  "{informacoesQuebraMeta.meta.nome}"
                </strong>
                .
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => reiniciarMeta(informacoesQuebraMeta.meta.id)}
                  className="w-full py-3 bg-black text-white font-semibold rounded-2xl text-sm hover:bg-gray-800 transition-colors"
                >
                  Registrar a quebra da meta e reiniciá-la.
                </button>
                <button
                  onClick={() => definirInformacoesQuebraMeta(null)}
                  className="w-full py-3 text-gray-500 font-semibold rounded-2xl text-sm hover:bg-gray-50 transition-colors"
                >
                  Ignorar — manter meta intacta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ MODAL NOVA DESPESA ══════════════ */}
        {modalDespesaAberto && (
          <div
            className="fixed inset-0 bg-black/50 z-20 flex items-end justify-center sheet-backdrop sheet-backdrop-com-teclado"
            onClick={(e) => {
              if (e.target === e.currentTarget) fecharModal()
            }}
          >
            <div className="sheet-panel sheet-panel-com-teclado w-full max-w-sm bg-white rounded-t-3xl p-5 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={fecharModal}
                  aria-label="Fechar"
                  className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <IconeFechar />
                </button>
                <div className="text-center">
                  <h2 className="text-base font-semibold text-gray-900">
                    Nova despesa
                  </h2>
                  <label className="relative mt-0.5 inline-flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs text-[#1A56DB] transition-colors hover:bg-blue-50">
                    <span>
                      {DIAS_SEMANA_ABREVIADOS[dataDaNovaDespesa.getDay()]},{" "}
                      {dataDaNovaDespesa.getDate()} de{" "}
                      {MESES_POR_EXTENSO[dataDaNovaDespesa.getMonth()]}
                    </span>
                    <IconeEditar />
                    <input
                      type="date"
                      value={dataDespesa}
                      onChange={(e) => {
                        if (e.target.value) {
                          definirDataDespesa(e.target.value)
                          definirErroNovaDespesa("")
                        }
                      }}
                      aria-label="Data da despesa"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
                <button
                  onClick={salvarDespesa}
                  className="text-gray-900 hover:text-black transition-colors"
                >
                  <IconeConfirmar />
                </button>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <input
                    ref={campoNomeNovaDespesaRef}
                    type="text"
                    placeholder="Nome da despesa"
                    value={nomeDespesa}
                    onChange={(e) => aoDigitarNome(e.target.value)}
                    onFocus={() =>
                      definirSugestoes(obterSugestoesRecentes(nomeDespesa))
                    }
                    aria-describedby={
                      erroNovaDespesa ? "erro-nova-despesa" : undefined
                    }
                    autoFocus
                    className="w-full px-4 py-3.5 bg-gray-100 rounded-2xl text-sm outline-none placeholder-gray-400 font-medium"
                  />
                  {sugestoes.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-100 rounded-2xl shadow-xl mt-1.5 overflow-hidden z-30">
                      {sugestoes.slice(0, 4).map((s) => {
                        const chave = normalizarNome(s)
                        const prev = despesasPrevistas.find(
                          (p) => normalizarNome(p.nome) === chave,
                        )
                        const ref = [...despesas]
                          .filter((d) => normalizarNome(d.nome) === chave)
                          .sort(
                            (a, b) =>
                              b.data.localeCompare(a.data) ||
                              Number(b.id) - Number(a.id),
                          )[0]
                        const valorExibido = prev?.valor ?? ref?.valor
                        const pagamentoExibido =
                          prev?.pagamento ?? ref?.pagamento
                        const pagExibido = pagamentoExibido
                          ? (prev?.cartaoNome ??
                            ref?.cartaoNome ??
                            ROTULOS_PAGAMENTO[pagamentoExibido])
                          : null
                        return (
                          <button
                            key={s}
                            onClick={() => selecionarSugestao(s)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 text-left"
                          >
                            <div>
                              <span className="text-sm font-semibold text-gray-900">
                                {s}
                              </span>
                              <p className="text-xs text-gray-600">
                                {valorExibido != null &&
                                  formatarMoeda(valorExibido)}
                                {pagExibido && ` · ${pagExibido}`}
                                {prev && (
                                  <span className="text-gray-500">
                                    {" "}
                                    · {ROTULOS_RECORRENCIA[prev.recorrencia]}
                                  </span>
                                )}
                              </p>
                            </div>
                            {prev && (
                              <span className="text-xs text-orange-600 font-medium shrink-0 ml-2">
                                padrão
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-3.5 gap-2">
                  <span className="text-sm text-gray-500 font-semibold">
                    R$
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={valorDespesa}
                    onChange={(e) => {
                      definirValorDespesa(e.target.value)
                      definirErroNovaDespesa("")
                    }}
                    className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400 font-medium"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-2">
                    Pagamento
                  </p>
                  <div className="flex gap-2">
                    {pagamentosDisponiveis.map((p) => (
                      <button
                        key={p}
                        onClick={() => aoSelecionarPagamento(p)}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                          pagamento === p
                            ? "bg-black text-white"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {ROTULOS_PAGAMENTO[p]}
                      </button>
                    ))}
                  </div>
                  {pagamento === "cartao" && cartoes.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {cartoes.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            definirCartaoSelecionado(c.id)
                            definirErroNovaDespesa("")
                          }}
                          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all ${
                            cartaoSelecionado === c.id
                              ? "bg-[#1A56DB] text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          <span className="text-base">💳</span>
                          <span className="text-sm font-medium truncate flex-1">
                            {c.nome}
                          </span>
                          {cartaoSelecionado === c.id && (
                            <span className="ml-auto shrink-0">
                              <IconeConfirmar />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {padraoSelecionado ? (
                  <div>
                    <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-2">
                      Como registrar
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={previsaoDoPadraoSelecionadoFoiConcluida}
                        onClick={() => {
                          definirRecorrencia(padraoSelecionado.recorrencia)
                          if (padraoSelecionado.recorrencia === "personalizada")
                            definirOcorrenciasPersonalizadas(
                              String(
                                obterTotalPrevistoNoCiclo(
                                  padraoSelecionado,
                                  quantidadeDiasDoCiclo,
                                ),
                              ),
                            )
                          definirErroNovaDespesa("")
                        }}
                        className={`rounded-xl px-3 py-3 text-left transition-all ${
                          previsaoDoPadraoSelecionadoFoiConcluida
                            ? "cursor-not-allowed bg-gray-100 text-gray-400 opacity-60"
                            : recorrencia === padraoSelecionado.recorrencia
                              ? "bg-black text-white"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <span className="block text-xs font-bold">Padrão</span>
                        <span className="mt-0.5 block text-[10px] opacity-75">
                          {ROTULOS_RECORRENCIA[padraoSelecionado.recorrencia]}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          definirRecorrencia("avulsa")
                          definirErroNovaDespesa("")
                        }}
                        className={`rounded-xl px-3 py-3 text-left transition-all ${
                          recorrencia === "avulsa"
                            ? "bg-black text-white"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <span className="block text-xs font-bold">Avulsa</span>
                        <span className="mt-0.5 block text-[10px] opacity-75">
                          gasto extra
                        </span>
                      </button>
                    </div>
                    <p className="mt-2 px-1 text-[10px] leading-relaxed text-gray-600">
                      {previsaoDoPadraoSelecionadoFoiConcluida ? (
                        <>
                          Todas as ocorrências de gasto previstas para este
                          ciclo já foram registradas. Esta despesa será
                          registrada como extra.
                        </>
                      ) : (
                        <>
                          Para alterar a recorrência principal, edite o padrão
                          em{" "}
                          <span className="font-semibold">
                            Insights → Projeção
                          </span>
                          .
                        </>
                      )}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-2">
                      Recorrência
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {([
                        "avulsa",
                        "diaria",
                        "semanal",
                        "mensal",
                        "personalizada",
                      ] as TipoRecorrencia[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => {
                            definirRecorrencia(r)
                            definirErroNovaDespesa("")
                          }}
                          className={`px-3.5 py-2 text-sm font-semibold rounded-xl transition-all ${
                            recorrencia === r
                              ? "bg-black text-white"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {ROTULOS_RECORRENCIA[r]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!padraoSelecionado && recorrencia === "personalizada" && (
                  <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-3.5 gap-2">
                    <span className="text-sm text-gray-600 font-medium flex-1">
                      Quantas vezes no ciclo?
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={ocorrenciasPersonalizadas}
                      onChange={(e) => {
                        definirOcorrenciasPersonalizadas(e.target.value)
                        definirErroNovaDespesa("")
                      }}
                      className="w-14 bg-transparent text-sm outline-none text-right font-bold text-gray-900"
                    />
                  </div>
                )}
                {resumoDoPadraoSelecionado && (
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                    <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
                      Resumo da despesa
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="min-h-[62px] rounded-xl bg-white px-2 py-2.5 text-center">
                        <p className="text-[9px] leading-tight text-gray-500">
                          Previsão do ciclo
                        </p>
                        <p className="mt-1 text-xs font-extrabold text-[#1A56DB]">
                          {formatarMoeda(
                            resumoDoPadraoSelecionado.previsaoDoCiclo,
                          )}
                        </p>
                      </div>
                      <div className="min-h-[62px] rounded-xl bg-white px-2 py-2.5 text-center">
                        <p className="text-[9px] leading-tight text-gray-500">
                          Já gasto
                        </p>
                        <p
                          className={`mt-1 text-xs font-extrabold ${
                            resumoDoPadraoSelecionado.gastoNoCiclo <
                            resumoDoPadraoSelecionado.previsaoDoCiclo
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {formatarMoeda(
                            resumoDoPadraoSelecionado.gastoNoCiclo,
                          )}
                        </p>
                      </div>
                      <div className="min-h-[62px] rounded-xl bg-white px-2 py-2.5 text-center">
                        <p className="text-[9px] leading-tight text-gray-500">
                          Ainda previsto
                        </p>
                        <p className="mt-1 text-xs font-extrabold text-orange-600">
                          {formatarMoeda(
                            resumoDoPadraoSelecionado.aindaPrevisto,
                          )}
                        </p>
                      </div>
                      <div className="min-h-[62px] rounded-xl bg-white px-2 py-2.5 text-center">
                        <p className="text-[9px] leading-tight text-gray-500">
                          Após esta despesa
                        </p>
                        <p
                          className={`mt-1 text-xs font-extrabold ${
                            resumoDoPadraoSelecionado.gastoComNovaDespesa <
                            resumoDoPadraoSelecionado.previsaoDoCiclo
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {formatarMoeda(
                            resumoDoPadraoSelecionado.gastoComNovaDespesa,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {!padraoSelecionado &&
                  recorrencia !== "avulsa" &&
                  valorProjecaoDaDespesa > 0 && (
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                      <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-1">
                        Projeção até dia {diaFechamento}
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatarMoeda(valorProjecaoDaDespesa)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {recorrencia === "diaria" &&
                          `${periodoFinanceiroAtual.diasRestantes} ocorrências previstas`}
                        {recorrencia === "semanal" &&
                          `${Math.ceil(periodoFinanceiroAtual.diasRestantes / 7)} ocorrências previstas`}
                        {recorrencia === "mensal" && "1 ocorrência prevista"}
                        {recorrencia === "personalizada" &&
                          `${ocorrenciasPersonalizadas} ocorrência(s) prevista(s)`}
                      </p>
                    </div>
                  )}
                {erroNovaDespesa && (
                  <p
                    id="erro-nova-despesa"
                    role="alert"
                    className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                  >
                    {erroNovaDespesa}
                  </p>
                )}
                <button
                  onClick={salvarDespesa}
                  className="w-full py-4 bg-black text-white font-bold rounded-2xl mt-1 hover:bg-gray-900 transition-all active:scale-[0.98]"
                >
                  Salvar despesa
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ MODAL DETALHE / EDIÇÃO ══════════════ */}
        {despesaAberta && (
          <div
            className="fixed inset-0 bg-black/50 z-20 flex items-end justify-center sheet-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) definirDespesaAberta(null)
            }}
          >
            <div className="sheet-panel w-full max-w-sm bg-white rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto">
              {modoDetalhe === "ver" && (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <button
                      onClick={() => definirDespesaAberta(null)}
                      aria-label="Fechar"
                      className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <IconeFechar />
                    </button>
                    <h2 className="text-base font-semibold text-gray-900">
                      Detalhe
                    </h2>
                    <button
                      onClick={iniciarEdicao}
                      aria-label="Editar despesa"
                      className="text-gray-500 hover:text-gray-900 transition-colors p-2.5 rounded-xl hover:bg-gray-100"
                    >
                      <IconeEditar />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 mb-5 pb-5 border-b border-gray-100">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0 scale-150">
                      <IconePagamento tipo={despesaAberta.pagamento} />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">
                        {despesaAberta.nome}
                      </p>
                      <p className="text-2xl font-bold text-gray-900 mt-0.5">
                        {formatarMoeda(despesaAberta.valor)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 mb-6">
                    {[
                      {
                        label: "Data",
                        valor: (() => {
                          const d = new Date(despesaAberta.data + "T12:00:00")
                          return `${DIAS_SEMANA_ABREVIADOS[d.getDay()]}, ${d.getDate()} de ${MESES_POR_EXTENSO[d.getMonth()]}`
                        })(),
                      },
                      {
                        label: "Pagamento",
                        valor:
                          despesaAberta.cartaoNome ??
                          ROTULOS_PAGAMENTO[despesaAberta.pagamento],
                      },
                      {
                        label: "Recorrência",
                        valor: ROTULOS_RECORRENCIA[despesaAberta.recorrencia],
                      },
                    ].map(({ label, valor }) => (
                      <div
                        key={label}
                        className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                      >
                        <span className="text-xs text-gray-600 font-medium">
                          {label}
                        </span>
                        <span className="text-sm font-semibold text-gray-800">
                          {valor}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={excluirDespesa}
                      className="flex-1 py-3 border border-red-200 text-red-600 font-semibold rounded-2xl text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <IconeLixeira />
                      Excluir
                    </button>
                    <button
                      onClick={iniciarEdicao}
                      className="flex-1 py-3 bg-black text-white font-semibold rounded-2xl text-sm hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
                    >
                      <IconeEditar />
                      Editar
                    </button>
                  </div>
                </>
              )}
              {modoDetalhe === "editar" && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <button
                      onClick={() => definirModoDetalhe("ver")}
                      className="text-gray-600 hover:text-gray-700 transition-colors"
                    >
                      <IconeEsquerda />
                    </button>
                    <h2 className="text-base font-semibold text-gray-900">
                      Editar despesa
                    </h2>
                    <button
                      onClick={salvarEdicao}
                      className="text-gray-900 hover:text-black transition-colors"
                    >
                      <IconeConfirmar />
                    </button>
                  </div>
                  <div className="space-y-4">
                    {/* Nome vinculado ao padrão — não pode ser alterado aqui */}
                    <div className="space-y-0.5">
                      <div className="w-full px-4 py-3.5 bg-gray-50 border border-dashed border-gray-300 rounded-2xl text-sm font-semibold text-gray-700">
                        {despesaAberta.nome}
                      </div>
                      <p className="text-[11px] text-gray-600 px-1">
                        O nome vincula este registro ao padrão previsto e não
                        pode ser alterado.
                      </p>
                    </div>
                    <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-3.5 gap-2">
                      <span className="text-sm text-gray-500 font-semibold">
                        R$
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={valorEdicaoDespesa}
                        onChange={(e) =>
                          definirValorEdicaoDespesa(e.target.value)
                        }
                        className="flex-1 bg-transparent text-sm outline-none font-medium"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-2">
                        Pagamento
                      </p>
                      <div className="flex gap-2">
                        {pagamentosDisponiveis.map((p) => (
                          <button
                            key={p}
                            onClick={() => {
                              definirPagamentoEdicaoDespesa(p)
                              if (
                                p === "cartao" &&
                                cartoes.length > 0 &&
                                cartaoEdicaoDespesa == null
                              )
                                definirCartaoEdicaoDespesa(cartoes[0].id)
                            }}
                            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                              pagamentoEdicaoDespesa === p
                                ? "bg-black text-white"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}
                          >
                            {ROTULOS_PAGAMENTO[p]}
                          </button>
                        ))}
                      </div>
                      {pagamentoEdicaoDespesa === "cartao" &&
                        cartoes.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1.5">
                            {cartoes.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => definirCartaoEdicaoDespesa(c.id)}
                                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all ${
                                  cartaoEdicaoDespesa === c.id
                                    ? "bg-[#1A56DB] text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                }`}
                              >
                                <span className="text-base">💳</span>
                                <span className="text-sm font-medium truncate flex-1">
                                  {c.nome}
                                </span>
                                {cartaoEdicaoDespesa === c.id && (
                                  <span className="ml-auto shrink-0">
                                    <IconeConfirmar />
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 flex items-start gap-3">
                      <div className="flex-1">
                        <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-0.5">
                          Recorrência
                        </p>
                        <p className="text-sm font-semibold text-gray-700">
                          {ROTULOS_RECORRENCIA[despesaAberta.recorrencia]}
                        </p>
                      </div>
                      <p className="text-[10px] text-gray-600 leading-snug text-right max-w-[120px] mt-0.5">
                        Para alterar, edite o padrão em{" "}
                        <span className="font-semibold text-gray-600">
                          Insights → Projeção
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={salvarEdicao}
                      disabled={!valorEdicaoDespesa}
                      className="w-full py-4 bg-black text-white font-bold rounded-2xl disabled:opacity-30 hover:bg-gray-900 transition-all active:scale-[0.98]"
                    >
                      Salvar alterações
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ MODAL COMPARATIVO ══════════════ */}
        {comparativoAberto && (
          <div
            className="fixed inset-0 bg-black/50 z-20 flex items-end justify-center sheet-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) definirComparativoAberto(false)
            }}
          >
            <div className="sheet-panel w-full max-w-sm bg-white rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => definirComparativoAberto(false)}
                  aria-label="Fechar"
                  className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <IconeFechar />
                </button>
                <div className="text-center">
                  <h2 className="text-base font-semibold text-gray-900">
                    Comparativo da previsão de gastos
                  </h2>
                  <p className="text-xs text-gray-600">
                    {MESES_POR_EXTENSO[mesInsights.getMonth()]} · até hoje, dia{" "}
                    {HOJE.getDate()}
                  </p>
                </div>
                <div className="w-8" />
              </div>

              <div className="flex items-center justify-center gap-5 py-3 mb-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-gray-300" />
                  <span className="text-xs text-gray-500">Previsto</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="text-xs text-gray-500">Abaixo</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="text-xs text-gray-500">Acima</span>
                </div>
              </div>

              {comparativoItens.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-600">
                    Sem dados para comparar.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 mt-3">
                  {comparativoItens.map((item, i) => {
                    const acima = item.diff > 0
                    const abaixo = item.diff < 0
                    const maiorVal = Math.max(item.previsto, item.real, 1)
                    return (
                      <div
                        key={i}
                        className={`rounded-2xl p-4 border ${
                          acima
                            ? "border-red-100 bg-red-50/40"
                            : abaixo
                              ? "border-emerald-100 bg-emerald-50/30"
                              : "border-gray-100"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {item.nome}
                            </p>
                            <p className="text-[10px] text-gray-600 mt-0.5">
                              {item.rotuloRecorrencia}
                            </p>
                          </div>
                          <div
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              acima
                                ? "bg-red-100 text-red-600"
                                : abaixo
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {acima ? "↑" : abaixo ? "↓" : "="}{" "}
                            {formatarMoeda(Math.abs(item.diff))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-600 w-12 text-right shrink-0">
                              Previsto
                            </span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gray-300"
                                style={{
                                  width: `${(item.previsto / maiorVal) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-semibold text-gray-500 w-16 shrink-0 text-right">
                              {formatarMoeda(item.previsto)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-600 w-12 text-right shrink-0">
                              Real
                            </span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${(item.real / maiorVal) * 100}%`,
                                  backgroundColor: acima
                                    ? "#F87171"
                                    : abaixo
                                      ? "#34D399"
                                      : "#374151",
                                }}
                              />
                            </div>
                            <span
                              className={`text-[10px] font-bold w-16 shrink-0 text-right ${
                                acima
                                  ? "text-red-500"
                                  : abaixo
                                    ? "text-emerald-600"
                                    : "text-gray-700"
                              }`}
                            >
                              {formatarMoeda(item.real)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[10px] text-gray-600 mb-0.5">
                          Previsto total
                        </p>
                        <p className="text-sm font-bold text-gray-700">
                          {formatarMoeda(
                            comparativoItens.reduce(
                              (a, i) => a + i.previsto,
                              0,
                            ),
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-600 mb-0.5">
                          Gasto real
                        </p>
                        <p className="text-sm font-bold text-gray-900">
                          {formatarMoeda(gastoRealComparativo)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-600 mb-0.5">
                          Diferença
                        </p>
                        <p
                          className={`text-sm font-bold ${
                            diferencaPrevisao! > 0
                              ? "text-red-500"
                              : diferencaPrevisao! < 0
                                ? "text-emerald-600"
                                : "text-gray-500"
                          }`}
                        >
                          {diferencaPrevisao! > 0 ? "+" : ""}
                          {formatarMoeda(diferencaPrevisao ?? 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ MODAL PROJEÇÃO ══════════════ */}
        {projecaoAberta && (
          <div
            className="fixed inset-0 bg-black/50 z-20 flex items-end justify-center sheet-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                definirProjecaoAberta(false)
                definirIdentificadorPrevisaoEmEdicao(null)
              }
            }}
          >
            <div
              className="sheet-panel w-full max-w-sm bg-white rounded-t-3xl flex flex-col"
              style={{ maxHeight: "92dvh" }}
            >
              <div className="flex-shrink-0 px-5 pt-5 pb-0">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => {
                      definirProjecaoAberta(false)
                      definirIdentificadorPrevisaoEmEdicao(null)
                    }}
                    aria-label="Fechar"
                    className="p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <IconeFechar />
                  </button>
                  <div className="text-center">
                    <h2 className="text-base font-semibold text-gray-900">
                      Projeção — {MESES_POR_EXTENSO[mesInsights.getMonth()]}
                    </h2>
                    {statusPeriodo === "atual" && (
                      <p className="text-xs text-gray-600">
                        até dia {diaFechamento}
                      </p>
                    )}
                  </div>
                  <div className="w-8" />
                </div>
                <div className="flex items-center gap-4 mb-3 mt-3 px-1">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-3 rounded-[3px]"
                      style={{ backgroundColor: COR_UTILIZADA }}
                    />
                    <span className="text-xs text-gray-500 font-medium">
                      Já ocorreu
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-3 rounded-[3px]"
                      style={{ backgroundColor: COR_RESTANTE }}
                    />
                    <span className="text-xs text-gray-500 font-medium">
                      Previsto
                    </span>
                  </div>
                  <p className="ml-auto text-[10px] text-gray-600">
                    Edite o padrão aqui
                  </p>
                </div>
              </div>
              {/* fim header fixo */}
              <div className="flex-1 overflow-y-auto px-5 pb-8">
                {/* Cenário duplo — metas */}
                {metas.some((m) => m.valorMedio && m.frequenciaMensal) &&
                  (() => {
                    const economiaMetas = metas.reduce((acc, m) => {
                      if (!m.valorMedio || !m.frequenciaMensal) return acc
                      const mesesR =
                        periodoFinanceiroAtual.diasRestantes / 30.44
                      return (
                        acc +
                        Math.floor(mesesR * m.frequenciaMensal) * m.valorMedio
                      )
                    }, 0)
                    const projecaoNormal = gruposProjecao.reduce(
                      (a, g) => a + g.projecaoValor,
                      0,
                    )
                    if (economiaMetas <= 0) return null
                    const projecaoComMetas = Math.max(
                      projecaoNormal - economiaMetas,
                      0,
                    )
                    return (
                      <div className="border border-emerald-100 bg-emerald-50 rounded-2xl p-4 mb-4">
                        <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-widest mb-3">
                          Mantendo suas metas
                        </p>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-gray-500">
                              Projeção normal
                            </p>
                            <p className="text-sm font-bold text-gray-600">
                              {formatarMoeda(projecaoNormal)}
                            </p>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-gray-800 font-semibold">
                              Projeção com metas
                            </p>
                            <p className="text-sm font-bold text-gray-900">
                              {formatarMoeda(projecaoComMetas)}
                            </p>
                          </div>
                          <div className="border-t border-emerald-100 pt-2 flex justify-between items-center">
                            <p className="text-xs font-semibold text-emerald-700">
                              Economia potencial
                            </p>
                            <p className="text-sm font-bold text-emerald-700">
                              ≈ {formatarMoeda(economiaMetas)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                {gruposProjecao.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm text-gray-600">
                      Nenhuma despesa recorrente cadastrada.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {gruposProjecao.map((g) => (
                      <div
                        key={`g-${g.id}`}
                        className="border border-gray-100 rounded-2xl p-4"
                      >
                        {identificadorPrevisaoEmEdicao === g.id ? (
                          (() => {
                            const v =
                              parseFloat(
                                valorPrevisaoEmEdicao.replace(",", "."),
                              ) || 0
                            const customOcc = Math.max(
                              parseInt(ocorrenciasPersonalizadasPrevisao) || 1,
                              1,
                            )
                            const occ =
                              recorrenciaPrevisaoEmEdicao === "diaria"
                                ? quantidadeDiasDoCiclo
                                : recorrenciaPrevisaoEmEdicao === "semanal"
                                  ? Math.ceil(quantidadeDiasDoCiclo / 7)
                                  : recorrenciaPrevisaoEmEdicao === "mensal"
                                    ? 1
                                    : recorrenciaPrevisaoEmEdicao ===
                                        "personalizada"
                                      ? customOcc
                                      : 0
                            const padraoAtual = despesasPrevistas.find(
                              (padrao) => padrao.id === g.id,
                            )
                            const usadasNoPadraoEditado =
                              despesasDoPeriodoInsights.filter((despesa) =>
                                padraoAtual
                                  ? despesaPertenceAoPadrao(
                                      despesa,
                                      padraoAtual,
                                    )
                                  : normalizarNome(despesa.nome) ===
                                    normalizarNome(g.nome),
                              ).length
                            const ocorrenciasRestantes = Math.max(
                              occ - usadasNoPadraoEditado,
                              0,
                            )
                            const proj = v * ocorrenciasRestantes
                            return (
                              <div className="space-y-4">
                                <div className="bg-gray-100 rounded-2xl px-4 py-3.5">
                                  <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-1">
                                    Nome do padrão
                                  </p>
                                  <input
                                    type="text"
                                    value={nomePrevisaoEmEdicao}
                                    onChange={(e) =>
                                      definirNomePrevisaoEmEdicao(
                                        e.target.value,
                                      )
                                    }
                                    className="w-full bg-transparent text-sm font-semibold outline-none text-gray-900"
                                  />
                                </div>

                                {/* Valor por ocorrência */}
                                <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-3.5 gap-2">
                                  <span className="text-sm text-gray-500 font-semibold shrink-0">
                                    R$/vez
                                  </span>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    value={valorPrevisaoEmEdicao}
                                    onChange={(e) =>
                                      definirValorPrevisaoEmEdicao(
                                        e.target.value,
                                      )
                                    }
                                    className="flex-1 bg-transparent text-sm outline-none font-medium w-0"
                                  />
                                </div>

                                <div>
                                  <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-2">
                                    Pagamento padrão
                                  </p>
                                  <div className="flex gap-2">
                                    {pagamentosDisponiveis.map((tipo) => (
                                      <button
                                        type="button"
                                        key={tipo}
                                        onClick={() => {
                                          definirPagamentoPrevisaoEmEdicao(tipo)
                                          if (
                                            tipo === "cartao" &&
                                            cartoes.length > 0 &&
                                            cartaoPrevisaoEmEdicao == null
                                          )
                                            definirCartaoPrevisaoEmEdicao(
                                              cartoes[0].id,
                                            )
                                        }}
                                        className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                                          pagamentoPrevisaoEmEdicao === tipo
                                            ? "bg-black text-white"
                                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                        }`}
                                      >
                                        {ROTULOS_PAGAMENTO[tipo]}
                                      </button>
                                    ))}
                                  </div>
                                  {pagamentoPrevisaoEmEdicao === "cartao" &&
                                    cartoes.length > 0 && (
                                      <div className="mt-2 flex flex-col gap-1.5">
                                        {cartoes.map((cartao) => (
                                          <button
                                            type="button"
                                            key={cartao.id}
                                            onClick={() =>
                                              definirCartaoPrevisaoEmEdicao(
                                                cartao.id,
                                              )
                                            }
                                            className={`rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                                              cartaoPrevisaoEmEdicao ===
                                              cartao.id
                                                ? "bg-[#1A56DB] text-white"
                                                : "bg-gray-100 text-gray-600"
                                            }`}
                                          >
                                            {cartao.nome}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                </div>

                                {/* Recorrência — interativa */}
                                <div>
                                  <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-2">
                                    Recorrência
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {([
                                      "diaria",
                                      "semanal",
                                      "mensal",
                                      "personalizada",
                                    ] as TipoRecorrencia[]).map((rec) => (
                                      <button
                                        key={rec}
                                        onClick={() =>
                                          definirRecorrenciaPrevisaoEmEdicao(
                                            rec,
                                          )
                                        }
                                        className={`px-3.5 py-2 text-sm font-semibold rounded-xl transition-all ${
                                          recorrenciaPrevisaoEmEdicao === rec
                                            ? "bg-black text-white"
                                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                        }`}
                                      >
                                        {ROTULOS_RECORRENCIA[rec]}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Campo de ocorrências para personalizada */}
                                {recorrenciaPrevisaoEmEdicao ===
                                  "personalizada" && (
                                  <div className="flex items-center gap-3 bg-gray-100 rounded-2xl px-4 py-3.5">
                                    <span className="text-sm text-gray-500 font-semibold shrink-0">
                                      Ocorrências por ciclo
                                    </span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="1"
                                      value={ocorrenciasPersonalizadasPrevisao}
                                      onChange={(e) =>
                                        definirOcorrenciasPersonalizadasPrevisao(
                                          e.target.value,
                                        )
                                      }
                                      className="flex-1 bg-transparent text-sm outline-none font-bold text-right text-gray-900 w-0"
                                    />
                                  </div>
                                )}

                                {occ > 0 && (
                                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                                    <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-1">
                                      Projeção restante até dia {diaFechamento}
                                    </p>
                                    <p className="text-2xl font-bold text-gray-900">
                                      {formatarMoeda(proj)}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">
                                      {ocorrenciasRestantes} de {occ}{" "}
                                      {occ === 1 ? "ocorrência" : "ocorrências"}{" "}
                                      ainda{" "}
                                      {ocorrenciasRestantes === 1
                                        ? "prevista"
                                        : "previstas"}
                                    </p>
                                  </div>
                                )}

                                <p className="text-[11px] leading-5 text-gray-500 px-1">
                                  Ao alterar o nome, as despesas ligadas a este
                                  padrão também são renomeadas. Valor, pagamento
                                  e recorrência passam a valer nos próximos
                                  lançamentos.
                                </p>

                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      definirIdentificadorPrevisaoEmEdicao(null)
                                    }
                                    className="flex-1 py-2.5 border border-gray-200 text-gray-500 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={salvarEdicaoDaPrevisao}
                                    className="flex-1 py-2.5 bg-black text-white font-semibold rounded-xl text-sm hover:bg-gray-900 transition-colors"
                                  >
                                    Salvar padrão
                                  </button>
                                </div>
                              </div>
                            )
                          })()
                        ) : (
                          /* ── Visualização normal ── */
                          <>
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900">
                                  {g.nome}
                                </p>
                                <p className="text-xs text-gray-600 mt-0.5">
                                  {ROTULOS_RECORRENCIA[g.recorrencia]} ·{" "}
                                  {formatarMoeda(g.valor)}/vez
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-3">
                                {g.restantes > 0 && (
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-gray-900">
                                      {formatarMoeda(g.projecaoValor)}
                                    </p>
                                    <p className="text-[10px] text-orange-600 font-medium">
                                      projeção
                                    </p>
                                  </div>
                                )}
                                <button
                                  onClick={() => iniciarEdicaoDaPrevisao(g)}
                                  aria-label="Editar previsão"
                                  className="p-2.5 text-gray-500 hover:text-gray-700 transition-colors rounded-xl hover:bg-gray-100"
                                >
                                  <IconeEditar />
                                </button>
                                <button
                                  onClick={() => excluirPrevisao(g.id)}
                                  aria-label="Excluir previsão"
                                  className="p-2.5 text-gray-500 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50"
                                >
                                  <IconeLixeira />
                                </button>
                              </div>
                            </div>
                            <div className="mt-3">
                              <BarraSegmentada
                                utilizadas={g.usadas}
                                restantes={g.restantes}
                              />
                              <div className="flex justify-between mt-1.5">
                                <span
                                  className="text-[10px] font-semibold"
                                  style={{ color: COR_UTILIZADA }}
                                >
                                  {g.usadas}x já ocorreu
                                </span>
                                <span className="text-[10px] font-semibold text-gray-600">
                                  {g.totalPrevisto} total
                                </span>
                                <span
                                  className="text-[10px] font-semibold"
                                  style={{ color: "#5B9BD5" }}
                                >
                                  {g.restantes}x restante
                                  {g.restantes !== 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 font-medium">
                          Total projetado
                        </span>
                        <span className="text-base font-bold text-gray-900">
                          {formatarMoeda(
                            gruposProjecao.reduce(
                              (a, g) => a + g.projecaoValor,
                              0,
                            ),
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* fim scroll content */}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
