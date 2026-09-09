import { useState } from "react"
import { MESES_POR_EXTENSO } from "../../dominio/constantes"
import type { BlocoNota, Nota } from "../../dominio/modelos"
import {
  IconeConfirmar,
  IconeDireita,
  IconeTarefas,
} from "../../componentes/icones/Icones"

interface TarefaComNota {
  bloco: BlocoNota
  nota: Nota
}

interface PropriedadesPainelTarefas {
  dataSelecionada: string | null
  tarefas: TarefaComNota[]
  aoAlternarTarefa: (idNota: number, idBloco: number) => void
  aoAbrirNota: (nota: Nota) => void
}

export default function PainelTarefas({
  dataSelecionada,
  tarefas,
  aoAlternarTarefa,
  aoAbrirNota,
}: PropriedadesPainelTarefas) {
  const [estaExpandido, definirEstaExpandido] = useState(false)
  if (!dataSelecionada || tarefas.length === 0) return null

  const quantidadeConcluida = tarefas.filter(
    ({ bloco }) => bloco.concluida,
  ).length
  const data = new Date(`${dataSelecionada}T12:00:00`)
  const rotuloData = `${String(data.getDate()).padStart(2, "0")} de ${MESES_POR_EXTENSO[data.getMonth()]}`

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 w-full max-w-sm z-[15] transition-all duration-300 ease-out"
      style={{ bottom: "92px" }}
    >
      <div className="bg-white rounded-t-3xl shadow-[0_-6px_32px_rgba(0,0,0,0.10)] overflow-hidden">
        <div className="flex justify-center pt-2.5 pb-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <button
          onClick={() => definirEstaExpandido((valorAtual) => !valorAtual)}
          className="w-full px-5 py-3 flex items-center gap-3 text-left"
        >
          <div className="w-8 h-8 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-700 shrink-0">
            <IconeTarefas />
          </div>
          <span className="text-sm font-semibold text-gray-900 flex-1">
            Tarefas
          </span>
          <span className="text-xs text-gray-600 mr-2">
            {quantidadeConcluida} de {tarefas.length} concluídas
          </span>
          <span
            className={`text-gray-600 text-xs transition-transform duration-200 ${
              estaExpandido ? "rotate-180" : ""
            }`}
          >
            ▲
          </span>
        </button>

        {estaExpandido && (
          <div className="px-4 pb-4 space-y-2 max-h-[52vh] overflow-y-auto">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-3 px-1">
              {rotuloData}
            </p>
            {tarefas.map(({ bloco, nota }) => (
              <div
                key={`tarefa-${bloco.id}`}
                className="w-full bg-gray-50 rounded-2xl px-4 py-3.5 flex items-center gap-3"
              >
                <button
                  onClick={() => aoAlternarTarefa(nota.id, bloco.id)}
                  className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    bloco.concluida
                      ? "bg-[#1A56DB] border-[#1A56DB]"
                      : "border-gray-300"
                  }`}
                  style={{ minWidth: 18 }}
                  aria-label={
                    bloco.concluida
                      ? "Marcar tarefa como pendente"
                      : "Marcar tarefa como concluída"
                  }
                >
                  {bloco.concluida && <IconeConfirmar />}
                </button>
                <div className="flex-1 min-w-0 text-left">
                  <p
                    className={`text-sm font-semibold truncate ${
                      bloco.concluida
                        ? "line-through text-gray-500"
                        : "text-gray-900"
                    }`}
                  >
                    {bloco.texto}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5 truncate">
                    {nota.titulo}
                    {bloco.hora ? ` · ${bloco.hora}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => {
                    definirEstaExpandido(false)
                    aoAbrirNota(nota)
                  }}
                  className="p-1.5 text-gray-500 hover:text-gray-500 shrink-0 transition-colors"
                  aria-label={`Abrir nota ${nota.titulo}`}
                >
                  <IconeDireita />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
