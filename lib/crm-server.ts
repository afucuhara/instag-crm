import { createClient } from "@/lib/supabase/server";

export type AppUser = { id: string; email: string; name: string; role: "admin" | "designer"; status: "active" | "inactive" };

export async function requireAppUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Response(JSON.stringify({ error: "Faça login para continuar." }), { status: 401, headers: { "content-type": "application/json" } });
  const { data: profile } = await supabase.from("profiles").select("id,email,name,role,status").eq("id", user.id).single<AppUser>();
  if (!profile) throw new Response(JSON.stringify({ error: "Perfil ainda não foi criado. Confirme o e-mail e tente novamente." }), { status: 403, headers: { "content-type": "application/json" } });
  if (profile.status !== "active") throw new Response(JSON.stringify({ error: "Esta conta está inativa." }), { status: 403, headers: { "content-type": "application/json" } });
  return { supabase, user, profile };
}

export function jsonError(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
  return Response.json({ error: message }, { status: 500 });
}

export function requireAdmin(user: AppUser) {
  if (user.role !== "admin") throw new Response(JSON.stringify({ error: "Apenas administradores podem realizar esta ação." }), { status: 403, headers: { "content-type": "application/json" } });
}
