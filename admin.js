const adminApp = {
    async renderDashboard() {
        const container = document.getElementById('admin-waseets-container');
        if (!container) return;

        container.innerHTML = '<p>جاري تحميل الوسطاء...</p>';

        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = '<p style="color:red;">فشل جلب الوسطاء من قاعدة البيانات.</p>';
            return;
        }

        if (!profiles || profiles.length === 0) {
            container.innerHTML = '<p>لا توجد حسابات وسطاء مسجلة بعد.</p>';
            return;
        }

        let html = '<ul style="padding:0; list-style:none;">';
        profiles.forEach(w => {
            const safeName = Utils.escapeHtml(w.name);
            const safePhone = Utils.escapeHtml(w.phone);
            const safeGov = Utils.escapeHtml(w.governorate);
            const subEnd = Utils.escapeHtml(w.subscription_end);

            html += `<li style="background:#f1f5f9; padding:10px; margin-bottom:8px; border-radius:8px;">
                <b>${safeName}</b> (${w.profession})<br>
                <small>الهاتف: ${safePhone} | المحافظة: ${safeGov}</small><br>
                <small style="color:#059669;">الاشتراك حتى: ${subEnd}</small>
            </li>`;
        });
        html += '</ul>';
        container.innerHTML = html;
    }
};
