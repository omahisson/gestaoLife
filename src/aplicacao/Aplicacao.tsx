import { useState } from "react"
import type { UsuarioAutenticado } from "../dominio/modelos"
import TelaLogin from "../funcionalidades/autenticacao/TelaLogin"
import {
  encerrarSessao,
  recuperarUsuarioAutenticado,
} from "../servicos/servico-de-autenticacao"
import GestaoLifeApp from "./GestaoLifeApp"

export default function Aplicacao() {
  const [usuario, definirUsuario] = useState<UsuarioAutenticado | null>(() =>
    recuperarUsuarioAutenticado(),
  )

  function sairDaAplicacao() {
    encerrarSessao()
    definirUsuario(null)
  }

  if (!usuario) {
    return <TelaLogin aoAutenticar={definirUsuario} />
  }

  return (
    <GestaoLifeApp
      key={usuario.id}
      usuario={usuario}
      aoSair={sairDaAplicacao}
    />
  )
}
