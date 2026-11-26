-- ============================================================================
-- Crow Go - Database Schema (corrected baseline)
-- Fixes applied vs. the previous database/schema.sql (committed 2026-11-25):
--   - Removed 5 trailing commas before closing parens (syntax errors - this
--     file would not run as-is before this fix).
--   - product_images.product_id was wrongly declared
--     "generated always as identity" (a second identity column on the same
--     table as `id`) - it is just a foreign key to products.id.
--   - Added the two CREATE TRIGGER statements that call the already-defined
--     handle_new_user()/set_product_serial() functions - the functions
--     existed but nothing invoked them, so this file alone could not have
--     rebuilt a working database.
--   - Added public.admins RLS (it had none - see crowgo-hardening.sql for
--     why this one is critical) and replaced the ~35 duplicate/overlapping
--     policies with one clean policy per operation per table.
--   - Added account_status + last_product_serial to profiles, and the
--     admin_audit_log table.
--   - Added storage.objects policies for the product-images bucket (these
--     need the bucket to exist first - see section 9).
--
-- This file is meant for building a FRESH database (a dev/test Supabase
-- project) from nothing. If you are patching the EXISTING live project,
-- use crowgo-hardening.sql instead - it is written to be safely re-run
-- against a database that already has the old (vulnerable) policies in it.
--
-- Apply via the Supabase SQL Editor, or: supabase db push
-- ============================================================================

begin;

-- =========================================================================
-- 1. TABLES
-- =========================================================================

create table if not exists public.profiles (
    id                   uuid primary key references auth.users (id) on delete cascade,
    name                 text not null,
    phone                text not null,
    governorate          text,
    profession           text,
    referral_code        text unique,
    subscription_end     timestamptz,
    whatsapp_phone       text,
    account_status       text not null default 'active' check (account_status in ('active', 'cancelled')),
    last_product_serial  integer not null default 0,
    created_at           timestamptz not null default now()
);

create unique index if not exists profiles_phone_key on public.profiles (phone);

create table if not exists public.admins (
    user_id    uuid primary key references auth.users (id) on delete cascade,
    created_at timestamptz not null default now()
);

create table if not exists public.products (
    id                   bigint generated always as identity primary key,
    owner_id             uuid not null references public.profiles (id) on delete cascade,
    serial               integer,
    name                 text not null,
    price                numeric(12, 2) not null check (price >= 0),
    description          text,
    owner_name           text,
    owner_phone          text,
    owner_address        text,
    selected_for_catalog boolean not null default false,
    created_at           timestamptz not null default now()
);

create index if not exists products_owner_id_idx on public.products (owner_id);
create unique index if not exists products_owner_serial on public.products (owner_id, serial);

create table if not exists public.product_images (
    id            bigint generated always as identity primary key,
    product_id    bigint not null references public.products (id) on delete cascade,
    storage_path  text not null,
    sort_order    integer not null default 0,
    created_at    timestamptz not null default now()
);

create index if not exists product_images_product_id_idx on public.product_images (product_id);

create table if not exists public.orders (
    id              bigint generated always as identity primary key,
    owner_id        uuid not null references public.profiles (id) on delete cascade,
    item_needed     text not null,
    client_name     text not null,
    client_phone    text not null,
    client_address  text,
    status          text not null default 'new' check (status in ('new', 'contacted', 'done')),
    created_at      timestamptz not null default now()
);

create index if not exists orders_owner_id_idx on public.orders (owner_id);

create table if not exists public.payments (
    id          bigint generated always as identity primary key,
    waseet_id   uuid not null references public.profiles (id) on delete cascade,
    amount      numeric(12, 2) not null check (amount > 0),
    method      text not null,
    notes       text,
    status      text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
    created_at  timestamptz not null default now()
);

create index if not exists payments_waseet_id_idx on public.payments (waseet_id);
create index if not exists payments_status_idx on public.payments (status);

create table if not exists public.referrals (
    id           bigint generated always as identity primary key,
    referrer_id  uuid not null references public.profiles (id) on delete cascade,
    referred_id  uuid not null references public.profiles (id) on delete cascade,
    created_at   timestamptz not null default now()
);

create unique index if not exists referrals_referred_unique on public.referrals (referred_id);
create index if not exists referrals_referrer_id_idx on public.referrals (referrer_id);

create table if not exists public.pin_reset_audit (
    id          bigint generated always as identity primary key,
    waseet_id   uuid not null references auth.users (id) on delete cascade,
    reset_by    uuid not null references auth.users (id) on delete cascade,
    created_at  timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
    id          bigint generated always as identity primary key,
    admin_id    uuid not null references auth.users (id),
    action      text not null,
    target_id   uuid,
    details     jsonb,
    created_at  timestamptz not null default now()
);

-- =========================================================================
-- 2. FUNCTIONS
-- =========================================================================

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.admins where user_id = auth.uid());
$$;

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

-- التسلسل بيزيد بس وعمره ما بيرجع، حتى لو اتحذف آخر عرض (يحل D-M1: تكرار
-- الكود بعد الحذف، وسباق كتابة لو جهازين بيضيفوا في نفس اللحظة).
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

    insert into public.admin_audit_log (admin_id, action, target_id, details)
        values (auth.uid(), 'confirm_payment', v_waseet, jsonb_build_object('payment_id', p_id, 'days', p_days));
end;
$$;

create or replace function public.reject_payment(p_id bigint)
returns void
language plpgsql security definer set search_path = public as $$
declare
    v_waseet uuid;
begin
    if not public.is_admin() then
        raise exception 'not allowed';
    end if;

    update public.payments
        set status = 'rejected'
        where id = p_id and status = 'pending'
        returning waseet_id into v_waseet;

    if v_waseet is null then
        raise exception 'payment not found or already handled';
    end if;

    insert into public.admin_audit_log (admin_id, action, target_id, details)
        values (auth.uid(), 'reject_payment', v_waseet, jsonb_build_object('payment_id', p_id));
end;
$$;

-- بيحل D-H3: الزرار "+ أسبوع"/"+ شهر" في admin.js كان بينادي الدالة دي وهي
-- مش موجودة في القاعدة خالص.
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

-- بيحل N-H1 جزئياً: بيعلّم الحساب كـ"ملغي" ويصفّر الاشتراك بدل ما يمسح
-- البروفايل (اللي كان بيسيب حساب الدخول في auth.users شغال من غير بروفايل).
-- قفل الدخول نفسه محتاج صلاحية service role، موجود في
-- supabase/functions/admin-ban-account - لازم تتنشر منفصلة.
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

-- بيحل N-H2: بيقرا من جدول admins بدل UUID ثابت في الكود. بياخد أول أدمن
-- عنده رقم واتساب متسجل، ولو محدش حاط رقم بيرجع رقم موبايله العادي.
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

-- بيحل N-H2 (جزء الكتابة): أدمن بيحدّث رقم واتسابه هو بس - مفيش UPDATE
-- مباشر على profiles.whatsapp_phone خالص (شوف قسم 4)، فمفيش طريقة لحد
-- يحدّث رقم أدمن تاني.
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

-- بيحل D-L1 (جزء 1): برجع exception واضح بدل ما يسكت لو الكود غلط أو
-- الوسيط بيحيل نفسه - الـ try/catch في app.js بيقرا error فعلاً فالرسالة
-- هتظهر فعلياً دلوقتي.
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

grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.has_active_sub() to authenticated, anon;
grant execute on function public.confirm_payment(bigint, int) to authenticated;
grant execute on function public.reject_payment(bigint) to authenticated;
grant execute on function public.admin_extend_subscription(uuid, int) to authenticated;
grant execute on function public.admin_cancel_account(uuid) to authenticated;
grant execute on function public.get_admin_whatsapp() to authenticated, anon;
grant execute on function public.admin_set_whatsapp(text) to authenticated;
grant execute on function public.apply_referral(text) to authenticated;

-- =========================================================================
-- 3. ROW LEVEL SECURITY
-- =========================================================================

alter table public.profiles         enable row level security;
alter table public.admins           enable row level security;
alter table public.products         enable row level security;
alter table public.product_images   enable row level security;
alter table public.orders           enable row level security;
alter table public.payments         enable row level security;
alter table public.referrals        enable row level security;
alter table public.pin_reset_audit  enable row level security;
alter table public.admin_audit_log  enable row level security;

-- admins: عمداً من غير أي policy. مع RLS مفعّلة ومفيش policies، الجدول ده
-- مقفول تماماً قدام anon وauthenticated - مفيش select ولا insert ولا
-- update ولا delete. فقط service role (أو إنت من لوحة Supabase) يقدر
-- يتعامل معاه. ده بالظبط اللي كان ناقص وسبب D-C1.
revoke all on public.admins from anon, authenticated;

-- profiles
create policy profiles_select on public.profiles for select
    using (id = auth.uid() or public.is_admin());

revoke update on public.profiles from authenticated;
grant update (name, governorate, profession) on public.profiles to authenticated;

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

-- product_images (لازم ترتبط بالعرض الأب - مفيش صف صور ممكن يتقرا لوحده
-- من غير ما يتأكد إن العرض بتاعه ملك القارئ أو إن القارئ أدمن. يحل D-H2.)
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

-- payments (pending بس، مبلغ موجب - مضمون أصلاً بالـ check constraint على
-- الجدول - وطلب واحد معلق بس في نفس الوقت. يحل D-H1 وN-H6 جزء منها.)
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

-- referrals: قراءة بس. الإدراج بيتم فقط عن طريق apply_referral()
-- (security definer)، ومفيش insert/update/delete policy = ممنوع تماماً
-- من المتصفح مباشرة.
revoke insert, update, delete on public.referrals from authenticated, anon;

create policy referrals_select on public.referrals for select
    using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin());

-- pin_reset_audit / admin_audit_log: قراءة للأدمن بس، الكتابة فقط عن طريق
-- دوال security definer.
create policy pin_reset_audit_select on public.pin_reset_audit for select
    using (public.is_admin());

create policy admin_audit_log_select on public.admin_audit_log for select
    using (public.is_admin());

commit;

-- =========================================================================
-- 4. STORAGE (شغّلها بعد ما تتأكد إن bucket اسمه product-images موجود)
-- =========================================================================
-- insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
--   on conflict (id) do nothing;
--
-- drop policy if exists "img_select_public" on storage.objects;
-- create policy "img_select_public" on storage.objects for select
--     using (bucket_id = 'product-images');
--
-- drop policy if exists "img_insert_own" on storage.objects;
-- create policy "img_insert_own" on storage.objects for insert to authenticated
--     with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
--
-- drop policy if exists "img_delete_own" on storage.objects;
-- create policy "img_delete_own" on storage.objects for delete to authenticated
--     using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================================
-- MANUAL STEP: create the first admin (cannot be done from this file -
-- admins has no policies at all, by design. Needs a service-role/dashboard
-- connection):
--   insert into public.admins (user_id) values ('<auth.users.id of the real admin>');
-- =========================================================================
