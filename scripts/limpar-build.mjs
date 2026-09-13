import { rmSync } from "node:fs"
import { resolve, sep } from "node:path"

const raizPermitida = `${resolve("build")}${sep}`
const destino = resolve("build", "servidor")

if (!destino.startsWith(raizPermitida)) {
  throw new Error("Diretório de compilação inválido.")
}

rmSync(destino, { recursive: true, force: true })
