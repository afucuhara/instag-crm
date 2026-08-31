import { jsonError, requireAppUser } from "@/lib/crm-server";

const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  try {
    const { supabase, profile: user } = await requireAppUser();
    const form = await request.formData();
    const clientId = String(form.get("clientId") ?? "");
    const designerId = user.role === "admin" && form.get("designerId") ? String(form.get("designerId")) : user.id;
    const title = String(form.get("title") ?? "").trim();
    const caption = String(form.get("caption") ?? "").trim();
    const format = form.get("format") === "carousel" ? "carousel" : "single";
    const workTypeId = String(form.get("workTypeId") ?? "");
    const scheduledDate = String(form.get("scheduledDate") ?? "") || null;
    const customRaw = String(form.get("customValue") ?? "");
    const customValue = customRaw === "" ? null : Number(customRaw);
    const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
    if (!title || !clientId || !workTypeId) return Response.json({ error: "Preencha cliente, título e tipo de trabalho." }, { status: 400 });
    if (!files.length || files.length > 20) return Response.json({ error: "Envie de 1 a 20 imagens." }, { status: 400 });
    if (format === "single" && files.length !== 1) return Response.json({ error: "Post único aceita exatamente uma imagem." }, { status: 400 });
    if (files.some((file) => !ACCEPTED.has(file.type) || file.size > 25 * 1024 * 1024)) return Response.json({ error: "Use PNG, JPG ou WebP, com até 25 MB por arquivo." }, { status: 400 });
    if (user.role !== "admin") {
      const { data: permission } = await supabase.from("client_members").select("client_id").eq("client_id", clientId).eq("user_id", user.id).maybeSingle();
      if (!permission) return Response.json({ error: "Você não tem acesso a este cliente." }, { status: 403 });
    }
    const { data: post, error: postError } = await supabase.from("posts").insert({ client_id: clientId, designer_id: designerId, work_type_id: workTypeId, title, caption, format, scheduled_date: scheduledDate, custom_value: Number.isFinite(customValue) ? customValue : null }).select("id").single();
    if (postError) throw postError;
    const assetRows: { id: string; storage_path: string; filename: string; mime_type: string; size: number; sort_order: number }[] = [];
    for (let index = 0; index < files.length; index++) {
      const file = files[index]; const assetId = crypto.randomUUID();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = `${post.id}/${String(index + 1).padStart(2, "0")}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("post-assets").upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      assetRows.push({ id: assetId, storage_path: storagePath, filename: file.name, mime_type: file.type, size: file.size, sort_order: index });
    }
    const { error: assetError } = await supabase.from("post_assets").insert(assetRows.map((asset) => ({ ...asset, post_id: post.id })));
    if (assetError) throw assetError;
    return Response.json({ id: post.id }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
