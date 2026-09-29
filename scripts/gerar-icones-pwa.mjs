import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { deflateSync } from "node:zlib"

const diretorio = resolve("public", "icons")
mkdirSync(diretorio, { recursive: true })

const azul = [26, 86, 219, 255]
const branco = [255, 255, 255, 255]

function tabelaCrc32() {
  return Array.from({ length: 256 }, (_, indice) => {
    let valor = indice
    for (let bit = 0; bit < 8; bit += 1) {
      valor = (valor & 1) !== 0 ? 0xedb88320 ^ (valor >>> 1) : valor >>> 1
    }
    return valor >>> 0
  })
}

const tabelaCrc = tabelaCrc32()

function crc32(buffer) {
  let valor = 0xffffffff
  for (const byte of buffer) {
    valor = tabelaCrc[(valor ^ byte) & 0xff] ^ (valor >>> 8)
  }
  return (valor ^ 0xffffffff) >>> 0
}

function bloco(tipo, dados) {
  const nome = Buffer.from(tipo)
  const tamanho = Buffer.alloc(4)
  tamanho.writeUInt32BE(dados.length)
  const verificacao = Buffer.alloc(4)
  verificacao.writeUInt32BE(crc32(Buffer.concat([nome, dados])))
  return Buffer.concat([tamanho, nome, dados, verificacao])
}

function dentroDoRetanguloArredondado(x, y, inicio, fim, raio) {
  const centroX = Math.max(inicio + raio, Math.min(x, fim - raio))
  const centroY = Math.max(inicio + raio, Math.min(y, fim - raio))
  return Math.hypot(x - centroX, y - centroY) <= raio
}

function dentroDoG(x, y, escala) {
  const centroX = 0.405
  const centroY = 0.5
  const distancia = Math.hypot(x - centroX, y - centroY)
  const anel = distancia >= 0.105 * escala && distancia <= 0.17 * escala
  const abertura = x > centroX + 0.045 * escala && y < centroY + 0.015 * escala
  const barra =
    x >= centroX &&
    x <= centroX + 0.17 * escala &&
    y >= centroY - 0.015 * escala &&
    y <= centroY + 0.05 * escala
  const haste =
    x >= centroX + 0.105 * escala &&
    x <= centroX + 0.17 * escala &&
    y >= centroY - 0.015 * escala &&
    y <= centroY + 0.13 * escala
  return (anel && !abertura) || barra || haste
}

function dentroDoL(x, y, escala) {
  const esquerda = 0.59
  const topo = 0.33
  const base = 0.67
  const espessura = 0.065 * escala
  const haste =
    x >= esquerda && x <= esquerda + espessura && y >= topo && y <= base
  const pe =
    x >= esquerda && x <= esquerda + 0.2 * escala && y >= base - espessura && y <= base
  return haste || pe
}

function corDoPonto(x, y, mascara) {
  const inicio = mascara ? 0.25 : 0.18
  const fim = 1 - inicio
  const raio = mascara ? 0.12 : 0.16
  if (!dentroDoRetanguloArredondado(x, y, inicio, fim, raio)) return azul

  const escala = mascara ? 0.78 : 1
  return dentroDoG(x, y, escala) || dentroDoL(x, y, escala) ? azul : branco
}

function gerarPng(tamanho, mascara = false) {
  const amostras = tamanho <= 32 ? 6 : 4
  const pixels = Buffer.alloc(tamanho * tamanho * 4)

  for (let y = 0; y < tamanho; y += 1) {
    for (let x = 0; x < tamanho; x += 1) {
      const acumulado = [0, 0, 0, 0]
      for (let subY = 0; subY < amostras; subY += 1) {
        for (let subX = 0; subX < amostras; subX += 1) {
          const cor = corDoPonto(
            (x + (subX + 0.5) / amostras) / tamanho,
            (y + (subY + 0.5) / amostras) / tamanho,
            mascara,
          )
          for (let canal = 0; canal < 4; canal += 1) acumulado[canal] += cor[canal]
        }
      }

      const indice = (y * tamanho + x) * 4
      const divisor = amostras * amostras
      for (let canal = 0; canal < 4; canal += 1) {
        pixels[indice + canal] = Math.round(acumulado[canal] / divisor)
      }
    }
  }

  const linhas = Buffer.alloc((tamanho * 4 + 1) * tamanho)
  for (let y = 0; y < tamanho; y += 1) {
    const inicioLinha = y * (tamanho * 4 + 1)
    linhas[inicioLinha] = 0
    pixels.copy(linhas, inicioLinha + 1, y * tamanho * 4, (y + 1) * tamanho * 4)
  }

  const cabecalho = Buffer.alloc(13)
  cabecalho.writeUInt32BE(tamanho, 0)
  cabecalho.writeUInt32BE(tamanho, 4)
  cabecalho[8] = 8
  cabecalho[9] = 6

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco("IHDR", cabecalho),
    bloco("IDAT", deflateSync(linhas, { level: 9 })),
    bloco("IEND", Buffer.alloc(0)),
  ])
}

const icones = [
  ["favicon-32.png", 32, false],
  ["apple-touch-icon.png", 180, false],
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
]

for (const [nome, tamanho, mascara] of icones) {
  writeFileSync(resolve(diretorio, nome), gerarPng(tamanho, mascara))
}
