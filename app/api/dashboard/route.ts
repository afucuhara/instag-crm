import { jsonError, requireAppUser } from "@/lib/crm-server";

export async function GET(request: Request) {
  try {
    const { supabase, profile: user } = await requireAppUser();
    const url = new URL(request.url);
    const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") ?? "")
      ? url.searchParams.get("month")!
      : new Date().toISOString().slice(0, 7);

    const [{ data: clientsData, error: clientsError }, { data: postsData, error: postsError }, { data: workTypesData }, { data: designersData }, { data: membersData }] = await Promise.all([
      supabase.from("clients").select("*").order("name"),
      supabase.from("posts").select("*, post_assets(id,filename,mime_type,size,sort_order)").order("created_at", { ascending: false }).limit(300),
      supabase.from("work_types").select("id,name,default_value,active").eq("active", true).order("name"),
      user.role === "admin" ? supabase.from("profiles").select("id,email,name,role,status").eq("role", "designer").order("name") : Promise.resolve({ data: [{ ...user }], error: null }),
      supabase.from("client_members").select("client_id,user_id"),
    ]);
    if (clientsError) throw clientsError; if (postsError) throw postsError;
    const clients = clientsData ?? []; const posts = postsData ?? []; const workTypes = workTypesData ?? []; const designers = designersData ?? []; const members = membersData ?? [];
    const clientIds = [...new Set(posts.map((post) => post.client_id))]; const designerIds = [...new Set(posts.map((post) => post.designer_id))];
    const [{ data: postClients }, { data: postDesigners }] = await Promise.all([
      clientIds.length ? supabase.from("clients").select("id,name,brand_color").in("id", clientIds) : Promise.resolve({ data: [] }),
      designerIds.length ? supabase.from("profiles").select("id,name").in("id", designerIds) : Promise.resolve({ data: [] }),
    ]);
    const clientMap = new Map((postClients ?? []).map((item) => [item.id, item])); const designerMap = new Map((postDesigners ?? []).map((item) => [item.id, item])); const workMap = new Map(workTypes.map((item) => [item.id, item]));
    const hydratedPosts = posts.map((post) => ({ ...post, client_name: clientMap.get(post.client_id)?.name ?? "Cliente", brand_color: clientMap.get(post.client_id)?.brand_color ?? "#6d5dfc", designer_name: designerMap.get(post.designer_id)?.name ?? "Designer", work_type_name: workMap.get(post.work_type_id)?.name ?? "Trabalho", default_value: workMap.get(post.work_type_id)?.default_value ?? 8, assets: post.post_assets ?? [] }));
    const monthPosts = hydratedPosts.filter((post) => String(post.approved_at ?? "").slice(0, 7) === month);
    const counts = new Map<string, number>(); for (const post of hydratedPosts) if (String(post.scheduled_date ?? "").slice(0, 7) === month) counts.set(post.client_id, (counts.get(post.client_id) ?? 0) + 1);
    const hydratedClients = clients.map((client) => ({ ...client, posts_this_month: counts.get(client.id) ?? 0 }));
    const hydratedDesigners = designers.map((designer) => ({ ...designer, client_count: members.filter((member) => member.user_id === designer.id).length, month_earnings: monthPosts.filter((post) => post.designer_id === designer.id && ["approved", "scheduled", "published"].includes(post.status)).reduce((sum, post) => sum + Number(post.approved_value ?? 0), 0) }));
    const earnings = monthPosts.filter((post) => ["approved", "scheduled", "published"].includes(String(post.status))).reduce((total, post) => total + Number(post.approved_value ?? 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const stats = {
      activeClients: hydratedClients.filter((client) => client.status === "active").length,
      awaitingApproval: hydratedPosts.filter((post) => post.status === "submitted").length,
      approvedThisMonth: monthPosts.length,
      earnings,
      postsToday: hydratedPosts.filter((post) => String(post.submitted_at).slice(0, 10) === today).length,
    };
    return Response.json({ user, month, clients: hydratedClients, posts: hydratedPosts, designers: hydratedDesigners, workTypes, stats });
  } catch (error) { return jsonError(error); }
}
