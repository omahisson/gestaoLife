import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"

export type PerfilAcesso = "administrador" | "usuario"
export type StatusUsuario = "pendente" | "ativo" | "inativo"

export interface UsuarioDoBanco {
  id: string
  login: string
  nome: string
  perfil: PerfilAcesso
  status: StatusUsuario
  senha_hash: string | null
}

export interface SessaoDoBanco {
  usuario_id: string
  csrf_token: string
  expira_em: string
}

export function abrirBanco(caminho: string) {
  if (caminho !== ":memory:") mkdirSync(dirname(caminho), { recursive: true })
  const banco = new DatabaseSync(caminho)
  banco.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
  banco.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      login TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      perfil TEXT NOT NULL CHECK (perfil IN ('administrador', 'usuario')),
      status TEXT NOT NULL CHECK (status IN ('pendente', 'ativo', 'inativo')),
      senha_hash TEXT,
      codigo_ativacao_hash TEXT,
      codigo_ativacao_expira_em TEXT,
      conta_principal INTEGER NOT NULL DEFAULT 0
        CHECK (conta_principal IN (0, 1)),
      criado_em TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS sessoes (
      token_hash TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      expira_em TEXT NOT NULL,
      criado_em TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS cofres (
      usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
      salt_kdf TEXT NOT NULL,
      parametros_kdf TEXT NOT NULL,
      nonce_chave TEXT NOT NULL,
      chave_criptografada TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS blocos_criptografados (
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tipo_bloco TEXT NOT NULL,
      revisao INTEGER NOT NULL,
      nonce TEXT NOT NULL,
      conteudo TEXT NOT NULL,
      PRIMARY KEY (usuario_id, tipo_bloco)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS sessoes_por_usuario
      ON sessoes(usuario_id);

  `)

  const colunasDeUsuario = banco
    .prepare("PRAGMA table_info(usuarios)")
    .all() as unknown as Array<{ name: string }>
  if (!colunasDeUsuario.some((coluna) => coluna.name === "conta_principal")) {
    banco.exec(`
      ALTER TABLE usuarios
        ADD COLUMN conta_principal INTEGER NOT NULL DEFAULT 0
        CHECK (conta_principal IN (0, 1));
    `)
  }

  banco.exec(`
    UPDATE usuarios
       SET conta_principal = 1
     WHERE id = (
       SELECT id FROM usuarios ORDER BY criado_em ASC, rowid ASC LIMIT 1
     )
       AND NOT EXISTS (
         SELECT 1 FROM usuarios WHERE conta_principal = 1
       );

    CREATE UNIQUE INDEX IF NOT EXISTS somente_uma_conta_principal
      ON usuarios(conta_principal) WHERE conta_principal = 1;

    CREATE TRIGGER IF NOT EXISTS definir_primeira_conta_como_principal
    AFTER INSERT ON usuarios
    WHEN NOT EXISTS (
      SELECT 1 FROM usuarios WHERE conta_principal = 1
    )
    BEGIN
      UPDATE usuarios SET conta_principal = 1 WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS impedir_exclusao_da_conta_principal
    BEFORE DELETE ON usuarios
    WHEN OLD.conta_principal = 1
    BEGIN
      SELECT RAISE(ABORT, 'A primeira conta não pode ser excluída.');
    END;

    PRAGMA user_version = 2;
  `)
  return banco
}

export function excluirSessoesExpiradas(banco: DatabaseSync) {
  banco
    .prepare("DELETE FROM sessoes WHERE expira_em <= ?")
    .run(new Date().toISOString())
}

export function buscarUsuarioPorLogin(
  banco: DatabaseSync,
  login: string,
): UsuarioDoBanco | undefined {
  return banco
    .prepare(
      "SELECT id, login, nome, perfil, status, senha_hash FROM usuarios WHERE login = ?",
    )
    .get(login) as unknown as UsuarioDoBanco | undefined
}

export function buscarSessao(
  banco: DatabaseSync,
  tokenHash: string,
): SessaoDoBanco & UsuarioDoBanco | undefined {
  return banco
    .prepare(`
      SELECT s.usuario_id, s.csrf_token, s.expira_em,
             u.id, u.login, u.nome, u.perfil, u.status, u.senha_hash
        FROM sessoes s
        JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token_hash = ? AND s.expira_em > ? AND u.status = 'ativo'
    `)
    .get(
      tokenHash,
      new Date().toISOString(),
    ) as unknown as SessaoDoBanco & UsuarioDoBanco | undefined
}
