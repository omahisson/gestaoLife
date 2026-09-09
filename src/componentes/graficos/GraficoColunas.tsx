import { formatarMoeda } from "../../dominio/regras-financeiras"

const COR_BARRA_NORMAL = "#BFDBFE"
const COR_BARRA_ATIVA = "#1A56DB"
const HACHURA_CSS = [
  "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.28) 4px, rgba(255,255,255,0.28) 6px)",
  "repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.28) 4px, rgba(255,255,255,0.28) 6px)",
].join(", ")

interface PropriedadesGraficoColunas {
  valores: number[]
  rotulos: string[]
  indiceDestacado: number | null
  aoClicar: (indice: number) => void
}

export default function GraficoColunas({
  valores,
  rotulos,
  indiceDestacado,
  aoClicar,
}: PropriedadesGraficoColunas) {
  const valorMaximo = Math.max(...valores, 1)

  return (
    <div className="flex items-end justify-between gap-1.5 pt-10 pb-1">
      {valores.map((valor, indice) => {
        const estaAtiva = indiceDestacado === indice
        const alturaEmPixels =
          valor > 0 ? Math.max((valor / valorMaximo) * 104, 10) : 3

        return (
          <button
            key={indice}
            onClick={() => aoClicar(indice)}
            className="flex-1 flex flex-col items-center gap-1.5 group relative"
          >
            {estaAtiva && valor > 0 && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1A56DB] text-white text-[9px] font-bold px-2 py-1 rounded-lg whitespace-nowrap z-10">
                {formatarMoeda(valor)}
                <span
                  className="absolute top-full left-1/2 -translate-x-1/2 block w-0 h-0"
                  style={{
                    borderLeft: "4px solid transparent",
                    borderRight: "4px solid transparent",
                    borderTop: "4px solid #1A56DB",
                  }}
                />
              </div>
            )}
            <div
              className="w-full transition-all duration-300"
              style={{
                height: `${alturaEmPixels}px`,
                minHeight: valor > 0 ? "8px" : "3px",
                borderRadius: "8px",
                backgroundColor: estaAtiva ? COR_BARRA_ATIVA : COR_BARRA_NORMAL,
                backgroundImage: estaAtiva ? HACHURA_CSS : "none",
                opacity: valor === 0 ? 0.35 : 1,
              }}
            />
            <span
              className="text-[10px] font-semibold transition-colors"
              style={{ color: estaAtiva ? COR_BARRA_ATIVA : "#4B5563" }}
            >
              {rotulos[indice]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
