-- ============================================================================
-- Crow Go - Complete Database Schema Snapshot (public)
-- Generated from live Supabase public schema snapshot
-- ============================================================================

-- 1. TABLES

create table if not exists public.profiles (
    id uuid not null,
    name text not null,
    phone text not null,
    governorate text,
    profession text,
    referral_code text,
    subscription_end timestamp with time zone,
    created_at timestamp with time zone default now() not null,
    whatsapp_phone text,
    primary key (id),
    constraint profiles_referral_code_key unique (referral_code),
    -- constraint profiles_id_fkey: foreign key (id) references auth.users(id) on delete CASCADE
);

create table if not exists public.admins (
    user_id uuid not null,
    created_at timestamp with time zone default now() not null,
    primary key (user_id),
    -- constraint admins_user_id_fkey: foreign key (user_id) references auth.users(id) on delete CASCADE
);

create table if not exists public.products (
    id bigint generated always as identity,
    owner_id uuid not null,
    serial integer,
    name text not null,
    price numeric not null,
    description text,
    owner_name text,
    owner_phone text,
    owner_address text,
    selected_for_catalog boolean default false not null,
    created_at timestamp with time zone default now() not null,
    primary key (id),
    constraint products_owner_id_fkey foreign key (owner_id) references public.profiles(id) on delete CASCADE
);

create table if not exists public.product_images (
    id bigint generated always as identity,
    product_id bigint generated always as identity not null,
    storage_path text not null,
    sort_order integer default 0 not null,
    created_at timestamp with time zone default now() not null,
    primary key (id),
    constraint product_images_product_id_fkey foreign key (product_id) references public.products(id) on delete CASCADE
);

create table if not exists public.orders (
    id bigint generated always as identity,
    owner_id uuid not null,
    item_needed text not null,
    client_name text not null,
    client_phone text not null,
    client_address text,
    status text default 'new' not null,
    created_at timestamp with time zone default now() not null,
    primary key (id),
    constraint orders_owner_id_fkey foreign key (owner_id) references public.profiles(id) on delete CASCADE,
    -- check constraint: orders_status_check
);

create table if not exists public.payments (
    id bigint generated always as identity,
    waseet_id uuid not null,
    amount numeric not null,
    method text not null,
    notes text,
    status text default 'pending' not null,
    created_at timestamp with time zone default now() not null,
    primary key (id),
    constraint payments_waseet_id_fkey foreign key (waseet_id) references public.profiles(id) on delete CASCADE,
    -- check constraint: payments_status_check
);

create table if not exists public.referrals (
    id bigint generated always as identity,
    referrer_id uuid not null,
    referred_id uuid not null,
    created_at timestamp with time zone default now() not null,
    primary key (id),
    constraint referrals_referred_unique unique (referred_id),
    constraint referrals_referrer_id_fkey foreign key (referrer_id) references public.profiles(id) on delete CASCADE,
    constraint referrals_referred_id_fkey foreign key (referred_id) references public.profiles(id) on delete CASCADE
);

create table if not exists public.pin_reset_audit (
    id bigint generated always as identity,
    waseet_id uuid not null,
    reset_by uuid not null,
    created_at timestamp with time zone default now() not null,
    primary key (id),
    -- constraint pin_reset_audit_reset_by_fkey: foreign key (reset_by) references auth.users(id),
    -- constraint pin_reset_audit_waseet_id_fkey: foreign key (waseet_id) references auth.users(id)
);

-- 2. INDEXES

CREATE INDEX orders_owner_id_idx ON public.orders USING btree (owner_id);
CREATE INDEX payments_status_idx ON public.payments USING btree (status);
CREATE INDEX payments_waseet_id_idx ON public.payments USING btree (waseet_id);
CREATE INDEX product_images_product_id_idx ON public.product_images USING btree (product_id);
CREATE INDEX products_owner_id_idx ON public.products USING btree (owner_id);
CREATE UNIQUE INDEX products_owner_serial ON public.products USING btree (owner_id, serial);
CREATE UNIQUE INDEX profiles_phone_key ON public.profiles USING btree (phone);
CREATE UNIQUE INDEX profiles_referral_code_key ON public.profiles USING btree (referral_code);
CREATE UNIQUE INDEX referrals_referred_unique ON public.referrals USING btree (referred_id);
CREATE INDEX referrals_referrer_id_idx ON public.referrals USING btree (referrer_id);

-- 3. FUNCTIONS & TRIGGERS

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.admins
    where user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.set_product_serial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    if new.serial is null then
        select coalesce(max(serial), 0) + 1 into new.serial
        from public.products
        where owner_id = new.owner_id;
    end if;
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
    v_code   text;
    v_exists boolean;
begin
    loop
        v_code := 'CROW-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
        select exists(select 1 from public.profiles where referral_code = v_code) into v_exists;
        exit when not v_exists;
    end loop;
    return v_code;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    insert into public.profiles (id, name, phone, governorate, profession, referral_code, subscription_end)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'name', ''),
        coalesce(new.raw_user_meta_data->>'phone', ''),
        new.raw_user_meta_data->>'governorate',
        new.raw_user_meta_data->>'profession',
        public.generate_referral_code(),
        now() + interval '7 days'
    )
    on conflict (id) do nothing;
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.has_active_sub()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.subscription_end is not null
          and p.subscription_end > now()
    );
$function$;

CREATE OR REPLACE FUNCTION public.confirm_payment(p_id bigint, p_days integer DEFAULT 30)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_waseet uuid;
begin
    if not public.is_admin() then
        raise exception 'not allowed';
    end if;

    update public.payments
        set status = 'confirmed'
        where id = p_id and status = 'pending'
        returning waseet_id into v_waseet;

    if v_waseet is null then
        raise exception 'payment not found or already handled';
    end if;

    update public.profiles
        set subscription_end = greatest(coalesce(subscription_end, now()), now())
                                + make_interval(days => p_days)
        where id = v_waseet;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reject_payment(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    if not public.is_admin() then
        raise exception 'not allowed';
    end if;

    update public.payments
        set status = 'rejected'
        where id = p_id and status = 'pending';
end;
$function$;

CREATE OR REPLACE FUNCTION public.apply_referral(p_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_ref  uuid;
    v_rows int;
    v_cnt  int;
begin
    select id into v_ref from public.profiles where referral_code = upper(trim(p_code));
    if v_ref is null or v_ref = auth.uid() then
        return;
    end if;

    insert into public.referrals (referrer_id, referred_id)
    values (v_ref, auth.uid())
    on conflict (referred_id) do nothing;

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
        return;
    end if;

    select count(*) into v_cnt from public.referrals where referrer_id = v_ref;
    if v_cnt % 5 = 0 then
        update public.profiles
            set subscription_end = greatest(coalesce(subscription_end, now()), now())
                                    + interval '7 days'
            where id = v_ref;
    end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_whatsapp()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_phone text;
begin
  select coalesce(nullif(trim(whatsapp_phone), ''), nullif(trim(phone), ''))
  into v_phone
  from public.profiles
  where id = '910e51e9-7870-4d26-9f7e-5ae67a32a524'::uuid
  limit 1;

  return coalesce(v_phone, '');
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_cancel_account(p_waseet_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    if not public.is_admin() then
        raise exception 'not allowed: admin privileges required';
    end if;

    begin
        delete from public.profiles where id = p_waseet_id;
        if found then
            return 'deleted';
        end if;
    exception when others then
        null;
    end;

    update public.profiles
        set subscription_end = now()
        where id = p_waseet_id;

    if not found then
        raise exception 'profile not found';
    end if;

    return 'expired';
end;
$function$;

-- 4. ROW LEVEL SECURITY (RLS) & POLICIES

alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.pin_reset_audit enable row level security;
alter table public.product_images enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.referrals enable row level security;

drop policy if exists "orders_delete" on public.orders;
create policy "orders_delete" on public.orders as PERMISSIVE for DELETE to public
using ((owner_id = auth.uid()));

drop policy if exists "orders_delete_own_or_admin" on public.orders;
create policy "orders_delete_own_or_admin" on public.orders as PERMISSIVE for DELETE to authenticated
using (((owner_id = auth.uid()) OR is_admin()));

drop policy if exists "orders_insert" on public.orders;
create policy "orders_insert" on public.orders as PERMISSIVE for INSERT to public
with check (((owner_id = auth.uid()) AND has_active_sub()));

drop policy if exists "orders_insert_active_sub" on public.orders;
create policy "orders_insert_active_sub" on public.orders as PERMISSIVE for INSERT to authenticated
with check (((owner_id = auth.uid()) AND has_active_sub()));

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders as PERMISSIVE for INSERT to authenticated
with check ((owner_id = auth.uid()));

drop policy if exists "orders_select" on public.orders;
create policy "orders_select" on public.orders as PERMISSIVE for SELECT to public
using (((owner_id = auth.uid()) OR is_admin()));

drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin" on public.orders as PERMISSIVE for SELECT to authenticated
using (((owner_id = auth.uid()) OR is_admin()));

drop policy if exists "orders_update" on public.orders;
create policy "orders_update" on public.orders as PERMISSIVE for UPDATE to public
using ((owner_id = auth.uid()))
with check ((owner_id = auth.uid()));

drop policy if exists "orders_update_own_or_admin" on public.orders;
create policy "orders_update_own_or_admin" on public.orders as PERMISSIVE for UPDATE to authenticated
using (((owner_id = auth.uid()) OR is_admin()))
with check (((owner_id = auth.uid()) OR is_admin()));

drop policy if exists "pay_insert" on public.payments;
create policy "pay_insert" on public.payments as PERMISSIVE for INSERT to public
with check (((waseet_id = auth.uid()) AND (status = 'pending'::text)));

drop policy if exists "pay_select" on public.payments;
create policy "pay_select" on public.payments as PERMISSIVE for SELECT to public
using (((waseet_id = auth.uid()) OR is_admin()));

drop policy if exists "payments_insert_own" on public.payments;
create policy "payments_insert_own" on public.payments as PERMISSIVE for INSERT to authenticated
with check ((waseet_id = auth.uid()));

drop policy if exists "payments_select_own_or_admin" on public.payments;
create policy "payments_select_own_or_admin" on public.payments as PERMISSIVE for SELECT to authenticated
using (((waseet_id = auth.uid()) OR is_admin()));

drop policy if exists "pin_reset_audit_select" on public.pin_reset_audit;
create policy "pin_reset_audit_select" on public.pin_reset_audit as PERMISSIVE for SELECT to public
using (is_admin());

drop policy if exists "Allow owner or admin to read product images" on public.product_images;
create policy "Allow owner or admin to read product images" on public.product_images as PERMISSIVE for SELECT to public
using ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_images.product_id) AND ((p.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM admins a
          WHERE (a.user_id = auth.uid()))))))));

drop policy if exists "Allow read product images" on public.product_images;
create policy "Allow read product images" on public.product_images as PERMISSIVE for SELECT to public
using (true);

drop policy if exists "images_all" on public.product_images;
create policy "images_all" on public.product_images as PERMISSIVE for ALL to public
using ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_images.product_id) AND (p.owner_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM products p
  WHERE ((p.id = product_images.product_id) AND (p.owner_id = auth.uid())))));

drop policy if exists "product_images_all_own_or_admin" on public.product_images;
create policy "product_images_all_own_or_admin" on public.product_images as PERMISSIVE for ALL to authenticated
using ((is_admin() OR (EXISTS ( SELECT 1
   FROM products pr
  WHERE ((pr.id = product_images.product_id) AND (pr.owner_id = auth.uid()))))))
with check ((is_admin() OR (EXISTS ( SELECT 1
   FROM products pr
  WHERE ((pr.id = product_images.product_id) AND (pr.owner_id = auth.uid()))))));

drop policy if exists "Allow owner or admin to read products" on public.products;
create policy "Allow owner or admin to read products" on public.products as PERMISSIVE for SELECT to public
using (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.user_id = auth.uid())))));

drop policy if exists "products_delete" on public.products;
create policy "products_delete" on public.products as PERMISSIVE for DELETE to public
using ((owner_id = auth.uid()));

drop policy if exists "products_delete_own_or_admin" on public.products;
create policy "products_delete_own_or_admin" on public.products as PERMISSIVE for DELETE to authenticated
using (((owner_id = auth.uid()) OR is_admin()));

drop policy if exists "products_insert" on public.products;
create policy "products_insert" on public.products as PERMISSIVE for INSERT to public
with check (((owner_id = auth.uid()) AND has_active_sub()));

drop policy if exists "products_insert_active_sub" on public.products;
create policy "products_insert_active_sub" on public.products as PERMISSIVE for INSERT to authenticated
with check (((owner_id = auth.uid()) AND has_active_sub()));

drop policy if exists "products_insert_when_active_sub" on public.products;
create policy "products_insert_when_active_sub" on public.products as PERMISSIVE for INSERT to authenticated
with check (((owner_id = auth.uid()) AND has_active_sub()));

drop policy if exists "products_select" on public.products;
create policy "products_select" on public.products as PERMISSIVE for SELECT to public
using (((owner_id = auth.uid()) OR is_admin()));

drop policy if exists "products_select_own_or_admin" on public.products;
create policy "products_select_own_or_admin" on public.products as PERMISSIVE for SELECT to authenticated
using (((owner_id = auth.uid()) OR is_admin()));

drop policy if exists "products_update" on public.products;
create policy "products_update" on public.products as PERMISSIVE for UPDATE to public
using ((owner_id = auth.uid()))
with check ((owner_id = auth.uid()));

drop policy if exists "products_update_own_or_admin" on public.products;
create policy "products_update_own_or_admin" on public.products as PERMISSIVE for UPDATE to authenticated
using (((owner_id = auth.uid()) OR is_admin()))
with check (((owner_id = auth.uid()) OR is_admin()));

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles as PERMISSIVE for SELECT to public
using (((id = auth.uid()) OR is_admin()));

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles as PERMISSIVE for SELECT to authenticated
using (((id = auth.uid()) OR is_admin()));

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles as PERMISSIVE for UPDATE to public
using (is_admin())
with check (is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles as PERMISSIVE for UPDATE to public
using ((id = auth.uid()))
with check ((id = auth.uid()));

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles as PERMISSIVE for UPDATE to authenticated
using (((id = auth.uid()) OR is_admin()))
with check (((id = auth.uid()) OR is_admin()));

drop policy if exists "referrals_select" on public.referrals;
create policy "referrals_select" on public.referrals as PERMISSIVE for SELECT to public
using (((referrer_id = auth.uid()) OR is_admin()));

drop policy if exists "referrals_select_own_or_admin" on public.referrals;
create policy "referrals_select_own_or_admin" on public.referrals as PERMISSIVE for SELECT to authenticated
using (((referrer_id = auth.uid()) OR (referred_id = auth.uid()) OR is_admin()));
