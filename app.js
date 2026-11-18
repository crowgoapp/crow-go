const SUPABASE_URL = 'https://pcbdtilmhmpotfxjnndt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DSE9wzGDfODZSVViJNOmPA_C0CQSIxS';
const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const Utils = {
    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },
    validateEgyptianPhone(phone) { return /^01[0125][0-9]{8}$/.test(phone); },
    validatePin(pin) { return /^[0-9]{4}$/.test(pin); },
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerText = message;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
    }
};

const router = {
    showScreen(screenId) {
        ['landing-screen', 'login-screen', 'register-screen', 'admin-dashboard', 'waseet-dashboard'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        const target = document.getElementById(screenId);
        if (target) target.classList.remove('hidden');
    },
    openAdminLogin() {
        const pass = prompt("أدخل كلمة مرور السوبر أدمن:");
        if (pass === 'admin123') {
            this.showScreen('admin-dashboard');
            if (typeof adminApp !== 'undefined') adminApp.renderDashboard();
        } else if (pass !== null) {
            Utils.showToast("كلمة المرور غير صحيحة!", "error");
        }
    }
};

async function handleLogin() {
    const phone = document.getElementById('login-phone').value.trim();
    const pin = document.getElementById('login-pin').value.trim();

    if (!Utils.validateEgyptianPhone(phone)) { Utils.showToast("رقم الهاتف غير صحيح", "error"); return; }
    if (!Utils.validatePin(pin)) { Utils.showToast("الرقم السري يجب أن يكون 4 أرقام", "error"); return; }

    const email = `${phone}@crowgo.local`;

    const { data, error } = await sbClient.auth.signInWithPassword({
        email: email,
        password: pin + '_crow_salt'
    });

    if (error) {
        Utils.showToast("رقم الهاتف أو الرقم السري غير صحيح!", "error");
        return;
    }

    const { data: profile } = await sbClient.from('profiles').select('*').eq('id', data.user.id).single();
    
    Utils.showToast("تم تسجيل الدخول بنجاح", "success");
    if (typeof waseetApp !== 'undefined') {
        waseetApp.initWaseetSession(data.user.id, profile || { name: phone, phone: phone });
    }
}

async function handleRegister() {
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const pin = document.getElementById('reg-pin').value.trim();
    const gov = document.getElementById('reg-gov').value.trim();
    const prof = document.getElementById('reg-prof').value;
    const refCodeInput = document.getElementById('reg-ref').value.trim().toUpperCase();

    if (!name) { Utils.showToast("أدخل الاسم الكامل", "error"); return; }
    if (!Utils.validateEgyptianPhone(phone)) { Utils.showToast("رقم الهاتف المصري غير صحيح", "error"); return; }
    if (!Utils.validatePin(pin)) { Utils.showToast("الرقم السري يجب أن يكون 4 أرقام", "error"); return; }
    if (!gov) { Utils.showToast("أدخل المحافظة", "error"); return; }

    const email = `${phone}@crowgo.local`;
    const password = pin + '_crow_salt';

    const { data, error } = await sbClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                phone: phone,
                name: name,
                governorate: gov,
                profession: prof,
                role: 'waseet'
            }
        }
    });

    if (error) {
        Utils.showToast("خطأ في التسجيل: " + error.message, "error");
        return;
    }

    // تسجيل الإحالة إن وجد كود صحيح
    if (data.user && refCodeInput) {
        const { data: referrer } = await sbClient
            .from('profiles')
            .select('id')
            .eq('referral_code', refCodeInput)
            .single();

        if (referrer && referrer.id !== data.user.id) {
            await sbClient.from('referrals').insert([{
                referrer_id: referrer.id,
                referred_id: data.user.id
            }]);
        }
    }

    const { data: newProfile } = await sbClient.from('profiles').select('*').eq('id', data.user.id).single();

    Utils.showToast("تم إنشاء الحساب ومنحك أسبوعاً تجريبياً مجانياً!", "success");
    if (data.user && typeof waseetApp !== 'undefined') {
        waseetApp.initWaseetSession(data.user.id, newProfile || { name: name, phone: phone });
    }
}
