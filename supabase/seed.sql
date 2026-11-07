-- =====================================================================
-- LOS MOTTA DELIVERY PRO · 3/3 seed.sql
--
-- ATENÇÃO: tudo marcado is_demo = true é DADO DE TESTE (nomes, tamanhos,
-- preços, bordas, adicionais e bairros). O administrador deve substituir
-- pelo cardápio oficial no painel. Nada aqui é preço ou sabor oficial.
-- =====================================================================

-- ------------------------------------------------------------------ Unidades
-- Araci: endereço e horários vêm da arte oficial "Horário de Funcionamento".
-- O WhatsApp é o número divulgado nessa arte. CONFIRME com o proprietário
-- se é o número que recebe pedidos e ajuste no painel, se necessário.
-- Teofilândia: endereço e horários (iguais aos de Araci) informados pelo proprietário;
-- WhatsApp ainda NÃO informado.
insert into public.units
  (slug, name, city, whatsapp, address, opening_hours, estimated_minutes, sort_order)
values
  ('araci', 'Los Motta · Araci', 'Araci',
   '5575992124505',
   'Av. Sete de Setembro, nº 283, Centro, Araci - BA',
   '{
     "mon": {"open": "18:30", "close": "23:00"},
     "tue": {"open": "18:30", "close": "23:00"},
     "wed": {"open": "18:30", "close": "23:00"},
     "thu": {"open": "18:30", "close": "23:00"},
     "fri": {"open": "18:30", "close": "23:45"},
     "sat": {"open": "18:00", "close": "00:00"},
     "sun": {"open": "18:00", "close": "00:00"}
   }'::jsonb,
   null, 1),
  ('teofilandia', 'Los Motta · Teofilândia', 'Teofilândia',
   null, 'Rua Fernando Lopes, 325, Teofilândia - BA, 48770-000', '{}'::jsonb, null, 2)
on conflict (slug) do nothing;

-- Teofilândia usa os mesmos horários de Araci (informado pelo proprietário)
update public.units
   set opening_hours = (select opening_hours from public.units where slug = 'araci')
 where slug = 'teofilandia' and opening_hours = '{}'::jsonb;

-- ------------------------------------------------------------- Configurações
insert into public.settings (key, value, is_public) values
  ('business_name',            '"Los Motta Pizzaria"',                         true),
  ('years_in_business',        '20',                                           true),
  ('instagram',                '"losmotta"',                                   true),
  ('payment_methods',          '["cash","pix","credit_card","debit_card"]',    true),
  -- regra para pizza com vários sabores: "highest" (maior preço) ou "average"
  ('multi_flavor_price_rule',  '"highest"',                                    true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------- Categorias
insert into public.categories (slug, name, kind, sort_order) values
  ('pizzas-tradicionais', 'Pizzas tradicionais', 'pizza',  1),
  ('pizzas-especiais',    'Pizzas especiais',    'pizza',  2),
  ('pizzas-doces',        'Pizzas doces',        'pizza',  3),
  ('bebidas',             'Bebidas',             'simple', 4),
  ('porcoes',             'Porções',             'simple', 5),
  ('adicionais',          'Adicionais',          'simple', 6),
  ('promocoes',           'Promoções',           'simple', 7)
on conflict (slug) do nothing;

-- ------------------------------------------- DEMO: tamanhos, bordas, adicionais
insert into public.pizza_sizes (name, slices, max_flavors, sort_order, is_demo)
select * from (values
  ('Pequena (teste)',  4, 1, 1, true),
  ('Média (teste)',    6, 2, 2, true),
  ('Grande (teste)',   8, 3, 3, true),
  ('Família (teste)', 12, 4, 4, true)
) v(name, slices, max_flavors, sort_order, is_demo)
where not exists (select 1 from public.pizza_sizes where is_demo);

insert into public.crusts (name, price, sort_order, is_demo)
select * from (values
  ('Borda de teste 1', 8.00, 1, true),
  ('Borda de teste 2', 8.00, 2, true)
) v(name, price, sort_order, is_demo)
where not exists (select 1 from public.crusts where is_demo);

insert into public.addons (name, price, scope, sort_order, is_demo)
select * from (values
  ('Adicional de teste 1', 5.00, 'pizza', 1, true),
  ('Adicional de teste 2', 6.00, 'pizza', 2, true)
) v(name, price, scope, sort_order, is_demo)
where not exists (select 1 from public.addons where is_demo);

-- ---------------------------------------------------- DEMO: sabores de pizza
insert into public.products (category_id, name, description, is_featured, is_best_seller, is_demo, sort_order)
select c.id, v.name, 'ITEM DE TESTE. Substitua pelo sabor oficial no painel.', v.feat, v.best, true, v.ord
from (values
  ('pizzas-tradicionais', 'Sabor tradicional (teste) 1', true,  true,  1),
  ('pizzas-tradicionais', 'Sabor tradicional (teste) 2', false, true,  2),
  ('pizzas-especiais',    'Sabor especial (teste) 1',    true,  false, 1),
  ('pizzas-especiais',    'Sabor especial (teste) 2',    false, false, 2),
  ('pizzas-doces',        'Sabor doce (teste) 1',        false, false, 1)
) v(cat, name, feat, best, ord)
join public.categories c on c.slug = v.cat
where not exists (select 1 from public.products p where p.name = v.name);

-- Preços de TESTE por tamanho (fórmula fictícia: 20 + 15 x ordem do tamanho)
insert into public.product_size_prices (product_id, size_id, price)
select p.id, s.id,
       20 + 15 * s.sort_order + case when c.slug = 'pizzas-especiais' then 8 else 0 end
from public.products p
join public.categories c on c.id = p.category_id and c.kind = 'pizza'
cross join public.pizza_sizes s
where p.is_demo and s.is_demo
on conflict do nothing;

-- ------------------------------------------------- DEMO: itens sem tamanho
insert into public.products (category_id, name, description, base_price, is_promo, is_demo, sort_order)
select c.id, v.name, 'ITEM DE TESTE. Substitua pelo item oficial no painel.', v.price, v.promo, true, v.ord
from (values
  ('bebidas',   'Bebida (teste) 1',   7.00, false, 1),
  ('bebidas',   'Bebida (teste) 2',  12.00, false, 2),
  ('porcoes',   'Porção (teste) 1',  25.00, false, 1),
  ('promocoes', 'Promoção (teste) 1', 49.90, true,  1)
) v(cat, name, price, promo, ord)
join public.categories c on c.slug = v.cat
where not exists (select 1 from public.products p where p.name = v.name);

-- ---------------------------------------------- DEMO: taxa de entrega (Araci)
insert into public.delivery_zones (unit_id, neighborhood, fee, is_demo)
select u.id, v.n, v.f, true
from public.units u
cross join (values ('Centro (teste)', 4.00::numeric), ('Outros bairros (teste)', 8.00::numeric)) v(n, f)
where u.slug = 'araci'
on conflict (unit_id, neighborhood) do nothing;
