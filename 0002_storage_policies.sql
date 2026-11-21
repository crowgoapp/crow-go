-- Crow Go — Migration 0002: Storage policies for the product-images bucket
--
-- The app code now uploads to paths shaped like:
--   <auth.uid()>/<product_id>/<timestamp>_<index>.webp
-- (see compressImage()/saveProduct() in waseet.js). These policies restrict
-- writes/deletes to the folder matching the caller's own user id. Reads stay
-- public because the bucket is used for public catalog poster images.
--
-- Apply via SQL Editor or `supabase db push`, same as 0001_security_rls.sql.
-- If the "product-images" bucket does not exist yet, create it first:
--   insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
--   on conflict (id) do nothing;

begin;

drop policy if exists img_select_public on storage.objects;
create policy img_select_public on storage.objects for select
    using (bucket_id = 'product-images');

drop policy if exists img_insert_own on storage.objects;
create policy img_insert_own on storage.objects for insert to authenticated
    with check (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists img_update_own on storage.objects;
create policy img_update_own on storage.objects for update to authenticated
    using (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists img_delete_own on storage.objects;
create policy img_delete_own on storage.objects for delete to authenticated
    using (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

commit;
