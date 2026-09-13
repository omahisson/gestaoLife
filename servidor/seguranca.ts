import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { hash, verify, type Options } from "@node-rs/argon2"

const parametrosDaSenha: Options = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
}

export function gerarToken(tamanho = 32) {
  return randomBytes(tamanho).toString("base64url")
}

export function resumirToken(token: string) {
  return createHash("sha256").update(token).digest("base64url")
}

export function compararResumos(valor: string, esperado: string) {
  const recebido = Buffer.from(valor)
  const conhecido = Buffer.from(esperado)
  return (
    recebido.length === conhecido.length && timingSafeEqual(recebido, conhecido)
  )
}

export function protegerSenha(senha: string) {
  return hash(senha, parametrosDaSenha)
}

export function conferirSenha(hashDaSenha: string, senha: string) {
  return verify(hashDaSenha, senha, parametrosDaSenha)
}

export function normalizarLogin(login: string) {
  return login.trim().toLocaleLowerCase("pt-BR")
}

export function gerarCodigoDeAtivacao() {
  return randomBytes(9).toString("base64url").toUpperCase()
}
