// Crow Go — Edge Function: admin-reset-pin
//
// Why this exists: waseets log in with phone+PIN against a fake "@crowgo.local"
// email, so there is no real inbox for a password-reset link (review issue C5).
// Until real phone OTP auth is added, an admin needs a way to set a new PIN for
// someone who forgot theirs. This must run server-side with the service-role
// key — never ship that key to the browser.
//
// Deploy (from your own machine, with Supabase CLI installed and logged in to
// YOUR project — this repo/session has no Supabase credentials and cannot do
// this for you):
//   supabase functions deploy admin-reset-pin
//
// Call it from the admin dashboard (already wired up in admin.js):
//   await sbClient.functions.invoke('admin-reset-pin', {
//     body: { waseet_id: '<uuid>', new_pin: '123456' }
//   });

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405 });
    }

    try {
        const authHeader = req.headers.get('Authorization') || '';
        const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
            global: { headers: { Authorization: authHeader } },
        });

        // Verify the CALLER (using their own JWT) is a real admin before doing
        // anything with the service-role key.
        const { data: isAdmin, error: adminCheckError } = await callerClient.rpc('is_admin');
        if (adminCheckError || !isAdmin) {
            return new Response(JSON.stringify({ error: 'not allowed' }), { status: 403 });
        }

        const { data: { user: callerUser } } = await callerClient.auth.getUser();
        if (!callerUser) {
            return new Response(JSON.stringify({ error: 'not allowed' }), { status: 403 });
        }

        const { waseet_id, new_pin } = await req.json();
        if (!waseet_id || !/^[0-9]{6}$/.test(String(new_pin))) {
            return new Response(JSON.stringify({ error: 'invalid input: new_pin must be 6 digits' }), { status: 400 });
        }

        const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
        const { error: updateError } = await admin.auth.admin.updateUserById(waseet_id, {
            password: `${new_pin}_crow_salt`,
        });
        if (updateError) {
            return new Response(JSON.stringify({ error: updateError.message }), { status: 400 });
        }

        await admin.from('pin_reset_audit').insert({ waseet_id, reset_by: callerUser.id });

        return new Response(JSON.stringify({ ok: true }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
});
