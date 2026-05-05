import Link from "next/link"

export const metadata = {
  title: "Política de Privacidade | InfraStudio",
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#040816] px-4 py-16 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-white/10 bg-slate-950/70 p-8 shadow-2xl backdrop-blur-xl md:p-12">
        <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
          InfraStudio
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-white md:text-4xl">Política de Privacidade</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Esta política descreve como a InfraStudio coleta, utiliza e protege dados pessoais em seus fluxos de autenticação,
          atendimento, integracoes e operacao da plataforma.
        </p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-300">
          <section>
            <h2 className="text-lg font-semibold text-white">1. Dados coletados</h2>
            <p className="mt-2">
              Podemos coletar nome, email, foto de perfil, identificadores de login social, dados enviados em formulários,
              mensagens trocadas em atendimentos, configuracoes de projeto e metadados tecnicos necessários para seguranca e operacao.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">2. Uso das informações</h2>
            <p className="mt-2">
              Os dados são utilizados para autenticar usuários, manter o funcionamento do atendimento, registrar históricos,
              entregar integracoes solicitadas, monitorar consumo da plataforma e cumprir obrigacoes legais e contratuais.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">3. Compartilhamento</h2>
            <p className="mt-2">
              Dados podem ser processados por provedores de infraestrutura, autenticação, banco de dados, mensageria e IA quando isso for
              necessário para prestar o serviço contratado. Não comercializamos dados pessoais.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">4. Seguranca e retencao</h2>
            <p className="mt-2">
              Adotamos controles tecnicos e operacionais para reduzir risco de acesso indevido. Os dados sao mantidos pelo tempo necessário
              para operacao da conta, auditoria, suporte e cumprimento de exigencias legais.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">5. Direitos do titular</h2>
            <p className="mt-2">
              O titular pode solicitar atualizacao, correcao ou exclusao de dados pessoais, observado o que for necessário para seguranca,
              prevencao a fraude e obrigacoes legais.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">6. Contato</h2>
            <p className="mt-2">
              Para assuntos de privacidade, utilize os canais oficiais informados pela InfraStudio dentro da plataforma ou no atendimento
              comercial.
            </p>
          </section>
        </div>

        <div className="mt-10">
          <Link href="/" className="text-sm font-semibold text-cyan-200 transition hover:text-cyan-100">
            Voltar para a home
          </Link>
        </div>
      </div>
    </main>
  )
}
