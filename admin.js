const adminApp = {
    async renderDashboard() {
        await Promise.all([this.renderWaseets(), this.renderPendingPayments()]);
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

        if (!profiles || profiles.length === 0) {
            container.innerHTML = '<p>لا توجد حسابات وسطاء مسجلة بعد.</p>';
            return;
        }

        let html = '<ul class="admin-list">';
        profiles.forEach(w => {
            const safeName = Utils.escapeHtml(w.name);
            const safePhone = Utils.escapeHtml(w.phone);
            const safeGov = Utils.escapeHtml(w.governorate);
            // المهنة كانت بتتحط في الـ HTML من غير تعقيم (L2) — قيمتها جاية من
            // قايمة select ثابتة حالياً، بس تعقيمها هنا بيقفل الباب لو اتغيرت
            // لحقل حر مستقبلاً.
            const safeProf = Utils.escapeHtml(w.profession);
            const subEnd = w.subscription_end
                ? new Date(w.subscription_end).toLocaleDateString('ar-EG')
                : 'غير محدد';

            html += `<li class="admin-list-item">
                <b>${safeName}</b> (${safeProf})<br>
                <small>الهاتف: ${safePhone} | المحافظة: ${safeGov}</small><br>
                <small class="text-success">الاشتراك حتى: ${subEnd}</small>
                <div class="admin-list-actions">
                    <button type="button" class="btn-small" onclick="adminApp.openResetPin('${w.id}', '${safeName.replace(/'/g, "\\'")}')">إعادة تعيين PIN</button>
                </div>
            </li>`;
        });
        html += '</ul>';
        container.innerHTML = html;
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
    }
};
