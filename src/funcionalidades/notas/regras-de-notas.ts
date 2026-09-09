import type { BlocoNota } from "../../dominio/modelos"

export type GrupoDeBlocos = { tipo: "texto"; bloco: BlocoNota } | {
  tipo: "checkboxes"
  blocos: BlocoNota[]
}

export function agruparBlocosDeNota(blocos: BlocoNota[]): GrupoDeBlocos[] {
  const grupos: GrupoDeBlocos[] = []
  let grupoAtual: BlocoNota[] | null = null

  for (const bloco of blocos) {
    if (bloco.tipo === "checkbox") {
      if (!grupoAtual) {
        grupoAtual = []
        grupos.push({ tipo: "checkboxes", blocos: grupoAtual })
      }
      grupoAtual.push(bloco)
    } else {
      grupoAtual = null
      grupos.push({ tipo: "texto", bloco })
    }
  }

  return grupos
}
