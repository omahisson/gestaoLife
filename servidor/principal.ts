import { resolve } from "node:path"
import { abrirBanco } from "./banco.js"
import { construirAplicacao } from "./aplicacao.js"

const producao = process.env.NODE_ENV === "production"
const caminhoDoBanco =
  process.env.DATABASE_PATH ?? resolve(".dados/gestao-life.sqlite")
const porta = Number(process.env.API_PORT) || 3001
const endereco = process.env.API_HOST ?? (producao ? "127.0.0.1" : "0.0.0.0")
const banco = abrirBanco(caminhoDoBanco)
const aplicacao = await construirAplicacao({ banco, producao })

const encerrar = async () => {
  await aplicacao.close()
  banco.close()
  process.exit(0)
}

process.on("SIGINT", encerrar)
process.on("SIGTERM", encerrar)

await aplicacao.listen({ port: porta, host: endereco })
