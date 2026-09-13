import { argon2id } from "hash-wasm"

export interface EnvelopeDoCofre {
  saltKdf: string
  parametrosKdf: string
  nonceChave: string
  chaveCriptografada: string
}

interface ParametrosKdf {
  versao: 1
  memoriaKiB: number
  iteracoes: number
  paralelismo: number
}

let chaveDeDados: CryptoKey | null = null
let usuarioDoCofre = ""

const parametrosAtuais: ParametrosKdf = {
  versao: 1,
  memoriaKiB: 19_456,
  iteracoes: 2,
  paralelismo: 1,
}

function bytesParaBase64(bytes: Uint8Array) {
  let binario = ""
  for (let inicio = 0; inicio < bytes.length; inicio += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(inicio, inicio + 0x8000))
  }
  return btoa(binario)
}

function base64ParaBytes(valor: string) {
  const binario = atob(valor)
  return Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0))
}

async function derivarChave(
  frase: string,
  salt: Uint8Array,
  parametros: ParametrosKdf,
) {
  const bytes = await argon2id({
    password: frase,
    salt,
    parallelism: parametros.paralelismo,
    iterations: parametros.iteracoes,
    memorySize: parametros.memoriaKiB,
    hashLength: 32,
    outputType: "binary",
  })
  return crypto.subtle.importKey(
    "raw",
    Uint8Array.from(bytes),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  )
}

export async function criarCofre(frase: string, usuarioId: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const chaveProtetora = await derivarChave(frase, salt, parametrosAtuais)
  const novaChave = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  )
  const chaveExportada = await crypto.subtle.exportKey("raw", novaChave)
  const chaveCriptografada = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData: new TextEncoder().encode(`cofre:v1:${usuarioId}`),
    },
    chaveProtetora,
    chaveExportada,
  )
  chaveDeDados = novaChave
  usuarioDoCofre = usuarioId
  return {
    saltKdf: bytesParaBase64(salt),
    parametrosKdf: JSON.stringify(parametrosAtuais),
    nonceChave: bytesParaBase64(nonce),
    chaveCriptografada: bytesParaBase64(new Uint8Array(chaveCriptografada)),
  } satisfies EnvelopeDoCofre
}

export async function desbloquearCofre(
  frase: string,
  usuarioId: string,
  envelope: EnvelopeDoCofre,
) {
  const parametros = JSON.parse(envelope.parametrosKdf) as ParametrosKdf
  if (
    parametros.versao !== 1 ||
    !Number.isSafeInteger(parametros.memoriaKiB) ||
    !Number.isSafeInteger(parametros.iteracoes) ||
    !Number.isSafeInteger(parametros.paralelismo)
  ) {
    throw new Error("Formato do cofre não suportado.")
  }
  const chaveProtetora = await derivarChave(
    frase,
    base64ParaBytes(envelope.saltKdf),
    parametros,
  )
  const chaveExportada = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ParaBytes(envelope.nonceChave),
      additionalData: new TextEncoder().encode(`cofre:v1:${usuarioId}`),
    },
    chaveProtetora,
    base64ParaBytes(envelope.chaveCriptografada),
  )
  chaveDeDados = await crypto.subtle.importKey(
    "raw",
    chaveExportada,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  )
  usuarioDoCofre = usuarioId
}

function exigirChave(usuarioId: string) {
  if (!chaveDeDados || usuarioDoCofre !== usuarioId) {
    throw new Error("O cofre está bloqueado.")
  }
  return chaveDeDados
}

export async function criptografarBloco(
  usuarioId: string,
  tipo: string,
  revisao: number,
  dados: unknown,
) {
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const texto = new TextEncoder().encode(JSON.stringify({ versao: 1, dados }))
  const conteudo = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData: new TextEncoder().encode(
        `bloco:${usuarioId}:${tipo}:${revisao}`,
      ),
    },
    exigirChave(usuarioId),
    texto,
  )
  return {
    nonce: bytesParaBase64(nonce),
    conteudo: bytesParaBase64(new Uint8Array(conteudo)),
  }
}

export async function descriptografarBloco<T>(
  usuarioId: string,
  tipo: string,
  revisao: number,
  nonce: string,
  conteudo: string,
) {
  const aberto = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ParaBytes(nonce),
      additionalData: new TextEncoder().encode(
        `bloco:${usuarioId}:${tipo}:${revisao}`,
      ),
    },
    exigirChave(usuarioId),
    base64ParaBytes(conteudo),
  )
  const envelope = JSON.parse(new TextDecoder().decode(aberto)) as {
    versao: number
    dados: T
  }
  if (envelope.versao !== 1) throw new Error("Versão de dados não suportada.")
  return envelope.dados
}

export function bloquearCofre() {
  chaveDeDados = null
  usuarioDoCofre = ""
}
