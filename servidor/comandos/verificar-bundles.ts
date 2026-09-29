import { existsSync, readdirSync, readFileSync } from "node:fs"
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

function validarPng(caminho: string, tamanhoEsperado: number) {
  if (!existsSync(caminho)) {
    throw new Error(`Ícone obrigatório ausente no pacote público: ${caminho}`)
  }

  const conteudo = readFileSync(caminho)
  const assinatura = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const pngValido =
    conteudo.length >= 24 && conteudo.subarray(0, 8).equals(assinatura)
  const largura = pngValido ? conteudo.readUInt32BE(16) : 0
  const altura = pngValido ? conteudo.readUInt32BE(20) : 0

  if (!pngValido || largura !== tamanhoEsperado || altura !== tamanhoEsperado) {
    throw new Error(
      `Ícone PWA inválido: ${caminho} deve medir ${tamanhoEsperado}x${tamanhoEsperado}.`,
    )
  }
}

const caminhoManifesto = resolve("dist", "manifest.webmanifest")
if (!existsSync(caminhoManifesto)) {
  throw new Error("O pacote público não contém o manifesto PWA.")
}

const manifesto = JSON.parse(readFileSync(caminhoManifesto, "utf8")) as {
  id?: unknown
  start_url?: unknown
  scope?: unknown
  display?: unknown
}

if (
  manifesto.id !== "/" ||
  manifesto.start_url !== "/" ||
  manifesto.scope !== "/" ||
  manifesto.display !== "standalone"
) {
  throw new Error("O manifesto PWA não preserva a identidade e o escopo esperados.")
}

validarPng(resolve("dist", "icons", "icon-192.png"), 192)
validarPng(resolve("dist", "icons", "icon-512.png"), 512)
validarPng(resolve("dist", "icons", "icon-maskable-512.png"), 512)
validarPng(resolve("dist", "icons", "apple-touch-icon.png"), 180)

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

console.log(
  "Pacotes público e administrativo permanecem separados e a instalação PWA está íntegra.",
)
