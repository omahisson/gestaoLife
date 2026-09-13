import { randomUUID } from "node:crypto"
import { resolve } from "node:path"
import { abrirBanco } from "../banco.js"
import {
  gerarCodigoDeAtivacao,
  normalizarLogin,
  resumirToken,
} from "../seguranca.js"

const login = normalizarLogin(process.argv[2] ?? "admin")
const nome = (process.argv[3] ?? "Administrador").trim()
if (!/^[a-z0-9._-]{3,40}$/.test(login) || nome.length < 2) {
  throw new Error("Uso: npm run conta:administrador -- <usuario> <nome>")
}

const banco = abrirBanco(
  process.env.DATABASE_PATH ?? resolve(".dados/gestao-life.sqlite"),
)
const existente = banco
  .prepare("SELECT id FROM usuarios WHERE login = ?")
  .get(login)
if (existente) throw new Error("Já existe uma conta com esse usuário.")

const codigo = gerarCodigoDeAtivacao()
banco
  .prepare(`
    INSERT INTO usuarios
      (id, login, nome, perfil, status, codigo_ativacao_hash,
       codigo_ativacao_expira_em, criado_em)
    VALUES (?, ?, ?, 'administrador', 'pendente', ?, ?, ?)
  `)
  .run(
    randomUUID(),
    login,
    nome,
    resumirToken(codigo),
    new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
    new Date().toISOString(),
  )
banco.close()

console.log(`Conta administrativa pendente: @${login}`)
console.log(`Código de ativação (válido por 24 horas): ${codigo}`)
