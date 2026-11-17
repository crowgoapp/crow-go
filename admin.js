const adminApp = {
    renderDashboard() {
        const container = document.getElementById('admin-waseets-container');
        if (!container) return;

        let waseetPhones = [];
        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            if (key && key.startsWith('crow_waseet_name_')) {
                waseetPhones.push(key.replace('crow_waseet_name_', ''));
            }
        }

        if (waseetPhones.length === 0) {
            container.innerHTML = '<p>لا توجد حسابات وسطاء مسجلة بعد.</p>';
            return;
        }

        let html = '<ul style="padding:0; list-style:none;">';
        waseetPhones.forEach(phone => {
            const name = Utils.escapeHtml(localStorage.getItem('crow_waseet_name_' + phone));
            const safePhone = Utils.escapeHtml(phone);
            html += `<li style="background:#f1f5f9; padding:8px; margin-bottom:5px; border-radius:6px;">
                <b>${name}</b> - الهاتف: ${safePhone}
            </li>`;
        });
        html += '</ul>';
        container.innerHTML = html;
    }
};
