// دوال المساعدة والأمان العامة (مدمجة هنا لتجنب زيادة ملفات)
const Utils = {
    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    safeJSONParse(key, fallback = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : fallback;
        } catch (error) {
            console.error(`خطأ في قراءة المفتاح ${key}:`, error);
            return fallback;
        }
    },

    validateEgyptianPhone(phone) {
        return /^01[0125][0-9]{8}$/.test(phone);
    },

    validatePin(pin) {
        return /^[0-9]{4}$/.test(pin);
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerText = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
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
        if (pass === (localStorage.getItem('crow_admin_pass') || 'admin123')) {
            this.showScreen('admin-dashboard');
            if (typeof adminApp !== 'undefined') adminApp.renderDashboard();
        } else if (pass !== null) {
            Utils.showToast("كلمة المرور غير صحيحة!", "error");
        }
    }
};

// المصادقة والتسجيل
function handleLogin() {
    const phone = document.getElementById('login-phone').value.trim();
    const pin = document.getElementById('login-pin').value.trim();

    if (!Utils.validateEgyptianPhone(phone)) {
        Utils.showToast("رقم الهاتف غير صحيح (11 رقم مصري)", "error");
        return;
    }
    if (!Utils.validatePin(pin)) {
        Utils.showToast("الرقم السري يجب أن يكون 4 أرقام", "error");
        return;
    }

    let savedPin = localStorage.getItem('crow_waseet_pin_' + phone) || '1234';
    if (pin !== savedPin) {
        Utils.showToast("الرقم السري غير صحيح!", "error");
        return;
    }

    let savedName = localStorage.getItem('crow_waseet_name_' + phone) || `وسيط (${phone})`;
    Utils.showToast("تم تسجيل الدخول بنجاح", "success");
    if (typeof waseetApp !== 'undefined') {
        waseetApp.initWaseetSession(phone, savedName);
    }
}

function handleRegister() {
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const pin = document.getElementById('reg-pin').value.trim();
    const gov = document.getElementById('reg-gov').value.trim();

    if (!name) { Utils.showToast("أدخل الاسم الكامل", "error"); return; }
    if (!Utils.validateEgyptianPhone(phone)) { Utils.showToast("رقم الهاتف المصري غير صحيح", "error"); return; }
    if (!Utils.validatePin(pin)) { Utils.showToast("الرقم السري يجب أن يكون 4 أرقام", "error"); return; }
    if (!gov) { Utils.showToast("أدخل المحافظة", "error"); return; }

    localStorage.setItem('crow_waseet_name_' + phone, Utils.escapeHtml(name));
    localStorage.setItem('crow_waseet_pin_' + phone, pin);

    let today = new Date().toISOString().split('T')[0];
    let weekLater = new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];
    localStorage.setItem('crow_sub_start_' + phone, today);
    localStorage.setItem('crow_sub_end_' + phone, weekLater);

    Utils.showToast("تم إنشاء الحساب ومنحك أسبوعاً تجريبياً مجانياً!", "success");
    if (typeof waseetApp !== 'undefined') {
        waseetApp.initWaseetSession(phone, name);
    }
}
