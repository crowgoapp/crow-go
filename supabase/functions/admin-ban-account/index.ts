// Crow Go — Edge Function: admin-ban-account
//
// Report finding N-H1: admin_cancel_account() (the SQL function) marks a
// profile as account_status='cancelled' and expires the subscription, but
// it CANNOT touch the person's actual login (auth.users) — that requires
// the service-role key, which only runs server-side. Without this
// function, a "cancelled" waseet can still sign in; they just land on a
// broken-looking dashboard once their profile data stops making sense.
//
// This function actually suspends the login via Supabase Auth's admin API
// (ban_duration), using the report's own suggested approach.
//
// Deploy (from your own machine, with Supabase CLI logged in to YOUR
// project — this session has no credentials and cannot do this for you):
//   supabase functions deploy admin-ban-account
//
// Call AFTER admin_cancel_account() succeeds, e.g. in admin.js:
//   await sbClient.rpc('admin_cancel_account', { p_waseet_id: id });
//   await sbClient.functions.invoke('admin-ban-account', {
//     body: { waseet_id: id, ban: true }   // ban: false to lift a ban
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

        const { data: isAdmin, error: adminCheckError } = await callerClient.rpc('is_admin');
        if (adminCheckError || !isAdmin) {
            return new Response(JSON.stringify({ error: 'not allowed' }), { status: 403 });
        }

        const { waseet_id, ban } = await req.json();
        if (!waseet_id) {
            return new Response(JSON.stringify({ error: 'waseet_id required' }), { status: 400 });
        }

        const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
        // '876000h' ~= 100 years (Supabase's admin API takes a duration
        // string, not "forever" — 'none' lifts an existing ban).
        const { error } = await admin.auth.admin.updateUserById(waseet_id, {
            ban_duration: ban === false ? 'none' : '876000h',
        });
        if (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 400 });
        }

        return new Response(JSON.stringify({ ok: true }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
});
