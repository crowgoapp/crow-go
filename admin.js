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
                <select id="admin-filter-gov" style="flex:1;min-width:140px;padding:8px;border-radius:8px;">
                    <option value="">كل المحافظات</option>
                    ${govOptions}
                </select>
                <select id="admin-filter-prof" style="flex:1;min-width:140px;padding:8px;border-radius:8px;">
                    <option value="">كل المهن</option>
                    ${profOptions}
                </select>
                ${(this.selectedGovernorate || this.selectedProfession)
                    ? `<button type="button" class="btn-small" data-action="reset-filters">إعادة ضبط</button>`
                    : ''}
            </div>
            <div id="admin-filtered-waseets-list"></div>
        `;

        container.innerHTML = filterHtml;

        const govSelect = document.getElementById('admin-filter-gov');
        const profSelect = document.getElementById('admin-filter-prof');
        if (govSelect) govSelect.addEventListener('change', () => this.onFilterChange());
        if (profSelect) profSelect.addEventListener('change', () => this.onFilterChange());

        container.onclick = (e) => {
            const resetBtn = e.target.closest('[data-action="reset-filters"]');
            if (resetBtn) {
                this.resetFilters();
            }
        };

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

        const html = '<ul class="admin-list">' + filtered.map(w => {
            const safeId = Utils.escapeHtml(String(w.id || ''));
            const safeName = Utils.escapeHtml(w.name || '');
            const safePhone = Utils.escapeHtml(w.phone || '');
            const safeGov = Utils.escapeHtml(w.governorate || '');
            const safeProf = Utils.escapeHtml(w.profession || '');

            const isDisabled = w.is_active === false || w.account_status === 'cancelled';
            const subEnd = w.subscription_end
                ? Utils.escapeHtml(new Date(w.subscription_end).toLocaleDateString('ar-EG'))
                : 'غير محدد';

            return `<li class="admin-list-item">
                <b>${safeName}</b> (${safeProf}) ${isDisabled ? '<span class="text-error">[ملغي]</span>' : ''}<br>
                <small>الهاتف: ${safePhone} | المحافظة: ${safeGov}</small><br>
                <small class="text-success">الاشتراك حتى: ${subEnd}</small>
                <div class="admin-list-actions" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
                    <button type="button" class="btn-small" data-action="reset-pin" data-id="${safeId}">إعادة تعيين PIN</button>
                    <button type="button" class="btn-small" data-action="extend-sub" data-id="${safeId}" data-days="7" data-label="أسبوع مجاني">+ أسبوع مجاني</button>
                    <button type="button" class="btn-small" data-action="extend-sub" data-id="${safeId}" data-days="30" data-label="شهر">+ شهر</button>
                    <button type="button" class="btn-small" data-action="impersonate" data-id="${safeId}">دخول كصاحب الحساب</button>
                    <button type="button" class="btn-small btn-reject" data-action="cancel-account" data-id="${safeId}">إلغاء الحساب</button>
                </div>
            </li>`;
        }).join('') + '</ul>';

        listContainer.innerHTML = html;

        listContainer.onclick = async (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const waseetId = btn.dataset.id;
            if (!waseetId) return;

            const profile = this.profiles.find(p => String(p.id) === String(waseetId));
            const waseetName = profile && profile.name ? profile.name : 'الوسيط';

            if (action === 'reset-pin') {
                await this.openResetPin(waseetId, waseetName);
            } else if (action === 'extend-sub') {
                const days = Number(btn.dataset.days || 0);
                const label = btn.dataset.label || `${days} يوم`;
                if (days > 0) {
                    await this.extendSubscription(waseetId, days, label);
                }
            } else if (action === 'impersonate') {
                await this.impersonateWaseet(waseetId);
            } else if (action === 'cancel-account') {
                await this.cancelAccount(waseetId, waseetName);
            }
        };
    },

    async extendSubscription(waseetId, daysToAdd, labelText) {
        const profile = this.profiles.find(p => String(p.id) === String(waseetId));
        const nameLabel = profile && profile.name ? profile.name : 'الوسيط';

        const ok = await Utils.confirmDialog(`إضافة ${labelText} (${daysToAdd} يوم) لاشتراك "${nameLabel}"؟`);
        if (!ok) return;

        try {
            const { error } = await sbClient.rpc('admin_extend_subscription', {
                p_waseet_id: waseetId,
                p_days: Number(daysToAdd)
            });

            if (error) throw error;

            Utils.showToast(`تم إضافة ${labelText} بنجاح`, 'success');
            await this.renderWaseets();
        } catch (e) {
            console.error(e);
            Utils.showToast('فشل تمديد الاشتراك: ' + Utils.translateError(e), 'error');
        }
    },

    async cancelAccount(waseetId, waseetName) {
        const profile = this.profiles.find(p => String(p.id) === String(waseetId));
        const safeName = waseetName || (profile && profile.name ? profile.name : 'الوسيط');

        const ok = await Utils.confirmDialog(`هل أنت متأكد من إلغاء حساب "${safeName}"؟`);
        if (!ok) return;

        try {
            const { data: result, error } = await sbClient.rpc('admin_cancel_account', {
                p_waseet_id: waseetId
            });

            if (error) throw error;

            // admin_cancel_account بقى بيعلّم الحساب "ملغي" ويصفّر الاشتراك
            // بس - مش بيمسح البروفايل (كان ده بيسيب حساب الدخول شغال من
            // غير بروفايل - N-H1). قفل الدخول الفعلي عن طريق Edge Function
            // منفصلة بصلاحية service role.
            try {
                const { error: banError } = await sbClient.functions.invoke('admin-ban-account', {
                    body: { waseet_id: waseetId, ban: true }
                });
                if (banError) throw banError;
                Utils.showToast('تم إلغاء الحساب ومنع تسجيل الدخول بنجاح', 'success');
            } catch (banErr) {
                console.error(banErr);
                Utils.showToast('تم إلغاء اشتراك الحساب، لكن تعذّر منع تسجيل الدخول — تأكد إن admin-ban-account منشورة (راجع supabase/functions/admin-ban-account)', 'error');
            }
            await this.renderWaseets();
        } catch (e) {
            console.error(e);
            Utils.showToast('فشل إلغاء الحساب: ' + Utils.translateError(e), 'error');
        }
    },

    async impersonateWaseet(waseetId) {
        try {
            const { data: isAdmin, error: adminErr } = await sbClient.rpc('is_admin');
            if (adminErr || !isAdmin) {
                Utils.showToast('هذه الميزة متاحة للأدمن فقط', 'error');
                return;
            }

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
            this.ensureReturnToAdminButton(targetProfile.name || 'الوسيط');

            if (typeof waseetApp !== 'undefined' && typeof waseetApp.initWaseetSession === 'function') {
                await waseetApp.initWaseetSession(targetProfile.id, targetProfile);
                Utils.showToast(`معاينة حساب الوسيط: ${targetProfile.name || 'الوسيط'}`, 'success');
            } else {
                Utils.showToast('واجهة الوسيط غير متاحة حالياً', 'error');
            }
        } catch (e) {
            console.error(e);
            Utils.showToast('تعذّر معاينة الحساب: ' + Utils.translateError(e), 'error');
        }
    },
    // ملحوظة لمراجعة N-C4: المعاينة لسه بتستخدم جلسة الأدمن الحقيقية
    // (التعديل/الحذف شغالين عن طريق RLS "OR is_admin()"، والإضافة بتفشل
    // لأن سياسة الإدراج بتشترط owner_id = auth.uid() بالظبط). الحل الكامل
    // (شاشة "قراءة فقط" بدالة admin_get_waseet_overview + سجل تدقيق مخصص)
    // أكبر من إصلاح نقطي ومؤجل لمرحلة لاحقة - موثق في docs/fixes-applied-report3.md.

    ensureReturnToAdminButton(waseetName = '') {
        let btn = document.getElementById('return-to-admin-floating-btn');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'return-to-admin-floating-btn';
            btn.type = 'button';
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
        }
        btn.innerText = waseetName ? `↩️ رجوع للأدمن (معاينة: ${waseetName})` : '↩️ رجوع للأدمن';
    },

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

        const html = payments.map(p => {
            const safePaymentId = Utils.escapeHtml(String(p.id || ''));
            const waseetName = Utils.escapeHtml(p.profiles ? p.profiles.name : p.waseet_id);
            const waseetPhone = Utils.escapeHtml(p.profiles ? p.profiles.phone : '');
            const amount = Number(p.amount || 0).toLocaleString('ar-EG');
            return `<div class="admin-payment-card">
                <div><b>${waseetName}</b> — ${waseetPhone}</div>
                <div class="admin-payment-amount">${amount} ج.م — ${Utils.escapeHtml(p.method || '')}</div>
                ${p.notes ? `<div class="admin-payment-notes">${Utils.escapeHtml(p.notes)}</div>` : ''}
                <div class="admin-list-actions">
                    <button type="button" class="btn-small btn-confirm" data-payment-action="confirm" data-payment-id="${safePaymentId}">✅ تأكيد (30 يوم)</button>
                    <button type="button" class="btn-small btn-reject" data-payment-action="reject" data-payment-id="${safePaymentId}">❌ رفض</button>
                </div>
            </div>`;
        }).join('');

        container.innerHTML = html;

        container.onclick = async (e) => {
            const btn = e.target.closest('button[data-payment-action]');
            if (!btn) return;

            const paymentId = btn.dataset.paymentId;
            if (!paymentId) return;

            if (btn.dataset.paymentAction === 'confirm') {
                await this.confirmPayment(paymentId);
            } else if (btn.dataset.paymentAction === 'reject') {
                await this.rejectPayment(paymentId);
            }
        };
    },

    async confirmPayment(paymentId) {
        const ok = await Utils.confirmDialog('تأكيد هذه الدفعة ومد الاشتراك 30 يوم؟');
        if (!ok) return;
        try {
            const { error } = await sbClient.rpc('confirm_payment', { p_id: paymentId, p_days: 30 });
            if (error) {
                Utils.showToast(Utils.translateError(error), 'error');
                return;
            }
            Utils.showToast('تم تأكيد الدفعة ومد الاشتراك', 'success');
            await this.renderDashboard();
        } catch (e) {
            console.error(e);
            Utils.showToast('تعذّر تأكيد الدفعة', 'error');
        }
    },

    async rejectPayment(paymentId) {
        const ok = await Utils.confirmDialog('رفض طلب التجديد ده؟');
        if (!ok) return;
        try {
            const { error } = await sbClient.rpc('reject_payment', { p_id: paymentId });
            if (error) {
                Utils.showToast(Utils.translateError(error), 'error');
                return;
            }
            Utils.showToast('تم رفض الطلب', 'success');
            await this.renderDashboard();
        } catch (e) {
            console.error(e);
            Utils.showToast('تعذّر رفض الطلب', 'error');
        }
    },

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
        const input = document.getElementById('admin-whatsapp-input');
        if (!input) return;

        const { data, error } = await sbClient.rpc('get_admin_whatsapp');
        if (!error && typeof data === 'string') {
            input.value = data;
        }
    },

    async saveAdminWhatsappSetting() {
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

        try {
            // بيحدّث رقم الأدمن الحالي نفسه بس، عن طريق دالة في القاعدة
            // (admin_set_whatsapp) بدل UPDATE مباشر بـ UUID ثابت احتياطي -
            // ده كان معناه إن أدمن تاني غير اللي الـ UUID بتاعه بيحفظ على
            // صف غلط بصمت (N-H2).
            const { error } = await sbClient.rpc('admin_set_whatsapp', { p_phone: clean });

            if (error) {
                Utils.showToast('فشل حفظ رقم الواتساب: ' + Utils.translateError(error), 'error');
                return;
            }

            input.value = clean;
            Utils.showToast('تم حفظ رقم واتساب الأدمن بنجاح', 'success');
        } catch (e) {
            console.error(e);
            Utils.showToast('تعذّر حفظ رقم الواتساب', 'error');
        }
    }
};

async function openAdminWhatsApp() {
    try {
        const { data, error } = await sbClient.rpc('get_admin_whatsapp');
        if (error) throw error;

        let rawPhone = typeof data === 'string' ? data : '';
        let clean = rawPhone.replace(/\D/g, '');
        if (clean.startsWith('01')) {
            clean = '20' + clean.slice(1);
        }

        if (!clean) {
            Utils.showToast('رقم واتساب الإدارة غير مضبوط حالياً', 'error');
            return;
        }

        const msg = encodeURIComponent('مرحباً بإدارة المنصة، أحتاج مساعدة.');
        window.open(`https://wa.me/${clean}?text=${msg}`, '_blank', 'noopener,noreferrer');
    } catch (e) {
        console.error('openAdminWhatsApp error:', e);
        Utils.showToast('تعذّر فتح واتساب حالياً', 'error');
    }
}
