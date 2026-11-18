const waseetApp = {
    currentUserId: "",
    currentName: "",
    products: [],

    initWaseetSession(userId, name) {
        this.currentUserId = userId;
        this.currentName = name;
        router.showScreen('waseet-dashboard');
        
        const welcomeEl = document.getElementById('waseet-welcome-text');
        if (welcomeEl) {
            welcomeEl.innerText = `أهلاً بك يا ${Utils.escapeHtml(name)}`;
        }
        this.loadProducts();
    },

    async loadProducts() {
        const container = document.getElementById('products-list-container');
        if (!container) return;

        container.innerHTML = '<p style="text-align:center;">جاري تحميل المنتجات...</p>';

        const { data, error } = await supabase
            .from('products')
            .select('*, product_images(storage_path)')
            .eq('owner_id', this.currentUserId)
            .order('created_at', { ascending: false });

        if (error) {
            Utils.showToast("خطأ في تحميل المنتجات", "error");
            container.innerHTML = '<p style="text-align:center; color:red;">فشل التحميل</p>';
            return;
        }

        this.products = data || [];
        this.renderProducts();
    },

    renderProducts() {
        const container = document.getElementById('products-list-container');
        if (!container) return;

        if (this.products.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:#94a3b8;">لا توجد منتجات مسجلة بعد.</p>';
            return;
        }

        container.innerHTML = '';
        this.products.forEach((p) => {
            const safeName = Utils.escapeHtml(p.name);
            const safePrice = Utils.escapeHtml(p.price);
            
            // جلب رابط الصورة من Supabase Storage إن وجدت
            let imgHtml = '';
            if (p.product_images && p.product_images.length > 0) {
                const path = p.product_images[0].storage_path;
                const { data: publicUrlData } = supabase.storage.from('product-images').getPublicUrl(path);
                if (publicUrlData) {
                    imgHtml = `<img src="${publicUrlData.publicUrl}" style="width:50px; height:50px; object-fit:cover; border-radius:6px; float:left;" />`;
                }
            }

            container.innerHTML += `
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:8px; overflow:hidden;">
                    ${imgHtml}
                    <b>#${p.serial || 1} - ${safeName}</b> (${safePrice} ج.م)<br>
                    <small style="color:#059669;">حالة المنتج: فعال في الكتالوج</small>
                </div>`;
        });
    },

    openNewProductModal() {
        document.getElementById('product-modal').classList.remove('hidden');
    },

    closeNewProductModal() {
        document.getElementById('product-modal').classList.add('hidden');
    },

    async saveNewProduct() {
        const name = document.getElementById('prod-name').value.trim();
        const price = document.getElementById('prod-price').value.trim();
        const imageFile = document.getElementById('prod-image').files[0];

        if (!name || !price) {
            Utils.showToast("أدخل اسم المنتج والسعر", "error");
            return;
        }

        Utils.showToast("جاري حفظ المنتج...", "success");

        // 1. إضافة المنتج في جدول products
        const { data: prodData, error: prodError } = await supabase
            .from('products')
            .insert([{
                owner_id: this.currentUserId,
                serial: Math.floor(Math.random() * 1000),
                name: name,
                price: parseFloat(price)
            }])
            .select()
            .single();

        if (prodError) {
            Utils.showToast("خطأ في حفظ المنتج: " + prodError.message, "error");
            return;
        }

        // 2. رفع الصورة لو وجدت إلى Storage
        if (imageFile && prodData) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${this.currentUserId}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, imageFile);

            if (!uploadError) {
                await supabase.from('product_images').insert([{
                    product_id: prodData.id,
                    storage_path: filePath
                }]);
            }
        }

        Utils.showToast("تم حفظ المنتج بنجاح!", "success");
        this.closeNewProductModal();
        this.loadProducts();
    },

    openNewOrderModal() {
        Utils.showToast("نافذة تسجيل طلب جديدة قيد التطوير", "success");
    }
};
