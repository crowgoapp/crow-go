let localProducts = [];
let localOrders = [];
let currentWaseetPhone = "01000000000";
let currentWaseetName = "الوسيط";
let currentTempProductImages = [];
let generatedCatalogImageFiles = [];

function loginAsWaseetDirectly(phone, waseetName) {
    currentWaseetPhone = phone;
    currentWaseetName = waseetName;
    if(!localStorage.getItem('crow_waseet_name_' + phone)) localStorage.setItem('crow_waseet_name_' + phone, waseetName);
    if(!localStorage.getItem('crow_sub_start_' + phone)) {
        let today = new Date().toISOString().split('T')[0];
        let weekLater = new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];
        localStorage.setItem('crow_sub_start_' + phone, today);
        localStorage.setItem('crow_sub_end_' + phone, weekLater);
    }
    showScreen('waseet-dashboard');
    let welcomeEl = document.getElementById('waseet-welcome-text');
    if(welcomeEl) welcomeEl.innerText = `أهلاً بك يا ${waseetName}`;
    
    let savedLogo = localStorage.getItem('crow_platform_logo');
    let logoContainer = document.getElementById('waseet-top-logo-container');
    if (savedLogo && logoContainer) logoContainer.innerHTML = `<img src="${savedLogo}" class="logo-img" alt="Logo">`;
    
    let rewardMsg = localStorage.getItem('crow_reward_msg_' + phone);
    if(rewardMsg) { alert(rewardMsg); localStorage.removeItem('crow_reward_msg_' + phone); }
    
    updateWaseetReferralDisplay(phone);
    updateWaseetSubscriptionUI(phone);
    loadLocalData(phone);
}

function updateWaseetSubscriptionUI(phone) {
    let start = localStorage.getItem('crow_sub_start_' + phone) || '2026-11-01';
    let end = localStorage.getItem('crow_sub_end_' + phone) || '2026-12-01';
    let refs = localStorage.getItem('crow_refs_' + phone) || '0';
    
    let sEl = document.getElementById('sub-start-date');
    let eEl = document.getElementById('sub-end-date');
    let rEl = document.getElementById('referral-progress-count');
    if(sEl) sEl.innerText = start;
    if(eEl) eEl.innerText = end;
    if(rEl) rEl.innerText = refs;

    let diffDays = Math.ceil((new Date(end) - new Date()) / (1000 * 60 * 60 * 24));
    let badge = document.getElementById('sub-status-badge');
    if(badge) {
        badge.className = diffDays > 0 ? "badge-green" : "badge-red";
        badge.innerText = diffDays > 0 ? `نشط (${diffDays} يوم)` : "منتهي";
    }
}

function getWaseetReferralCode(phone) {
    let cleanPhone = phone ? phone.replace(/\D/g, '') : '1234';
    return `CROW-${cleanPhone.slice(-4)}`;
}

function updateWaseetReferralDisplay(phone) {
    let codeEl = document.getElementById('waseet-ref-code-display');
    if (codeEl) codeEl.innerText = getWaseetReferralCode(phone);
}

function shareWaseetInviteWhatsApp() {
    let msg = `أهلاً بك 👋\nللتواصل مع مكتب (${currentWaseetName}) اذكر كود الإحالة:\n🔑 *كود الوسيط: ${getWaseetReferralCode(currentWaseetPhone)}*\n📞 ${currentWaseetPhone}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function switchWaseetTab(tab) {
    let isProd = tab === 'products';
    let pTab = document.getElementById('waseet-tab-products');
    let oTab = document.getElementById('waseet-tab-orders');
    let btnP = document.getElementById('tab-btn-products');
    let btnO = document.getElementById('tab-btn-orders');

    if(pTab) pTab.classList.toggle('hidden', !isProd);
    if(oTab) oTab.classList.toggle('hidden', isProd);
    if(btnP) { btnP.style.background = isProd ? 'var(--secondary-blue)' : '#e2e8f0'; btnP.style.color = isProd ? 'white' : 'var(--text-color)'; }
    if(btnO) { btnO.style.background = !isProd ? 'var(--secondary-blue)' : '#e2e8f0'; btnO.style.color = !isProd ? 'white' : 'var(--text-color)'; }
}

function loadLocalData(phone) {
    localProducts = JSON.parse(localStorage.getItem('crow_prods_' + phone) || '[]');
    localOrders = JSON.parse(localStorage.getItem('crow_orders_' + phone) || '[]');
    renderProducts(); renderOrders();
}

function saveToLocalStorage() {
    localStorage.setItem('crow_prods_' + currentWaseetPhone, JSON.stringify(localProducts));
    localStorage.setItem('crow_orders_' + currentWaseetPhone, JSON.stringify(localOrders));
}

function handleProductImagesUpload(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                let maxDim = 1000;
                if (w > maxDim || h > maxDim) {
                    if (w > h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
                    else { w = Math.round(w * (maxDim / h)); h = maxDim; }
                }
                canvas.width = w; canvas.height = h;
                let ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                currentTempProductImages.push({ data: canvas.toDataURL('image/jpeg', 0.85), inCatalog: true });
                renderTempImagesGallery();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
    event.target.value = '';
}

function renderTempImagesGallery() {
    let gallery = document.getElementById('prod-images-gallery');
    let badge = document.getElementById('prod-img-count-badge');
    if(badge) badge.innerText = currentTempProductImages.length;
    if(!gallery) return;
    gallery.innerHTML = '';
    currentTempProductImages.forEach((imgObj, idx) => {
        gallery.innerHTML += `<div style="position:relative; width:70px; height:70px; border:2px solid #10b981; border-radius:6px; overflow:hidden;">
            <img src="${imgObj.data}" style="width:100%; height:100%; object-fit:cover;">
            <button type="button" onclick="currentTempProductImages.splice(${idx},1); renderTempImagesGallery();" style="position:absolute; top:0; left:0; background:red; color:white; border:none; width:20px; height:20px; font-size:10px; cursor:pointer;">×</button>
        </div>`;
    });
}

function openNewProductModal() {
    document.getElementById('edit-prod-index').value = "-1";
    document.getElementById('prod-modal-title').innerText = "➕ إضافة منتج جديد";
    document.getElementById('prod-name').value = '';
    document.getElementById('prod-price').value = '';
    document.getElementById('prod-desc').value = '';
    document.getElementById('prod-owner-name').value = '';
    document.getElementById('prod-owner-phone').value = '';
    document.getElementById('prod-owner-address').value = '';
    currentTempProductImages = [];
    renderTempImagesGallery();
    document.getElementById('product-modal').classList.remove('hidden');
}

function openEditProductModal(index) {
    let p = localProducts[index];
    if(!p) return;
    document.getElementById('edit-prod-index').value = index;
    document.getElementById('prod-modal-title').innerText = `✏️ تعديل منتج (#${p.serial})`;
    document.getElementById('prod-name').value = p.name || '';
    document.getElementById('prod-price').value = p.price || '';
    document.getElementById('prod-desc').value = p.desc || '';
    document.getElementById('prod-owner-name').value = p.ownerName || '';
    document.getElementById('prod-owner-phone').value = p.ownerPhone || '';
    document.getElementById('prod-owner-address').value = p.ownerAddress || '';
    currentTempProductImages = Array.isArray(p.images) ? JSON.parse(JSON.stringify(p.images)) : [];
    renderTempImagesGallery();
    document.getElementById('product-modal').classList.remove('hidden');
}

function closeProductModal() { document.getElementById('product-modal').classList.add('hidden'); }

function saveProductFromModal() {
    let index = parseInt(document.getElementById('edit-prod-index').value, 10);
    let name = document.getElementById('prod-name').value.trim();
    let price = document.getElementById('prod-price').value.trim();
    let desc = document.getElementById('prod-desc').value.trim();
    let ownerName = document.getElementById('prod-owner-name').value.trim();
    let ownerPhone = document.getElementById('prod-owner-phone').value.trim();
    let ownerAddress = document.getElementById('prod-owner-address').value.trim();

    if(!name || !price) { alert("أدخل اسم المنتج والسعر!"); return; }

    if(isNaN(index) || index < 0) {
        let nextSerial = localProducts.length > 0 ? Math.max(...localProducts.map(i => i.serial)) + 1 : 1;
        localProducts.push({ serial: nextSerial, name, price, desc, images: JSON.parse(JSON.stringify(currentTempProductImages)), ownerName, ownerPhone, ownerAddress, selectedForCatalog: true });
    } else {
        localProducts[index].name = name;
        localProducts[index].price = price;
        localProducts[index].desc = desc;
        localProducts[index].images = JSON.parse(JSON.stringify(currentTempProductImages));
        localProducts[index].ownerName = ownerName;
        localProducts[index].ownerPhone = ownerPhone;
        localProducts[index].ownerAddress = ownerAddress;
    }
    saveToLocalStorage();
    renderProducts();
    closeProductModal();
}

function toggleCatalogSelection(index) {
    localProducts[index].selectedForCatalog = localProducts[index].selectedForCatalog !== false ? false : true;
    saveToLocalStorage();
}

function renderProducts() {
    let container = document.getElementById('products-list-container');
    if(!container) return;
    container.innerHTML = localProducts.length === 0 ? '<p style="text-align:center; color:#94a3b8;">لا توجد منتجات مسجلة.</p>' : '';
    localProducts.forEach((p, i) => {
        let isSelected = p.selectedForCatalog !== false;
        let cover = (p.images && p.images.length > 0) ? p.images[0].data : '';
        let imgTag = cover ? `<img src="${cover}" style="width:45px; height:45px; object-fit:cover; border-radius:6px;">` : '📦';
        container.innerHTML += `<div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:8px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; font-size:12px; gap:8px;">
            <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleCatalogSelection(${i})" style="width:18px; height:18px; cursor:pointer;" title="تضمين في الكتالوج">
            <div style="display:flex; align-items:center; gap:8px; flex:1;">
                ${imgTag}
                <div><b>#${p.serial} - ${p.name}</b> (${p.price} ج.م)<br><small style="color:#059669;">المالك: ${p.ownerName || 'غير مسجل'}</small></div>
            </div>
            <div style="display:flex; gap:4px;">
                <button class="btn-info" onclick="openEditProductModal(${i})" style="padding:5px 8px; margin:0; font-size:11px;">تعديل</button>
                <button class="btn-danger" onclick="deleteProduct(${i})" style="padding:5px 8px; margin:0; font-size:11px;">حذف</button>
            </div>
        </div>`;
    });
}

function deleteProduct(i) {
    if(confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
        localProducts.splice(i, 1);
        saveToLocalStorage();
        renderProducts();
    }
}

function openNewOrderModal() { document.getElementById('order-modal').classList.remove('hidden'); }
function closeOrderModal() { document.getElementById('order-modal').classList.add('hidden'); }

function saveOrderFromModal() {
    let itemNeeded = document.getElementById('order-item').value.trim();
    let clientName = document.getElementById('order-client-name').value.trim();
    let clientPhone = document.getElementById('order-client-phone').value.trim();
    let clientAddress = document.getElementById('order-client-address').value.trim();
    if(!itemNeeded || !clientName || !clientPhone) { alert("أكمل بيانات الطلب الأساسية"); return; }
    localOrders.push({ id: Date.now(), itemNeeded, clientName, clientPhone, clientAddress, date: new Date().toLocaleDateString('ar-EG') });
    saveToLocalStorage(); renderOrders(); closeOrderModal();
}

function renderOrders() {
    let container = document.getElementById('orders-list-container');
    if(!container) return;
    container.innerHTML = localOrders.length === 0 ? '<p style="text-align:center; color:#94a3b8;">لا توجد طلبات مسجلة.</p>' : '';
    localOrders.forEach((o, i) => {
        container.innerHTML += `<div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:8px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; font-size:12px;">
            <div><b>🛒 ${o.itemNeeded}</b><br><small style="color:#1b4982;">👤 ${o.clientName} (${o.clientPhone})</small></div>
            <button class="btn-danger" onclick="localOrders.splice(${i},1); saveToLocalStorage(); renderOrders();" style="padding:4px 8px; margin:0; font-size:11px;">حذف</button>
        </div>`;
    });
}

// محرك رسم وتوليد الكتالوج المصور
async function renderFlyerCanvas(product, waseetName) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1080;
    canvas.height = 1350;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1080, 1350);

    // هيدر الإعلان
    ctx.fillStyle = '#0d233a';
    ctx.fillRect(0, 0, 1080, 150);

    ctx.fillStyle = '#10b981';
    ctx.fillRect(850, 40, 200, 70);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`كود #${product.serial}`, 950, 88);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`👤 ${waseetName}`, 40, 95);

    // صورة المنتج الرئيسية
    let imgData = (product.images && product.images.length > 0) ? product.images[0].data : '';
    if (imgData) {
        await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                ctx.fillStyle = '#f1f5f9';
                ctx.fillRect(40, 180, 1000, 700);
                ctx.drawImage(img, 40, 180, 1000, 700);
                resolve();
            };
            img.onerror = () => resolve();
            img.src = imgData;
        });
    }

    // تفاصيل السلعة والأسعار
    ctx.fillStyle = '#0d233a';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(product.name, 1040, 950);

    ctx.fillStyle = '#059669';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText(`💰 السعر: ${product.price} ج.م`, 1040, 1020);

    if (product.desc) {
        ctx.fillStyle = '#475569';
        ctx.font = '32px sans-serif';
        ctx.fillText(`📝 ${product.desc.substring(0, 70)}`, 1040, 1090);
    }

    // فوتر الكتالوج
    ctx.fillStyle = '#1b4982';
    ctx.fillRect(0, 1230, 1080, 120);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`للاستعلام والمعاينة تواصل مع (${waseetName}) واذكر رقم الكود`, 540, 1300);

    return canvas.toDataURL('image/jpeg', 0.90);
}

async function openCatalogPreview() {
    let selectedProducts = localProducts.filter(p => p.selectedForCatalog !== false);
    if (selectedProducts.length === 0) {
        alert("يرجى اختيار وتحديد منتج واحد على الأقل من القائمة لتصديره في الكتالوج!");
        return;
    }

    let previewBox = document.getElementById('catalog-preview-content');
    previewBox.innerHTML = `<p style="text-align:center; color:#1b4982; font-weight:bold;">⏳ جاري تجهيز وبناء بوسترات الكتالوج المصورة...</p>`;
    document.getElementById('catalog-modal').classList.remove('hidden');

    generatedCatalogImageFiles = [];
    previewBox.innerHTML = '';

    for (const p of selectedProducts) {
        let dataUrl = await renderFlyerCanvas(p, currentWaseetName);
        
        // تحويل الـ DataURL إلى ملف لتسهيل المشاركة
        let blob = await (await fetch(dataUrl)).blob();
        let file = new File([blob], `code_${p.serial}.jpg`, { type: 'image/jpeg' });
        generatedCatalogImageFiles.push(file);

        previewBox.innerHTML += `<div style="margin-bottom:14px; border:1px solid #cbd5e1; border-radius:10px; overflow:hidden; background:#fff;">
            <img src="${dataUrl}" style="width:100%; display:block;">
            <a href="${dataUrl}" download="code_${p.serial}.jpg" style="display:block; text-align:center; background:#e2e8f0; color:#0d233a; padding:8px; font-size:13px; font-weight:bold; text-decoration:none;">⬇️ حفظ بوستر (كود #${p.serial}) في الاستوديو</a>
        </div>`;
    }
}

function closeCatalogModal() { document.getElementById('catalog-modal').classList.add('hidden'); }

async function shareCatalogWithImages() {
    if (generatedCatalogImageFiles.length === 0) { alert("لا توجد صور جاهزة للمشاركة!"); return; }

    if (navigator.canShare && navigator.canShare({ files: generatedCatalogImageFiles })) {
        try {
            await navigator.share({
                files: generatedCatalogImageFiles,
                title: `عروض ${currentWaseetName}`
            });
        } catch (err) {
            console.log("تم إلغاء المشاركة");
        }
    } else {
        alert("متصفح الموبايل لا يدعم المشاركة المباشرة للملفات دفعة واحدة، يمكنك الضغط على زر (⬇️ حفظ بوستر في الاستوديو) تحت كل صورة ثم إرسالها للزبائن عبر واتساب بكل سهولة!");
    }
}
