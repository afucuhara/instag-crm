import { jsonError, requireAdmin, requireAppUser } from "@/lib/crm-server";

export async function POST(request: Request) {
  try {
    const { supabase, profile: user } = await requireAppUser(); requireAdmin(user);
    const body = await request.json() as { name?: string; segment?: string; monthlyPostGoal?: number; brandColor?: string; designerIds?: string[] };
    const name = body.name?.trim();
    if (!name) return Response.json({ error: "Informe o nome do cliente." }, { status: 400 });
    const id = crypto.randomUUID();
    const goal = Math.max(1, Math.min(100, Number(body.monthlyPostGoal) || 12));
    const color = /^#[0-9a-f]{6}$/i.test(body.brandColor ?? "") ? body.brandColor! : "#6d5dfc";
    const { error } = await supabase.from("clients").insert({ id, name, segment: body.segment?.trim() ?? "", brand_color: color, monthly_post_goal: goal });
    if (error) throw error;
    const designerIds = (body.designerIds ?? []).filter(Boolean);
    if (designerIds.length) { const { error: memberError } = await supabase.from("client_members").insert(designerIds.map((designerId) => ({ client_id: id, user_id: designerId }))); if (memberError) throw memberError; }
    return Response.json({ id }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
