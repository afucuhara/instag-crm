import { createClient } from "@/lib/supabase/server";
import { CrmApp } from "./crm-app";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="login-mark">I</div>
          <p className="eyebrow">INSTAG CRM</p>
          <h1>Sua operação de social media, em um só lugar.</h1>
          <p>Organize clientes, calendário, entregas, aprovações e pagamentos com acesso seguro para toda a equipe.</p>
          <LoginForm />
          <small>Autenticação segura pelo Supabase. O administrador define as permissões de cada designer.</small>
        </section>
      </main>
    );
  }
  return <CrmApp identity={{ displayName: user.user_metadata?.full_name ?? user.email ?? "Usuário", email: user.email ?? "", fullName: user.user_metadata?.full_name ?? null }} />;
}
