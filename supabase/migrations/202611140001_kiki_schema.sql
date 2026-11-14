-- 僅供新的開發／測試專案；此檔不會由應用程式自動執行。
begin;
create table public.kiki_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  fit_preference text not null default '微寬鬆' check (fit_preference in ('貼身','合身','微寬鬆','Oversized')),
  personalize boolean not null default false,
  external_ai_consent boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.kiki_products (
  id text primary key, name text not null, subtitle text not null, category text not null,
  price integer not null check (price >= 0), image text not null,
  color text not null, color_hex text not null, colors jsonb not null,
  fit text not null, sizes jsonb not null, tags text[] not null,
  description text not null, material text not null
);
create table public.kiki_avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  front_path text not null, side_path text not null,
  height numeric not null check (height between 120 and 220),
  weight numeric not null check (weight between 30 and 250),
  shoulder numeric check (shoulder between 25 and 70),
  chest numeric check (chest between 50 and 200),
  waist numeric check (waist between 40 and 200),
  hip numeric check (hip between 50 and 200),
  created_at timestamptz not null default now(),
  check (split_part(front_path,'/',1) = user_id::text),
  check (split_part(side_path,'/',1) = user_id::text),
  unique(id,user_id)
);
create table public.kiki_tryons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  avatar_id uuid not null,
  product_id text not null references public.kiki_products(id),
  size text not null, color text not null,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  mode text not null check (mode in ('demo','ai')),
  result_path text, error text,
  created_at timestamptz not null default now(),
  foreign key(avatar_id,user_id) references public.kiki_avatars(id,user_id) on delete cascade,
  check (result_path is null or split_part(result_path,'/',1) = user_id::text),
  check (status <> 'completed' or result_path is not null),
  unique(id,user_id)
);
create table public.kiki_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.kiki_products(id),
  created_at timestamptz not null default now(), primary key(user_id,product_id)
);
create table public.kiki_outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tryon_id uuid not null,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  foreign key(tryon_id,user_id) references public.kiki_tryons(id,user_id) on delete cascade,
  unique(user_id,tryon_id)
);
create index kiki_tryons_user_created on public.kiki_tryons(user_id,created_at desc);
create index kiki_outfits_user_created on public.kiki_outfits(user_id,created_at desc);

alter table public.kiki_profiles enable row level security;
alter table public.kiki_products enable row level security;
alter table public.kiki_avatars enable row level security;
alter table public.kiki_tryons enable row level security;
alter table public.kiki_favorites enable row level security;
alter table public.kiki_outfits enable row level security;
create policy "kiki_public_catalog" on public.kiki_products for select to anon,authenticated using (true);
create policy "kiki_own_profile" on public.kiki_profiles for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "kiki_own_avatar" on public.kiki_avatars for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "kiki_own_tryons" on public.kiki_tryons for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "kiki_own_favorites" on public.kiki_favorites for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "kiki_own_outfits" on public.kiki_outfits for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (select 1 from public.kiki_tryons t where t.id = tryon_id and t.user_id = (select auth.uid()) and t.status='completed'));

-- 新註冊帳號自動建立設定；不回填、更動既有帳號。
create function public.kiki_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.kiki_profiles(user_id,display_name)
  values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'風格探索者'),40));
  return new;
end;
$$;
revoke all on function public.kiki_new_user() from public,anon,authenticated;
create trigger kiki_on_auth_user_created after insert on auth.users for each row execute function public.kiki_new_user();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('kiki-private','kiki-private',false,10485760,array['image/jpeg','image/png','image/webp']);
create policy "kiki_read_own_photos" on storage.objects for select to authenticated
using (bucket_id='kiki-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "kiki_upload_own_photos" on storage.objects for insert to authenticated
with check (bucket_id='kiki-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "kiki_update_own_photos" on storage.objects for update to authenticated
using (bucket_id='kiki-private' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='kiki-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "kiki_delete_own_photos" on storage.objects for delete to authenticated
using (bucket_id='kiki-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
grant select on public.kiki_products to anon,authenticated;
revoke insert,update,delete on public.kiki_products from anon,authenticated;
revoke all on public.kiki_profiles,public.kiki_avatars,public.kiki_tryons,public.kiki_favorites,public.kiki_outfits from anon;
grant select,insert,update,delete on public.kiki_profiles,public.kiki_avatars,public.kiki_tryons,public.kiki_favorites,public.kiki_outfits to authenticated;
commit;
