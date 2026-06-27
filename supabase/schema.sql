do $$
begin
  create type app_role as enum ('Admin', 'User');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type application_status as enum ('Pending', 'Under Review', 'Accepted', 'Rejected');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  phone text,
  role app_role not null default 'User',
  avatar text,
  created_at timestamptz not null default now()
);

create table if not exists public.resume_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_name text not null,
  email text not null,
  resume_path text not null,
  resume_file_name text not null,
  resume_url text,
  status application_status not null default 'Pending',
  remarks text,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  subject text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.admin_exists()
returns boolean
language sql
stable
security definer
set search_path = public
as $
  select exists (select 1 from public.profiles where role = 'Admin');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'Admin');
$$;


create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  final_role app_role;
begin
  requested_role := coalesce(new.raw_user_meta_data->>'role', 'User');
  if requested_role = 'Admin' and not public.admin_exists() then
    final_role := 'Admin';
  else
    final_role := 'User';
  end if;

  insert into public.profiles (id, name, email, phone, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    final_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.resume_uploads enable row level security;
alter table public.notifications enable row level security;
alter table public.contact_messages enable row level security;

drop policy if exists "Allow first admin profile" on public.profiles;
drop policy if exists "Users create own profile" on public.profiles;
drop policy if exists "Profiles readable by owner or admin" on public.profiles;
drop policy if exists "Users update own non-admin profile" on public.profiles;
drop policy if exists "Admins manage profiles" on public.profiles;
drop policy if exists "Users insert own resumes" on public.resume_uploads;
drop policy if exists "Users read own resumes" on public.resume_uploads;
drop policy if exists "Admins update resumes" on public.resume_uploads;
drop policy if exists "Admins delete resumes" on public.resume_uploads;
drop policy if exists "Users read own notifications" on public.notifications;
drop policy if exists "Users update own notifications" on public.notifications;
drop policy if exists "Admins create notifications" on public.notifications;
drop policy if exists "Admins delete notifications" on public.notifications;
drop policy if exists "Anyone can submit contact" on public.contact_messages;
drop policy if exists "Admins read contacts" on public.contact_messages;
drop policy if exists "Admins update contacts" on public.contact_messages;
drop policy if exists "Admins delete contacts" on public.contact_messages;

create policy "Allow first admin profile" on public.profiles for insert with check (role = 'Admin' and not public.admin_exists() and auth.uid() = id);
create policy "Users create own profile" on public.profiles for insert with check (role = 'User' and auth.uid() = id);
create policy "Profiles readable by owner or admin" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "Users update own non-admin profile" on public.profiles for update using (auth.uid() = id and role = 'User') with check (auth.uid() = id and role = 'User');
create policy "Admins manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

create policy "Users insert own resumes" on public.resume_uploads for insert with check (auth.uid() = user_id);
create policy "Users read own resumes" on public.resume_uploads for select using (auth.uid() = user_id or public.is_admin());
create policy "Admins update resumes" on public.resume_uploads for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete resumes" on public.resume_uploads for delete using (public.is_admin());

create policy "Users read own notifications" on public.notifications for select using (auth.uid() = user_id or public.is_admin());
create policy "Users update own notifications" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Admins create notifications" on public.notifications for insert with check (public.is_admin());
create policy "Admins delete notifications" on public.notifications for delete using (public.is_admin());

create policy "Anyone can submit contact" on public.contact_messages for insert with check (true);
create policy "Admins read contacts" on public.contact_messages for select using (public.is_admin());
create policy "Admins update contacts" on public.contact_messages for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete contacts" on public.contact_messages for delete using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

drop policy if exists "Users upload own protected resumes" on storage.objects;
drop policy if exists "Users read own protected resumes" on storage.objects;
drop policy if exists "Admins manage protected resumes" on storage.objects;

create policy "Users upload own protected resumes" on storage.objects for insert with check (bucket_id = 'resumes' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users read own protected resumes" on storage.objects for select using (bucket_id = 'resumes' and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin()));
create policy "Admins manage protected resumes" on storage.objects for all using (bucket_id = 'resumes' and public.is_admin()) with check (bucket_id = 'resumes' and public.is_admin());
