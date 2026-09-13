import type {
  Cartao,
  Despesa,
  DespesaPrevista,
  Meta,
  Nota,
} from "../dominio/modelos"
import { criptografarBloco, descriptografarBloco } from "../seguranca/cofre"
import { requisitarApi } from "../servicos/cliente-api"

export interface DadosDoUsuario {
  nomeUsuario: string
  diaFechamento: number
  cartoes: Cartao[]
  despesas: Despesa[]
  despesasPrevistas: DespesaPrevista[]
  notas: Nota[]
  metas: Meta[]
}

interface BlocoDaApi {
  tipo: string
  revisao: number
  nonce: string
  conteudo: string
}

const revisoes = new Map<string, number>()
const tiposConhecidos = new Set<string>()
let filaDeSalvamento = Promise.resolve()

function chaveDaRevisao(usuarioId: string, tipo: string) {
  return `${usuarioId}\0${tipo}`
}

function mesDaDespesa(despesa: Despesa) {
  return /^\d{4}-\d{2}/.exec(despesa.data)?.[0] ?? "sem-data"
}

function separarEmBlocos(dados: DadosDoUsuario) {
  const blocos = new Map<string, unknown>()
  blocos.set("configuracoes", {
    nomeUsuario: dados.nomeUsuario,
    diaFechamento: dados.diaFechamento,
  })
  blocos.set("financeiro", {
    cartoes: dados.cartoes,
    despesasPrevistas: dados.despesasPrevistas,
  })
  blocos.set("metas", dados.metas)

  const despesasPorMes = new Map<string, Despesa[]>()
  for (const despesa of dados.despesas) {
    const tipo = `despesas:${mesDaDespesa(despesa)}`
    despesasPorMes.set(tipo, [...(despesasPorMes.get(tipo) ?? []), despesa])
  }
  for (const [tipo, despesas] of despesasPorMes) blocos.set(tipo, despesas)

  for (let inicio = 0; inicio < dados.notas.length; inicio += 50) {
    const indice = Math.floor(inicio / 50) + 1
    blocos.set(
      `notas:${String(indice).padStart(4, "0")}`,
      dados.notas.slice(inicio, inicio + 50),
    )
  }
  return blocos
}

export async function carregarDadosDoUsuario(
  usuarioId: string,
  nomeInicial: string,
): Promise<DadosDoUsuario> {
  const blocos = await requisitarApi<BlocoDaApi[]>("/api/blocos")
  const dados: DadosDoUsuario = {
    nomeUsuario: nomeInicial,
    diaFechamento: 30,
    cartoes: [],
    despesas: [],
    despesasPrevistas: [],
    notas: [],
    metas: [],
  }
  revisoes.clear()
  tiposConhecidos.clear()
  for (const bloco of blocos) {
    revisoes.set(chaveDaRevisao(usuarioId, bloco.tipo), bloco.revisao)
    tiposConhecidos.add(bloco.tipo)
    const conteudo = await descriptografarBloco<unknown>(
      usuarioId,
      bloco.tipo,
      bloco.revisao,
      bloco.nonce,
      bloco.conteudo,
    )
    if (bloco.tipo === "configuracoes" || bloco.tipo === "financeiro") {
      Object.assign(dados, conteudo)
    } else if (bloco.tipo === "metas") {
      dados.metas = (conteudo as Meta[])
    } else if (bloco.tipo.startsWith("despesas:")) {
      dados.despesas.push(...conteudo as Despesa[])
    } else if (bloco.tipo.startsWith("notas:")) {
      dados.notas.push(...conteudo as Nota[])
    }
  }
  dados.despesas.sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id)
  dados.notas.sort((a, b) => a.criadaEm.localeCompare(b.criadaEm))
  return dados
}

async function executarSalvamento(usuarioId: string, dados: DadosDoUsuario) {
  const blocos = separarEmBlocos(dados)
  for (const [tipo, conteudoAberto] of blocos) {
    const chave = chaveDaRevisao(usuarioId, tipo)
    const revisaoEsperada = revisoes.get(chave) ?? 0
    const novaRevisao = revisaoEsperada + 1
    const criptografado = await criptografarBloco(
      usuarioId,
      tipo,
      novaRevisao,
      conteudoAberto,
    )
    const resposta = await requisitarApi<{ revisao: number }>(
      `/api/blocos/${encodeURIComponent(tipo)}`,
      {
        method: "PUT",
        body: JSON.stringify({ revisaoEsperada, ...criptografado }),
      },
    )
    revisoes.set(chave, resposta.revisao)
    tiposConhecidos.add(tipo)
  }

  for (const tipo of [...tiposConhecidos]) {
    if (blocos.has(tipo)) continue
    await requisitarApi<void>(`/api/blocos/${encodeURIComponent(tipo)}`, {
      method: "DELETE",
    })
    tiposConhecidos.delete(tipo)
    revisoes.delete(chaveDaRevisao(usuarioId, tipo))
  }
}

export function salvarDadosDoUsuario(usuarioId: string, dados: DadosDoUsuario) {
  filaDeSalvamento = filaDeSalvamento
    .catch(() => undefined)
    .then(() => executarSalvamento(usuarioId, dados))
  return filaDeSalvamento
}
