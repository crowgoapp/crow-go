-- ============================================================================
-- Crow Go - Storage policies for the product-images bucket
--
-- Split into its own file (was previously commented out inside schema.sql,
-- which the 2026-11-27 review flagged as "easy to forget" - R-L2) so it
-- runs as a normal, real SQL statement instead of something you have to
-- remember to uncomment.
--
-- RUN THIS whenever you set up a database that doesn't have these policies
-- yet - a fresh dev project built from schema.sql, or the first time you
-- apply crowgo-hardening.sql to the live project (crowgo-hardening.sql
-- does NOT include this - storage policies are independent of the table
-- policies it manages).
--
-- The product-images bucket itself already exists on the live project; the
-- insert below is only needed when building a brand new dev project.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "img_select_public" on storage.objects;
create policy "img_select_public" on storage.objects for select
    using (bucket_id = 'product-images');

drop policy if exists "img_insert_own" on storage.objects;
create policy "img_insert_own" on storage.objects for insert to authenticated
    with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "img_delete_own" on storage.objects;
create policy "img_delete_own" on storage.objects for delete to authenticated
    using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
