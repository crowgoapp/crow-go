const waseetApp = {
    currentUserId: "",
    profile: null,
    products: [],
    orders: [],
    posterPages: [],
    MAX_IMAGES_PER_PRODUCT: 6,
    MAX_ITEMS_PER_POSTER_PAGE: 8,

    async initWaseetSession(userId, profileData) {
        this.currentUserId = userId;
        this.profile = profileData;
        router.showScreen('waseet-dashboard');

        const welcomeEl = document.getElementById('waseet-welcome-text');
        if (welcomeEl) {
            // innerText بيتعامل مع النص كنص خام من غير تنفيذ HTML، فاستخدام
            // escapeHtml معاه كان بيعمل تعقيم مزدوج (ظهور &amp; بدل &) — L1
            welcomeEl.innerText = `أهلاً بك يا ${this.profile.name || ''}`;
        }

        this.switchTab('products');
        // ملحوظة: switchTab('products') بينادي loadProducts() بالفعل، فمفيش
        // داعي لنداء تاني هنا (كان بيحمّل العروض مرتين - M9).
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

    isSubscriptionActive() {
        if (!this.profile || !this.profile.subscription_end) return false;
        return new Date(this.profile.subscription_end) > new Date();
    },

    daysUntilExpiry() {
        if (!this.profile || !this.profile.subscription_end) return null;
        const diffMs = new Date(this.profile.subscription_end) - new Date();
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    },

    // يقفل أزرار الإضافة/البوستر لو الاشتراك منتهي، وبيحذر قبل الانتهاء بـ3 أيام
    // (يحل H1 على مستوى الواجهة — المنع الحقيقي في القاعدة عن طريق has_active_sub())
    updateSubscriptionGateUI() {
        const banner = document.getElementById('sub-expired-banner');
        const addBtn = document.getElementById('add-product-btn');
        const posterBtn = document.getElementById('generate-poster-btn');
        const addOrderBtn = document.getElementById('add-order-btn');
        if (!banner) return;

        const active = this.isSubscriptionActive();
        const daysLeft = this.daysUntilExpiry();

        [addBtn, posterBtn, addOrderBtn].forEach(btn => { if (btn) btn.disabled = !active; });

        if (!active) {
            banner.classList.remove('hidden');
            banner.className = 'sub-banner sub-banner-expired';
            banner.innerText = '⛔ اشتراكك منتهي. جدّد اشتراكك من تبويب "الاشتراك" عشان تقدر تضيف عروض أو تصدر بوستر (القراءة متاحة طول الوقت).';
        } else if (daysLeft !== null && daysLeft <= 3) {
            banner.classList.remove('hidden');
            banner.className = 'sub-banner sub-banner-warning';
            banner.innerText = `⚠️ اشتراكك هينتهي خلال ${daysLeft} يوم. جدّده بدري عشان ما ينقطعش عملك.`;
        } else {
            banner.classList.add('hidden');
        }
    },

    // ================= 1. إدارة المنتجات وتعدد الصور =================
    async loadProducts() {
        const container = document.getElementById('products-list-container');
        container.innerHTML = '<p class="text-center">جاري تحميل العروض...</p>';

        try {
            const { data, error } = await sbClient
                .from('products')
                .select('*, product_images(id, storage_path)')
                .eq('owner_id', this.currentUserId)
                .order('serial', { ascending: true });

            if (error) throw error;

            this.products = data || [];
            this.renderProducts();
            this.updateSubscriptionGateUI();
        } catch (e) {
            console.error(e);
            container.innerHTML = `<p class="text-center text-error">${Utils.translateError(e)}</p>`;
        }
    },

    renderProducts() {
        const container = document.getElementById('products-list-container');
        if (this.products.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">لا توجد عروض مسجلة بعد. اضغط "+ إضافة عرض" للبدء.</p>';
            return;
        }

        container.innerHTML = '';
        this.products.forEach((p) => {
            const safeName = Utils.escapeHtml(p.name);
            const safePrice = Number(p.price || 0).toLocaleString('ar-EG');
            const safeDesc = Utils.escapeHtml(p.description || '');
            const safeOwner = Utils.escapeHtml(p.owner_name || 'غير مسجل');
            const safeOwnerPhone = Utils.escapeHtml(p.owner_phone || '');

            let thumbsHtml = '';
            if (p.product_images && p.product_images.length > 0) {
                thumbsHtml = '<div class="thumb-row">';
                p.product_images.forEach(img => {
                    const { data: urlData } = sbClient.storage.from('product-images').getPublicUrl(img.storage_path);
                    if (urlData && urlData.publicUrl) {
                        thumbsHtml += `<div class="thumb-wrap">
                            <img src="${urlData.publicUrl}" class="thumb-img" />
                            <button type="button" class="thumb-delete" title="حذف الصورة"
                                onclick="waseetApp.deleteProductImage(${img.id}, '${img.storage_path.replace(/'/g, "\\'")}', ${p.id}, this)">✕</button>
                        </div>`;
                    }
                });
                thumbsHtml += '</div>';
            }

            const checkedAttr = p.selected_for_catalog ? 'checked' : '';

            container.innerHTML += `
                <div class="product-card">
                    <div class="product-card-head">
                        <label class="product-select-label">
                            <input type="checkbox" ${checkedAttr} onchange="waseetApp.toggleCatalogSelect(${p.id}, this.checked)" class="product-select-checkbox" />
                            <span>كود #${p.serial} - ${safeName}</span>
                        </label>
                        <span class="product-price-badge">${safePrice} ج.م</span>
                    </div>
                    ${safeDesc ? `<div class="product-desc">${safeDesc}</div>` : ''}
                    ${thumbsHtml}
                    <div class="product-owner-box">
                        🔒 المالك: <b>${safeOwner}</b> ${safeOwnerPhone ? `(${safeOwnerPhone})` : ''}
                    </div>
                    <div class="product-actions-row">
                        <button type="button" onclick="waseetApp.openEditProductModal(${p.id})" class="btn-card-action btn-edit">✏️ تعديل</button>
                        <button type="button" onclick="Utils.withBusy(this, () => waseetApp.deleteProduct(${p.id}))" class="btn-card-action btn-delete">🗑️ حذف</button>
                    </div>
                </div>`;
        });
    },

    async toggleCatalogSelect(productId, isSelected) {
        try {
            const { error } = await sbClient.from('products').update({ selected_for_catalog: isSelected }).eq('id', productId);
            if (error) throw error;
            const prod = this.products.find(x => x.id === productId);
            if (prod) prod.selected_for_catalog = isSelected;
        } catch (e) {
            console.error(e);
            Utils.showToast(Utils.translateError(e), 'error');
        }
    },

    openNewProductModal() {
        if (!this.isSubscriptionActive()) {
            Utils.showToast('اشتراكك منتهي، جدّده الأول من تبويب الاشتراك', 'error');
            return;
        }
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

    // تضغط الصورة لعرض 1280 بكسل وتحولها WebP قبل الرفع (تنزل من 3-8 ميجا
    // لحوالي 150-300 كيلو) — يحل M3
    async compressImage(file, maxW = 1280, quality = 0.8) {
        const bmp = await createImageBitmap(file);
        const scale = Math.min(1, maxW / bmp.width);
        const c = document.createElement('canvas');
        c.width = Math.round(bmp.width * scale);
        c.height = Math.round(bmp.height * scale);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        return await new Promise(r => c.toBlob(r, 'image/webp', quality));
    },

    async saveProduct() {
        const editId = document.getElementById('prod-edit-id').value;
        const name = document.getElementById('prod-name').value.trim();
        const price = document.getElementById('prod-price').value.trim();
        const desc = document.getElementById('prod-desc').value.trim();
        const ownerName = document.getElementById('prod-owner-name').value.trim();
        const ownerPhone = Utils.normalizeDigits(document.getElementById('prod-owner-phone').value.trim());
        const ownerAddress = document.getElementById('prod-owner-address').value.trim();
        const imageFiles = document.getElementById('prod-images').files;

        if (!name || !price) {
            Utils.showToast('أدخل اسم العرض والسعر', 'error');
            return;
        }
        if (ownerPhone && !Utils.validateEgyptianPhone(ownerPhone)) {
            Utils.showToast('رقم هاتف المالك غير صحيح', 'error');
            return;
        }
        if (imageFiles && imageFiles.length > this.MAX_IMAGES_PER_PRODUCT) {
            Utils.showToast(`أقصى عدد صور لكل عرض هو ${this.MAX_IMAGES_PER_PRODUCT}`, 'error');
            return;
        }

        try {
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

                if (error) throw error;
                targetProductId = editId;
            } else {
                // الكود التسلسلي بقى بيتولد في القاعدة (trigger في migration
                // 0001) بدل حسابه في المتصفح، عشان ميتكررش لو فاتح جهازين (M4).
                const { data: prodData, error: prodError } = await sbClient
                    .from('products')
                    .insert([{
                        owner_id: this.currentUserId,
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

                if (prodError) throw prodError;
                targetProductId = prodData.id;
            }

            if (imageFiles && imageFiles.length > 0 && targetProductId) {
                for (let i = 0; i < imageFiles.length; i++) {
                    const file = imageFiles[i];
                    const compressed = await this.compressImage(file).catch(() => file);
                    const fileName = `${this.currentUserId}/${targetProductId}/${Date.now()}_${i}.webp`;

                    const { error: uploadError } = await sbClient.storage
                        .from('product-images')
                        .upload(fileName, compressed, { contentType: 'image/webp' });

                    if (uploadError) {
                        console.error('upload failed', uploadError);
                        continue;
                    }

                    const { error: imgInsertError } = await sbClient.from('product_images').insert([{
                        product_id: targetProductId,
                        storage_path: fileName,
                        sort_order: i
                    }]);
                    if (imgInsertError) console.error('image row insert failed', imgInsertError);
                }
            }

            Utils.showToast('تم حفظ العرض بنجاح!', 'success');
            this.closeProductModal();
            await this.loadProducts();
        } catch (e) {
            console.error(e);
            Utils.showToast('خطأ في الحفظ: ' + Utils.translateError(e), 'error');
        }
    },

    // حذف صورة منفردة (كان مفيش أصلاً - M2)
    async deleteProductImage(imageId, storagePath, productId, btn) {
        const ok = await Utils.confirmDialog('حذف هذه الصورة؟');
        if (!ok) return;
        await Utils.withBusy(btn, async () => {
            const { error: storageError } = await sbClient.storage.from('product-images').remove([storagePath]);
            if (storageError) console.error('storage remove failed', storageError);

            const { error } = await sbClient.from('product_images').delete().eq('id', imageId);
            if (error) throw error;

            await this.loadProducts();
        });
    },

    // حذف العرض كان بيمسح السطر بس وبيسيب ملفات الصور في الـ Storage لأبد
    // (M2) — دلوقتي بنمسح الصور من Storage الأول.
    async deleteProduct(productId) {
        const ok = await Utils.confirmDialog('هل أنت متأكد من حذف هذا العرض نهائياً؟');
        if (!ok) return;

        try {
            const product = this.products.find(x => x.id === productId);
            const paths = (product && product.product_images || []).map(img => img.storage_path);
            if (paths.length > 0) {
                const { error: storageError } = await sbClient.storage.from('product-images').remove(paths);
                if (storageError) console.error('storage cleanup failed', storageError);
            }

            const { error } = await sbClient.from('products').delete().eq('id', productId);
            if (error) throw error;

            Utils.showToast('تم حذف العرض', 'success');
            await this.loadProducts();
        } catch (e) {
            console.error(e);
            Utils.showToast('فشل الحذف: ' + Utils.translateError(e), 'error');
        }
    },

    // ================= 2. توليد بوستر الكتالوج المجمع كصورة =================
    async generateCatalogPoster() {
        if (!this.isSubscriptionActive()) {
            Utils.showToast('اشتراكك منتهي، جدّده الأول من تبويب الاشتراك', 'error');
            return;
        }

        const selectedItems = this.products.filter(p => p.selected_for_catalog);
        if (selectedItems.length === 0) {
            Utils.showToast('حدد منتجاً واحداً على الأقل لوضعه في البوستر', 'error');
            return;
        }

        Utils.showToast('جاري تصميم بوستر الكتالوج...', 'success');

        // تقسيم البوستر لصفحات بحد أقصى 8 عروض لكل صورة — ده بيحل مخاطر حجم
        // الـ Canvas في Safari على الآيفون (حد أقصى حوالي 16.7 مليون بكسل) اللي
        // كانت بتخلي الصورة تطلع فاضية أو التطبيق يقفل (H6).
        const pages = [];
        for (let i = 0; i < selectedItems.length; i += this.MAX_ITEMS_PER_POSTER_PAGE) {
            pages.push(selectedItems.slice(i, i + this.MAX_ITEMS_PER_POSTER_PAGE));
        }

        document.getElementById('poster-waseet-phone').innerText = this.profile.phone || '';

        const wrapper = document.getElementById('poster-canvas-wrapper');
        const subtitleEl = document.getElementById('poster-subtitle');
        const grid = document.getElementById('poster-items-grid');
        this.posterPages = [];

        try {
            for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
                const pageItems = pages[pageIndex];
                subtitleEl.innerText = pages.length > 1
                    ? `عروض ${this.profile.profession || 'مميزة'} - ${this.profile.governorate || ''} (${pageIndex + 1}/${pages.length})`
                    : `عروض ${this.profile.profession || 'مميزة'} - ${this.profile.governorate || ''}`;

                grid.innerHTML = '';
                for (const item of pageItems) {
                    let imgUrl = '';
                    if (item.product_images && item.product_images.length > 0) {
                        const { data: urlData } = sbClient.storage.from('product-images').getPublicUrl(item.product_images[0].storage_path);
                        if (urlData && urlData.publicUrl) imgUrl = urlData.publicUrl;
                    }

                    grid.innerHTML += `
          <div class="poster-item">
            ${imgUrl ? `<img src="${imgUrl}" crossorigin="anonymous" />` : `<div class="poster-item-noimg">بدون صورة</div>`}
            <div class="poster-item-code">كود #${item.serial}</div>
            <div class="poster-item-name">${Utils.escapeHtml(item.name)}</div>
            ${item.description ? `<div class="poster-item-desc">${Utils.escapeHtml(item.description)}</div>` : ''}
            <div class="poster-item-price">${Number(item.price || 0).toLocaleString('ar-EG')} ج.م</div>
          </div>
        `;
                }

                const canvas = await html2canvas(wrapper, { useCORS: true, scale: 2 });
                const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
                this.posterPages.push(blob);
            }

            this.renderPosterPreview();
            document.getElementById('poster-preview-modal').classList.remove('hidden');
        } catch (e) {
            console.error(e);
            Utils.showToast('تعذّر توليد صورة البوستر. جرّب تقلل عدد العروض المحددة أو صور أصغر، وحاول تاني.', 'error');
        }
    },

    renderPosterPreview() {
        const container = document.getElementById('poster-pages-container');
        container.innerHTML = '';
        this.posterPages.forEach((blob, idx) => {
            const url = URL.createObjectURL(blob);
            const pageDiv = document.createElement('div');
            pageDiv.className = 'poster-preview-page';
            pageDiv.innerHTML = `
                <img src="${url}" class="poster-preview-img" />
                <div class="poster-preview-actions">
                    <button type="button" class="btn" onclick="waseetApp.sharePosterPage(${idx})">📤 مشاركة على واتساب</button>
                    <a href="${url}" download="CrowGo-Catalog-${idx + 1}.png" class="btn btn-secondary poster-download-link">⬇️ تحميل</a>
                </div>
            `;
            container.appendChild(pageDiv);
        });
    },

    // مشاركة مباشرة بـ Web Share API (أفضل من <a download> اللي مابيشتغلش
    // كويس على iOS أو جوه متصفح واتساب/فيسبوك الداخلي) مع بديل تحميل — H6
    async sharePosterPage(pageIndex) {
        const blob = this.posterPages[pageIndex];
        if (!blob) return;
        const file = new File([blob], `CrowGo-Catalog-${pageIndex + 1}.png`, { type: 'image/png' });

        try {
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'كتالوج عروضي' });
            } else {
                Utils.showToast('المشاركة المباشرة مش مدعومة في هذا المتصفح، استخدم زرار التحميل', 'error');
            }
        } catch (e) {
            if (e && e.name !== 'AbortError') {
                console.error(e);
                Utils.showToast('تعذّرت المشاركة، جرّب التحميل بدل منها', 'error');
            }
        }
    },

    // ================= 3. إدارة طلبات الزبائن =================
    async loadOrders() {
        const container = document.getElementById('orders-list-container');
        container.innerHTML = '<p class="text-center">جاري تحميل الطلبات...</p>';

        try {
            const { data, error } = await sbClient
                .from('orders')
                .select('*')
                .eq('owner_id', this.currentUserId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.orders = data || [];
            this.renderOrders();
        } catch (e) {
            console.error(e);
            container.innerHTML = `<p class="text-error">${Utils.translateError(e)}</p>`;
        }
    },

    renderOrders() {
        const container = document.getElementById('orders-list-container');
        if (this.orders.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">لا توجد طلبات مسجلة حالياً.</p>';
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
                <div class="order-card">
                    <div class="order-card-head">
                        <b>${Utils.escapeHtml(o.item_needed)}</b>
                        ${statusLabels[o.status] || ''}
                    </div>
                    <div class="order-client-line">👤 ${Utils.escapeHtml(o.client_name)} — 📞 ${Utils.escapeHtml(o.client_phone)}</div>
                    ${o.client_address ? `<div class="order-address-line">📍 ${Utils.escapeHtml(o.client_address)}</div>` : ''}
                    <div class="order-actions-row">
                        <button type="button" onclick="waseetApp.updateOrderStatus(${o.id}, 'contacted')" class="btn-order-action btn-order-contacted">تم التواصل</button>
                        <button type="button" onclick="waseetApp.updateOrderStatus(${o.id}, 'done')" class="btn-order-action btn-order-done">مكتمل</button>
                        <button type="button" onclick="Utils.withBusy(this, () => waseetApp.deleteOrder(${o.id}))" class="btn-order-action btn-order-delete">🗑️</button>
                    </div>
                </div>
            `;
        });
    },

    openNewOrderModal() {
        if (!this.isSubscriptionActive()) {
            Utils.showToast('اشتراكك منتهي، جدّده الأول من تبويب الاشتراك', 'error');
            return;
        }
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
        const clientPhone = Utils.normalizeDigits(document.getElementById('ord-client-phone').value.trim());
        const clientAddress = document.getElementById('ord-client-address').value.trim();

        if (!item || !clientName || !clientPhone) {
            Utils.showToast('أدخل الطلب واسم الزبون وهاتفه', 'error');
            return;
        }
        if (!Utils.validateEgyptianPhone(clientPhone)) {
            Utils.showToast('رقم هاتف الزبون غير صحيح', 'error');
            return;
        }

        try {
            const { error } = await sbClient.from('orders').insert([{
                owner_id: this.currentUserId,
                item_needed: item,
                client_name: clientName,
                client_phone: clientPhone,
                client_address: clientAddress,
                status: 'new'
            }]);

            if (error) throw error;
            Utils.showToast('تم تسجيل طلب الزبون', 'success');
            this.closeNewOrderModal();
            await this.loadOrders();
        } catch (e) {
            console.error(e);
            Utils.showToast('فشل حفظ الطلب: ' + Utils.translateError(e), 'error');
        }
    },

    async updateOrderStatus(orderId, newStatus) {
        try {
            const { error } = await sbClient.from('orders').update({ status: newStatus }).eq('id', orderId);
            if (error) throw error;
            Utils.showToast('تم تحديث حالة الطلب', 'success');
            await this.loadOrders();
        } catch (e) {
            console.error(e);
            Utils.showToast(Utils.translateError(e), 'error');
        }
    },

    async deleteOrder(orderId) {
        const ok = await Utils.confirmDialog('حذف هذا الطلب؟');
        if (!ok) return;
        try {
            const { error } = await sbClient.from('orders').delete().eq('id', orderId);
            if (error) throw error;
            await this.loadOrders();
        } catch (e) {
            console.error(e);
            Utils.showToast(Utils.translateError(e), 'error');
        }
    },

    // ================= 4. الاشتراك وطلبات التجديد والإحالات =================
    async loadSubscriptionAndReferrals() {
        try {
            const { data: freshProfile, error: profileError } = await sbClient.from('profiles').select('*').eq('id', this.currentUserId).single();
            if (profileError) throw profileError;
            if (freshProfile) this.profile = freshProfile;

            this.updateSubscriptionGateUI();

            const subBox = document.getElementById('subscription-info-box');
            const hasEnd = !!this.profile.subscription_end;
            const isExpired = hasEnd ? new Date(this.profile.subscription_end) <= new Date() : true;
            const endLabel = hasEnd
                ? new Date(this.profile.subscription_end).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
                : 'غير محدد';

            subBox.innerHTML = `
                <div class="sub-status-line">حالة الاشتراك الحالي: ${isExpired ? '<span class="text-error">منتهي ⛔</span>' : '<span class="text-success">نشط ✅</span>'}</div>
                <div class="sub-end-line">ينتهي في: <b>${endLabel}</b></div>
            `;

            const { data: payments, error: payError } = await sbClient.from('payments').select('*').eq('waseet_id', this.currentUserId).order('created_at', { ascending: false });
            if (payError) throw payError;

            const payContainer = document.getElementById('payments-history-container');
            if (payments && payments.length > 0) {
                payContainer.innerHTML = '<div class="payments-history-title">طلبات التجديد السابقة:</div>';
                payments.forEach(pay => {
                    const st = pay.status === 'confirmed' ? 'مؤكد ✅' : (pay.status === 'rejected' ? 'مرفوض ❌' : 'قيد المراجعة ⏳');
                    const amount = Number(pay.amount || 0).toLocaleString('ar-EG');
                    payContainer.innerHTML += `<div class="payment-history-row">${amount} ج.م (${Utils.escapeHtml(pay.method)}) — <b>${st}</b></div>`;
                });
            } else {
                payContainer.innerHTML = '';
            }

            document.getElementById('my-referral-code').value = this.profile.referral_code || '';
            const { count, error: countError } = await sbClient.from('referrals').select('*', { count: 'exact', head: true }).eq('referrer_id', this.currentUserId);
            if (countError) throw countError;

            const refCount = count || 0;
            // كان بيقول "متبقي 5" حتى لو الوسيط وصل بالظبط لـ5 أو 10 إحالات بدل
            // ما يهنّئه — H3c
            let refText;
            if (refCount > 0 && refCount % 5 === 0) {
                refText = `🎉 مبروك! عدد إحالاتك ${refCount} وكسبت أسبوع مجاني إضافي.`;
            } else {
                const remainder = 5 - (refCount % 5);
                refText = `عدد إحالاتك الناجحة: ${refCount} (متبقي ${remainder} للحصول على أسبوع مجاني إضافي)`;
            }
            document.getElementById('referrals-count-text').innerText = refText;
        } catch (e) {
            console.error(e);
            Utils.showToast(Utils.translateError(e), 'error');
        }
    },

    async submitPaymentRequest() {
        const amount = document.getElementById('pay-amount').value.trim();
        const method = document.getElementById('pay-method').value;
        const notes = document.getElementById('pay-notes').value.trim();

        if (!amount) { Utils.showToast('أدخل المبلغ المحول', 'error'); return; }

        try {
            const { error } = await sbClient.from('payments').insert([{
                waseet_id: this.currentUserId,
                amount: parseFloat(amount),
                method: method,
                notes: notes,
                status: 'pending'
            }]);

            if (error) throw error;
            Utils.showToast('تم إرسال طلب التجديد للإدارة بنجاح', 'success');
            document.getElementById('pay-amount').value = '';
            document.getElementById('pay-notes').value = '';
            await this.loadSubscriptionAndReferrals();
        } catch (e) {
            console.error(e);
            Utils.showToast('فشل إرسال الطلب: ' + Utils.translateError(e), 'error');
        }
    },

    async copyReferralCode() {
        const codeInput = document.getElementById('my-referral-code');
        codeInput.select();
        try {
            await navigator.clipboard.writeText(codeInput.value);
            Utils.showToast('تم نسخ كود الإحالة!', 'success');
        } catch (e) {
            console.error(e);
            Utils.showToast('تعذّر النسخ التلقائي، انسخ الكود يدوياً', 'error');
        }
    },

    shareReferralOnWhatsApp() {
        const code = document.getElementById('my-referral-code').value;
        if (!code) return;
        const text = encodeURIComponent(`انضم لمنصة Crow Go للوسطاء واستخدم كود الإحالة بتاعي: ${code}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
    }
};
