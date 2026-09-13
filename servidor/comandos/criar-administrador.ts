import { resolve } from "node:path"
import { criarOuReemitirAdministradorPendente } from "../administradores.js"
import { abrirBanco } from "../banco.js"
import { normalizarLogin } from "../seguranca.js"

const login = normalizarLogin(process.argv[2] ?? "admin")
const nome = (process.argv[3] ?? "Administrador").trim()
if (!/^[a-z0-9._-]{3,40}$/.test(login) || nome.length < 2) {
  throw new Error("Uso: npm run conta:administrador -- <usuario> <nome>")
}

const banco = abrirBanco(
  process.env.DATABASE_PATH ?? resolve(".dados/gestao-life.sqlite"),
)
let resultado: ReturnType<typeof criarOuReemitirAdministradorPendente>
try {
  resultado = criarOuReemitirAdministradorPendente(banco, login, nome)
} finally {
  banco.close()
}

console.log(`Conta administrativa pendente: @${login}`)
if (resultado.reemitido) {
  console.log("O código de ativação anterior foi invalidado.")
}
console.log(`Código de ativação (válido por 24 horas): ${resultado.codigo}`)
