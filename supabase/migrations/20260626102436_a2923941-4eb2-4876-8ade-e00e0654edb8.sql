
create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  prefix text not null,
  token_hash text not null unique,
  scopes text[] not null default array['read']::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists api_tokens_owner_idx on public.api_tokens(owner_id);
create index if not exists api_tokens_project_idx on public.api_tokens(project_id);

grant select, insert, update, delete on public.api_tokens to authenticated;
grant all on public.api_tokens to service_role;

alter table public.api_tokens enable row level security;

create policy "tokens_owner_read"   on public.api_tokens for select to authenticated using (owner_id = auth.uid());
create policy "tokens_owner_insert" on public.api_tokens for insert to authenticated with check (owner_id = auth.uid());
create policy "tokens_owner_update" on public.api_tokens for update to authenticated using (owner_id = auth.uid());
create policy "tokens_owner_delete" on public.api_tokens for delete to authenticated using (owner_id = auth.uid());

create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  url text not null,
  secret text not null,
  events text[] not null default array['*']::text[],
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists webhook_endpoints_project_idx on public.webhook_endpoints(project_id);

grant select, insert, update, delete on public.webhook_endpoints to authenticated;
grant all on public.webhook_endpoints to service_role;

alter table public.webhook_endpoints enable row level security;

create policy "webhooks_member_read"   on public.webhook_endpoints for select to authenticated using (public.is_project_member(auth.uid(), project_id));
create policy "webhooks_member_insert" on public.webhook_endpoints for insert to authenticated with check (public.is_project_member(auth.uid(), project_id) and owner_id = auth.uid());
create policy "webhooks_owner_update"  on public.webhook_endpoints for update to authenticated using (owner_id = auth.uid());
create policy "webhooks_owner_delete"  on public.webhook_endpoints for delete to authenticated using (owner_id = auth.uid());

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event text not null,
  payload jsonb not null,
  status_code int,
  response_excerpt text,
  error text,
  delivered_at timestamptz not null default now()
);
create index if not exists webhook_deliveries_endpoint_idx on public.webhook_deliveries(endpoint_id, delivered_at desc);

grant select on public.webhook_deliveries to authenticated;
grant all on public.webhook_deliveries to service_role;

alter table public.webhook_deliveries enable row level security;

create policy "deliveries_member_read" on public.webhook_deliveries for select to authenticated using (
  exists (
    select 1 from public.webhook_endpoints e
    where e.id = endpoint_id and public.is_project_member(auth.uid(), e.project_id)
  )
);
