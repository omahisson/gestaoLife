export const COR_UTILIZADA = "#FB923C"
export const COR_RESTANTE = "#C2D9EE"

interface PropriedadesBarraSegmentada {
  utilizadas: number
  restantes: number
}

export default function BarraSegmentada({
  utilizadas,
  restantes,
}: PropriedadesBarraSegmentada) {
  const total = utilizadas + restantes
  if (total === 0) return null

  const quantidadeMaximaDeSegmentos = 28
  const fatorDeReducao =
    total > quantidadeMaximaDeSegmentos
      ? quantidadeMaximaDeSegmentos / total
      : 1
  const segmentosUtilizados = Math.max(
    Math.round(utilizadas * fatorDeReducao),
    utilizadas > 0 ? 1 : 0,
  )
  const segmentosRestantes = Math.max(
    Math.round(restantes * fatorDeReducao),
    restantes > 0 ? 1 : 0,
  )

  return (
    <div className="flex gap-[2.5px]">
      {Array.from({ length: segmentosUtilizados }).map((_, indice) => (
        <div
          key={`utilizada-${indice}`}
          className="h-3 flex-1 rounded-[3px]"
          style={{ backgroundColor: COR_UTILIZADA, minWidth: 0 }}
        />
      ))}
      {Array.from({ length: segmentosRestantes }).map((_, indice) => (
        <div
          key={`restante-${indice}`}
          className="h-3 flex-1 rounded-[3px]"
          style={{ backgroundColor: COR_RESTANTE, minWidth: 0 }}
        />
      ))}
    </div>
  )
}
