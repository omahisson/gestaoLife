import { readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

function lerArquivos(diretorio: string): string {
  return readdirSync(diretorio, { withFileTypes: true })
    .map((entrada) => {
      const caminho = join(diretorio, entrada.name)
      return entrada.isDirectory()
        ? lerArquivos(caminho)
        : readFileSync(caminho, "utf8")
    })
    .join("\n")
}

const pacotePublico = lerArquivos(resolve("dist"))
const pacoteAdministrativo = lerArquivos(resolve("dist-admin"))
const marcadoresPrivados = ["Código exibido uma única vez", "Adicionar pessoa"]

for (const marcador of marcadoresPrivados) {
  if (pacotePublico.includes(marcador)) {
    throw new Error(
      `A aplicação pública contém código administrativo: ${marcador}`,
    )
  }
  if (!pacoteAdministrativo.includes(marcador)) {
    throw new Error(
      `A aplicação administrativa não contém o marcador esperado: ${marcador}`,
    )
  }
}

console.log("Pacotes público e administrativo permanecem separados.")
