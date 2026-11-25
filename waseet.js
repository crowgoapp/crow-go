const waseetApp = {
    currentUserId: "",
    profile: null,
    products: [],
    orders: [],
    posterPages: [],
    posterObjectUrls: [],
    MAX_IMAGES_PER_PRODUCT: 6,
    MAX_ITEMS_PER_POSTER_PAGE: 8,

    async initWaseetSession(userId, profileData) {
        this.currentUserId = userId;
        this.profile = profileData;
        router.showScreen('waseet-dashboard');

        const welcomeEl = document.getElementById('waseet-welcome-text');
        if (welcomeEl) {
            welcomeEl.innerText = `أهلاً بك يا ${this.profile?.name || ''}`;
        }

        this.switchTab('products');
    },

    switchTab(tabName) {
        ['products', 'orders', 'sub'].forEach(t => {
            const tabEl = document.getElementById(`waseet-tab-${t}`);
            const btnEl = document.getElementById(`tab-btn-${t}`);
            if (tabEl) tabEl.classList.add('hidden');
            if (btnEl) btnEl.classList.remove('active');
        });

        const activeTab = document.getElementById(`waseet-tab-${tabName}`);
        const activeBtn = document.getElementById(`tab-btn-${tabName}`);
        if (activeTab) activeTab.classList.remove('hidden');
        if (activeBtn) activeBtn.classList.add('active');

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

    updateSubscriptionGateUI() {
        const banner = document.getElementById('sub-expired-banner');
        const addBtn = document.getElementById('add-product-btn');
        const posterBtn = document.getElementById('generate-poster-btn');
        const addOrderBtn = document.getElementById('add-order-btn');
        if (!banner) return;

        const active = this.isSubscriptionActive();
        const daysLeft = this.daysUntilExpiry();

        [addBtn, posterBtn, addOrderBtn].forEach(btn => {
            if (btn) btn.disabled = !active;
        });

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
        if (!container) return;
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
            container.innerHTML = `<p class="text-center text-error">${Utils.escapeHtml(Utils.translateError(e))}</p>`;
        }
    },

    renderProducts() {
        const container = document.getElementById('products-list-container');
        if (!container) return;

        if (this.products.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">لا توجد عروض مسجلة بعد. اضغط "+ إضافة عرض" للبدء.</p>';
            return;
        }

        container.innerHTML = this.products.map((p) => {
            const safeName = Utils.escapeHtml(p.name);
            const safeSerial = Utils.escapeHtml(p.serial ?? '');
            const safePrice = Number(p.price || 0).toLocaleString('ar-EG');
            const safeDesc = Utils.escapeHtml(p.description || '');
            const safeOwner = Utils.escapeHtml(p.owner_name || 'غير مسجل');
            const safeOwnerPhone = Utils.escapeHtml(p.owner_phone || '');
            const checkedAttr = p.selected_for_catalog ? 'checked' : '';

            let thumbsHtml = '';
            if (Array.isArray(p.product_images) && p.product_images.length > 0) {
                const imgsMarkup = p.product_images.map((img) => {
                    const { data: urlData } = sbClient.storage
                        .from('product-images')
                        .getPublicUrl(img.storage_path);
                    if (!urlData || !urlData.publicUrl) return '';
                    return `
                        <div class="thumb-wrap">
                            <img src="${Utils.escapeHtml(urlData.publicUrl)}" alt="${safeName}" class="thumb-img" loading="lazy" />
                            <button type="button"
                                class="thumb-delete"
                                title="حذف الصورة"
                                data-action="delete-img"
                                data-img-id="${Utils.escapeHtml(img.id)}"
                                data-storage-path="${Utils.escapeHtml(img.storage_path)}">✕</button>
                        </div>`;
                }).join('');

                if (imgsMarkup) {
                    thumbsHtml = `<div class="thumb-row">${imgsMarkup}</div>`;
                }
            }

            return `
                <div class="product-card" data-product-id="${Utils.escapeHtml(p.id)}">
                    <div class="product-card-head">
                        <label class="product-select-label">
                            <input type="checkbox"
                                ${checkedAttr}
                                data-action="toggle-catalog"
                                data-product-id="${Utils.escapeHtml(p.id)}"
                                class="product-select-checkbox" />
                            <span>كود #${safeSerial} - ${safeName}</span>
                        </label>
                        <span class="product-price-badge">${safePrice} ج.م</span>
                    </div>
                    ${safeDesc ? `<div class="product-desc">${safeDesc}</div>` : ''}
                    ${thumbsHtml}
                    <div class="product-owner-box">
                        🔒 المالك: <b>${safeOwner}</b> ${safeOwnerPhone ? `(${safeOwnerPhone})` : ''}
                    </div>
                    <div class="product-actions-row">
                        <button type="button" data-action="edit-product" data-product-id="${Utils.escapeHtml(p.id)}" class="btn-card-action btn-edit">✏️ تعديل</button>
                        <button type="button" data-action="delete-product" data-product-id="${Utils.escapeHtml(p.id)}" class="btn-card-action btn-delete">🗑️ حذف</button>
                    </div>
                </div>`;
        }).join('');

        this.bindProductsEvents(container);
    },

    bindProductsEvents(container) {
        if (container.dataset.bound === '1') return;
        container.dataset.bound = '1';

        container.addEventListener('change', async (e) => {
            const target = e.target;
            if (target && target.dataset.action === 'toggle-catalog') {
                await this.toggleCatalogSelect(target.dataset.productId, target.checked);
            }
        });

        container.addEventListener('click', async (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            if (action === 'edit-product') {
                this.openEditProductModal(btn.dataset.productId);
            } else if (action === 'delete-product') {
                await Utils.withBusy(btn, () => this.deleteProduct(btn.dataset.productId));
            } else if (action === 'delete-img') {
                await this.deleteProductImage(btn.dataset.imgId, btn.dataset.storagePath, btn);
            }
        });
    },

    async toggleCatalogSelect(productId, isSelected) {
        try {
            const { error } = await sbClient
                .from('products')
                .update({ selected_for_catalog: isSelected })
                .eq('id', productId)
                .eq('owner_id', this.currentUserId);

            if (error) throw error;
            const prod = this.products.find(x => String(x.id) === String(productId));
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
        const p = this.products.find(x => String(x.id) === String(productId));
        if (!p) return;
        document.getElementById('prod-modal-title').innerText = `تعديل العرض #${p.serial ?? ''}`;
        document.getElementById('prod-edit-id').value = p.id;
        document.getElementById('prod-name').value = p.name || '';
        document.getElementById('prod-price').value = p.price ?? '';
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

    async compressImage(file, maxW = 1280, quality = 0.8) {
        const bmp = await createImageBitmap(file);
        const scale = Math.min(1, maxW / bmp.width);
        const c = document.createElement('canvas');
        c.width = Math.round(bmp.width * scale);
        c.height = Math.round(bmp.height * scale);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        return await new Promise(r => c.toBlob(r, 'image/webp', quality));
    },

    async saveProduct(btn = null) {
        const editId = document.getElementById('prod-edit-id').value;
        const name = document.getElementById('prod-name').value.trim();
        const priceRaw = Utils.normalizeDigits(document.getElementById('prod-price').value.trim());
        const desc = document.getElementById('prod-desc').value.trim();
        const ownerName = document.getElementById('prod-owner-name').value.trim();
        const ownerPhone = Utils.normalizeDigits(document.getElementById('prod-owner-phone').value.trim());
        const ownerAddress = document.getElementById('prod-owner-address').value.trim();
        const imageFiles = document.getElementById('prod-images').files;

        if (!name || !priceRaw || isNaN(parseFloat(priceRaw))) {
            Utils.showToast('أدخل اسم العرض والسعر بشكل صحيح', 'error');
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

        await Utils.withBusy(btn, async () => {
            let targetProductId = editId;

            if (editId) {
                const { error } = await sbClient
                    .from('products')
                    .update({
                        name: name,
                        price: parseFloat(priceRaw),
                        description: desc,
                        owner_name: ownerName,
                        owner_phone: ownerPhone,
                        owner_address: ownerAddress
                    })
                    .eq('id', editId)
                    .eq('owner_id', this.currentUserId);

                if (error) throw error;
            } else {
                const { data: prodData, error: prodError } = await sbClient
                    .from('products')
                    .insert([{
                        owner_id: this.currentUserId,
                        name: name,
                        price: parseFloat(priceRaw),
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

                    const { error: imgInsertError } = await sbClient
                        .from('product_images')
                        .insert([{
                            product_id: targetProductId,
                            owner_id: this.currentUserId,
                            storage_path: fileName,
                            sort_order: i
                        }]);
                    if (imgInsertError) console.error('image row insert failed', imgInsertError);
                }
            }

            Utils.showToast('تم حفظ العرض بنجاح!', 'success');
            this.closeProductModal();
            await this.loadProducts();
        });
    },

    async deleteProductImage(imageId, storagePath, btn) {
        const ok = await Utils.confirmDialog('حذف هذه الصورة؟');
        if (!ok) return;
        await Utils.withBusy(btn, async () => {
            if (storagePath) {
                const { error: storageError } = await sbClient.storage.from('product-images').remove([storagePath]);
                if (storageError) console.error('storage remove failed', storageError);
            }

            const { error } = await sbClient
                .from('product_images')
                .delete()
                .eq('id', imageId)
                .eq('owner_id', this.currentUserId);

            if (error) throw error;
            await this.loadProducts();
        });
    },

    async deleteProduct(productId) {
        const ok = await Utils.confirmDialog('هل أنت متأكد من حذف هذا العرض نهائياً؟');
        if (!ok) return;

        const product = this.products.find(x => String(x.id) === String(productId));
        const paths = ((product && product.product_images) || [])
            .map(img => img.storage_path)
            .filter(Boolean);

        if (paths.length > 0) {
            const { error: storageError } = await sbClient.storage.from('product-images').remove(paths);
            if (storageError) console.error('storage cleanup failed', storageError);
        }

        const { error } = await sbClient
            .from('products')
            .delete()
            .eq('id', productId)
            .eq('owner_id', this.currentUserId);

        if (error) throw error;
        Utils.showToast('تم حذف العرض', 'success');
        await this.loadProducts();
    },

    // ================= 2. توليد بوستر الكتالوج المجمع كصورة =================
    clearPosterUrls() {
        if (Array.isArray(this.posterObjectUrls)) {
            this.posterObjectUrls.forEach(url => URL.revokeObjectURL(url));
        }
        this.posterObjectUrls = [];
    },

    closePosterPreviewModal() {
        this.clearPosterUrls();
        const modal = document.getElementById('poster-preview-modal');
        if (modal) modal.classList.add('hidden');
    },

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

        Utils.showToast('جاري تجهيز صفحات المجلة...', 'success');

        const phoneEl = document.getElementById('poster-waseet-phone');
        if (phoneEl) phoneEl.innerText = this.profile?.phone || '';

        const userName =
            this.profile?.name?.trim() ||
            this.profile?.full_name?.trim() ||
            this.profile?.username?.trim() ||
            this.profile?.display_name?.trim() ||
            (this.profile?.email ? this.profile.email.split('@')[0] : '') ||
            this.profile?.phone ||
            '';

        const titleEl = document.getElementById('poster-exhibition-title');
        if (titleEl) {
            titleEl.innerText = userName ? `معرض ${userName}` : 'معرضي';
        }

        const wrapper = document.getElementById('poster-canvas-wrapper');
        const subtitleEl = document.getElementById('poster-subtitle');
        const grid = document.getElementById('poster-items-grid');
        this.posterPages = [];

        try {
            for (let pageIndex = 0; pageIndex < selectedItems.length; pageIndex++) {
                const item = selectedItems[pageIndex];
                if (subtitleEl) {
                    subtitleEl.innerText = '';
                    subtitleEl.style.display = 'none';
                }

                let imagesHtml = '';
                if (item.product_images && item.product_images.length > 0) {
                    imagesHtml = item.product_images
                        .map((imgObj) => {
                            const { data: urlData } = sbClient.storage
                                .from('product-images')
                                .getPublicUrl(imgObj.storage_path);
                            return urlData && urlData.publicUrl
                                ? `<img src="${Utils.escapeHtml(urlData.publicUrl)}" crossorigin="anonymous" />`
                                : '';
                        })
                        .filter(Boolean)
                        .join('');
                }

                grid.innerHTML = `
                    <div class="poster-item poster-item-single">
                        ${imagesHtml ? `<div class="poster-item-images">${imagesHtml}</div>` : `<div class="poster-item-noimg">بدون صورة</div>`}
                        <div class="poster-item-code">كود #${Utils.escapeHtml(item.serial ?? '')}</div>
                        <div class="poster-item-name">${Utils.escapeHtml(item.name)}</div>
                        ${item.description ? `<div class="poster-item-desc">${Utils.escapeHtml(item.description)}</div>` : ''}
                        <div class="poster-item-price">${Number(item.price || 0).toLocaleString('ar-EG')} ج.م</div>
                    </div>
                `;

                const imgs = Array.from(wrapper.querySelectorAll('img'));
                await Promise.all(
                    imgs.map((img) =>
                        img.complete
                            ? Promise.resolve()
                            : new Promise((res) => {
                                  img.onload = res;
                                  img.onerror = res;
                              })
                    )
                );

                const canvas = await html2canvas(wrapper, { useCORS: true, scale: 1.5 });
                const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
                if (blob) this.posterPages.push(blob);
            }

            this.renderPosterPreview();
            document.getElementById('poster-preview-modal').classList.remove('hidden');
        } catch (e) {
            console.error(e);
            Utils.showToast('تعذّر توليد صفحات المجلة. جرّب تقليل عدد العروض المحددة، وحاول تاني.', 'error');
        }
    },

    renderPosterPreview() {
        const container = document.getElementById('poster-pages-container');
        if (!container) return;

        this.clearPosterUrls();
        container.innerHTML = '';

        if (this.posterPages.length > 1) {
            const shareAllBox = document.createElement('div');
            shareAllBox.className = 'poster-preview-page';
            shareAllBox.innerHTML = `
                <div class="poster-preview-actions">
                    <button type="button" class="btn" data-action="share-all">📤 مشاركة كل الصفحات معاً (${this.posterPages.length})</button>
                </div>
            `;
            container.appendChild(shareAllBox);
        }

        this.posterPages.forEach((blob, idx) => {
            const url = URL.createObjectURL(blob);
            this.posterObjectUrls.push(url);

            const pageDiv = document.createElement('div');
            pageDiv.className = 'poster-preview-page';
            pageDiv.innerHTML = `
                <img src="${Utils.escapeHtml(url)}" alt="صفحة ${idx + 1}" class="poster-preview-img" />
                <div class="poster-preview-actions">
                    <button type="button" class="btn" data-action="share-page" data-page-index="${idx}">📤 مشاركة صفحة ${idx + 1}</button>
                    <a href="${Utils.escapeHtml(url)}" download="CrowGo-Magazine-Page-${idx + 1}.jpg" class="btn btn-secondary poster-download-link">⬇️ تحميل</a>
                </div>
            `;
            container.appendChild(pageDiv);
        });

        if (container.dataset.bound !== '1') {
            container.dataset.bound = '1';
            container.addEventListener('click', async (e) => {
                const btn = e.target.closest('button[data-action]');
                if (!btn) return;
                if (btn.dataset.action === 'share-all') {
                    await this.shareAllPosterPages();
                } else if (btn.dataset.action === 'share-page') {
                    await this.sharePosterPage(Number(btn.dataset.pageIndex));
                }
            });
        }
    },

    async shareAllPosterPages() {
        if (!this.posterPages || this.posterPages.length === 0) return;

        const files = this.posterPages.map(
            (blob, idx) => new File([blob], `CrowGo-Magazine-Page-${idx + 1}.jpg`, { type: 'image/jpeg' })
        );

        try {
            if (navigator.canShare && navigator.canShare({ files })) {
                await navigator.share({
                    files,
                    title: 'مجلة عروضي'
                });
            } else {
                Utils.showToast('مشاركة كل الصور دفعة واحدة مش مدعومة هنا، استخدم مشاركة كل صفحة أو التحميل', 'error');
            }
        } catch (e) {
            if (e && e.name !== 'AbortError') {
                console.error(e);
                Utils.showToast('تعذّرت مشاركة الكل دفعة واحدة، جرّب مشاركة الصفحات واحدة واحدة', 'error');
            }
        }
    },

    async sharePosterPage(pageIndex) {
        const blob = this.posterPages[pageIndex];
        if (!blob) return;
        const file = new File([blob], `CrowGo-Magazine-Page-${pageIndex + 1}.jpg`, { type: 'image/jpeg' });

        try {
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: `مجلة عروضي - صفحة ${pageIndex + 1}` });
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
        if (!container) return;
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
            container.innerHTML = `<p class="text-error">${Utils.escapeHtml(Utils.translateError(e))}</p>`;
        }
    },

    renderOrders() {
        const container = document.getElementById('orders-list-container');
        if (!container) return;

        if (this.orders.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">لا توجد طلبات مسجلة حالياً.</p>';
            return;
        }

        const statusLabels = {
            'new': '<span class="badge badge-new">جديد</span>',
            'contacted': '<span class="badge badge-contacted">تم التواصل</span>',
            'done': '<span class="badge badge-done">مكتمل</span>'
        };

        container.innerHTML = this.orders.map(o => `
            <div class="order-card" data-order-id="${Utils.escapeHtml(o.id)}">
                <div class="order-card-head">
                    <b>${Utils.escapeHtml(o.item_needed)}</b>
                    ${statusLabels[o.status] || ''}
                </div>
                <div class="order-client-line">👤 ${Utils.escapeHtml(o.client_name)} — 📞 ${Utils.escapeHtml(o.client_phone)}</div>
                ${o.client_address ? `<div class="order-address-line">📍 ${Utils.escapeHtml(o.client_address)}</div>` : ''}
                <div class="order-actions-row">
                    <button type="button" data-action="status-contacted" data-order-id="${Utils.escapeHtml(o.id)}" class="btn-order-action btn-order-contacted">تم التواصل</button>
                    <button type="button" data-action="status-done" data-order-id="${Utils.escapeHtml(o.id)}" class="btn-order-action btn-order-done">مكتمل</button>
                    <button type="button" data-action="delete-order" data-order-id="${Utils.escapeHtml(o.id)}" class="btn-order-action btn-order-delete">🗑️</button>
                </div>
            </div>
        `).join('');

        this.bindOrdersEvents(container);
    },

    bindOrdersEvents(container) {
        if (container.dataset.bound === '1') return;
        container.dataset.bound = '1';

        container.addEventListener('click', async (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;

            const orderId = btn.dataset.orderId;
            const action = btn.dataset.action;

            if (action === 'status-contacted') {
                await this.updateOrderStatus(orderId, 'contacted');
            } else if (action === 'status-done') {
                await this.updateOrderStatus(orderId, 'done');
            } else if (action === 'delete-order') {
                await Utils.withBusy(btn, () => this.deleteOrder(orderId));
            }
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

    async saveNewOrder(btn = null) {
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

        await Utils.withBusy(btn, async () => {
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
        });
    },

    async updateOrderStatus(orderId, newStatus) {
        try {
            const { error } = await sbClient
                .from('orders')
                .update({ status: newStatus })
                .eq('id', orderId)
                .eq('owner_id', this.currentUserId);

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

        const { error } = await sbClient
            .from('orders')
            .delete()
            .eq('id', orderId)
            .eq('owner_id', this.currentUserId);

        if (error) throw error;
        await this.loadOrders();
    },

    // ================= 4. الاشتراك وطلبات التجديد والإحالات =================
    async loadSubscriptionAndReferrals() {
        try {
            const { data: freshProfile, error: profileError } = await sbClient
                .from('profiles')
                .select('*')
                .eq('id', this.currentUserId)
                .single();

            if (profileError) throw profileError;
            if (freshProfile) this.profile = freshProfile;

            this.updateSubscriptionGateUI();

            const subBox = document.getElementById('subscription-info-box');
            const hasEnd = !!this.profile?.subscription_end;
            const isExpired = hasEnd ? new Date(this.profile.subscription_end) <= new Date() : true;
            const endLabel = hasEnd
                ? new Date(this.profile.subscription_end).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
                : 'غير محدد';

            if (subBox) {
                subBox.innerHTML = `
                    <div class="sub-status-line">حالة الاشتراك الحالي: ${isExpired ? '<span class="text-error">منتهي ⛔</span>' : '<span class="text-success">نشط ✅</span>'}</div>
                    <div class="sub-end-line">ينتهي في: <b>${Utils.escapeHtml(endLabel)}</b></div>
                `;
            }

            const { data: payments, error: payError } = await sbClient
                .from('payments')
                .select('*')
                .eq('waseet_id', this.currentUserId)
                .order('created_at', { ascending: false });

            if (payError) throw payError;

            const payContainer = document.getElementById('payments-history-container');
            if (payContainer) {
                if (payments && payments.length > 0) {
                    const rowsHtml = payments.map(pay => {
                        const st = pay.status === 'confirmed' ? 'مؤكد ✅' : (pay.status === 'rejected' ? 'مرفوض ❌' : 'قيد المراجعة ⏳');
                        const amount = Number(pay.amount || 0).toLocaleString('ar-EG');
                        return `<div class="payment-history-row">${Utils.escapeHtml(amount)} ج.م (${Utils.escapeHtml(pay.method)}) — <b>${st}</b></div>`;
                    }).join('');
                    payContainer.innerHTML = `<div class="payments-history-title">طلبات التجديد السابقة:</div>${rowsHtml}`;
                } else {
                    payContainer.innerHTML = '';
                }
            }

            const refCodeInput = document.getElementById('my-referral-code');
            if (refCodeInput) refCodeInput.value = this.profile?.referral_code || '';

            const { count, error: countError } = await sbClient
                .from('referrals')
                .select('*', { count: 'exact', head: true })
                .eq('referrer_id', this.currentUserId);

            if (countError) throw countError;

            const refCount = count || 0;
            let refText;
            if (refCount > 0 && refCount % 5 === 0) {
                refText = `🎉 مبروك! عدد إحالاتك ${refCount} وكسبت أسبوع مجاني إضافي.`;
            } else {
                const remainder = 5 - (refCount % 5);
                refText = `عدد إحالاتك الناجحة: ${refCount} (متبقي ${remainder} للحصول على أسبوع مجاني إضافي)`;
            }

            const refCountEl = document.getElementById('referrals-count-text');
            if (refCountEl) refCountEl.innerText = refText;
        } catch (e) {
            console.error(e);
            Utils.showToast(Utils.translateError(e), 'error');
        }
    },

    async submitPaymentRequest(btn = null) {
        const amountRaw = Utils.normalizeDigits(document.getElementById('pay-amount').value.trim());
        const method = document.getElementById('pay-method').value;
        const notes = document.getElementById('pay-notes').value.trim();

        const numericAmount = parseFloat(amountRaw);
        if (!amountRaw || isNaN(numericAmount) || numericAmount <= 0) {
            Utils.showToast('أدخل المبلغ المحول بشكل صحيح', 'error');
            return;
        }

        await Utils.withBusy(btn, async () => {
            const { error } = await sbClient.from('payments').insert([{
                waseet_id: this.currentUserId,
                amount: numericAmount,
                method: method,
                notes: notes,
                status: 'pending'
            }]);

            if (error) throw error;
            Utils.showToast('تم إرسال طلب التجديد للإدارة بنجاح', 'success');
            document.getElementById('pay-amount').value = '';
            document.getElementById('pay-notes').value = '';
            await this.loadSubscriptionAndReferrals();
        });
    },

    async copyReferralCode() {
        const codeInput = document.getElementById('my-referral-code');
        if (!codeInput) return;
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
        const code = document.getElementById('my-referral-code')?.value;
        if (!code) return;
        const text = encodeURIComponent(`انضم لمنصة Crow Go للوسطاء واستخدم كود الإحالة بتاعي: ${code}`);
        window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
    }
};
