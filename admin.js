const adminApp = {
    profiles: [],
    selectedGovernorate: '',
    selectedProfession: '',

    async renderDashboard() {
       await Promise.all([
            this.renderWaseets(),
            this.renderPendingPayments(),
            this.loadAdminWhatsappSetting()
        ]);
    },

    async renderWaseets() {
        const container = document.getElementById('admin-waseets-container');
        if (!container) return;

        container.innerHTML = '<p>جاري تحميل الوسطاء...</p>';

        const { data: profiles, error } = await sbClient
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = '<p class="text-error">فشل جلب الوسطاء من قاعدة البيانات.</p>';
            console.error(error);
            return;
        }

        this.profiles = profiles || [];

        if (this.profiles.length === 0) {
            container.innerHTML = '<p>لا توجد حسابات وسطاء مسجلة بعد.</p>';
            return;
        }

        const governorates = [...new Set(
            this.profiles
                .map(p => (p.governorate || '').trim())
                .filter(Boolean)
        )];

        const professions = [...new Set(
            this.profiles
                .map(p => (p.profession || '').trim())
                .filter(Boolean)
        )];

        const govOptions = governorates
            .map(g => `<option value="${Utils.escapeHtml(g)}" ${this.selectedGovernorate === g ? 'selected' : ''}>${Utils.escapeHtml(g)}</option>`)
            .join('');

        const profOptions = professions
            .map(pr => `<option value="${Utils.escapeHtml(pr)}" ${this.selectedProfession === pr ? 'selected' : ''}>${Utils.escapeHtml(pr)}</option>`)
            .join('');

        const filterHtml = `
            <div class="admin-filters-bar" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
                <select id="admin-filter-gov" onchange="adminApp.onFilterChange()" style="flex:1;min-width:140px;padding:8px;border-radius:8px;">
                    <option value="">كل المحافظات</option>
                    ${govOptions}
                </select>
                <select id="admin-filter-prof" onchange="adminApp.onFilterChange()" style="flex:1;min-width:140px;padding:8px;border-radius:8px;">
                    <option value="">كل المهن</option>
                    ${profOptions}
                </select>
                ${(this.selectedGovernorate || this.selectedProfession)
                    ? `<button type="button" class="btn-small" onclick="adminApp.resetFilters()">إعادة ضبط</button>`
                    : ''}
            </div>
            <div id="admin-filtered-waseets-list"></div>
        `;

        container.innerHTML = filterHtml;
        this.renderFilteredWaseetsList();
    },

    onFilterChange() {
        const govEl = document.getElementById('admin-filter-gov');
        const profEl = document.getElementById('admin-filter-prof');
        this.selectedGovernorate = govEl ? govEl.value : '';
        this.selectedProfession = profEl ? profEl.value : '';
        this.renderFilteredWaseetsList();
    },

    resetFilters() {
        this.selectedGovernorate = '';
        this.selectedProfession = '';
        this.renderWaseets();
    },

    renderFilteredWaseetsList() {
        const listContainer = document.getElementById('admin-filtered-waseets-list');
        if (!listContainer) return;

        const filtered = this.profiles.filter(w => {
            const matchGov = !this.selectedGovernorate || (w.governorate || '').trim() === this.selectedGovernorate;
            const matchProf = !this.selectedProfession || (w.profession || '').trim() === this.selectedProfession;
            return matchGov && matchProf;
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = '<p class="text-muted">لا يوجد وسطاء مطابقون للفلاتر المختارة.</p>';
            return;
        }

        let html = '<ul class="admin-list">';
        filtered.forEach(w => {
            const safeName = Utils.escapeHtml(w.name || '');
            const safePhone = Utils.escapeHtml(w.phone || '');
            const safeGov = Utils.escapeHtml(w.governorate || '');
            const safeProf = Utils.escapeHtml(w.profession || '');
            const escapedNameForJs = safeName.replace(/'/g, "\\'");

            const isDisabled = w.is_active === false || w.account_status === 'cancelled';
            const subEnd = w.subscription_end
                ? new Date(w.subscription_end).toLocaleDateString('ar-EG')
                : 'غير محدد';

            html += `<li class="admin-list-item">
                <b>${safeName}</b> (${safeProf}) ${isDisabled ? '<span class="text-error">[ملغي]</span>' : ''}<br>
                <small>الهاتف: ${safePhone} | المحافظة: ${safeGov}</small><br>
                <small class="text-success">الاشتراك حتى: ${subEnd}</small>
                <div class="admin-list-actions" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
                    <button type="button" class="btn-small" onclick="adminApp.openResetPin('${w.id}', '${escapedNameForJs}')">إعادة تعيين PIN</button>
                    <button type="button" class="btn-small" onclick="adminApp.extendSubscription('${w.id}', 7, 'أسبوع مجاني')">+ أسبوع مجاني</button>
                    <button type="button" class="btn-small" onclick="adminApp.extendSubscription('${w.id}', 30, 'شهر')">+ شهر</button>
                    <button type="button" class="btn-small" onclick="adminApp.impersonateWaseet('${w.id}')">دخول كصاحب الحساب</button>
                    <button type="button" class="btn-small btn-reject" onclick="adminApp.cancelAccount('${w.id}', '${escapedNameForJs}')">إلغاء الحساب</button>
                </div>
            </li>`;
        });
        html += '</ul>';
        listContainer.innerHTML = html;
    },

    async extendSubscription(waseetId, daysToAdd, labelText) {
        const profile = this.profiles.find(p => String(p.id) === String(waseetId));
        const nameLabel = profile && profile.name ? profile.name : 'الوسيط';

        const ok = await Utils.confirmDialog(`إضافة ${labelText} (${daysToAdd} يوم) لاشتراك "${nameLabel}"؟`);
        if (!ok) return;

        try {
            const now = new Date();
            const currentEnd = profile && profile.subscription_end ? new Date(profile.subscription_end) : null;
            const baseDate = (currentEnd && !isNaN(currentEnd.getTime()) && currentEnd > now)
                ? currentEnd
                : now;

            const newEndDate = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

            const { error } = await sbClient
                .from('profiles')
                .update({ subscription_end: newEndDate })
                .eq('id', waseetId);

            if (error) throw error;

            Utils.showToast(`تم إضافة ${labelText} بنجاح`, 'success');
            await this.renderWaseets();
        } catch (e) {
            console.error(e);
            Utils.showToast('فشل تمديد الاشتراك: ' + Utils.translateError(e), 'error');
        }
    },

    async cancelAccount(waseetId, waseetName) {
        const ok = await Utils.confirmDialog(`هل أنت متأكد من إلغاء حساب "${waseetName}"؟`);
        if (!ok) return;

        try {
            const { error: deleteError } = await sbClient
                .from('profiles')
                .delete()
                .eq('id', waseetId);

            if (deleteError) {
                // لو الحذف المباشر مرفوض بسبب ارتباطات أو سياسات RLS، ننهي الاشتراك فوراً
                const { error: fallbackError } = await sbClient
                    .from('profiles')
                    .update({ subscription_end: new Date().toISOString() })
                    .eq('id', waseetId);

                if (fallbackError) throw deleteError;

                Utils.showToast('تم إيقاف/إنهاء اشتراك الحساب (تحقق من صلاحيات الحذف في Supabase لو أردت حذفه نهائياً)', 'success');
                await this.renderWaseets();
                return;
            }

            Utils.showToast('تم إلغاء وحذف الحساب بنجاح', 'success');
            await this.renderWaseets();
        } catch (e) {
            console.error(e);
            Utils.showToast('فشل إلغاء الحساب: ' + Utils.translateError(e), 'error');
        }
    },

    async impersonateWaseet(waseetId) {
        try {
            let targetProfile = this.profiles.find(p => String(p.id) === String(waseetId));
            if (!targetProfile) {
                const { data, error } = await sbClient
                    .from('profiles')
                    .select('*')
                    .eq('id', waseetId)
                    .single();
                if (error) throw error;
                targetProfile = data;
            }

            if (!targetProfile) {
                Utils.showToast('لم يتم العثور على بيانات الحساب', 'error');
                return;
            }

            sessionStorage.setItem('crowgo_impersonating_from_admin', '1');
            this.ensureReturnToAdminButton();

            if (typeof waseetApp !== 'undefined' && typeof waseetApp.initWaseetSession === 'function') {
                await waseetApp.initWaseetSession(targetProfile.id, targetProfile);
                Utils.showToast(`تم الدخول إلى حساب: ${targetProfile.name || 'الوسيط'}`, 'success');
            } else {
                Utils.showToast('واجهة الوسيط غير متاحة حالياً', 'error');
            }
        } catch (e) {
            console.error(e);
            Utils.showToast('تعذّر الدخول على الحساب: ' + Utils.translateError(e), 'error');
        }
    },

    ensureReturnToAdminButton() {
        if (document.getElementById('return-to-admin-floating-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'return-to-admin-floating-btn';
        btn.type = 'button';
        btn.innerText = '↩️ رجوع للأدمن';
        btn.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:9999;padding:10px 14px;border-radius:10px;border:none;background:#0f2b46;color:#fff;font-weight:bold;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.25);';
        btn.onclick = async () => {
            sessionStorage.removeItem('crowgo_impersonating_from_admin');
            btn.remove();
            if (typeof router !== 'undefined' && typeof router.showScreen === 'function') {
                router.showScreen('admin-dashboard');
            }
            await this.renderDashboard();
        };
        document.body.appendChild(btn);
    },

    // لوحة "مدفوعات قيد المراجعة" بزرار تأكيد/رفض (يحل جزء من C2/H2)
    async renderPendingPayments() {
        const container = document.getElementById('admin-payments-container');
        if (!container) return;

        container.innerHTML = '<p>جاري تحميل المدفوعات...</p>';

        const { data: payments, error } = await sbClient
            .from('payments')
            .select('*, profiles(name, phone)')
            .eq('status', 'pending')
            .order('created_at', { ascending: true });

        if (error) {
            container.innerHTML = '<p class="text-error">فشل جلب طلبات التجديد.</p>';
            console.error(error);
            return;
        }

        if (!payments || payments.length === 0) {
            container.innerHTML = '<p>لا توجد طلبات تجديد قيد المراجعة حالياً.</p>';
            return;
        }

        let html = '';
        payments.forEach(p => {
            const waseetName = Utils.escapeHtml(p.profiles ? p.profiles.name : p.waseet_id);
            const waseetPhone = Utils.escapeHtml(p.profiles ? p.profiles.phone : '');
            const amount = Number(p.amount || 0).toLocaleString('ar-EG');
            html += `<div class="admin-payment-card">
                <div><b>${waseetName}</b> — ${waseetPhone}</div>
                <div class="admin-payment-amount">${amount} ج.م — ${Utils.escapeHtml(p.method)}</div>
                ${p.notes ? `<div class="admin-payment-notes">${Utils.escapeHtml(p.notes)}</div>` : ''}
                <div class="admin-list-actions">
                    <button type="button" class="btn-small btn-confirm" onclick="adminApp.confirmPayment(${p.id})">✅ تأكيد (30 يوم)</button>
                    <button type="button" class="btn-small btn-reject" onclick="adminApp.rejectPayment(${p.id})">❌ رفض</button>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    },

    async confirmPayment(paymentId) {
        const ok = await Utils.confirmDialog('تأكيد هذه الدفعة ومد الاشتراك 30 يوم؟');
        if (!ok) return;
        const { error } = await sbClient.rpc('confirm_payment', { p_id: paymentId, p_days: 30 });
        if (error) { Utils.showToast(Utils.translateError(error), 'error'); return; }
        Utils.showToast('تم تأكيد الدفعة ومد الاشتراك', 'success');
        await this.renderDashboard();
    },

    async rejectPayment(paymentId) {
        const ok = await Utils.confirmDialog('رفض طلب التجديد ده؟');
        if (!ok) return;
        const { error } = await sbClient.rpc('reject_payment', { p_id: paymentId });
        if (error) { Utils.showToast(Utils.translateError(error), 'error'); return; }
        Utils.showToast('تم رفض الطلب', 'success');
        await this.renderDashboard();
    },

    // يستدعي Edge Function (supabase/functions/admin-reset-pin) اللي بتستخدم
    // service role على السيرفر — مش موجودة هنا مفتاح، ولازم تتنشر على مشروع
    // Supabase بتاعك أولاً (يحل جزء من C5: مفيش طريقة لاسترجاع الـ PIN حالياً).
    async openResetPin(waseetId, waseetName) {
        const newPin = prompt(`أدخل رقم PIN جديد (6 أرقام) لـ ${waseetName}:`);
        if (!newPin) return;
        const normalized = Utils.normalizeDigits(newPin);
        if (!/^[0-9]{6}$/.test(normalized)) {
            Utils.showToast('الـ PIN لازم يكون 6 أرقام', 'error');
            return;
        }
        try {
            const { error } = await sbClient.functions.invoke('admin-reset-pin', {
                body: { waseet_id: waseetId, new_pin: normalized }
            });
            if (error) throw error;
            Utils.showToast('تم تغيير الـ PIN بنجاح', 'success');
        } catch (e) {
            Utils.showToast('فشل تغيير الـ PIN — تأكد إن الـ Edge Function منشورة (راجع supabase/functions/admin-reset-pin)', 'error');
            console.error(e);
        }
    },
   
    async loadAdminWhatsappSetting() {
        const adminId = '910e51e9-7870-4d26-9f7e-5ae67a32a524';
        const input = document.getElementById('admin-whatsapp-input');
        if (!input) return;

        const { data, error } = await sbClient
            .from('profiles')
            .select('whatsapp_phone, phone')
            .eq('id', adminId)
            .single();

        if (!error && data) {
            input.value = data.whatsapp_phone || data.phone || '';
        }
    },

    async saveAdminWhatsappSetting() {
        const adminId = '910e51e9-7870-4d26-9f7e-5ae67a32a524';
        const input = document.getElementById('admin-whatsapp-input');
        if (!input) return;

        let clean = (input.value || '').replace(/\D/g, '');
        if (clean.startsWith('01')) {
            clean = '20' + clean.slice(1);
        }

        if (!clean || clean.length < 10) {
            Utils.showToast('أدخل رقم واتساب صحيح', 'error');
            return;
        }

        const { error } = await sbClient
            .from('profiles')
            .update({ whatsapp_phone: clean })
            .eq('id', adminId);

        if (error) {
            Utils.showToast('فشل حفظ رقم الواتساب: ' + Utils.translateError(error), 'error');
            return;
        }

        input.value = clean;
        Utils.showToast('تم حفظ رقم واتساب الأدمن بنجاح', 'success');
    }
};
async function openAdminWhatsApp() {
    const adminId = '910e51e9-7870-4d26-9f7e-5ae67a32a524';
    try {
        const { data, error } = await sbClient
            .from('profiles')
            .select('whatsapp_phone, phone')
            .eq('id', adminId)
            .single();

        if (error) throw error;

        let rawPhone = (data && (data.whatsapp_phone || data.phone)) || '';
        let clean = rawPhone.replace(/\D/g, '');
        if (clean.startsWith('01')) {
            clean = '20' + clean.slice(1);
        }

        if (!clean) {
            Utils.showToast('رقم واتساب الإدارة غير مضبوط حالياً', 'error');
            return;
        }

        const msg = encodeURIComponent('مرحباً بإدارة المنصة، أحتاج مساعدة.');
        window.open(`https://wa.me/${clean}?text=${msg}`, '_blank');
    } catch (e) {
        console.error(e);
        Utils.showToast('تعذّر فتح واتساب حالياً', 'error');
    }
}
