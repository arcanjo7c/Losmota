-- =====================================================================
-- LOS MOTTA DELIVERY PRO · 2/3 policies.sql  (rode depois do schema.sql)
--
-- Regras:
--  * Visitante: lê só cardápio, unidades ativas, taxas e configurações públicas.
--  * Visitante NÃO lê nem escreve pedidos diretamente. O pedido nasce pela
--    função create_order() (functions.sql), que recalcula tudo no servidor.
--  * Proprietário (admin_users.role = 'owner'): acesso total.
--  * Responsável de unidade ('unit_manager'): só pedidos da sua unidade (e só muda o status).
-- =====================================================================

alter table public.admin_users         enable row level security;
alter table public.units               enable row level security;
alter table public.delivery_zones      enable row level security;
alter table public.categories          enable row level security;
alter table public.pizza_sizes         enable row level security;
alter table public.products            enable row level security;
alter table public.product_size_prices enable row level security;
alter table public.crusts              enable row level security;
alter table public.addons              enable row level security;
alter table public.coupons             enable row level security;
alter table public.settings            enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.order_status_history enable row level security;

-- ---------------------------------------------------------------- admin_users
drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_self_read on public.admin_users
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------- leitura pública (cardápio)
drop policy if exists units_public_read on public.units;
create policy units_public_read on public.units
  for select to anon, authenticated using (is_active);

drop policy if exists zones_public_read on public.delivery_zones;
create policy zones_public_read on public.delivery_zones
  for select to anon, authenticated using (is_active);

drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories
  for select to anon, authenticated using (is_active);

drop policy if exists sizes_public_read on public.pizza_sizes;
create policy sizes_public_read on public.pizza_sizes
  for select to anon, authenticated using (is_active);

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select to anon, authenticated using (is_active);

drop policy if exists size_prices_public_read on public.product_size_prices;
create policy size_prices_public_read on public.product_size_prices
  for select to anon, authenticated using (true);

drop policy if exists crusts_public_read on public.crusts;
create policy crusts_public_read on public.crusts
  for select to anon, authenticated using (is_active);

drop policy if exists addons_public_read on public.addons;
create policy addons_public_read on public.addons
  for select to anon, authenticated using (is_active);

drop policy if exists settings_public_read on public.settings;
create policy settings_public_read on public.settings
  for select to anon, authenticated using (is_public);

-- cupons, pedidos, itens e histórico: SEM política pública (negado por padrão)

-- ------------------------------------------------ equipe: proprietário
drop policy if exists admin_users_owner_all on public.admin_users;
create policy admin_users_owner_all on public.admin_users
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- ------------------- cardápio, unidades e configurações: SÓ o proprietário
do $$
declare t text;
begin
  foreach t in array array[
    'units', 'delivery_zones', 'categories', 'pizza_sizes', 'products',
    'product_size_prices', 'crusts', 'addons', 'coupons', 'settings'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.is_owner()) with check (public.is_owner())',
      t || '_owner_all', t);
  end loop;
end $$;

-- --------------------------------------- pedidos: por unidade (RLS por linha)
-- Proprietário: todas as unidades. Responsável: só a sua.
drop policy if exists orders_admin_all on public.orders;
drop policy if exists orders_unit_select on public.orders;
create policy orders_unit_select on public.orders
  for select to authenticated using (public.can_access_unit(unit_id));

drop policy if exists orders_unit_update on public.orders;
create policy orders_unit_update on public.orders
  for update to authenticated
  using (public.can_access_unit(unit_id))
  with check (public.can_access_unit(unit_id));

drop policy if exists orders_owner_delete on public.orders;
create policy orders_owner_delete on public.orders
  for delete to authenticated using (public.is_owner());

-- Na prática, a equipe só pode alterar o STATUS do pedido (não valores nem dados do cliente)
revoke update on public.orders from authenticated;
grant  update (status) on public.orders to authenticated;

drop policy if exists order_items_admin_all on public.order_items;
drop policy if exists order_items_unit_select on public.order_items;
create policy order_items_unit_select on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o
            where o.id = order_id and public.can_access_unit(o.unit_id)));

drop policy if exists order_status_history_admin_all on public.order_status_history;
drop policy if exists order_history_unit_select on public.order_status_history;
create policy order_history_unit_select on public.order_status_history
  for select to authenticated using (
    exists (select 1 from public.orders o
            where o.id = order_id and public.can_access_unit(o.unit_id)));

-- ------------------------------------------------ Storage: fotos dos produtos
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-images');

drop policy if exists product_images_admin_write on storage.objects;
drop policy if exists product_images_owner_write on storage.objects;
create policy product_images_owner_write on storage.objects
  for all to authenticated
  using (bucket_id = 'product-images' and public.is_owner())
  with check (bucket_id = 'product-images' and public.is_owner());
