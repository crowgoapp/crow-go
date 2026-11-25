CREATE TABLE admins (user_id uuid, created_at timestamp with time zone);

CREATE TABLE orders (created_at timestamp with time zone, status text, client_address text, id bigint, owner_id uuid, client_phone text, client_name text, item_needed text);

CREATE TABLE payments (created_at timestamp with time zone, notes text, method text, status text, id bigint, waseet_id uuid, amount numeric);

CREATE TABLE pin_reset_audit (waseet_id uuid, created_at timestamp with time zone, reset_by uuid, id bigint);

CREATE TABLE product_images (storage_path text, id bigint, product_id bigint, sort_order integer, created_at timestamp with time zone);

CREATE TABLE products (description text, id bigint, owner_id uuid, serial integer, price numeric, selected_for_catalog boolean, created_at timestamp with time zone, name text, owner_name text, owner_phone text, owner_address text);

CREATE TABLE profiles (whatsapp_phone text, name text, created_at timestamp with time zone, subscription_end timestamp with time zone, profession text, referral_code text, governorate text, phone text, id uuid);

CREATE TABLE referrals (id bigint, referrer_id uuid, created_at timestamp with time zone, referred_id uuid);
