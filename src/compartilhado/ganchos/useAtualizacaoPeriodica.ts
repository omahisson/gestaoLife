import { useEffect, useState } from "react"

/**
 * Solicita uma nova renderização no intervalo informado.
 * Útil para valores derivados do relógio, sem expor detalhes do temporizador.
 */
export default function useAtualizacaoPeriodica(
  intervaloEmMilissegundos: number,
) {
  const [, definirCiclo] = useState(0)

  useEffect(() => {
    const identificador = window.setInterval(
      () => definirCiclo((cicloAtual) => cicloAtual + 1),
      intervaloEmMilissegundos,
    )

    return () => window.clearInterval(identificador)
  }, [intervaloEmMilissegundos])
}
