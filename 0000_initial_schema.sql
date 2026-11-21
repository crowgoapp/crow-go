-- Crow Go — Migration 0000: Initial database schema
--
-- WHY THIS FILE EXISTS
-- The original repo shipped with no database files at all (report issue
-- L6) — the schema below is INFERRED from the queries in app.js/waseet.js/
-- admin.js (report section 3) plus what was actually observed while
-- smoke-testing the fixed app against the live project on 2026-11-20:
--   - a new signup gets a referral_code shaped like "CROW-XXXX"
--   - a new signup's subscription_end is set exactly 7 days out
-- This strongly implies a trigger already exists on auth.users in the
-- live project that does what handle_new_user() below does. This file
-- reproduces that behavior so a FRESH project can be stood up with the
-- same structure — it is not a guaranteed byte-for-byte copy of whatever
-- already runs in production.
--
-- WHO SHOULD RUN THIS, AND WHEN
--   - Setting up a new/empty Supabase project (e.g. the separate dev
--     project recommended in the review, Phase 0): run this file FIRST,
--     before 0001_security_rls.sql and 0002_storage_policies.sql.
--   - The existing LIVE project: do NOT run this blind. It already has
--     these tables. First export the real schema and diff it against this
--     file:
--         supabase db dump --schema public > live_schema.sql
--     Only apply the pieces that are actually missing (e.g. if the admins
--     table, generate_referral_code(), or the trigger don't already
--     exist there under these exact names).
--
-- This migration does not enable RLS or add any policies — that is
-- 0001_security_rls.sql's job, and it assumes these tables already exist.

begin;

-- =========================================================================
-- profiles — one row per waseet, created automatically on signup
-- =========================================================================
create table if not exists public.profiles (
    id                uuid primary key references auth.users (id) on delete cascade,
    name              text not null,
    phone             text not null,
    governorate       text,
    profession        text,
    referral_code     text unique,
    subscription_end  timestamptz,
    created_at        timestamptz not null default now()
);

create unique index if not exists profiles_phone_key on public.profiles (phone);

-- =========================================================================
-- products — a waseet's catalog items, including the "secret" owner data
-- =========================================================================
create table if not exists public.products (
    id                   bigint generated always as identity primary key,
    owner_id             uuid not null references public.profiles (id) on delete cascade,
    serial               integer,
    name                 text not null,
    price                numeric(12, 2) not null,
    description          text,
    owner_name           text,
    owner_phone          text,
    owner_address        text,
    selected_for_catalog boolean not null default false,
    created_at           timestamptz not null default now()
);

create index if not exists products_owner_id_idx on public.products (owner_id);
-- NOTE: the unique (owner_id, serial) index and the serial-assigning
-- trigger are created in 0001_security_rls.sql, alongside the rest of the
-- anti-tampering logic — keeping them there avoids defining the same
-- trigger function in two files.

-- =========================================================================
-- product_images — multiple photos per product, stored in Supabase Storage
-- =========================================================================
create table if not exists public.product_images (
    id            bigint generated always as identity primary key,
    product_id    bigint not null references public.products (id) on delete cascade,
    storage_path  text not null,
    sort_order    integer not null default 0,
    created_at    timestamptz not null default now()
);

create index if not exists product_images_product_id_idx on public.product_images (product_id);

-- =========================================================================
-- orders — customer requests a waseet logs and tracks
-- =========================================================================
create table if not exists public.orders (
    id             bigint generated always as identity primary key,
    owner_id       uuid not null references public.profiles (id) on delete cascade,
    item_needed    text not null,
    client_name    text not null,
    client_phone   text not null,
    client_address text,
    status         text not null default 'new' check (status in ('new', 'contacted', 'done')),
    created_at     timestamptz not null default now()
);

create index if not exists orders_owner_id_idx on public.orders (owner_id);

-- =========================================================================
-- payments — manual InstaPay/Vodafone Cash subscription renewal requests
-- =========================================================================
create table if not exists public.payments (
    id          bigint generated always as identity primary key,
    waseet_id   uuid not null references public.profiles (id) on delete cascade,
    amount      numeric(12, 2) not null,
    method      text not null,
    notes       text,
    status      text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
    created_at  timestamptz not null default now()
);

create index if not exists payments_waseet_id_idx on public.payments (waseet_id);
create index if not exists payments_status_idx on public.payments (status);

-- =========================================================================
-- referrals — who referred whom (reward logic lives in apply_referral(),
-- see 0001_security_rls.sql)
-- =========================================================================
create table if not exists public.referrals (
    id           bigint generated always as identity primary key,
    referrer_id  uuid not null references public.profiles (id) on delete cascade,
    referred_id  uuid not null references public.profiles (id) on delete cascade,
    created_at   timestamptz not null default now()
);

create index if not exists referrals_referrer_id_idx on public.referrals (referrer_id);
-- NOTE: the unique constraint on referred_id (one referral per new account)
-- is added in 0001_security_rls.sql alongside apply_referral().

-- =========================================================================
-- Auto-create a profile row (with a generated referral code and a 7-day
-- free trial) whenever someone signs up through auth.users — this is what
-- app.js's handleRegister() relies on existing.
-- =========================================================================
create or replace function public.generate_referral_code()
returns text
language plpgsql as $$
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
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
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
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

commit;
