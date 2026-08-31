create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null default 'designer' check (role in ('admin', 'designer')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text not null default '',
  brand_color text not null default '#6d5dfc' check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  monthly_post_goal integer not null default 12 check (monthly_post_goal between 1 and 100),
  status text not null default 'active' check (status in ('active', 'paused')),
  created_at timestamptz not null default now()
);

create table if not exists public.client_members (
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);

create table if not exists public.work_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_value numeric(10,2) not null default 8 check (default_value >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  designer_id uuid not null references public.profiles(id),
  work_type_id uuid not null references public.work_types(id),
  title text not null,
  caption text not null default '',
  format text not null default 'single' check (format in ('single', 'carousel')),
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'changes', 'approved', 'scheduled', 'published')),
  scheduled_date date,
  custom_value numeric(10,2) check (custom_value >= 0),
  approved_value numeric(10,2) check (approved_value >= 0),
  feedback text not null default '',
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.post_assets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_path text not null unique,
  filename text not null,
  mime_type text not null,
  size integer not null check (size > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  designer_id uuid not null references public.profiles(id),
  reference_month text not null check (reference_month ~ '^\\d{4}-\\d{2}$'),
  amount numeric(10,2) not null default 0 check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (designer_id, reference_month)
);

create index if not exists client_members_user_idx on public.client_members(user_id);
create index if not exists posts_client_idx on public.posts(client_id);
create index if not exists posts_designer_idx on public.posts(designer_id);
create index if not exists posts_status_idx on public.posts(status);
create index if not exists posts_scheduled_idx on public.posts(scheduled_date);
create index if not exists post_assets_post_idx on public.post_assets(post_id);
create index if not exists payments_designer_idx on public.payments(designer_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when not exists (select 1 from public.profiles) then 'admin' else 'designer' end
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create schema if not exists private;
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin' and status = 'active');
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

insert into public.work_types (name, default_value) select 'Post único', 8 where not exists (select 1 from public.work_types where name = 'Post único');
insert into public.work_types (name, default_value) select 'Carrossel', 8 where not exists (select 1 from public.work_types where name = 'Carrossel');

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_members enable row level security;
alter table public.work_types enable row level security;
alter table public.posts enable row level security;
alter table public.post_assets enable row level security;
alter table public.payments enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using (id = (select auth.uid()) or private.is_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists clients_admin_all on public.clients;
create policy clients_admin_all on public.clients for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists clients_member_select on public.clients;
create policy clients_member_select on public.clients for select to authenticated using (exists (select 1 from public.client_members cm where cm.client_id = clients.id and cm.user_id = (select auth.uid())));

drop policy if exists members_admin_all on public.client_members;
create policy members_admin_all on public.client_members for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists members_self_select on public.client_members;
create policy members_self_select on public.client_members for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists work_types_auth_select on public.work_types;
create policy work_types_auth_select on public.work_types for select to authenticated using (active = true or private.is_admin());
drop policy if exists work_types_admin_all on public.work_types;
create policy work_types_admin_all on public.work_types for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists posts_admin_all on public.posts;
create policy posts_admin_all on public.posts for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists posts_designer_select on public.posts;
create policy posts_designer_select on public.posts for select to authenticated using (designer_id = (select auth.uid()) or exists (select 1 from public.client_members cm where cm.client_id = posts.client_id and cm.user_id = (select auth.uid())));
drop policy if exists posts_designer_insert on public.posts;
create policy posts_designer_insert on public.posts for insert to authenticated with check (designer_id = (select auth.uid()) and exists (select 1 from public.client_members cm where cm.client_id = posts.client_id and cm.user_id = (select auth.uid())));
drop policy if exists posts_designer_update on public.posts;
create policy posts_designer_update on public.posts for update to authenticated
using (designer_id = (select auth.uid()) and status in ('draft', 'changes'))
with check (designer_id = (select auth.uid()) and status in ('submitted', 'changes', 'draft') and approved_value is null and approved_at is null);

create or replace function public.guard_post_updates()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if private.is_admin() then return new; end if;
  if old.designer_id <> (select auth.uid()) then raise exception 'not allowed'; end if;
  if new.designer_id is distinct from old.designer_id
    or new.client_id is distinct from old.client_id
    or new.work_type_id is distinct from old.work_type_id
    or new.title is distinct from old.title
    or new.format is distinct from old.format
    or new.scheduled_date is distinct from old.scheduled_date
    or new.custom_value is distinct from old.custom_value
    or new.approved_value is distinct from old.approved_value
    or new.approved_at is distinct from old.approved_at
  then raise exception 'designers can only edit caption and workflow fields'; end if;
  if new.status not in ('draft', 'submitted', 'changes') then raise exception 'invalid designer status'; end if;
  return new;
end;
$$;
revoke all on function public.guard_post_updates() from public, anon, authenticated;
drop trigger if exists guard_post_updates on public.posts;
create trigger guard_post_updates before update on public.posts for each row execute procedure public.guard_post_updates();

drop policy if exists assets_admin_all on public.post_assets;
create policy assets_admin_all on public.post_assets for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists assets_post_access on public.post_assets;
create policy assets_post_access on public.post_assets for select to authenticated using (exists (select 1 from public.posts p where p.id = post_assets.post_id and (p.designer_id = (select auth.uid()) or exists (select 1 from public.client_members cm where cm.client_id = p.client_id and cm.user_id = (select auth.uid())))));
drop policy if exists assets_post_insert on public.post_assets;
create policy assets_post_insert on public.post_assets for insert to authenticated with check (exists (select 1 from public.posts p where p.id = post_assets.post_id and p.designer_id = (select auth.uid())));

drop policy if exists payments_admin_all on public.payments;
create policy payments_admin_all on public.payments for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists payments_self_select on public.payments;
create policy payments_self_select on public.payments for select to authenticated using (designer_id = (select auth.uid()));

grant select on all tables in schema public to authenticated;
grant update (name) on public.profiles to authenticated;
grant insert, update, delete on public.clients, public.client_members, public.work_types, public.posts, public.post_assets, public.payments to authenticated;
grant insert (client_id, designer_id, work_type_id, title, caption, format, scheduled_date, custom_value, feedback) on public.posts to authenticated;
grant insert on public.post_assets to authenticated;

insert into storage.buckets (id, name, public) values ('post-assets', 'post-assets', false) on conflict (id) do nothing;
drop policy if exists post_assets_select on storage.objects;
create policy post_assets_select on storage.objects for select to authenticated using (bucket_id = 'post-assets' and (private.is_admin() or exists (select 1 from public.posts p where p.id = split_part(name, '/', 1)::uuid and (p.designer_id = (select auth.uid()) or exists (select 1 from public.client_members cm where cm.client_id = p.client_id and cm.user_id = (select auth.uid()))))));
drop policy if exists post_assets_insert on storage.objects;
create policy post_assets_insert on storage.objects for insert to authenticated with check (bucket_id = 'post-assets' and (private.is_admin() or exists (select 1 from public.posts p where p.id = split_part(name, '/', 1)::uuid and p.designer_id = (select auth.uid()))));
drop policy if exists post_assets_delete on storage.objects;
create policy post_assets_delete on storage.objects for delete to authenticated using (bucket_id = 'post-assets' and (private.is_admin() or owner_id = (select auth.uid())::text));
