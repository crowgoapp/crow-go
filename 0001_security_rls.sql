-- Crow Go — Migration 0001: RLS, admin authorization, and subscription/payment/referral integrity
--
-- WHY THIS FILE EXISTS
-- The code review (2026-11-20) found that every security guarantee in this app was
-- supposed to live in Supabase Row Level Security policies, but none of that was
-- ever committed to the repo — so it could not be verified, reproduced, or rolled
-- back. This migration is the missing "source of truth" for the database side of
-- the fixes (issues C1-C5, H1-H4 in the review).
--
-- HOW TO APPLY
--   1. Run this against a DEV/STAGING Supabase project first, never directly on
--      production. Create one if you don't have one (Project > New Project).
--   2. Via Supabase CLI:      supabase db push
--      Or paste it directly into the SQL Editor in the Supabase dashboard.
--   3. This assumes the table/column names inferred in the review (section 3):
--      profiles, products, product_images, orders, payments, referrals.
--      ADJUST the column names below if your real schema differs — export your
--      current schema first with: supabase db dump --schema public
--   4. After applying, open Supabase Dashboard > Advisors > Security Advisor and
--      fix anything it still flags.
--   5. Test as TWO different waseet accounts plus the anonymous (logged-out) key
--      and confirm neither can read/write the other's data. See
--      docs/fixes-applied.md for the full acceptance checklist.
--
-- This migration intentionally does NOT touch auth settings (email confirmation,
-- CAPTCHA, rate limits) — those are dashboard toggles, not SQL. See README.md.

begin;

-- =========================================================================
-- 1. Enable Row Level Security on every table that holds user or business data
-- =========================================================================
alter table public.profiles        enable row level security;
alter table public.products        enable row level security;
alter table public.product_images  enable row level security;
alter table public.orders          enable row level security;
alter table public.payments        enable row level security;
alter table public.referrals       enable row level security;

-- =========================================================================
-- 2. Admin authorization — a real admins table instead of a hardcoded password
--    (fixes C1, C2)
-- =========================================================================
create table if not exists public.admins (
    user_id    uuid primary key references auth.users on delete cascade,
    created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- Deliberately NO select/insert/update policy on public.admins: with RLS on and
-- no policy, nothing is readable or writable through the anon/authenticated
-- client keys at all. Only a service-role connection (Supabase dashboard, or a
-- server-side script) can add/remove admins. Run manually once:
--   insert into public.admins (user_id) values ('<the admin auth.users.id>');

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.has_active_sub()
returns boolean
language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and subscription_end > now()
    );
$$;

grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.has_active_sub() to authenticated, anon;

-- =========================================================================
-- 3. Profiles — read your own row (or admin reads all); only a few columns
--    are self-editable. subscription_end and referral_code are NOT in that
--    list, which is what closes the "extend my own subscription" hole (C4b).
-- =========================================================================
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
    using (id = auth.uid() or public.is_admin());

revoke update on public.profiles from authenticated;
grant update (name, governorate, profession) on public.profiles to authenticated;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
    using (id = auth.uid())
    with check (id = auth.uid());

-- Admins may update any profile column (used by confirm_payment()/admin tools).
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update
    using (public.is_admin())
    with check (public.is_admin());

-- =========================================================================
-- 4. Products — owner-only, and inserts require an active subscription
--    (fixes H1: an expired waseet can no longer add products)
-- =========================================================================
drop policy if exists products_select on public.products;
create policy products_select on public.products for select
    using (owner_id = auth.uid() or public.is_admin());

drop policy if exists products_insert on public.products;
create policy products_insert on public.products for insert
    with check (owner_id = auth.uid() and public.has_active_sub());

drop policy if exists products_update on public.products;
create policy products_update on public.products for update
    using (owner_id = auth.uid())
    with check (owner_id = auth.uid());

drop policy if exists products_delete on public.products;
create policy products_delete on public.products for delete
    using (owner_id = auth.uid());

-- Prevent duplicate catalog serial numbers per owner (fixes M4)
create unique index if not exists products_owner_serial
    on public.products (owner_id, serial);

-- Auto-assign the serial number server-side instead of trusting the client's
-- "max(serial) in the browser + 1" (which breaks across two open tabs/devices).
create or replace function public.set_product_serial()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
    if new.serial is null then
        select coalesce(max(serial), 0) + 1 into new.serial
        from public.products
        where owner_id = new.owner_id;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_set_product_serial on public.products;
create trigger trg_set_product_serial
    before insert on public.products
    for each row execute function public.set_product_serial();

-- =========================================================================
-- 5. Product images — access follows the parent product
-- =========================================================================
drop policy if exists images_all on public.product_images;
create policy images_all on public.product_images for all
    using (exists (
        select 1 from public.products p
        where p.id = product_id and p.owner_id = auth.uid()
    ))
    with check (exists (
        select 1 from public.products p
        where p.id = product_id and p.owner_id = auth.uid()
    ));

-- =========================================================================
-- 6. Orders — owner-only, inserts also require an active subscription (H1)
-- =========================================================================
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select
    using (owner_id = auth.uid() or public.is_admin());

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert
    with check (owner_id = auth.uid() and public.has_active_sub());

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update
    using (owner_id = auth.uid())
    with check (owner_id = auth.uid());

drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders for delete
    using (owner_id = auth.uid());

-- =========================================================================
-- 7. Payments — a waseet can only ever insert their own PENDING request, and
--    can never flip it to confirmed themselves (fixes C4a)
-- =========================================================================
drop policy if exists pay_insert on public.payments;
create policy pay_insert on public.payments for insert
    with check (waseet_id = auth.uid() and status = 'pending');

drop policy if exists pay_select on public.payments;
create policy pay_select on public.payments for select
    using (waseet_id = auth.uid() or public.is_admin());

-- No update/delete policy for "authenticated" at all: only confirm_payment()/
-- reject_payment() below (as security definer, run by an admin) may change status.

create or replace function public.confirm_payment(p_id bigint, p_days int default 30)
returns void
language plpgsql security definer set search_path = public as $$
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
$$;

create or replace function public.reject_payment(p_id bigint)
returns void
language plpgsql security definer set search_path = public as $$
begin
    if not public.is_admin() then
        raise exception 'not allowed';
    end if;

    update public.payments
        set status = 'rejected'
        where id = p_id and status = 'pending';
end;
$$;

grant execute on function public.confirm_payment(bigint, int) to authenticated;
grant execute on function public.reject_payment(bigint) to authenticated;

-- =========================================================================
-- 8. Referrals — applied server-side only, one referral per new account,
--    reward granted automatically every 5 (fixes H3, C4c)
-- =========================================================================
alter table public.referrals
    add constraint referrals_referred_unique unique (referred_id);

revoke insert, update, delete on public.referrals from authenticated, anon;

drop policy if exists referrals_select on public.referrals;
create policy referrals_select on public.referrals for select
    using (referrer_id = auth.uid() or public.is_admin());

create or replace function public.apply_referral(p_code text)
returns void
language plpgsql security definer set search_path = public as $$
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
$$;

grant execute on function public.apply_referral(text) to authenticated;

-- =========================================================================
-- 9. Admin PIN reset bookkeeping (used by the admin-reset-pin edge function,
--    see supabase/functions/admin-reset-pin). No RLS access for normal users.
-- =========================================================================
create table if not exists public.pin_reset_audit (
    id          bigint generated always as identity primary key,
    waseet_id   uuid not null references auth.users on delete cascade,
    reset_by    uuid not null references auth.users on delete cascade,
    created_at  timestamptz not null default now()
);
alter table public.pin_reset_audit enable row level security;
drop policy if exists pin_reset_audit_select on public.pin_reset_audit;
create policy pin_reset_audit_select on public.pin_reset_audit for select
    using (public.is_admin());

commit;

-- =========================================================================
-- MANUAL STEP (cannot be done in SQL): create the first admin.
-- Run this once, after you know your own auth.users.id (Authentication >
-- Users in the dashboard, or: select id from auth.users where email = '...'):
--
--   insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000000');
-- =========================================================================
