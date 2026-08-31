import { jsonError, requireAdmin, requireAppUser } from "@/lib/crm-server";

export async function POST(request: Request) {
  try {
    const { supabase, profile: user } = await requireAppUser(); requireAdmin(user);
    const body = await request.json() as { name?: string; defaultValue?: number };
    const name = body.name?.trim(); const value = Number(body.defaultValue);
    if (!name || !Number.isFinite(value) || value < 0) return Response.json({ error: "Informe o serviço e um valor válido." }, { status: 400 });
    const { data, error } = await supabase.from("work_types").insert({ name, default_value: value, active: true }).select("id").single();
    if (error) throw error;
    return Response.json({ id: data.id }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
