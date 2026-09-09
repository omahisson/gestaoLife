import type { AbaPrincipal } from "../../dominio/modelos"
import {
  IconeBarras,
  IconeCalendario,
  IconeMais,
  IconePessoa,
  IconeVida,
} from "../icones/Icones"

interface PropriedadesNavegacaoPrincipal {
  abaAtual: AbaPrincipal
  aoSelecionarAba: (aba: AbaPrincipal) => void
  aoCriarDespesa: () => void
}

interface PropriedadesItemNavegacao {
  aba: AbaPrincipal
  abaAtual: AbaPrincipal
  rotulo: string
  icone: React.ReactNode
  aoSelecionar: (aba: AbaPrincipal) => void
}

function ItemNavegacao({
  aba,
  abaAtual,
  rotulo,
  icone,
  aoSelecionar,
}: PropriedadesItemNavegacao) {
  const estaAtivo = aba === abaAtual

  return (
    <button
      onClick={() => aoSelecionar(aba)}
      aria-label={rotulo}
      aria-current={estaAtivo ? "page" : undefined}
      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full transition-all duration-200 ${
        estaAtivo
          ? "bg-white text-gray-950"
          : "text-gray-400 hover:text-gray-200"
      }`}
    >
      {icone}
      {estaAtivo && (
        <span className="nav-label text-xs font-bold">{rotulo}</span>
      )}
    </button>
  )
}

export default function NavegacaoPrincipal({
  abaAtual,
  aoSelecionarAba,
  aoCriarDespesa,
}: PropriedadesNavegacaoPrincipal) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm z-[16] px-5 pb-7 pointer-events-none">
      <div className="bg-gray-950 rounded-full flex items-center justify-between px-2 py-2 shadow-2xl pointer-events-auto">
        <ItemNavegacao
          aba="inicio"
          abaAtual={abaAtual}
          rotulo="Início"
          icone={<IconeCalendario />}
          aoSelecionar={aoSelecionarAba}
        />
        <ItemNavegacao
          aba="insights"
          abaAtual={abaAtual}
          rotulo="Insights"
          icone={<IconeBarras />}
          aoSelecionar={aoSelecionarAba}
        />
        <button
          onClick={aoCriarDespesa}
          aria-label="Nova despesa"
          className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm hover:bg-gray-100 transition-colors"
        >
          <IconeMais />
        </button>
        <ItemNavegacao
          aba="vida"
          abaAtual={abaAtual}
          rotulo="Life"
          icone={<IconeVida />}
          aoSelecionar={aoSelecionarAba}
        />
        <ItemNavegacao
          aba="perfil"
          abaAtual={abaAtual}
          rotulo="Perfil"
          icone={<IconePessoa />}
          aoSelecionar={aoSelecionarAba}
        />
      </div>
    </nav>
  )
}
