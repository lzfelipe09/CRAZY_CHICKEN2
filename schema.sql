-- =========================================================
-- CRAZY CHICKEN ECOMMERCE - BANCO, AUTH, RLS E STORAGE
-- Execute este arquivo no SQL Editor do Supabase UMA VEZ.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- 1) PERFIS DE USUÁRIO
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer','admin')),
  full_name text,
  phone text,
  postal_code text,
  street text,
  number text,
  complement text,
  city text,
  state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Função segura usada pelas políticas. O papel admin não é decidido pelo front-end.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

-- Cria perfil para usuários que eventualmente já existam no Auth.
insert into public.profiles (id, full_name, role)
select id, coalesce(raw_user_meta_data ->> 'full_name', ''), 'customer'
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, phone, postal_code, street, number, complement, city, state) on table public.profiles to authenticated;

-- O cliente lê o próprio perfil. Admin lê todos.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
on public.profiles for select
to authenticated
using (public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- ---------------------------------------------------------
-- 2) PRODUTOS
-- ---------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null check (char_length(name) between 1 and 140),
  description text,
  category text not null default 'Outros',
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  image_url text,
  image_path text,
  is_new boolean not null default false,
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
before update on public.products
for each row execute function public.touch_updated_at();

alter table public.products enable row level security;

revoke all on table public.products from anon, authenticated;
grant select on table public.products to anon, authenticated;
grant insert, update, delete on table public.products to authenticated;

drop policy if exists "products_public_read_active" on public.products;
create policy "products_public_read_active"
on public.products for select
to anon, authenticated
using (active = true);

drop policy if exists "products_admin_read_all" on public.products;
create policy "products_admin_read_all"
on public.products for select
to authenticated
using (public.is_admin());

drop policy if exists "products_admin_insert" on public.products;
create policy "products_admin_insert"
on public.products for insert
to authenticated
with check (public.is_admin());

drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update"
on public.products for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete"
on public.products for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------
-- 3) FAVORITOS
-- ---------------------------------------------------------
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.favorites enable row level security;

revoke all on table public.favorites from anon, authenticated;
grant select, insert, delete on table public.favorites to authenticated;

drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own"
on public.favorites for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own"
on public.favorites for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own"
on public.favorites for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------
-- 4) PEDIDOS
-- ---------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending_whatsapp' check (
    status in ('pending_whatsapp','confirmed','preparing','ready','delivered','cancelled')
  ),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  shipping_cost numeric(12,2) check (shipping_cost is null or shipping_cost >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  shipping_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
before update on public.orders
for each row execute function public.touch_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name_snapshot text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0 and quantity <= 99),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
grant select on table public.orders to authenticated;
grant update (status, shipping_cost, total) on table public.orders to authenticated;
grant select on table public.order_items to authenticated;

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
on public.orders for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "orders_admin_select" on public.orders;
create policy "orders_admin_select"
on public.orders for select
to authenticated
using (public.is_admin());

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update"
on public.orders for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own"
on public.order_items for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.user_id = (select auth.uid())
  )
);

drop policy if exists "order_items_admin_select" on public.order_items;
create policy "order_items_admin_select"
on public.order_items for select
to authenticated
using (public.is_admin());

-- Criação de pedido atômica no banco.
-- O preço e o nome são obtidos do produto no banco, não do navegador do cliente.
create or replace function public.create_order(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_subtotal numeric(12,2) := 0;
  v_order_id uuid;
  v_order_number bigint;
begin
  if v_user is null then
    raise exception 'Autenticação necessária.';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Carrinho vazio.';
  end if;

  select * into v_profile from public.profiles where id = v_user;
  if not found then
    raise exception 'Perfil não encontrado.';
  end if;

  if nullif(trim(coalesce(v_profile.full_name,'')), '') is null
     or nullif(trim(coalesce(v_profile.phone,'')), '') is null
     or nullif(trim(coalesce(v_profile.postal_code,'')), '') is null
     or nullif(trim(coalesce(v_profile.street,'')), '') is null
     or nullif(trim(coalesce(v_profile.number,'')), '') is null
     or nullif(trim(coalesce(v_profile.city,'')), '') is null
     or nullif(trim(coalesce(v_profile.state,'')), '') is null then
    raise exception 'Complete seu cadastro antes de finalizar o pedido.';
  end if;

  -- Primeira passada: valida produtos/estoque e calcula subtotal.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    begin
      v_qty := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception 'Quantidade inválida.';
    end;

    if v_qty < 1 or v_qty > 99 then
      raise exception 'Quantidade inválida.';
    end if;

    begin
      select * into strict v_product
      from public.products
      where id = (v_item ->> 'product_id')::uuid
        and active = true;
    exception
      when no_data_found then
        raise exception 'Um produto do carrinho não está mais disponível.';
      when invalid_text_representation then
        raise exception 'Produto inválido.';
    end;

    if v_product.stock < v_qty then
      raise exception 'Estoque insuficiente para %.', v_product.name;
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  insert into public.orders (
    user_id,
    status,
    subtotal,
    shipping_cost,
    total,
    shipping_snapshot
  ) values (
    v_user,
    'pending_whatsapp',
    v_subtotal,
    null,
    v_subtotal,
    jsonb_build_object(
      'full_name', v_profile.full_name,
      'phone', v_profile.phone,
      'postal_code', v_profile.postal_code,
      'street', v_profile.street,
      'number', v_profile.number,
      'complement', v_profile.complement,
      'city', v_profile.city,
      'state', v_profile.state
    )
  ) returning id, order_number into v_order_id, v_order_number;

  -- Segunda passada: grava os itens com snapshot de preço/nome.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item ->> 'quantity')::integer;
    select * into strict v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid and active = true;

    insert into public.order_items (
      order_id, product_id, name_snapshot, unit_price, quantity, line_total
    ) values (
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.price,
      v_qty,
      v_product.price * v_qty
    );
  end loop;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal
  );
end;
$$;

revoke all on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to authenticated;

-- ---------------------------------------------------------
-- 5) STORAGE DE IMAGENS DOS PRODUTOS
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  6291456,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Como o bucket é público, clientes podem visualizar as imagens pela URL pública.
-- Apenas admin autenticado pode criar/alterar/remover arquivos.
drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------
-- 6) ÍNDICES ÚTEIS
-- ---------------------------------------------------------
create index if not exists products_active_category_idx on public.products (active, category);
create index if not exists products_created_at_idx on public.products (created_at desc);
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_created_idx on public.orders (status, created_at desc);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists favorites_user_idx on public.favorites (user_id);

-- =========================================================
-- DEPOIS DE CRIAR SUA CONTA PELO SITE, PROMOVA SOMENTE VOCÊ:
--
-- update public.profiles
-- set role = 'admin'
-- where id = (
--   select id from auth.users where email = 'SEU_EMAIL_AQUI'
-- );
--
-- Não coloque esse e-mail no código do site. Rode a instrução no SQL Editor.
-- =========================================================
