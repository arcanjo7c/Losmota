-- =====================================================================
-- LOS MOTTA DELIVERY PRO · 7C Digital
-- 1/3  schema.sql   (rode primeiro)
-- 2/3  policies.sql (segurança RLS + storage)
-- 3/3  seed.sql     (dados de TESTE, opcional)
-- Em etapa posterior: functions.sql (create_order, validação de cupom)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Equipe do painel
--   role = 'owner'         -> proprietário: vê e gerencia TUDO (as duas unidades)
--   role = 'unit_manager'  -> responsável de uma unidade: só os pedidos da sua unidade
-- ---------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users add column if not exists name    text;
alter table public.admin_users add column if not exists role    text not null default 'owner';
alter table public.admin_users add column if not exists unit_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'admin_users_role_check') then
    alter table public.admin_users
      add constraint admin_users_role_check check (role in ('owner', 'unit_manager'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'admin_users_unit_required') then
    alter table public.admin_users
      add constraint admin_users_unit_required check (role = 'owner' or unit_id is not null);
  end if;
end $$;

-- Qualquer pessoa da equipe (proprietário ou responsável de unidade)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'owner');
$$;

-- Proprietário acessa qualquer unidade; responsável, só a sua.
create or replace function public.can_access_unit(target_unit uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and (role = 'owner' or unit_id = target_unit)
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Unidades (Araci, Teofilândia)
-- opening_hours: {"mon":{"open":"18:30","close":"23:00"}, ... "sun":null}
-- ---------------------------------------------------------------------
create table if not exists public.units (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  city              text not null,
  whatsapp          text,                       -- só dígitos, com DDI: 5575...
  address           text,
  maps_url          text,
  opening_hours     jsonb not null default '{}'::jsonb,
  delivery_enabled  boolean not null default true,
  pickup_enabled    boolean not null default true,
  min_order         numeric(10,2) not null default 0 check (min_order >= 0),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  is_active         boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'admin_users_unit_fk') then
    alter table public.admin_users
      add constraint admin_users_unit_fk
      foreign key (unit_id) references public.units (id) on delete cascade;
  end if;
end $$;

-- Taxa de entrega por bairro e por unidade
create table if not exists public.delivery_zones (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid not null references public.units (id) on delete cascade,
  neighborhood text not null,
  fee          numeric(10,2) not null default 0 check (fee >= 0),
  is_active    boolean not null default true,
  is_demo      boolean not null default false,
  unique (unit_id, neighborhood)
);

-- ---------------------------------------------------------------------
-- Cardápio
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  kind       text not null default 'simple' check (kind in ('pizza', 'simple')),
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

-- Tamanhos de pizza e limite de sabores de cada um
create table if not exists public.pizza_sizes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slices      integer check (slices is null or slices > 0),
  max_flavors integer not null default 1 check (max_flavors between 1 and 6),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  is_demo     boolean not null default false
);

-- Produtos. Em categorias do tipo "pizza", cada produto é um SABOR e o
-- preço vem de product_size_prices. Nas demais, vale base_price.
create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid not null references public.categories (id) on delete restrict,
  name           text not null,
  description    text,
  image_url      text,
  base_price     numeric(10,2) check (base_price is null or base_price >= 0),
  promo_price    numeric(10,2) check (promo_price is null or promo_price >= 0),
  is_featured    boolean not null default false,
  is_best_seller boolean not null default false,
  is_promo       boolean not null default false,
  is_active      boolean not null default true,
  is_demo        boolean not null default false,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_id);

create table if not exists public.product_size_prices (
  product_id uuid not null references public.products (id) on delete cascade,
  size_id    uuid not null references public.pizza_sizes (id) on delete cascade,
  price      numeric(10,2) not null check (price >= 0),
  primary key (product_id, size_id)
);

-- Bordas recheadas
create table if not exists public.crusts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  price      numeric(10,2) not null default 0 check (price >= 0),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  is_demo    boolean not null default false
);

-- Adicionais (scope: só pizzas ou qualquer produto)
create table if not exists public.addons (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  price      numeric(10,2) not null default 0 check (price >= 0),
  scope      text not null default 'pizza' check (scope in ('pizza', 'all')),
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  is_demo    boolean not null default false
);

-- ---------------------------------------------------------------------
-- Cupons e configurações
-- ---------------------------------------------------------------------
create table if not exists public.coupons (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  type       text not null check (type in ('percent', 'fixed')),
  value      numeric(10,2) not null check (value > 0),
  min_order  numeric(10,2) not null default 0 check (min_order >= 0),
  max_uses   integer check (max_uses is null or max_uses > 0),
  uses_count integer not null default 0,
  starts_at  timestamptz,
  ends_at    timestamptz,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Chave/valor. is_public = true pode ser lido por qualquer visitante.
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  is_public  boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum (
      'awaiting_confirmation', 'confirmed', 'preparing',
      'out_for_delivery', 'completed', 'cancelled'
    );
  end if;
end $$;

create sequence if not exists public.orders_number_seq start 1001;

create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_number   bigint not null unique default nextval('public.orders_number_seq'),
  public_token   uuid not null unique default gen_random_uuid(),
  unit_id        uuid not null references public.units (id) on delete restrict,
  status         public.order_status not null default 'awaiting_confirmation',
  customer_name  text not null,
  customer_phone text not null,
  fulfillment    text not null check (fulfillment in ('delivery', 'pickup')),
  address        text,
  neighborhood   text,
  reference      text,
  payment_method text not null check (payment_method in ('cash', 'pix', 'credit_card', 'debit_card')),
  change_for     numeric(10,2) check (change_for is null or change_for > 0),
  notes          text,
  coupon_code    text,
  subtotal       numeric(10,2) not null check (subtotal >= 0),
  delivery_fee   numeric(10,2) not null default 0 check (delivery_fee >= 0),
  discount       numeric(10,2) not null default 0 check (discount >= 0),
  total          numeric(10,2) not null check (total >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (fulfillment = 'pickup' or (address is not null and neighborhood is not null))
);
create index if not exists orders_unit_created_idx on public.orders (unit_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status);

-- Itens guardam "foto" (snapshot) do que foi vendido: mudar o cardápio
-- depois não altera pedidos antigos.
create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  product_id  uuid references public.products (id) on delete set null,
  name        text not null,
  size_name   text,
  flavors     jsonb not null default '[]'::jsonb,
  crust_name  text,
  addons      jsonb not null default '[]'::jsonb,
  quantity    integer not null check (quantity > 0),
  unit_price  numeric(10,2) not null check (unit_price >= 0),
  total_price numeric(10,2) not null check (total_price >= 0),
  notes       text
);
create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.order_status_history (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  status     public.order_status not null,
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists order_history_order_idx on public.order_status_history (order_id, created_at);

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists orders_log_status on public.orders;
create trigger orders_log_status
  after insert or update of status on public.orders
  for each row execute function public.log_order_status();

do $$
declare t text;
begin
  foreach t in array array['units', 'products', 'orders', 'settings'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- Pedidos em tempo real no painel
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders')
  then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Dashboard
-- security INVOKER: as políticas RLS valem. Responsável de unidade só
-- enxerga (e soma) pedidos da própria unidade; proprietário vê tudo ou
-- filtra por unidade (p_unit).
-- Faturamento = pedidos NÃO cancelados. "revenue_completed" = só concluídos.
-- p_to é exclusivo (use o início do dia seguinte).
-- ---------------------------------------------------------------------
create or replace function public.dashboard_stats(
  p_from timestamptz,
  p_to   timestamptz,
  p_unit uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with o as (
    select * from public.orders
    where created_at >= p_from and created_at < p_to
      and (p_unit is null or unit_id = p_unit)
  )
  select jsonb_build_object(
    'total_orders', (select count(*) from o),
    'by_status', coalesce(
      (select jsonb_object_agg(st, c)
         from (select status::text as st, count(*) as c from o group by status) s),
      '{}'::jsonb),
    'revenue', coalesce((select sum(total) from o where status <> 'cancelled'), 0),
    'revenue_completed', coalesce((select sum(total) from o where status = 'completed'), 0),
    'avg_ticket', coalesce((select avg(total) from o where status <> 'cancelled'), 0),
    'by_unit', coalesce(
      (select jsonb_agg(jsonb_build_object('unit_id', unit_id, 'orders', n, 'revenue', r))
         from (select unit_id, count(*) as n,
                      coalesce(sum(total) filter (where status <> 'cancelled'), 0) as r
                 from o group by unit_id) u),
      '[]'::jsonb),
    'by_day', coalesce(
      (select jsonb_agg(jsonb_build_object('day', d, 'orders', n, 'revenue', r) order by d)
         from (select (created_at at time zone 'America/Bahia')::date as d,
                      count(*) as n,
                      coalesce(sum(total) filter (where status <> 'cancelled'), 0) as r
                 from o group by 1) x),
      '[]'::jsonb),
    'top_products', coalesce(
      (select jsonb_agg(jsonb_build_object('name', name, 'qty', q) order by q desc)
         from (select i.name, sum(i.quantity) as q
                 from public.order_items i
                 join o on o.id = i.order_id
                where o.status <> 'cancelled'
                group by i.name
                order by q desc
                limit 5) t),
      '[]'::jsonb)
  );
$$;

grant execute on function public.dashboard_stats(timestamptz, timestamptz, uuid) to authenticated;
