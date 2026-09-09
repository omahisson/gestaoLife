import { useCallback, useRef } from "react"

/** Gera identificadores numéricos seguros para múltiplos navegadores. */
export default function useGeradorDeIdentificador() {
  const identificadoresDaSessao = useRef(new Set<number>())

  return useCallback(() => {
    let identificador = 0
    do {
      const partes = crypto.getRandomValues(new Uint32Array(2))
      identificador = partes[0] * 0x20_0000 + (partes[1] & 0x1f_ffff)
    } while (
      identificador <= 1_000 ||
      identificadoresDaSessao.current.has(identificador)
    )
    identificadoresDaSessao.current.add(identificador)
    return identificador
  }, [])
}
