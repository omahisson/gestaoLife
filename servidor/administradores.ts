import { randomUUID } from "node:crypto"
import type { DatabaseSync } from "node:sqlite"
import { gerarCodigoDeAtivacao, resumirToken } from "./seguranca.js"

interface AdministradorExistente {
  id: string
  perfil: "administrador" | "usuario"
  status: "pendente" | "ativo" | "inativo"
}

export function criarOuReemitirAdministradorPendente(
  banco: DatabaseSync,
  login: string,
  nome: string,
) {
  const existente = banco
    .prepare("SELECT id, perfil, status FROM usuarios WHERE login = ?")
    .get(login) as unknown as AdministradorExistente | undefined
  const codigo = gerarCodigoDeAtivacao()
  const codigoHash = resumirToken(codigo)
  const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString()

  if (existente) {
    if (
      existente.perfil !== "administrador" ||
      existente.status !== "pendente"
    ) {
      throw new Error(
        "A conta já existe e não é uma conta administrativa pendente.",
      )
    }

    banco
      .prepare(`
        UPDATE usuarios
           SET nome = ?, codigo_ativacao_hash = ?,
               codigo_ativacao_expira_em = ?
         WHERE id = ?
      `)
      .run(nome, codigoHash, expiraEm, existente.id)

    return { codigo, reemitido: true }
  }

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
      codigoHash,
      expiraEm,
      new Date().toISOString(),
    )

  return { codigo, reemitido: false }
}
