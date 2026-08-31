import { jsonError, requireAppUser } from "@/lib/crm-server";

type PostRecord = {
  id: string;
  designer_id: string;
  caption: string | null;
  custom_value: number | null;
  work_types: { default_value: number } | null;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, profile: user } = await requireAppUser(); const { id } = await context.params;
    const { data: post, error: postError } = await supabase.from("posts").select("*, work_types(default_value)").eq("id", id).maybeSingle<PostRecord>();
    if (postError) throw postError;
    if (!post) return Response.json({ error: "Trabalho não encontrado." }, { status: 404 });
    if (user.role !== "admin" && post.designer_id !== user.id) return Response.json({ error: "Sem permissão para este trabalho." }, { status: 403 });
    const body = await request.json() as { action?: string; feedback?: string; caption?: string; scheduledDate?: string | null; customValue?: number | null };
    if (user.role === "designer") {
      if (body.action !== "resubmit") return Response.json({ error: "Ação não permitida." }, { status: 403 });
      const { error } = await supabase.from("posts").update({ caption: body.caption ?? post.caption, status: "submitted", feedback: "", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      return Response.json({ ok: true });
    }
    const custom = body.customValue === null || body.customValue === undefined ? post.custom_value : Number(body.customValue);
    if (body.action === "approve") {
      const value = Number.isFinite(Number(custom)) ? Number(custom) : Number(post.work_types?.default_value ?? 8);
      const { error } = await supabase.from("posts").update({ status: "approved", custom_value: custom, approved_value: value, feedback: "", approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    } else if (body.action === "changes") {
      const { error } = await supabase.from("posts").update({ status: "changes", feedback: body.feedback?.trim() ?? "", updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    } else if (["scheduled", "published"].includes(body.action ?? "")) {
      const { error } = await supabase.from("posts").update({ status: body.action, ...(body.scheduledDate ? { scheduled_date: body.scheduledDate } : {}), updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("posts").update({ ...(body.caption !== undefined ? { caption: body.caption } : {}), scheduled_date: body.scheduledDate ?? null, custom_value: custom, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    }
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}
