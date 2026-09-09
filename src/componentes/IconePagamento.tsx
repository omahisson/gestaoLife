import type { TipoPagamento } from "../dominio/modelos"

export default function IconePagamento({ tipo }: { tipo: TipoPagamento }) {
  if (tipo === "cartao") {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <rect x="2" y="5" width="20" height="14" rx="3" />
          <path d="M2 10h20" />
          <path d="M6 15h4" />
        </svg>
      </div>
    )
  }

  if (tipo === "pix") {
    return (
      <div className="w-full h-full flex items-center justify-center text-[#1A56DB]">
        <svg viewBox="0 0 20 20" width="17" height="17" fill="currentColor">
          <g transform="translate(10,10)">
            <rect
              x="-2.4"
              y="-7.5"
              width="4.8"
              height="6"
              rx="2.4"
              transform="rotate(45)"
            />
            <rect
              x="-2.4"
              y="1.5"
              width="4.8"
              height="6"
              rx="2.4"
              transform="rotate(45)"
            />
            <rect
              x="-2.4"
              y="-7.5"
              width="4.8"
              height="6"
              rx="2.4"
              transform="rotate(-45)"
            />
            <rect
              x="-2.4"
              y="1.5"
              width="4.8"
              height="6"
              rx="2.4"
              transform="rotate(-45)"
            />
          </g>
        </svg>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex items-center justify-center text-emerald-600">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="7" width="20" height="13" rx="2" />
        <circle cx="12" cy="13.5" r="2.5" />
        <path d="M6 10h.01M18 10h.01" />
        <path d="M3 4h18" />
      </svg>
    </div>
  )
}
