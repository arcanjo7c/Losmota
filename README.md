# Los Motta Delivery Pro
Sistema de pedidos online da **Los Motta Pizzaria** (Araci e Teofilândia, BA). Desenvolvido pela **7C Digital**.

Stack: React + Vite + TypeScript + Tailwind · Supabase (PostgreSQL, Auth, Storage, Realtime) · Vercel.

> **Status:** base, banco de dados, permissões por unidade e painel (login, pedidos por unidade e dashboard).
> Home completa, cardápio, carrinho, checkout e WhatsApp entram nas próximas etapas.

## Rodando localmente
1. `npm install`
2. Copie `.env.example` para `.env.local` e preencha com a URL e a chave **anon** do seu projeto Supabase.
3. No Supabase, abra **SQL Editor** e rode, nesta ordem:
   `supabase/schema.sql` → `supabase/policies.sql` → `supabase/seed.sql` (dados de teste, opcional).
4. `npm run dev`

## Equipe e permissões
| Perfil | Vê pedidos | Dashboard | Cardápio, unidades, configurações |
|---|---|---|---|
| Proprietário (`owner`) | Araci + Teofilândia (com abas) | Geral ou por unidade | Sim |
| Responsável de unidade (`unit_manager`) | Só a sua unidade | Só a sua unidade | Não |

A restrição é feita no banco (RLS), não só na tela: mesmo que alguém altere o front-end, o responsável de Araci não consegue ler pedidos de Teofilândia. A equipe só altera o **status** do pedido.

**Criar usuários:** Supabase → **Authentication → Users → Add user** (e-mail e senha, "Auto confirm"). Depois, no SQL Editor:

```sql
-- Proprietário
insert into public.admin_users (user_id, role, name)
select id, 'owner', 'Nome do proprietário' from auth.users where email = 'EMAIL_DO_PROPRIETARIO';

-- Responsável de Araci
insert into public.admin_users (user_id, role, unit_id, name)
select u.id, 'unit_manager', (select id from public.units where slug = 'araci'), 'Nome'
from auth.users u where u.email = 'EMAIL_RESPONSAVEL_ARACI';

-- Responsável de Teofilândia
insert into public.admin_users (user_id, role, unit_id, name)
select u.id, 'unit_manager', (select id from public.units where slug = 'teofilandia'), 'Nome'
from auth.users u where u.email = 'EMAIL_RESPONSAVEL_TEOFILANDIA';
```
Painel: `/admin` (login em `/admin/login`).

> Já tinha rodado a etapa 1? Rode `schema.sql`, `policies.sql` e `seed.sql` de novo: são seguros para reexecutar e aplicam as novas permissões.

## Segurança
- Só a chave `anon` vai para o front-end. **Nunca** use a `service_role` no código nem na Vercel.
- Visitantes leem apenas cardápio, unidades ativas e configurações públicas.
- Pedidos, itens, histórico e cupons não têm leitura pública. O pedido será criado por função no servidor (etapa 4), que recalcula os preços.

## O que precisa ser preenchido pelo administrador
- WhatsApp da unidade **Teofilândia** (endereço e horários já cadastrados).
- Confirmar o WhatsApp da unidade Araci (veio da arte de horários).
- Substituir **todos** os itens marcados como teste (`is_demo`): sabores, tamanhos, preços, bordas, adicionais e bairros.
- Fotos dos produtos (upload pelo painel, bucket `product-images`).

## Publicar na Vercel
1. Suba o projeto no GitHub.
2. Vercel → **Add New Project** → importe o repositório (preset Vite).
3. Em **Environment Variables**, cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Deploy. O `vercel.json` já cuida das rotas do app.
