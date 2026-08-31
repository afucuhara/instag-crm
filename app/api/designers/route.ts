import { jsonError, requireAdmin, requireAppUser } from "@/lib/crm-server";

export async function POST(request: Request) {
  try {
    const { supabase, profile: user } = await requireAppUser(); requireAdmin(user);
    const body = await request.json() as { name?: string; email?: string };
    const name = body.name?.trim(); const email = body.email?.trim().toLowerCase();
    if (!name || !email || !email.includes("@")) return Response.json({ error: "Informe nome e e-mail válidos." }, { status: 400 });
    const { data: existing } = await supabase.from("profiles").select("id,role").eq("email", email).maybeSingle();
    if (!existing) return Response.json({ error: "O designer precisa criar a conta primeiro pela tela de login. Depois, cadastre o mesmo e-mail aqui." }, { status: 409 });
    if (existing.role !== "designer") return Response.json({ error: "Este e-mail já pertence a um administrador." }, { status: 409 });
    return Response.json({ id: existing.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("UNIQUE") ? "Este e-mail já está cadastrado." : null;
    return message ? Response.json({ error: message }, { status: 409 }) : jsonError(error);
  }
}
