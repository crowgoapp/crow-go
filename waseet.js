const waseetApp = {
    currentUserId: "",
    profile: null,
    products: [],
    orders: [],

    async initWaseetSession(userId, profileData) {
        this.currentUserId = userId;
        this.profile = profileData;
        router.showScreen('waseet-dashboard');

        const welcomeEl = document.getElementById('waseet-welcome-text');
        if (welcomeEl) {
            welcomeEl.innerText = `أهلاً بك يا ${Utils.escapeHtml(this.profile.name)}`;
        }

        this.switchTab('products');
        await this.loadProducts();
    },

    switchTab(tabName) {
        ['products', 'orders', 'sub'].forEach(t => {
            document.getElementById(`waseet-tab-${t}`).classList.add('hidden');
            document.getElementById(`tab-btn-${t}`).classList.remove('active');
        });
        document.getElementById(`waseet-tab-${tabName}`).classList.remove('hidden');
        document.getElementById(`tab-btn-${tabName}`).classList.add('active');

        if (tabName === 'products') this.loadProducts();
        if (tabName === 'orders') this.loadOrders();
        if (tabName === 'sub') this.loadSubscriptionAndReferrals();
    },

    // ================= 1. إدارة المنتجات وتعدد الصور =================
    async loadProducts() {
        const container = document.getElementById('products-list-container');
        container.innerHTML = '<p style="text-align:center;">جاري تحميل العروض...</p>';

        const { data, error } = await sbClient
            .from('products')
            .select('*, product_images(id, storage_path)')
            .eq('owner_id', this.currentUserId)
            .order('serial', { ascending: true });

        if (error) {
            container.innerHTML = '<p style="text-align:center; color:red;">فشل تحميل العروض</p>';
            return;
        }

        this.products = data || [];
        this.renderProducts();
    },

    renderProducts() {
        const container = document.getElementById('products-list-container');
        if (this.products.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8;">لا توجد عروض مسجلة بعد. اضغط "+ إضافة عرض" للبدء.</p>';
            return;
        }

        container.innerHTML = '';
        this.products.forEach((p) => {
            const safeName = Utils.escapeHtml(p.name);
            const safePrice = Utils.escapeHtml(p.price);
            const safeDesc = Utils.escapeHtml(p.description || '');
            const safeOwner = Utils.escapeHtml(p.owner_name || 'غير مسجل');
            const safeOwnerPhone = Utils.escapeHtml(p.owner_phone || '');

            // عرض مصغرات الصور المتعددة مع الرابط الصحيح للبوكت
            let thumbsHtml = '';
            if (p.product_images && p.product_images.length > 0) {
                thumbsHtml = '<div style="display:flex; gap:6px; overflow-x:auto; margin:8px 0;">';
                p.product_images.forEach(img => {
                    const { data: urlData } = sbClient.storage.from('product-images').getPublicUrl(img.storage_path);
                    if (urlData && urlData.publicUrl) {
                        thumbsHtml += `<img src="${urlData.publicUrl}" style="width:60px; height:60px; object-fit:cover; border-radius:6px; border:1px solid #cbd5e1;" />`;
                    }
                });
                thumbsHtml += '</div>';
            }

            const checkedAttr = p.selected_for_catalog ? 'checked' : '';

            container.innerHTML += `
                <div style="background:#fff; border:1px solid #cbd5e1; border-radius:10px; padding:10px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <label style="display:flex; align-items:center; gap:6px; font-weight:bold; color:#0f2b46; cursor:pointer;">
                            <input type="checkbox" ${checkedAttr} onchange="waseetApp.toggleCatalogSelect(${p.id}, this.checked)" style="width:18px; height:18px; margin:0;" />
                            <span>كود #${p.serial} - ${safeName}</span>
                        </label>
                        <span style="background:#0f2b46; color:#fff; padding:2px 8px; border-radius:6px; font-size:13px; font-weight:bold;">${safePrice} ج.م</span>
                    </div>
                    ${safeDesc ? `<div style="font-size:12px; color:#475569; margin-top:4px;">${safeDesc}</div>` : ''}
                    ${thumbsHtml}
                    <div style="background:#f8fafc; padding:6px; border-radius:6px; font-size:11px; color:#64748b; margin-top:6px;">
                        🔒 المالك: <b>${safeOwner}</b> ${safeOwnerPhone ? `(${safeOwnerPhone})` : ''}
                    </div>
                    <div style="display:flex; gap:6px; margin-top:8px;">
                        <button type="button" onclick="waseetApp.openEditProductModal(${p.id})" style="flex:1; padding:6px; border:none; border-radius:6px; background:#e2e8f0; color:#0f2b46; font-weight:bold; font-size:12px; cursor:pointer;">✏️ تعديل</button>
                        <button type="button" onclick="waseetApp.deleteProduct(${p.id})" style="flex:1; padding:6px; border:none; border-radius:6px; background:#fee2e2; color:#991b1b; font-weight:bold; font-size:12px; cursor:pointer;">🗑️ حذف</button>
                    </div>
                </div>`;
        });
    },

    async toggleCatalogSelect(productId, isSelected) {
        await sbClient.from('products').update({ selected_for_catalog: isSelected }).eq('id', productId);
        const prod = this.products.find(x => x.id === productId);
        if (prod) prod.selected_for_catalog = isSelected;
    },

    openNewProductModal() {
        document.getElementById('prod-modal-title').innerText = 'إضافة عرض جديد';
        document.getElementById('prod-edit-id').value = '';
        document.getElementById('prod-name').value = '';
        document.getElementById('prod-price').value = '';
        document.getElementById('prod-desc').value = '';
        document.getElementById('prod-owner-name').value = '';
        document.getElementById('prod-owner-phone').value = '';
        document.getElementById('prod-owner-address').value = '';
        document.getElementById('prod-images').value = '';
        document.getElementById('product-modal').classList.remove('hidden');
    },

    openEditProductModal(productId) {
        const p = this.products.find(x => x.id === productId);
        if (!p) return;
        document.getElementById('prod-modal-title').innerText = `تعديل العرض #${p.serial}`;
        document.getElementById('prod-edit-id').value = p.id;
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-price').value = p.price;
        document.getElementById('prod-desc').value = p.description || '';
        document.getElementById('prod-owner-name').value = p.owner_name || '';
        document.getElementById('prod-owner-phone').value = p.owner_phone || '';
        document.getElementById('prod-owner-address').value = p.owner_address || '';
        document.getElementById('prod-images').value = '';
        document.getElementById('product-modal').classList.remove('hidden');
    },

    closeProductModal() {
        document.getElementById('product-modal').classList.add('hidden');
    },

    async saveProduct() {
        const editId = document.getElementById('prod-edit-id').value;
        const name = document.getElementById('prod-name').value.trim();
        const price = document.getElementById('prod-price').value.trim();
        const desc = document.getElementById('prod-desc').value.trim();
        const ownerName = document.getElementById('prod-owner-name').value.trim();
        const ownerPhone = document.getElementById('prod-owner-phone').value.trim();
        const ownerAddress = document.getElementById('prod-owner-address').value.trim();
        const imageFiles = document.getElementById('prod-images').files;

        if (!name || !price) {
            Utils.showToast("أدخل اسم العرض والسعر", "error");
            return;
        }

        Utils.showToast("جاري الحفظ ورفع الصور...", "success");
        let targetProductId = editId;

        if (editId) {
            const { error } = await sbClient.from('products').update({
                name: name,
                price: parseFloat(price),
                description: desc,
                owner_name: ownerName,
                owner_phone: ownerPhone,
                owner_address: ownerAddress
            }).eq('id', editId);

            if (error) { Utils.showToast("خطأ في التعديل", "error"); return; }
            targetProductId = editId;
        } else {
            const maxSerial = this.products.reduce((max, item) => Math.max(max, item.serial || 0), 0);
            const nextSerial = maxSerial + 1;

            const { data: prodData, error: prodError } = await sbClient
                .from('products')
                .insert([{
                    owner_id: this.currentUserId,
                    serial: nextSerial,
                    name: name,
                    price: parseFloat(price),
                    description: desc,
                    owner_name: ownerName,
                    owner_phone: ownerPhone,
                    owner_address: ownerAddress,
                    selected_for_catalog: true
                }])
                .select()
                .single();

            if (prodError) { Utils.showToast("خطأ في الحفظ: " + prodError.message, "error"); return; }
            targetProductId = prodData.id;
        }

        // رفع الصور المتعددة بشكل صحيح لـ Storage
        if (imageFiles && imageFiles.length > 0 && targetProductId) {
            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i];
                const fileExt = file.name.split('.').pop();
                const fileName = `${this.currentUserId}_${Date.now()}_${i}.${fileExt}`;

                const { error: uploadError } = await sbClient.storage
                    .from('product-images')
                    .upload(fileName, file);

                if (!uploadError) {
                    await sbClient.from('product_images').insert([{
                        product_id: targetProductId,
                        storage_path: fileName,
                        sort_order: i
                    }]);
                }
            }
        }

        Utils.showToast("تم حفظ العرض بنجاح!", "success");
        this.closeProductModal();
        await this.loadProducts();
    },

    async deleteProduct(productId) {
        if (!confirm("هل أنت متأكد من حذف هذا العرض نهائياً؟")) return;
        const { error } = await sbClient.from('products').delete().eq('id', productId);
        if (error) { Utils.showToast("فشل الحذف", "error"); return; }
        Utils.showToast("تم حذف العرض", "success");
        await this.loadProducts();
    },

    // ================= 2. توليد بوستر الكتالوج المجمع كصورة =================
    async generateCatalogPoster() {
        const selectedItems = this.products.filter(p => p.selected_for_catalog);
        if (selectedItems.length === 0) {
            Utils.showToast("حدد منتجاً واحداً على الأقل لوضعه في البوستر", "error");
            return;
        }

        Utils.showToast("جاري تصميم بوستر الكتالوج...", "success");

        document.getElementById('poster-waseet-phone').innerText = this.profile.phone || '';
        document.getElementById('poster-subtitle').innerText = `عروض ${this.profile.profession || 'مميزة'} - ${this.profile.governorate || ''}`;

        const grid = document.getElementById('poster-items-grid');
        grid.innerHTML = '';

        for (const item of selectedItems) {
            let imgUrl = '';
            if (item.product_images && item.product_images.length > 0) {
                const { data: urlData } = sbClient.storage.from('product-images').getPublicUrl(item.product_images[0].storage_path);
                if (urlData && urlData.publicUrl) imgUrl = urlData.publicUrl;
            }

            grid.innerHTML += `
                <div class="poster-item">
                    ${imgUrl ? `<img src="${imgUrl}" crossorigin="anonymous" />` : `<div style="height:160px; display:flex; align-items:center; justify-content:center; background:#1e293b; border-radius:8px; margin-bottom:8px; color:#94a3b8;">بدون صورة</div>`}
                    <div style="font-size:13px; color:#38bdf8; font-weight:bold;">كود #${item.serial}</div>
                    <div style="font-size:16px; font-weight:bold; color:#fff; margin:4px 0;">${Utils.escapeHtml(item.name)}</div>
                    <div style="font-size:15px; font-weight:bold; background:#3182ce; color:#fff; display:inline-block; padding:3px 12px; border-radius:12px;">${Utils.escapeHtml(item.price)} ج.م</div>
                </div>
            `;
        }

        const wrapper = document.getElementById('poster-canvas-wrapper');
        try {
            const canvas = await html2canvas(wrapper, { useCORS: true, scale: 2 });
            const dataUrl = canvas.toDataURL('image/png');
            document.getElementById('generated-poster-img').src = dataUrl;
            document.getElementById('download-poster-link').href = dataUrl;
            document.getElementById('poster-preview-modal').classList.remove('hidden');
        } catch (e) {
            Utils.showToast("حدث خطأ أثناء توليد الصورة، حاول مرة أخرى", "error");
        }
    },

    // ================= 3. إدارة طلبات الزبائن =================
    async loadOrders() {
        const container = document.getElementById('orders-list-container');
        container.innerHTML = '<p style="text-align:center;">جاري تحميل الطلبات...</p>';

        const { data, error } = await sbClient
            .from('orders')
            .select('*')
            .eq('owner_id', this.currentUserId)
            .order('created_at', { ascending: false });

        if (error) { container.innerHTML = '<p style="color:red;">فشل تحميل الطلبات</p>'; return; }
        this.orders = data || [];
        this.renderOrders();
    },

    renderOrders() {
        const container = document.getElementById('orders-list-container');
        if (this.orders.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8;">لا توجد طلبات مسجلة حالياً.</p>';
            return;
        }

        const statusLabels = {
            'new': '<span class="badge badge-new">جديد</span>',
            'contacted': '<span class="badge badge-contacted">تم التواصل</span>',
            'done': '<span class="badge badge-done">مكتمل</span>'
        };

        container.innerHTML = '';
        this.orders.forEach(o => {
            container.innerHTML += `
                <div style="background:#fff; border:1px solid #cbd5e1; border-radius:10px; padding:10px; margin-bottom:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <b>${Utils.escapeHtml(o.item_needed)}</b>
                        ${statusLabels[o.status] || ''}
                    </div>
                    <div style="font-size:13px; color:#334155; margin-top:4px;">👤 ${Utils.escapeHtml(o.client_name)} — 📞 ${Utils.escapeHtml(o.client_phone)}</div>
                    ${o.client_address ? `<div style="font-size:12px; color:#64748b;">📍 ${Utils.escapeHtml(o.client_address)}</div>` : ''}
                    <div style="display:flex; gap:4px; margin-top:8px;">
                        <button type="button" onclick="waseetApp.updateOrderStatus(${o.id}, 'contacted')" style="flex:1; padding:5px; font-size:11px; border:none; border-radius:6px; background:#fef3c7; color:#92400e; font-weight:bold; cursor:pointer;">تم التواصل</button>
                        <button type="button" onclick="waseetApp.updateOrderStatus(${o.id}, 'done')" style="flex:1; padding:5px; font-size:11px; border:none; border-radius:6px; background:#d1fae5; color:#065f46; font-weight:bold; cursor:pointer;">مكتمل</button>
                        <button type="button" onclick="waseetApp.deleteOrder(${o.id})" style="padding:5px 8px; font-size:11px; border:none; border-radius:6px; background:#fee2e2; color:#991b1b; cursor:pointer;">🗑️</button>
                    </div>
                </div>
            `;
        });
    },

    openNewOrderModal() {
        document.getElementById('ord-item').value = '';
        document.getElementById('ord-client-name').value = '';
        document.getElementById('ord-client-phone').value = '';
        document.getElementById('ord-client-address').value = '';
        document.getElementById('order-modal').classList.remove('hidden');
    },

    closeNewOrderModal() {
        document.getElementById('order-modal').classList.add('hidden');
    },

    async saveNewOrder() {
        const item = document.getElementById('ord-item').value.trim();
        const clientName = document.getElementById('ord-client-name').value.trim();
        const clientPhone = document.getElementById('ord-client-phone').value.trim();
        const clientAddress = document.getElementById('ord-client-address').value.trim();

        if (!item || !clientName || !clientPhone) {
            Utils.showToast("أدخل الطلب واسم الزبون وهاتفه", "error");
            return;
        }

        const { error } = await sbClient.from('orders').insert([{
            owner_id: this.currentUserId,
            item_needed: item,
            client_name: clientName,
            client_phone: clientPhone,
            client_address: clientAddress,
            status: 'new'
        }]);

        if (error) { Utils.showToast("فشل حفظ الطلب", "error"); return; }
        Utils.showToast("تم تسجيل طلب الزبون", "success");
        this.closeNewOrderModal();
        await this.loadOrders();
    },

    async updateOrderStatus(orderId, newStatus) {
        await sbClient.from('orders').update({ status: newStatus }).eq('id', orderId);
        Utils.showToast("تم تحديث حالة الطلب", "success");
        await this.loadOrders();
    },

    async deleteOrder(orderId) {
        if (!confirm("حذف هذا الطلب؟")) return;
        await sbClient.from('orders').delete().eq('id', orderId);
        await this.loadOrders();
    },

    // ================= 4. الاشتراك وطلبات التجديد والإحالات =================
    async loadSubscriptionAndReferrals() {
        const { data: freshProfile } = await sbClient.from('profiles').select('*').eq('id', this.currentUserId).single();
        if (freshProfile) this.profile = freshProfile;

        const subBox = document.getElementById('subscription-info-box');
        const endDate = new Date(this.profile.subscription_end);
        const today = new Date();
        const isExpired = endDate < today;

        subBox.innerHTML = `
            <div style="font-weight:bold; color:#0f2b46; margin-bottom:4px;">حالة الاشتراك الحالي: ${isExpired ? '<span style="color:#dc2626;">منتهي ⛔</span>' : '<span style="color:#059669;">نشط ✅</span>'}</div>
            <div style="font-size:13px; color:#475569;">ينتهي في: <b>${Utils.escapeHtml(this.profile.subscription_end)}</b></div>
        `;

        const { data: payments } = await sbClient.from('payments').select('*').eq('waseet_id', this.currentUserId).order('created_at', { ascending: false });
        const payContainer = document.getElementById('payments-history-container');
        if (payments && payments.length > 0) {
            payContainer.innerHTML = '<div style="font-size:12px; font-weight:bold; margin-bottom:4px;">طلبات التجديد السابقة:</div>';
            payments.forEach(pay => {
                const st = pay.status === 'confirmed' ? 'مؤكد ✅' : (pay.status === 'rejected' ? 'مرفوض ❌' : 'قيد المراجعة ⏳');
                payContainer.innerHTML += `<div style="font-size:12px; background:#f1f5f9; padding:6px; border-radius:6px; margin-bottom:4px;">${pay.amount} ج.م (${Utils.escapeHtml(pay.method)}) — <b>${st}</b></div>`;
            });
        } else {
            payContainer.innerHTML = '';
        }

        document.getElementById('my-referral-code').value = this.profile.referral_code || '';
        const { count } = await sbClient.from('referrals').select('*', { count: 'exact', head: true }).eq('referrer_id', this.currentUserId);
        const refCount = count || 0;
        const remainder = 5 - (refCount % 5);
        document.getElementById('referrals-count-text').innerText = `عدد إحالاتك الناجحة: ${refCount} (متبقي ${remainder} للحصول على أسبوع مجاني إضافي)`;
    },

    async submitPaymentRequest() {
        const amount = document.getElementById('pay-amount').value.trim();
        const method = document.getElementById('pay-method').value;
        const notes = document.getElementById('pay-notes').value.trim();

        if (!amount) { Utils.showToast("أدخل المبلغ المحول", "error"); return; }

        const { error } = await sbClient.from('payments').insert([{
            waseet_id: this.currentUserId,
            amount: parseFloat(amount),
            method: method,
            notes: notes,
            status: 'pending'
        }]);

        if (error) { Utils.showToast("فشل إرسال الطلب", "error"); return; }
        Utils.showToast("تم إرسال طلب التجديد للإدارة بنجاح", "success");
        document.getElementById('pay-amount').value = '';
        document.getElementById('pay-notes').value = '';
        await this.loadSubscriptionAndReferrals();
    },

    copyReferralCode() {
        const codeInput = document.getElementById('my-referral-code');
        codeInput.select();
        navigator.clipboard.writeText(codeInput.value);
        Utils.showToast("تم نسخ كود الإحالة!", "success");
    }
};
