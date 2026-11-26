-- ============================================================================
-- crowgo-hardening.sql
-- Patches the EXISTING live Crow Go database (the one already running at
-- qonffvfaxjtzfaozvsng.supabase.co as of 2026-11-26). Safe to re-run.
--
-- WHY THIS FILE EXISTS
-- The 2026-11-25 code review found the live database has NO RLS protection
-- at all on the `admins` table, and ~35 overlapping RLS policies across the
-- other tables where a single overly-permissive duplicate defeats every
-- stricter policy next to it (Postgres OR's permissive policies together).
-- Confirmed by the reviewer with live exploit tests against a cloned copy:
-- an anonymous, logged-out visitor can insert themselves into `admins` and
-- become a full admin; any waseet can set their own subscription_end to
-- the year 2099; any waseet can insert a payments row that is already
-- "confirmed" for a negative amount; any waseet can read every other
-- waseet's product photos.
--
-- BEFORE YOU RUN THIS (do these manually first, in the SQL Editor):
--   1. select * from public.admins;
--      -- should show exactly your own real admin row(s). Delete anything
--      -- else - if there's anything else, someone already exploited the
--      -- hole above and you should also rotate your admin password.
--   2. select * from public.payments where status = 'confirmed' or amount <= 0;
--      -- review any payment that was confirmed without going through
--      -- confirm_payment(), or has a non-positive amount.
--   3. select id, subscription_end from public.profiles
--        where subscription_end > now() + interval '400 days';
--      -- flags any suspiciously far-future subscription_end that may have
--      -- been self-set rather than paid for.
--   4. Do this on a COPY/dev project first if you possibly can. The
--      reviewer tested this file against a cloned copy of your schema with
--      real attack scenarios (section 4 of the report) - I could not do
--      the same from this session (no database credentials, no local
--      Postgres available here), so please don't skip your own test pass.
--
-- The whole file runs in one transaction: if anything fails, nothing
-- changes. If you need to re-run it, it is idempotent except for the
-- CHECK constraints in section 1, which will correctly refuse to apply if
-- existing data violates them (that's your signal to go clean it up, per
-- step 2/3 above, not a bug in this file).
-- ============================================================================

begin;

-- =========================================================================
-- 0. Close the critical hole FIRST, on its own, in case anything later in
--    this file has to be rolled back for any reason.
-- =========================================================================
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
-- No policies are added for admins on purpose: with RLS on and zero
-- policies, anon/authenticated get zero rows and zero writes. Only a
-- service-role connection (or you, in the dashboard) can read/write it.

-- =========================================================================
-- 1. New columns + constraints the app/schema now expects
-- =========================================================================
alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles add column if not exists last_product_serial integer not null default 0;
alter table public.profiles add column if not exists whatsapp_phone text;

do $$ begin
    alter table public.profiles add constraint profiles_account_status_check
        check (account_status in ('active', 'cancelled'));
exception when duplicate_object then null;
end $$;

-- عشان counter التسلسل يبدأ من أعلى رقم موجود فعلاً لكل وسيط، مش من صفر
-- (لو شغلتها على قاعدة فيها بيانات حقيقية أصلاً).
update public.profiles p
    set last_product_serial = greatest(p.last_product_serial, coalesce((
        select max(pr.serial) from public.products pr where pr.owner_id = p.id
    ), 0));

do $$ begin
    alter table public.payments add constraint payments_amount_check check (amount > 0);
exception when duplicate_object then null;
end $$;

do $$ begin
    alter table public.products add constraint products_price_check check (price >= 0);
exception when duplicate_object then null;
end $$;

create table if not exists public.admin_audit_log (
    id          bigint generated always as identity primary key,
    admin_id    uuid not null references auth.users (id),
    action      text not null,
    target_id   uuid,
    details     jsonb,
    created_at  timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
drop policy if exists admin_audit_log_select on public.admin_audit_log;
create policy admin_audit_log_select on public.admin_audit_log for select using (public.is_admin());

-- =========================================================================
-- 2. Drop every existing policy by its exact current name (captured from
--    a live schema dump on 2026-11-26) before rebuilding clean ones.
-- =========================================================================
drop policy if exists orders_delete on public.orders;
drop policy if exists orders_delete_own_or_admin on public.orders;
drop policy if exists orders_insert on public.orders;
drop policy if exists orders_insert_active_sub on public.orders;
drop policy if exists orders_insert_own on public.orders;
drop policy if exists orders_select on public.orders;
drop policy if exists orders_select_own_or_admin on public.orders;
drop policy if exists orders_update on public.orders;
drop policy if exists orders_update_own_or_admin on public.orders;

drop policy if exists pay_insert on public.payments;
drop policy if exists pay_select on public.payments;
drop policy if exists payments_insert_own on public.payments;
drop policy if exists payments_select_own_or_admin on public.payments;

drop policy if exists pin_reset_audit_select on public.pin_reset_audit;

drop policy if exists "Allow owner or admin to read product images" on public.product_images;
drop policy if exists "Allow read product images" on public.product_images;
drop policy if exists images_all on public.product_images;
drop policy if exists product_images_all_own_or_admin on public.product_images;

drop policy if exists "Allow owner or admin to read products" on public.products;
drop policy if exists products_delete on public.products;
drop policy if exists products_delete_own_or_admin on public.products;
drop policy if exists products_insert on public.products;
drop policy if exists products_insert_active_sub on public.products;
drop policy if exists products_insert_when_active_sub on public.products;
drop policy if exists products_select on public.products;
drop policy if exists products_select_own_or_admin on public.products;
drop policy if exists products_update on public.products;
drop policy if exists products_update_own_or_admin on public.products;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_select_own_or_admin on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_update_own_or_admin on public.profiles;

drop policy if exists referrals_select on public.referrals;
drop policy if exists referrals_select_own_or_admin on public.referrals;

-- =========================================================================
-- 3. Rebuild: exactly one policy per operation per table, so there is
--    nothing left for a weak duplicate to undermine.
-- =========================================================================

-- profiles: read your own row (or admin); self-edit only 3 harmless
-- columns (closes N-C3: self-editing subscription_end to 2099, and
-- self-editing referral_code/phone).
create policy profiles_select on public.profiles for select
    using (id = auth.uid() or public.is_admin());

revoke update on public.profiles from authenticated;
grant update (name, governorate, profession) on public.profiles to authenticated;
-- whatsapp_phone is intentionally NOT in that grant list - it's set only
-- via admin_set_whatsapp() below (security definer), which is how N-H2
-- gets closed on the write side, not just by removing a JS fallback UUID.

create policy profiles_update on public.profiles for update
    using (id = auth.uid() or public.is_admin())
    with check (id = auth.uid() or public.is_admin());

-- products
create policy products_select on public.products for select
    using (owner_id = auth.uid() or public.is_admin());

create policy products_insert on public.products for insert
    with check (owner_id = auth.uid() and public.has_active_sub());

create policy products_update on public.products for update
    using (owner_id = auth.uid() or public.is_admin())
    with check (owner_id = auth.uid() or public.is_admin());

create policy products_delete on public.products for delete
    using (owner_id = auth.uid() or public.is_admin());

-- product_images: tied to the parent product's owner (or admin) - closes
-- D-H2 (the "using (true)" policy that let anyone read every image row).
create policy product_images_all on public.product_images for all
    using (exists (
        select 1 from public.products p
        where p.id = product_images.product_id
          and (p.owner_id = auth.uid() or public.is_admin())
    ))
    with check (exists (
        select 1 from public.products p
        where p.id = product_images.product_id
          and (p.owner_id = auth.uid() or public.is_admin())
    ));

-- orders
create policy orders_select on public.orders for select
    using (owner_id = auth.uid() or public.is_admin());

create policy orders_insert on public.orders for insert
    with check (owner_id = auth.uid() and public.has_active_sub());

create policy orders_update on public.orders for update
    using (owner_id = auth.uid() or public.is_admin())
    with check (owner_id = auth.uid() or public.is_admin());

create policy orders_delete on public.orders for delete
    using (owner_id = auth.uid() or public.is_admin());

-- payments: pending-only insert, amount already > 0 via the table CHECK
-- added in section 1, and at most one pending request per waseet at a
-- time (closes D-H1's "negative confirmed payment" hole and N-H6's
-- "can queue 10 pending requests" finding).
create policy payments_select on public.payments for select
    using (waseet_id = auth.uid() or public.is_admin());

create policy payments_insert on public.payments for insert
    with check (
        waseet_id = auth.uid()
        and status = 'pending'
        and not exists (
            select 1 from public.payments p2
            where p2.waseet_id = auth.uid() and p2.status = 'pending'
        )
    );

-- referrals: read-only from the client; apply_referral() is the only way in.
revoke insert, update, delete on public.referrals from authenticated, anon;

create policy referrals_select on public.referrals for select
    using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin());

create policy pin_reset_audit_select on public.pin_reset_audit for select
    using (public.is_admin());

-- =========================================================================
-- 4. Functions: fix/add the ones the report flagged
-- =========================================================================

-- D-M1: counter-based serial that never gets reused after a delete.
create or replace function public.set_product_serial()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
    if new.serial is null then
        update public.profiles
            set last_product_serial = last_product_serial + 1
            where id = new.owner_id
            returning last_product_serial into new.serial;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_set_product_serial on public.products;
create trigger trg_set_product_serial
    before insert on public.products
    for each row execute function public.set_product_serial();

-- Make sure the signup trigger actually exists (the report found the
-- schema.sql FILE was missing this CREATE TRIGGER line - if it also
-- turns out to be missing live, this adds it; if it already exists,
-- this just replaces it with the same definition).
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

-- has_active_sub(): now also checks account_status (so a cancelled
-- account can't insert new products/orders even before its subscription
-- date runs out).
create or replace function public.has_active_sub()
returns boolean
language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and coalesce(p.account_status, 'active') = 'active'
          and p.subscription_end is not null
          and p.subscription_end > now()
    );
$$;

-- D-H3: the function admin.js already calls for "+week"/"+month" but that
-- did not exist in the database at all.
create or replace function public.admin_extend_subscription(p_waseet_id uuid, p_days int)
returns void
language plpgsql security definer set search_path = public as $$
begin
    if not public.is_admin() then
        raise exception 'not allowed';
    end if;
    if p_days < 1 or p_days > 366 then
        raise exception 'invalid number of days (must be 1-366)';
    end if;

    update public.profiles
        set subscription_end = greatest(coalesce(subscription_end, now()), now())
                                + make_interval(days => p_days)
        where id = p_waseet_id;

    if not found then
        raise exception 'profile not found';
    end if;

    insert into public.admin_audit_log (admin_id, action, target_id, details)
        values (auth.uid(), 'extend_subscription', p_waseet_id, jsonb_build_object('days', p_days));
end;
$$;
grant execute on function public.admin_extend_subscription(uuid, int) to authenticated;

-- N-H1: stop pretending to delete the account (that orphaned the
-- auth.users login row and the function was swallowing any error with
-- "exception when others then null"). This marks it cancelled instead;
-- actually blocking login needs supabase/functions/admin-ban-account
-- (service role), deployed separately.
create or replace function public.admin_cancel_account(p_waseet_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
begin
    if not public.is_admin() then
        raise exception 'not allowed: admin privileges required';
    end if;

    update public.profiles
        set account_status = 'cancelled',
            subscription_end = now()
        where id = p_waseet_id;

    if not found then
        raise exception 'profile not found';
    end if;

    insert into public.admin_audit_log (admin_id, action, target_id)
        values (auth.uid(), 'cancel_account', p_waseet_id);

    return 'cancelled';
end;
$$;
grant execute on function public.admin_cancel_account(uuid) to authenticated;

-- N-H2: read from the admins table instead of a hardcoded UUID.
create or replace function public.get_admin_whatsapp()
returns text
language plpgsql security definer set search_path = public as $$
declare
    v_phone text;
begin
    select coalesce(nullif(trim(p.whatsapp_phone), ''), nullif(trim(p.phone), ''))
    into v_phone
    from public.profiles p
    join public.admins a on a.user_id = p.id
    order by (p.whatsapp_phone is not null and trim(p.whatsapp_phone) <> '') desc, p.created_at asc
    limit 1;

    return coalesce(v_phone, '');
end;
$$;
grant execute on function public.get_admin_whatsapp() to authenticated, anon;

create or replace function public.admin_set_whatsapp(p_phone text)
returns void
language plpgsql security definer set search_path = public as $$
begin
    if not public.is_admin() then
        raise exception 'not allowed';
    end if;
    update public.profiles set whatsapp_phone = p_phone where id = auth.uid();
end;
$$;
grant execute on function public.admin_set_whatsapp(text) to authenticated;

-- D-L1 / N-H5: raise real errors instead of silently returning, and
-- longer/harder-to-guess referral codes (was 4 hex chars = 65,536
-- possibilities; now 6 = ~16.7 million).
create or replace function public.generate_referral_code()
returns text
language plpgsql as $$
declare
    v_code   text;
    v_exists boolean;
begin
    loop
        v_code := 'CROW-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
        select exists(select 1 from public.profiles where referral_code = v_code) into v_exists;
        exit when not v_exists;
    end loop;
    return v_code;
end;
$$;

create or replace function public.apply_referral(p_code text)
returns void
language plpgsql security definer set search_path = public as $$
declare
    v_ref  uuid;
    v_rows int;
    v_cnt  int;
begin
    select id into v_ref from public.profiles where referral_code = upper(trim(p_code));

    if v_ref is null then
        raise exception 'invalid referral code';
    end if;
    if v_ref = auth.uid() then
        raise exception 'cannot refer yourself';
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
            set subscription_end = greatest(coalesce(subscription_end, now()), now()) + interval '7 days'
            where id = v_ref;
    end if;
end;
$$;

commit;

-- =========================================================================
-- 5. Storage policies (run separately - needs the product-images bucket
--    to already exist, which it does on your live project)
-- =========================================================================
drop policy if exists "img_select_public" on storage.objects;
create policy "img_select_public" on storage.objects for select
    using (bucket_id = 'product-images');

drop policy if exists "img_insert_own" on storage.objects;
create policy "img_insert_own" on storage.objects for insert to authenticated
    with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "img_delete_own" on storage.objects;
create policy "img_delete_own" on storage.objects for delete to authenticated
    using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================================
-- AFTER RUNNING: open Supabase Dashboard > Advisors > Security Advisor and
-- confirm "RLS Disabled in Public" no longer lists admins (or anything
-- else). Then work through the acceptance checklist in docs/fixes-applied-report3.md.
-- =========================================================================
