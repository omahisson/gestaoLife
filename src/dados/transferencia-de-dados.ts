import type { DadosDoUsuario } from "./repositorio-remoto"
import type {
  BlocoNota,
  Cartao,
  Despesa,
  DespesaPrevista,
  Meta,
  Nota,
  TipoPagamento,
  TipoRecorrencia,
} from "../dominio/modelos"

const FORMATO = "gestao-life"
const VERSAO = 1
export const TAMANHO_MAXIMO_IMPORTACAO = 10 * 1024 * 1024

interface DocumentoDeDados {
  formato: typeof FORMATO
  versao: typeof VERSAO
  exportadoEm: string
  dados: DadosDoUsuario
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return !!valor && typeof valor === "object" && !Array.isArray(valor)
}

function ehIdentificador(valor: unknown): valor is number {
  return Number.isSafeInteger(valor) && Number(valor) >= 0
}

function ehNumeroFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor)
}

function ehTexto(valor: unknown, maximo: number, obrigatorio = false) {
  return (
    typeof valor === "string" &&
    valor.length <= maximo &&
    (!obrigatorio || valor.trim().length > 0)
  )
}

function ehDataIso(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor))
    return false
  const data = new Date(`${valor}T12:00:00Z`)
  return (
    !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor
  )
}

function ehHora(valor: unknown): valor is string {
  return typeof valor === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(valor)
}

function ehDataHora(valor: unknown): valor is string {
  return (
    typeof valor === "string" &&
    valor.length <= 40 &&
    !Number.isNaN(Date.parse(valor))
  )
}

function ehChaveDeOcorrencia(valor: unknown): valor is string {
  if (valor === "extra" || ehDataIso(valor)) return true
  if (typeof valor !== "string") return false
  const correspondencia = /^(\d{4}-\d{2}-\d{2})#([1-9]\d{0,4})$/.exec(valor)
  return (
    !!correspondencia &&
    ehDataIso(correspondencia[1]) &&
    Number(correspondencia[2]) <= 10_000
  )
}

const pagamentos = new Set<TipoPagamento>(["pix", "dinheiro", "cartao"])
const recorrencias = new Set<TipoRecorrencia>([
  "diaria",
  "semanal",
  "mensal",
  "personalizada",
  "avulsa",
])

function ehPagamento(valor: unknown): valor is TipoPagamento {
  return typeof valor === "string" && pagamentos.has(valor as TipoPagamento)
}

function ehRecorrencia(valor: unknown): valor is TipoRecorrencia {
  return typeof valor === "string" && recorrencias.has(valor as TipoRecorrencia)
}

function ehOpcional<T>(
  valor: unknown,
  validador: (conteudo: unknown) => conteudo is T,
): valor is T | undefined {
  return valor === undefined || validador(valor)
}

function validarCartao(valor: unknown): valor is Cartao {
  return (
    ehObjeto(valor) &&
    ehIdentificador(valor.id) &&
    ehTexto(valor.nome, 120, true)
  )
}

function validarDespesa(valor: unknown): valor is Despesa {
  return (
    ehObjeto(valor) &&
    ehIdentificador(valor.id) &&
    ehOpcional(valor.padraoId, ehIdentificador) &&
    ehTexto(valor.nome, 200, true) &&
    ehNumeroFinito(valor.valor) &&
    valor.valor > 0 &&
    ehDataIso(valor.data) &&
    ehPagamento(valor.pagamento) &&
    ehOpcional(valor.cartaoId, ehIdentificador) &&
    ehOpcional(valor.cartaoNome, (item): item is string =>
      ehTexto(item, 120),
    ) &&
    ehRecorrencia(valor.recorrencia) &&
    ehOpcional(valor.ocorrenciasRestantes, (item): item is number =>
      ehIdentificador(item),
    ) &&
    ehOpcional(
      valor.ocorrenciaPrevistaEm,
      ehChaveDeOcorrencia,
    ) &&
    ehOpcional(valor.metaId, ehIdentificador)
  )
}

function validarDespesaPrevista(valor: unknown): valor is DespesaPrevista {
  return (
    ehObjeto(valor) &&
    ehIdentificador(valor.id) &&
    ehTexto(valor.nome, 200, true) &&
    ehNumeroFinito(valor.valor) &&
    valor.valor > 0 &&
    ehOpcional(valor.dataInicio, ehDataIso) &&
    ehOpcional(valor.vigenteDesde, ehDataIso) &&
    ehOpcional(valor.vigenteAte, ehDataIso) &&
    ehOpcional(valor.excluidoEm, ehDataIso) &&
    ehOpcional(valor.pagamento, ehPagamento) &&
    ehOpcional(valor.cartaoId, ehIdentificador) &&
    ehOpcional(valor.cartaoNome, (item): item is string =>
      ehTexto(item, 120),
    ) &&
    ehRecorrencia(valor.recorrencia) &&
    ehOpcional(
      valor.ocorrenciasPorCiclo,
      (item): item is number =>
        ehIdentificador(item) && Number(item) >= 1 && Number(item) <= 10_000,
    ) &&
    ehIdentificador(valor.restantes)
  )
}

function validarBloco(valor: unknown): valor is BlocoNota {
  return (
    ehObjeto(valor) &&
    ehIdentificador(valor.id) &&
    (valor.tipo === "texto" || valor.tipo === "checkbox") &&
    ehTexto(valor.texto, 20_000) &&
    typeof valor.concluida === "boolean" &&
    ehOpcional(valor.data, ehDataIso) &&
    ehOpcional(valor.hora, ehHora)
  )
}

function validarNota(valor: unknown): valor is Nota {
  return (
    ehObjeto(valor) &&
    ehIdentificador(valor.id) &&
    ehTexto(valor.titulo, 500) &&
    Array.isArray(valor.blocos) &&
    valor.blocos.length <= 10_000 &&
    possuiIdentificadoresValidos(valor.blocos, validarBloco) &&
    ehOpcional(valor.data, ehDataIso) &&
    ehOpcional(valor.hora, ehHora) &&
    typeof valor.fixada === "boolean" &&
    typeof valor.arquivada === "boolean" &&
    ehDataHora(valor.criadaEm)
  )
}

function validarMeta(valor: unknown): valor is Meta {
  return (
    ehObjeto(valor) &&
    ehIdentificador(valor.id) &&
    ehTexto(valor.nome, 500, true) &&
    ehDataHora(valor.dataInicio) &&
    ehOpcional(valor.despesaVinculadaNome, (item): item is string =>
      ehTexto(item, 200, true),
    ) &&
    ehOpcional(
      valor.valorMedio,
      (item): item is number => ehNumeroFinito(item) && item > 0,
    ) &&
    ehOpcional(
      valor.frequenciaMensal,
      (item): item is number => Number.isInteger(item) && Number(item) > 0,
    )
  )
}

function possuiIdentificadoresValidos<T extends { id: number }>(
  itens: unknown[],
  validador: (item: unknown) => item is T,
) {
  const identificadores = new Set<number>()
  return itens.every((item) => {
    if (!validador(item)) return false
    const id = Number(item.id)
    if (identificadores.has(id)) return false
    identificadores.add(id)
    return true
  })
}

function validarColecao<T extends { id: number }>(
  valor: unknown,
  validador: (item: unknown) => item is T,
) {
  return (
    Array.isArray(valor) &&
    valor.length <= 100_000 &&
    possuiIdentificadoresValidos(valor, validador)
  )
}

function validarDados(valor: unknown): valor is DadosDoUsuario {
  if (!ehObjeto(valor)) return false
  if (
    typeof valor.nomeUsuario !== "string" ||
    valor.nomeUsuario.trim().length === 0 ||
    valor.nomeUsuario.length > 80 ||
    !Number.isInteger(valor.diaFechamento) ||
    Number(valor.diaFechamento) < 1 ||
    Number(valor.diaFechamento) > 31
  )
    return false
  return (
    validarColecao(valor.cartoes, validarCartao) &&
    validarColecao(valor.despesas, validarDespesa) &&
    validarColecao(valor.despesasPrevistas, validarDespesaPrevista) &&
    validarColecao(valor.notas, validarNota) &&
    validarColecao(valor.metas, validarMeta)
  )
}

export function criarDocumentoDeExportacao(
  dados: DadosDoUsuario,
): DocumentoDeDados {
  return {
    formato: FORMATO,
    versao: VERSAO,
    exportadoEm: new Date().toISOString(),
    dados: structuredClone(dados),
  }
}

export function lerDocumentoDeImportacao(texto: string): DadosDoUsuario {
  let documento: unknown
  try {
    documento = JSON.parse(texto)
  } catch {
    throw new Error("O arquivo selecionado não contém um JSON válido.")
  }
  if (
    !ehObjeto(documento) ||
    documento.formato !== FORMATO ||
    documento.versao !== VERSAO ||
    typeof documento.exportadoEm !== "string" ||
    !validarDados(documento.dados)
  )
    throw new Error("O arquivo não é uma exportação compatível do Gestão Life.")
  return structuredClone(documento.dados)
}
