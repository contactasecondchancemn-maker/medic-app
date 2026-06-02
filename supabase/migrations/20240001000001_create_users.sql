-- users
-- Extends auth.users with app-level profile data.
-- id mirrors auth.users.id so no join key is needed.

create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  persona     public.persona not null default 'pre_clinical',
  created_at  timestamptz not null default now()
);

alter table public.users enable row level security;

-- Users can read and update only their own row.
create policy "users: select own"
  on public.users for select
  using (auth.uid() = id);

create policy "users: update own"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Row is created by the auth trigger below, not directly by the client.
create policy "users: insert via trigger"
  on public.users for insert
  with check (auth.uid() = id);

-- Automatically create a profile row whenever a new auth user is confirmed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
