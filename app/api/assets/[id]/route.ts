import { jsonError, requireAppUser } from "@/lib/crm-server";

type AssetRecord = {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  storage_path: string;
  posts: { designer_id: string; client_id: string } | null;
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, profile: user } = await requireAppUser(); const { id } = await context.params;
    const { data: asset, error: assetError } = await supabase.from("post_assets").select("*, posts(designer_id,client_id)").eq("id", id).maybeSingle<AssetRecord>();
    if (assetError) throw assetError;
    if (!asset) return new Response("Arquivo não encontrado.", { status: 404 });
    if (user.role !== "admin" && asset.posts?.designer_id !== user.id) return new Response("Sem permissão.", { status: 403 });
    const { data: object, error: downloadError } = await supabase.storage.from("post-assets").download(String(asset.storage_path));
    if (downloadError || !object) return new Response("Arquivo não encontrado.", { status: 404 });
    return new Response(object, { headers: { "content-type": String(asset.mime_type), "content-length": String(asset.size), "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(String(asset.filename))}`, "cache-control": "private, max-age=300" } });
  } catch (error) { return jsonError(error); }
}
