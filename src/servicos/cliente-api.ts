let tokenCsrf = ""

export class ErroDaApi extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
    readonly dados?: unknown,
  ) {
    super(mensagem)
  }
}

export function definirTokenCsrf(token: string) {
  tokenCsrf = token
}

export function limparTokenCsrf() {
  tokenCsrf = ""
}

export async function requisitarApi<T>(
  caminho: string,
  opcoes: RequestInit = {},
): Promise<T> {
  const metodo = opcoes.method?.toUpperCase() ?? "GET"
  const mutacao = !["GET", "HEAD", "OPTIONS"].includes(metodo)
  const resposta = await fetch(caminho, {
    ...opcoes,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(opcoes.body ? { "Content-Type": "application/json" } : {}),
      ...(mutacao && tokenCsrf ? { "X-CSRF-Token": tokenCsrf } : {}),
      ...opcoes.headers,
    },
  })
  if (!resposta.ok) {
    const dados = await resposta.json().catch(() => undefined)
    const mensagem =
      dados && typeof dados === "object" && "erro" in dados
        ? String(dados.erro)
        : `Falha na API (${resposta.status}).`
    throw new ErroDaApi(mensagem, resposta.status, dados)
  }
  if (resposta.status === 204) return undefined as T
  return resposta.json() as Promise<T>
}
