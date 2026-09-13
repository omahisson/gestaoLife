import { useEffect, useState } from "react"
import type { UsuarioAutenticado } from "../dominio/modelos"
import TelaLogin from "../funcionalidades/autenticacao/TelaLogin"
import {
  encerrarSessao,
  recuperarUsuarioAutenticado,
} from "../servicos/servico-de-autenticacao"
import GestaoLifeApp from "./GestaoLifeApp"

export default function Aplicacao() {
  const [usuario, definirUsuario] = useState<UsuarioAutenticado | null>(null)
  const [cofreAberto, definirCofreAberto] = useState(false)
  const [verificandoSessao, definirVerificandoSessao] = useState(true)

  useEffect(() => {
    recuperarUsuarioAutenticado()
      .then(definirUsuario)
      .finally(() => definirVerificandoSessao(false))
  }, [])

  async function sairDaAplicacao() {
    await encerrarSessao()
    definirCofreAberto(false)
    definirUsuario(null)
  }

  if (verificandoSessao) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#EEF2F9] text-sm font-semibold text-gray-600">
        Verificando acesso...
      </main>
    )
  }

  if (!usuario || !cofreAberto) {
    return (
      <TelaLogin
        usuarioDaSessao={usuario}
        aoAutenticar={(usuarioAutenticado) => {
          definirUsuario(usuarioAutenticado)
          definirCofreAberto(true)
        }}
        aoEncerrarSessao={() => {
          definirUsuario(null)
          definirCofreAberto(false)
        }}
      />
    )
  }

  return (
    <GestaoLifeApp
      key={usuario.id}
      usuario={usuario}
      aoSair={sairDaAplicacao}
    />
  )
}
