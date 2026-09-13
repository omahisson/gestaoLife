import assert from "node:assert/strict"
import { test } from "node:test"
import {
  bloquearCofre,
  criarCofre,
  criptografarBloco,
  descriptografarBloco,
  desbloquearCofre,
} from "./cofre"

test("a frase abre a chave e a autenticação vincula usuário, bloco e revisão", async () => {
  const usuarioId = "usuario-seguro"
  const envelope = await criarCofre("uma frase longa e exclusiva", usuarioId)
  const bloco = await criptografarBloco(usuarioId, "notas:0001", 1, {
    texto: "conteúdo sensível",
  })
  bloquearCofre()
  await desbloquearCofre("uma frase longa e exclusiva", usuarioId, envelope)
  assert.deepEqual(
    await descriptografarBloco(
      usuarioId,
      "notas:0001",
      1,
      bloco.nonce,
      bloco.conteudo,
    ),
    { texto: "conteúdo sensível" },
  )
  await assert.rejects(
    descriptografarBloco(
      usuarioId,
      "notas:0001",
      2,
      bloco.nonce,
      bloco.conteudo,
    ),
  )
  bloquearCofre()
})
