-- =====================================================================
--  学科中心资料库 · Supabase 一次性初始化脚本
--  用法：Supabase 后台 → SQL Editor → New query → 整段粘贴 → Run
--  运行完成后，结果面板会显示「部长邀请码」，用它注册第一个账号（自动成为管理员）
--  可以重复运行：已有的数据不会被删除
-- =====================================================================


-- ---------- 表 ----------

create table if not exists public.members (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  student_id  text not null unique,
  role        text not null default 'member' check (role in ('admin','member')),
  status      text not null default 'active' check (status in ('active','banned')),
  note        text,
  created_at  timestamptz not null default now()
);

create table if not exists public.invites (
  code            text primary key,
  for_name        text not null,
  for_student_id  text,                     -- 填了就只有这个学号能用
  role            text not null default 'member' check (role in ('admin','member')),
  created_by      uuid references public.members(id) on delete set null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz,
  used_by         uuid references public.members(id) on delete set null,
  used_at         timestamptz,
  revoked         boolean not null default false
);

create table if not exists public.devices (
  id          bigserial primary key,
  user_id     uuid not null references public.members(id) on delete cascade,
  device_id   text not null,
  label       text,
  status      text not null default 'pending' check (status in ('approved','pending','revoked')),
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  unique (user_id, device_id)
);

create table if not exists public.resources (
  id            uuid primary key default gen_random_uuid(),
  section       text not null check (section in ('course','intern','exam','contest')),
  category      text not null,
  title         text not null,
  tag           text,          -- 课程名 / 公司名 / 考试名 / 比赛名
  term          text,          -- 学期，如 2025秋
  teacher       text,
  description   text,
  kind          text not null check (kind in ('file','link')),
  storage_path  text,
  file_name     text,
  file_size     bigint,
  mime          text,
  link_url      text,
  uploader      uuid references public.members(id) on delete set null default auth.uid(),
  views         integer not null default 0,
  downloads     integer not null default 0,
  created_at    timestamptz not null default now(),
  check (kind = 'link' or storage_path is not null),
  check (kind = 'file' or link_url is not null)
);
create index if not exists resources_section_idx on public.resources(section, created_at desc);

create table if not exists public.access_logs (
  id           bigserial primary key,
  user_id      uuid references public.members(id) on delete cascade,
  resource_id  uuid references public.resources(id) on delete cascade,
  action       text not null check (action in ('view','download','open_link')),
  device_id    text,
  created_at   timestamptz not null default now()
);
create index if not exists access_logs_time_idx on public.access_logs(created_at desc);

create table if not exists public.settings (
  key    text primary key,
  value  jsonb not null
);
insert into public.settings(key, value) values ('max_devices', '3') on conflict do nothing;

-- ---------- 工具函数 ----------

-- 浏览器每个请求都带 x-device-id 头，这里取出来
create or replace function public.current_device() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-device-id', '')
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where id = auth.uid() and role = 'admin' and status = 'active')
$$;

-- 账号有效（未封禁）
create or replace function public.is_active_account() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where id = auth.uid() and status = 'active')
$$;

-- 账号有效 + 当前设备已获批（管理员不受设备限制）
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members m
    where m.id = auth.uid() and m.status = 'active'
      and (m.role = 'admin' or exists (
        select 1 from devices d
        where d.user_id = m.id and d.device_id = current_device() and d.status = 'approved'))
  )
$$;

-- ---------- RLS ----------

alter table public.members     enable row level security;
alter table public.invites     enable row level security;
alter table public.devices     enable row level security;
alter table public.resources   enable row level security;
alter table public.access_logs enable row level security;
alter table public.settings    enable row level security;

drop policy if exists members_select on public.members;
create policy members_select on public.members for select
  using (id = auth.uid() or public.is_member());

drop policy if exists invites_admin on public.invites;
create policy invites_admin on public.invites for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists devices_select on public.devices;
create policy devices_select on public.devices for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists devices_admin on public.devices;
create policy devices_admin on public.devices for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists devices_admin_del on public.devices;
create policy devices_admin_del on public.devices for delete
  using (public.is_admin());

drop policy if exists resources_select on public.resources;
create policy resources_select on public.resources for select using (public.is_member());
drop policy if exists resources_insert on public.resources;
create policy resources_insert on public.resources for insert
  with check (public.is_member() and uploader = auth.uid());
drop policy if exists resources_update on public.resources;
create policy resources_update on public.resources for update
  using (public.is_member() and (uploader = auth.uid() or public.is_admin()))
  with check (public.is_member() and (uploader = auth.uid() or public.is_admin()));
drop policy if exists resources_delete on public.resources;
create policy resources_delete on public.resources for delete
  using (public.is_member() and (uploader = auth.uid() or public.is_admin()));

drop policy if exists logs_admin on public.access_logs;
create policy logs_admin on public.access_logs for select using (public.is_admin());

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (public.is_active_account());
drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for update
  using (public.is_admin()) with check (public.is_admin());

-- 显式授权（新版 Supabase 不再自动给新表开放接口）
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ---------- RPC（网页调用的后台函数）----------

-- 注册前检查邀请码（未登录也能调用）
create or replace function public.check_invite(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare i invites;
begin
  select * into i from invites where code = upper(trim(p_code));
  if not found or i.revoked or i.used_by is not null or (i.expires_at is not null and i.expires_at < now()) then
    return json_build_object('ok', false);
  end if;
  return json_build_object('ok', true, 'for_name', i.for_name, 'for_student_id', i.for_student_id);
end $$;

-- 使用邀请码，建立成员档案
create or replace function public.redeem_invite(p_code text, p_name text, p_student_id text)
returns json language plpgsql security definer set search_path = public as $$
declare i invites; r text;
begin
  if auth.uid() is null then raise exception '未登录'; end if;
  if exists (select 1 from members where id = auth.uid()) then
    return json_build_object('ok', true, 'already', true);
  end if;
  select * into i from invites where code = upper(trim(p_code)) for update;
  if not found or i.revoked or i.used_by is not null or (i.expires_at is not null and i.expires_at < now()) then
    raise exception '邀请码无效或已被使用';
  end if;
  if i.for_student_id is not null and i.for_student_id <> trim(p_student_id) then
    raise exception '该邀请码不是发给这个学号的';
  end if;
  r := i.role;
  if r = 'admin' and exists (select 1 from members where role = 'admin') then r := 'member'; end if;
  insert into members(id, name, student_id, role) values (auth.uid(), trim(p_name), trim(p_student_id), r);
  update invites set used_by = auth.uid(), used_at = now() where code = i.code;
  return json_build_object('ok', true, 'role', r);
end $$;

-- 登记当前设备：名额内自动通过，超出则等待部长批准
create or replace function public.register_device(p_device_id text, p_label text)
returns json language plpgsql security definer set search_path = public as $$
declare m members; d devices; n int; maxn int;
begin
  select * into m from members where id = auth.uid();
  if not found then return json_build_object('status', 'no_member'); end if;
  if m.status = 'banned' then return json_build_object('status', 'banned'); end if;
  select * into d from devices where user_id = m.id and device_id = p_device_id;
  if found then
    update devices set last_seen = now(), label = coalesce(p_label, label) where id = d.id;
    return json_build_object('status', case when m.role = 'admin' then 'approved' else d.status end, 'role', m.role);
  end if;
  select coalesce((value)::text::int, 3) into maxn from settings where key = 'max_devices';
  select count(*) into n from devices where user_id = m.id and status = 'approved';
  insert into devices(user_id, device_id, label, status)
    values (m.id, p_device_id, p_label,
            case when m.role = 'admin' or n < coalesce(maxn, 3) then 'approved' else 'pending' end)
    returning * into d;
  return json_build_object('status', case when m.role = 'admin' then 'approved' else d.status end, 'role', m.role);
end $$;

-- 记录查看/下载
create or replace function public.log_access(p_resource uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member() then raise exception '无权限'; end if;
  insert into access_logs(user_id, resource_id, action, device_id)
    values (auth.uid(), p_resource, p_action, current_device());
  if p_action = 'view' then
    update resources set views = views + 1 where id = p_resource;
  else
    update resources set downloads = downloads + 1 where id = p_resource;
  end if;
end $$;

-- 生成邀请码（管理员）
create or replace function public.create_invite(p_for_name text, p_for_student_id text, p_days int)
returns text language plpgsql security definer set search_path = public as $$
declare c text; b bytea; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; k int;
begin
  if not is_admin() then raise exception '只有部长可以生成邀请码'; end if;
  loop
    b := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    c := '';
    for k in 0..9 loop
      c := c || substr(alphabet, 1 + (get_byte(b, k) % 32), 1);
    end loop;
    exit when not exists (select 1 from invites where code = c);
  end loop;
  insert into invites(code, for_name, for_student_id, created_by, expires_at)
    values (c, trim(p_for_name), nullif(trim(coalesce(p_for_student_id, '')), ''), auth.uid(),
            case when p_days is null or p_days <= 0 then null else now() + make_interval(days => p_days) end);
  return c;
end $$;

-- 封禁 / 解封成员（管理员）
create or replace function public.set_member_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '无权限'; end if;
  if p_user = auth.uid() then raise exception '不能封禁自己'; end if;
  update members set status = p_status where id = p_user;
end $$;

-- 移交部长（管理员）权限：对方成为管理员，自己变回普通成员
create or replace function public.transfer_admin(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception '只有现任部长可以移交'; end if;
  if p_user = auth.uid() then raise exception '不能移交给自己'; end if;
  if not exists (select 1 from members where id = p_user and status = 'active') then
    raise exception '对方不是有效成员';
  end if;
  update members set role = 'admin'  where id = p_user;
  update members set role = 'member' where id = auth.uid();
end $$;

revoke all on function public.check_invite(text) from public;
grant execute on function public.check_invite(text) to anon, authenticated;
grant execute on function public.redeem_invite(text, text, text) to authenticated;
grant execute on function public.register_device(text, text) to authenticated;
grant execute on function public.log_access(uuid, text) to authenticated;
grant execute on function public.create_invite(text, text, int) to authenticated;
grant execute on function public.set_member_status(uuid, text) to authenticated;
grant execute on function public.transfer_admin(uuid) to authenticated;

-- ---------- 文件存储 ----------

insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do update set public = false;

drop policy if exists files_read on storage.objects;
create policy files_read on storage.objects for select to authenticated
  using (bucket_id = 'files' and public.is_active_account());

drop policy if exists files_insert on storage.objects;
create policy files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and public.is_active_account()
              and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists files_delete on storage.objects;
create policy files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'files' and ((storage.foldername(name))[2] = auth.uid()::text or public.is_admin()));

-- ---------- 部长（第一个管理员）邀请码 ----------
-- 只在还没有管理员、也没有未用的管理员邀请码时生成一个
do $$
declare c text; b bytea; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; k int;
begin
  if not exists (select 1 from public.members where role = 'admin')
     and not exists (select 1 from public.invites where role = 'admin' and used_by is null and not revoked) then
    b := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    c := '';
    for k in 0..9 loop
      c := c || substr(alphabet, 1 + (get_byte(b, k) % 32), 1);
    end loop;
    insert into public.invites(code, for_name, role) values (c, '部长', 'admin');
  end if;
end $$;

select code as "部长邀请码（复制它，用来注册第一个账号）"
from public.invites where role = 'admin' and used_by is null and not revoked;
