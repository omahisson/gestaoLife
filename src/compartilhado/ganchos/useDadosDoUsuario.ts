import { useEffect, useState } from "react"
import {
  carregarDadosDoUsuario,
  salvarDadosDoUsuario,
} from "../../dados/repositorio-remoto"
import type {
  Cartao,
  Despesa,
  DespesaPrevista,
  Meta,
  Nota,
} from "../../dominio/modelos"

export default function useDadosDoUsuario(usuarioId: string) {
  const [nomeUsuario, definirNomeUsuario] = useState("")
  const [diaFechamento, definirDiaFechamento] = useState(30)
  const [cartoes, definirCartoes] = useState<Cartao[]>([])
  const [despesas, definirDespesas] = useState<Despesa[]>([])
  const [despesasPrevistas, definirDespesasPrevistas] = useState<
    DespesaPrevista[]
  >([])
  const [notas, definirNotas] = useState<Nota[]>([])
  const [metas, definirMetas] = useState<Meta[]>([])
  const [dadosCarregados, definirDadosCarregados] = useState(false)
  const [erroDosDados, definirErroDosDados] = useState("")
  const [indiceDeRecarga, definirIndiceDeRecarga] = useState(0)

  useEffect(() => {
    let efeitoCancelado = false
    definirDadosCarregados(false)
    definirErroDosDados("")
    carregarDadosDoUsuario(usuarioId)
      .then((dados) => {
        if (efeitoCancelado) return
        definirNomeUsuario(dados.nomeUsuario)
        definirDiaFechamento(dados.diaFechamento)
        definirCartoes(dados.cartoes)
        definirDespesas(dados.despesas)
        definirDespesasPrevistas(dados.despesasPrevistas)
        definirNotas(dados.notas)
        definirMetas(dados.metas)
        definirDadosCarregados(true)
      })
      .catch(() => {
        if (!efeitoCancelado) {
          definirErroDosDados("Não foi possível carregar os dados do servidor.")
        }
      })
    return () => {
      efeitoCancelado = true
    }
  }, [usuarioId, indiceDeRecarga])

  useEffect(() => {
    if (!dadosCarregados) return
    salvarDadosDoUsuario(usuarioId, {
      nomeUsuario,
      diaFechamento,
      cartoes,
      despesas,
      despesasPrevistas,
      notas,
      metas,
    })
      .then(() => definirErroDosDados(""))
      .catch(() => {
        definirErroDosDados("Não foi possível salvar os dados no servidor.")
      })
  }, [
    usuarioId,
    dadosCarregados,
    nomeUsuario,
    diaFechamento,
    cartoes,
    despesas,
    despesasPrevistas,
    notas,
    metas,
  ])

  return {
    nomeUsuario,
    definirNomeUsuario,
    diaFechamento,
    definirDiaFechamento,
    cartoes,
    definirCartoes,
    despesas,
    definirDespesas,
    despesasPrevistas,
    definirDespesasPrevistas,
    notas,
    definirNotas,
    metas,
    definirMetas,
    dadosCarregados,
    erroDosDados,
    recarregarDados: () => definirIndiceDeRecarga((indice) => indice + 1),
  }
}
