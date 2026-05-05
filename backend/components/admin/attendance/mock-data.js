export const conversations = [
  {
    id: "marina-costa",
    cliente: {
      nome: "Marina Costa",
    },
    mensagens: [
      {
        id: "msg-001",
        autor: "cliente",
        texto: "Bom dia, gostaria de saber o status do meu projeto.",
        horario: "09:31",
      },
      {
        id: "msg-002",
        autor: "atendente",
        texto: "Bom dia, Marina. Vou verificar as informações e já te retorno.",
        horario: "09:32",
      },
      {
        id: "msg-003",
        autor: "cliente",
        texto: "Perfeito. Pode me enviar o orcamento atualizado?",
        horario: "09:42",
      },
    ],
    status: "humano",
    origem: "whatsapp",
  },
  {
    id: "rafael-lima",
    cliente: {
      nome: "Rafael Lima",
    },
    mensagens: [
      {
        id: "msg-004",
        autor: "cliente",
        texto: "Recebi a proposta do projeto.",
        horario: "09:10",
      },
      {
        id: "msg-005",
        autor: "atendente",
        texto: "Certo, Rafael. Fico disponivel se quiser revisar algum ponto.",
        horario: "09:14",
      },
      {
        id: "msg-006",
        autor: "cliente",
        texto: "Obrigado pelo retorno. Vou analisar.",
        horario: "09:18",
      },
    ],
    status: "ia",
    origem: "site",
  },
  {
    id: "clara-mendes",
    cliente: {
      nome: "Clara Mendes",
    },
    mensagens: [
      {
        id: "msg-007",
        autor: "cliente",
        texto: "Preciso ajustar os dados do projeto.",
        horario: "08:55",
      },
      {
        id: "msg-008",
        autor: "atendente",
        texto: "Claro, Clara. Me envie os dados corretos para atualizacao.",
        horario: "08:56",
      },
    ],
    status: "humano",
    origem: "whatsapp",
  },
  {
    id: "bruno-rocha",
    cliente: {
      nome: "Bruno Rocha",
    },
    mensagens: [
      {
        id: "msg-009",
        autor: "cliente",
        texto: "Conseguimos marcar uma reuniao hoje?",
        horario: "Ontem",
      },
      {
        id: "msg-010",
        autor: "atendente",
        texto: "Sim, temos disponibilidade no fim da tarde.",
        horario: "Ontem",
      },
    ],
    status: "ia",
    origem: "whatsapp",
  },
  {
    id: "helena-duarte",
    cliente: {
      nome: "Helena Duarte",
    },
    mensagens: [
      {
        id: "msg-011",
        autor: "cliente",
        texto: "Enviei os arquivos solicitados.",
        horario: "Ontem",
      },
      {
        id: "msg-012",
        autor: "atendente",
        texto: "Recebido, Helena. Vamos validar e retornar em seguida.",
        horario: "Ontem",
      },
    ],
    status: "humano",
    origem: "site",
  },
]
