import type {
  Cartao,
  Despesa,
  DespesaPrevista,
  Meta,
  Nota,
} from "../dominio/modelos"
import type {
  DadosDoUsuarioNoBanco,
  UsuarioDoBanco,
} from "./modelos-do-banco"

export interface DadosDoUsuario {
  nomeUsuario: string
  diaFechamento: number
  cartoes: Cartao[]
  despesas: Despesa[]
  despesasPrevistas: DespesaPrevista[]
  notas: Nota[]
  metas: Meta[]
}

const enderecoBase = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "")
const filasDeSalvamento = new Map<string, Promise<void>>()

async function requisitar<T>(caminho: string, opcoes?: RequestInit): Promise<T> {
  const resposta = await fetch(`${enderecoBase}${caminho}`, {
    ...opcoes,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...opcoes?.headers },
  })
  if (!resposta.ok) {
    throw new Error(`Falha na API: ${resposta.status} ${resposta.statusText}`)
  }
  return resposta.json() as Promise<T>
}

export function buscarUsuariosPorLogin(login: string): Promise<UsuarioDoBanco[]> {
  return requisitar<UsuarioDoBanco[]>(
    `/usuarios?login=${encodeURIComponent(login)}`,
  )
}

export async function carregarDadosDoUsuario(
  usuarioId: string,
): Promise<DadosDoUsuario> {
  const identificador = encodeURIComponent(usuarioId)
  const [usuario, dados] = await Promise.all([
    requisitar<UsuarioDoBanco>(`/usuarios/${identificador}`),
    requisitar<DadosDoUsuarioNoBanco>(`/dadosUsuarios/${identificador}`),
  ])
  if (!usuario.ativo || dados.usuarioId !== usuarioId) {
    throw new Error("Usuário inativo ou sem dados vinculados.")
  }
  const cartoes = dados.cartoes.map((cartao, indice) =>
    typeof cartao === "string" ? { id: -(indice + 1), nome: cartao } : cartao,
  )
  return {
    nomeUsuario: usuario.nome,
    diaFechamento: dados.diaFechamento,
    cartoes,
    despesas: dados.despesas,
    despesasPrevistas: dados.despesasPrevistas,
    notas: dados.notas,
    metas: dados.metas,
  }
}

async function executarSalvamento(
  usuarioId: string,
  dados: DadosDoUsuario,
): Promise<void> {
  const identificador = encodeURIComponent(usuarioId)
  await Promise.all([
    requisitar<UsuarioDoBanco>(`/usuarios/${identificador}`, {
      method: "PATCH",
      body: JSON.stringify({ nome: dados.nomeUsuario }),
    }),
    requisitar<DadosDoUsuarioNoBanco>(`/dadosUsuarios/${identificador}`, {
      method: "PATCH",
      body: JSON.stringify({
        diaFechamento: dados.diaFechamento,
        cartoes: dados.cartoes,
        despesas: dados.despesas,
        despesasPrevistas: dados.despesasPrevistas,
        notas: dados.notas,
        metas: dados.metas,
      }),
    }),
  ])
}

export function salvarDadosDoUsuario(
  usuarioId: string,
  dados: DadosDoUsuario,
): Promise<void> {
  const salvamentoAnterior = filasDeSalvamento.get(usuarioId) ?? Promise.resolve()
  const salvamentoAtual = salvamentoAnterior
    .catch(() => undefined)
    .then(() => executarSalvamento(usuarioId, dados))

  filasDeSalvamento.set(usuarioId, salvamentoAtual)
  salvamentoAtual.then(
    () => {
      if (filasDeSalvamento.get(usuarioId) === salvamentoAtual) {
        filasDeSalvamento.delete(usuarioId)
      }
    },
    () => {
      if (filasDeSalvamento.get(usuarioId) === salvamentoAtual) {
        filasDeSalvamento.delete(usuarioId)
      }
    },
  )
  return salvamentoAtual
}

export async function criarContaNoBanco(
  usuario: UsuarioDoBanco,
  dados: DadosDoUsuarioNoBanco,
): Promise<void> {
  await requisitar<UsuarioDoBanco>("/usuarios", {
    method: "POST",
    body: JSON.stringify(usuario),
  })
  try {
    await requisitar<DadosDoUsuarioNoBanco>("/dadosUsuarios", {
      method: "POST",
      body: JSON.stringify(dados),
    })
  } catch (erro) {
    await fetch(`${enderecoBase}/usuarios/${encodeURIComponent(usuario.id)}`, {
      method: "DELETE",
    })
    throw erro
  }
}
