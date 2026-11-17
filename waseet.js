const waseetApp = {
    currentPhone: "",
    currentName: "",
    products: [],

    initWaseetSession(phone, name) {
        this.currentPhone = phone;
        this.currentName = name;
        router.showScreen('waseet-dashboard');
        
        const welcomeEl = document.getElementById('waseet-welcome-text');
        if (welcomeEl) {
            welcomeEl.innerText = `أهلاً بك يا ${Utils.escapeHtml(name)}`;
        }
        this.loadData();
    },

    loadData() {
        this.products = Utils.safeJSONParse('crow_prods_' + this.currentPhone, []);
        this.renderProducts();
    },

    renderProducts() {
        const container = document.getElementById('products-list-container');
        if (!container) return;

        if (this.products.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8;">لا توجد منتجات مسجلة.</p>';
            return;
        }

        container.innerHTML = '';
        this.products.forEach((p) => {
            const safeName = Utils.escapeHtml(p.name);
            const safePrice = Utils.escapeHtml(p.price);
            const safeOwner = Utils.escapeHtml(p.ownerName || 'غير مسجل');

            container.innerHTML += `
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:8px;">
                    <b>#${p.serial} - ${safeName}</b> (${safePrice} ج.م)<br>
                    <small style="color:#059669;">المالك: ${safeOwner}</small>
                </div>`;
        });
    },

    openNewProductModal() { Utils.showToast("نافذة إضافة منتج جديدة (قيد التشغيل)", "success"); },
    openNewOrderModal() { Utils.showToast("نافذة تسجيل طلب جديدة (قيد التشغيل)", "success"); }
};
