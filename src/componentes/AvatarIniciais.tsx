interface PropriedadesAvatarIniciais {
  nome: string
  tamanho?: number
  cor?: string
  corTexto?: string
  aoClicar?: () => void
}

export default function AvatarIniciais({
  nome,
  tamanho = 36,
  cor = "#3A7EBF",
  corTexto = "white",
  aoClicar,
}: PropriedadesAvatarIniciais) {
  const iniciais = nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("")

  return (
    <button
      onClick={aoClicar}
      className="rounded-full flex items-center justify-center font-bold shrink-0 shadow-sm hover:opacity-90 transition-opacity active:scale-95"
      style={{
        width: tamanho,
        height: tamanho,
        background: cor,
        fontSize: tamanho * 0.38,
        color: corTexto,
      }}
      aria-label="Perfil"
    >
      {iniciais}
    </button>
  )
}
