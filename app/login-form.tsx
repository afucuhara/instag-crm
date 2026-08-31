"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setLoading(true);
    const form = new FormData(event.currentTarget); const email = String(form.get("email") ?? ""); const password = String(form.get("password") ?? ""); const name = String(form.get("name") ?? "");
    const supabase = createClient();
    const result = mode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (result.error) setError(result.error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : result.error.message);
    else if (mode === "signup" && !result.data.session) setMessage("Cadastro criado. Confirme seu e-mail para entrar.");
    else window.location.assign("/");
    setLoading(false);
  }
  return <form className="auth-form" onSubmit={submit}>{mode === "signup" && <label className="field"><span>Nome completo</span><input name="name" required placeholder="Seu nome"/></label>}<label className="field"><span>E-mail</span><input name="email" type="email" required placeholder="voce@email.com"/></label><label className="field"><span>Senha</span><input name="password" type="password" minLength={8} required placeholder="Mínimo de 8 caracteres"/></label>{error&&<p className="auth-error">{error}</p>}{message&&<p className="auth-message">{message}</p>}<button className="login-button" disabled={loading}>{loading?"Aguarde...":mode==="login"?"Entrar":"Criar conta"}<span>→</span></button><button type="button" className="auth-switch" onClick={()=>{setMode(mode==="login"?"signup":"login");setError("");setMessage("")}}>{mode==="login"?"Ainda não tenho acesso":"Já tenho uma conta"}</button></form>;
}
