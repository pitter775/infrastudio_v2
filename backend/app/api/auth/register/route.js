import { NextResponse } from "next/server"

import { registerUsuarioWithProjeto } from "@/lib/auth-registration"

export async function POST(request) {
  try {
    const { nome, email, senha, confirmarSenha } = await request.json()

    if (!nome?.trim() || !email?.trim() || !senha || !confirmarSenha) {
      return NextResponse.json({ error: "Nome, email e senha sao obrigatorios." }, { status: 400 })
    }

    if (senha !== confirmarSenha) {
      return NextResponse.json({ error: "A confirmacao de senha nao confere." }, { status: 400 })
    }

    if (senha.trim().length < 6) {
      return NextResponse.json({ error: "A senha precisa ter pelo menos 6 caracteres." }, { status: 400 })
    }

    const result = await registerUsuarioWithProjeto({ nome, email, senha })

    if (!result.ok) {
      const alreadyExists = result.reason === "email_already_exists"
      return NextResponse.json(
        {
          error: alreadyExists
            ? "Ja existe uma conta com este email."
            : "Nao foi possivel concluir seu cadastro agora.",
        },
        { status: alreadyExists ? 409 : 500 },
      )
    }

    return NextResponse.json({ message: "Conta criada. Voce ja pode entrar." }, { status: 201 })
  } catch (error) {
    console.error("[auth] register failed", error)
    return NextResponse.json({ error: "Nao foi possivel concluir seu cadastro agora." }, { status: 500 })
  }
}
