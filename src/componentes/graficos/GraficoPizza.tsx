import { CORES_GRAFICO_PIZZA } from "../../dominio/constantes"
import { formatarMoeda } from "../../dominio/regras-financeiras"

interface ItemGraficoPizza {
  nome: string
  valor: number
}

export default function GraficoPizza({ itens }: { itens: ItemGraficoPizza[] }) {
  const total = itens.reduce((acumulado, item) => acumulado + item.valor, 0)
  if (total === 0)
    return (
      <p className="text-sm text-gray-600 text-center py-6">
        Sem dados neste período.
      </p>
    )

  const itensOrdenados = [...itens].sort(
    (primeiro, segundo) => segundo.valor - primeiro.valor,
  )
  const principaisItens = itensOrdenados.slice(0, 5)
  const valorDosDemais = itensOrdenados
    .slice(5)
    .reduce((acumulado, item) => acumulado + item.valor, 0)
  const dados =
    valorDosDemais > 0
      ? [...principaisItens, { nome: "Outros", valor: valorDosDemais }]
      : principaisItens

  const raioExterno = 52
  const raioInterno = 30
  const centroX = 64
  const centroY = 64
  let anguloAtual = -Math.PI / 2

  const fatias = dados.map((item, indice) => {
    const proporcao = item.valor / total
    const anguloInicial = anguloAtual
    const anguloFinal = anguloAtual + proporcao * 2 * Math.PI
    anguloAtual = anguloFinal
    const arcoMaior = proporcao > 0.5 ? 1 : 0
    let caminho: string

    if (proporcao >= 0.9999) {
      caminho = `M${centroX} ${centroY - raioExterno} A${raioExterno} ${raioExterno} 0 1 1 ${centroX - 0.01} ${centroY - raioExterno} L${centroX - 0.01} ${centroY - raioInterno} A${raioInterno} ${raioInterno} 0 1 0 ${centroX} ${centroY - raioInterno} Z`
    } else {
      const x1 = centroX + raioExterno * Math.cos(anguloInicial)
      const y1 = centroY + raioExterno * Math.sin(anguloInicial)
      const x2 = centroX + raioExterno * Math.cos(anguloFinal)
      const y2 = centroY + raioExterno * Math.sin(anguloFinal)
      const xInterno1 = centroX + raioInterno * Math.cos(anguloInicial)
      const yInterno1 = centroY + raioInterno * Math.sin(anguloInicial)
      const xInterno2 = centroX + raioInterno * Math.cos(anguloFinal)
      const yInterno2 = centroY + raioInterno * Math.sin(anguloFinal)
      caminho = `M${x1.toFixed(2)} ${y1.toFixed(2)} A${raioExterno} ${raioExterno} 0 ${arcoMaior} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L${xInterno2.toFixed(2)} ${yInterno2.toFixed(2)} A${raioInterno} ${raioInterno} 0 ${arcoMaior} 0 ${xInterno1.toFixed(2)} ${yInterno1.toFixed(2)}Z`
    }

    return {
      caminho,
      cor: CORES_GRAFICO_PIZZA[indice % CORES_GRAFICO_PIZZA.length],
      nome: item.nome,
      percentual: Math.round(proporcao * 100),
      valor: item.valor,
    }
  })

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
        <svg width="128" height="128" viewBox="0 0 128 128">
          {fatias.map((fatia, indice) => (
            <path
              key={indice}
              d={fatia.caminho}
              fill={fatia.cor}
              stroke="white"
              strokeWidth="2.5"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[9px] text-gray-600 font-medium">Total</span>
          <span className="text-[10px] font-bold text-gray-900 leading-tight">
            {formatarMoeda(total)}
          </span>
        </div>
      </div>
      <div className="flex-1 space-y-2.5 min-w-0">
        {fatias.map((fatia, indice) => (
          <div key={indice} className="flex items-start gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
              style={{ backgroundColor: fatia.cor }}
            />
            <span className="text-xs text-gray-600 flex-1 truncate leading-tight">
              {fatia.nome}
            </span>
            <div className="flex flex-col items-end shrink-0 ml-1">
              <span className="text-xs font-bold text-gray-900 tabular-nums leading-tight">
                {fatia.percentual}%
              </span>
              <span className="text-[10px] text-gray-600 tabular-nums leading-tight">
                {formatarMoeda(fatia.valor)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
