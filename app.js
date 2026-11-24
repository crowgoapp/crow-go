if (!window.supabase) {
    document.addEventListener('DOMContentLoaded', () => {
        document.body.innerHTML = `
            <div style="padding:30px; text-align:center; font-family:sans-serif; direction:rtl;">
                <h2 style="color:#dc2626;">تعذّر تحميل التطبيق</h2>
                <p>مكتبة الاتصال بالخادم لم يتم تحميلها. تأكد من اتصالك بالإنترنت ثم أعد تحميل الصفحة.</p>
                <button onclick="location.reload()" style="padding:10px 20px; border-radius:8px; border:none; background:#0f2b46; color:#fff; font-weight:bold;">إعادة المحاولة</button>
            </div>`;
    });
    throw new Error('Supabase client library failed to load from CDN.');
}

const SUPABASE_URL = 'https://qonffvfaxjtzfaozvsng.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uFtEiZv2mHs6iOWRtggzwA_03xop1Sv';
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

    // يحول الأرقام العربية-الهندية والفارسية (٠-٩ / ۰-۹) لأرقام إنجليزية قبل أي تحقق
    normalizeDigits(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
            .replace(/[‎‏\s]+/g, '');
    },

    validateEgyptianPhone(phone) {
        return /^01[0125][0-9]{8}$/.test(Utils.normalizeDigits(phone));
    },
    validatePin(pin) {
        return /^[0-9]{6}$/.test(Utils.normalizeDigits(pin));
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerText = message;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
    },

    // رسائل Supabase الشائعة مترجمة للعربي (بدل عرضها زي ما هي بالإنجليزي)
    translateError(error) {
        const msg = (error && error.message) || String(error || '');
        const table = [
            [/invalid login credentials/i, 'رقم الهاتف أو الرقم السري غير صحيح'],
            [/user already registered/i, 'رقم الهاتف ده مسجل بحساب قبل كده'],
            [/email not confirmed/i, 'الحساب لسه محتاج تفعيل، تواصل مع الإدارة'],
            [/password should be at least/i, 'الرقم السري قصير، لازم يكون 6 أرقام على الأقل'],
            [/rate limit/i, 'محاولات كتير في وقت قصير، استنى شوية وحاول تاني'],
            [/network|fetch/i, 'مفيش اتصال بالإنترنت، تأكد من الشبكة وحاول تاني'],
            [/duplicate key|unique constraint|23505/i, 'في تضارب في البيانات (ممكن نفس الكود اتسجل قبل كده)، حاول تاني'],
            [/not allowed|permission/i, 'مفيش صلاحية لتنفيذ العملية دي'],
        ];
        for (const [pattern, ar] of table) {
            if (pattern.test(msg)) return ar;
        }
        return 'حصلت مشكلة غير متوقعة، حاول تاني';
    },

    // تقفل الزرار أثناء التنفيذ عشان تمنع تكرار الضغط، وتمسك أي خطأ بدل ما يقع التطبيق
    async withBusy(btn, fn) {
        if (btn && btn.disabled) return;
        const label = btn ? btn.innerText : '';
        if (btn) { btn.disabled = true; btn.innerText = 'جاري التنفيذ...'; }
        try {
            await fn();
        } catch (e) {
            console.error(e);
            Utils.showToast(
                (typeof navigator !== 'undefined' && navigator.onLine === false)
                    ? 'مفيش اتصال بالإنترنت'
                    : Utils.translateError(e),
                'error'
            );
        } finally {
            if (btn) { btn.disabled = false; btn.innerText = label; }
        }
    },

    confirmDialog(message) {
        return new Promise(resolve => {
            const overlay = document.getElementById('confirm-dialog-overlay');
            const msgEl = document.getElementById('confirm-dialog-message');
            const yesBtn = document.getElementById('confirm-dialog-yes');
            const noBtn = document.getElementById('confirm-dialog-no');
            if (!overlay || !msgEl || !yesBtn || !noBtn) {
                resolve(window.confirm(message));
                return;
            }
            msgEl.innerText = message;
            overlay.classList.remove('hidden');
            const cleanup = (result) => {
                overlay.classList.add('hidden');
                yesBtn.onclick = null;
                noBtn.onclick = null;
                resolve(result);
            };
            yesBtn.onclick = () => cleanup(true);
            noBtn.onclick = () => cleanup(false);
        });
    }
};

const router = {
    showScreen(screenId) {
        ['landing-screen', 'login-screen', 'register-screen', 'admin-login-screen', 'admin-dashboard', 'waseet-dashboard'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        const target = document.getElementById(screenId);
        if (target) target.classList.remove('hidden');
    },
    openAdminLogin() {
        const emailEl = document.getElementById('admin-login-email');
        const passEl = document.getElementById('admin-login-pass');
        if (emailEl) emailEl.value = '';
        if (passEl) passEl.value = '';
        this.showScreen('admin-login-screen');
    }
};

// السوبر أدمن بيدخل بحساب Supabase حقيقي (إيميل + باسورد قوي)، مش بكلمة مرور
// مكتوبة في الكود. صلاحيته الحقيقية بتتحدد من جدول admins في القاعدة عن طريق
// RPC is_admin() — الواجهة هنا مجرد شكل، RLS هي اللي بتمنع فعلياً. (يحل C1)
async function handleAdminLogin() {
    const btn = document.getElementById('admin-login-btn');
    await Utils.withBusy(btn, async () => {
        const email = document.getElementById('admin-login-email').value.trim();
        const password = document.getElementById('admin-login-pass').value;

        if (!email || !password) {
            Utils.showToast('أدخل الإيميل وكلمة المرور', 'error');
            return;
        }

        const { error } = await sbClient.auth.signInWithPassword({ email, password });
        if (error) {
            const msg = /invalid login credentials/i.test(error.message || '')
                ? 'الإيميل أو كلمة المرور غير صحيحة'
                : Utils.translateError(error);
            Utils.showToast(msg, 'error');
            return;
        }

        const { data: isAdmin, error: rpcError } = await sbClient.rpc('is_admin');
        if (rpcError || !isAdmin) {
            await sbClient.auth.signOut();
            Utils.showToast('هذا الحساب ليس لديه صلاحية أدمن', 'error');
            return;
        }

        router.showScreen('admin-dashboard');
        if (typeof adminApp !== 'undefined') adminApp.renderDashboard();
    });
}

async function logout() {
    await sbClient.auth.signOut();
    if (typeof waseetApp !== 'undefined') {
        waseetApp.currentUserId = '';
        waseetApp.profile = null;
        waseetApp.products = [];
        waseetApp.orders = [];
    }
    router.showScreen('landing-screen');
}

async function handleLogin() {
    const btn = document.getElementById('login-submit-btn');
    await Utils.withBusy(btn, async () => {
        const phone = Utils.normalizeDigits(document.getElementById('login-phone').value.trim());
        const pin = Utils.normalizeDigits(document.getElementById('login-pin').value.trim());

        if (!Utils.validateEgyptianPhone(phone)) { Utils.showToast('رقم الهاتف غير صحيح', 'error'); return; }
        if (!Utils.validatePin(pin)) { Utils.showToast('الرقم السري يجب أن يكون 6 أرقام', 'error'); return; }

        const email = `${phone}@crowgo.local`;

        const { data, error } = await sbClient.auth.signInWithPassword({
            email: email,
            password: pin + '_crow_salt'
        });

        if (error) {
            Utils.showToast('رقم الهاتف أو الرقم السري غير صحيح!', 'error');
            return;
        }

        const { data: profile, error: profileError } = await sbClient.from('profiles').select('*').eq('id', data.user.id).single();
        if (profileError) throw profileError;

        Utils.showToast('تم تسجيل الدخول بنجاح', 'success');
        if (typeof waseetApp !== 'undefined') {
            await waseetApp.initWaseetSession(data.user.id, profile || { name: phone, phone: phone });
        }
    });
}

async function handleRegister() {
    const btn = document.getElementById('register-submit-btn');
    await Utils.withBusy(btn, async () => {
        const name = document.getElementById('reg-name').value.trim();
        const phone = Utils.normalizeDigits(document.getElementById('reg-phone').value.trim());
        const pin = Utils.normalizeDigits(document.getElementById('reg-pin').value.trim());
        const gov = document.getElementById('reg-gov').value.trim();
        const prof = document.getElementById('reg-prof').value;
        const refCodeInput = document.getElementById('reg-ref').value.trim().toUpperCase();

        if (!name) { Utils.showToast('أدخل الاسم الكامل', 'error'); return; }
        if (!Utils.validateEgyptianPhone(phone)) { Utils.showToast('رقم الهاتف المصري غير صحيح', 'error'); return; }
        if (!Utils.validatePin(pin)) { Utils.showToast('الرقم السري يجب أن يكون 6 أرقام', 'error'); return; }
        if (!gov) { Utils.showToast('أدخل المحافظة', 'error'); return; }

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
                    profession: prof
                    // ملحوظة: أي حقل هنا (user_metadata) المستخدم يقدر يغيره بنفسه،
                    // فمينفعش يتبنى عليه أي قرار صلاحيات. الدور/الأدمن بيتحددوا من
                    // جدول admins في القاعدة فقط (is_admin() في migration 0001).
                }
            }
        });

        if (error) {
            Utils.showToast('خطأ في التسجيل: ' + Utils.translateError(error), 'error');
            return;
        }

        // تسجيل الإحالة بيتم من خلال دالة في القاعدة (apply_referral) مش insert
        // مباشر من المتصفح، عشان محدش يقدر يزوّر إحالات لنفسه (يحل H3/C4).
        // محتاج جلسة فعلية، فلو "تأكيد الإيميل" شغال في Supabase مفيش session هنا.
        if (data.session && refCodeInput) {
            try {
                await sbClient.rpc('apply_referral', { p_code: refCodeInput });
            } catch (e) {
                console.error('referral application failed', e);
            }
        }

        const { data: newProfile } = data.user
            ? await sbClient.from('profiles').select('*').eq('id', data.user.id).single()
            : { data: null };

        Utils.showToast('تم إنشاء الحساب ومنحك أسبوعاً تجريبياً مجانياً!', 'success');
        if (data.session && data.user && typeof waseetApp !== 'undefined') {
            await waseetApp.initWaseetSession(data.user.id, newProfile || { name: name, phone: phone });
        } else {
            // "تأكيد الإيميل" شغال في إعدادات Supabase ومفيش جلسة فورية.
            // الحل السريع الموصى به في التقرير: إيقاف Confirm Email من لوحة
            // Supabase (Authentication > Providers > Email) طالما بنعتمد على
            // موبايل+PIN بدل إيميل حقيقي.
            Utils.showToast('جرّب تسجّل الدخول الآن برقمك والـ PIN', 'success');
            router.showScreen('login-screen');
        }
    });
}

// استرجاع الجلسة تلقائياً عند فتح التطبيق (يحل H5: الجلسة كانت بتضيع مع كل Refresh)
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session } } = await sbClient.auth.getSession();
        if (!session) { router.showScreen('landing-screen'); return; }

        const { data: isAdmin } = await sbClient.rpc('is_admin');
        if (isAdmin) {
            router.showScreen('admin-dashboard');
            if (typeof adminApp !== 'undefined') adminApp.renderDashboard();
            return;
        }

        const { data: profile } = await sbClient.from('profiles').select('*').eq('id', session.user.id).single();
        if (typeof waseetApp !== 'undefined') {
            await waseetApp.initWaseetSession(session.user.id, profile || { name: session.user.email, phone: '' });
        }
    } catch (e) {
        console.error('session restore failed', e);
        router.showScreen('landing-screen');
    }
});

(function initPwaInstallButton() {
    let deferredPrompt = null;
    const installBtn = document.getElementById('pwa-install-btn');
    if (!installBtn) return;

    const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;

    if (isStandalone) {
        installBtn.classList.add('hidden');
        return;
    }

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIos) {
        installBtn.classList.remove('hidden');
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.classList.remove('hidden');
    });

    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
            if (outcome === 'accepted') {
                installBtn.classList.add('hidden');
            }
        } else if (isIos) {
            alert('لتثبيت التطبيق على آيفون: اضغط على أيقونة المشاركة (Share) في المتصفح ثم اختر "إضافة إلى الشاشة الرئيسية".');
        }
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        installBtn.classList.add('hidden');
    });
})();
