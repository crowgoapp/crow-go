let localProducts = [];
let localOrders = [];
let currentWaseetPhone = "01000000000";
let currentWaseetName = "الوسيط";
let currentTempProductImages = [];
let generatedCatalogImageFiles = [];

function switchWaseetTab(tabName) {
    let prodDiv = document.getElementById('waseet-tab-products');
    let orderDiv = document.getElementById('waseet-tab-orders');
    let btnProd = document.getElementById('tab-btn-products');
    let btnOrder = document.getElementById('tab-btn-orders');

    if(tabName === 'products') {
        prodDiv.classList.remove('hidden');
        orderDiv.classList.add('hidden');
        btnProd.style.background = 'var(--secondary-blue)';
        btnProd.style.color = 'white';
        btnOrder.style.background = '#e2e8f0';
        btnOrder.style.color = 'var(--text-color)';
    } else {
        orderDiv.classList.remove('hidden');
        prodDiv.classList.add('hidden');
        btnOrder.style.background = 'var(--secondary-blue)';
        btnOrder.style.color = 'white';
        btnProd.style.background = '#e2e8f0';
        btnProd.style.color = 'var(--text-color)';
    }
}

// دخول مباشر للوسيط (من لوحة الأدمن) مع تفعيل اللوجو وتحديث بيانات الاشتراك والإحالات
function loginAsWaseetDirectly(phone, waseetName) {
    currentWaseetPhone = phone;
    currentWaseetName = waseetName || `وسيط (${phone})`;
    
    if(!localStorage.getItem('crow_waseet_name_' + phone)) {
        localStorage.setItem('crow_waseet_name_' + phone, currentWaseetName);
    }

    if(!localStorage.getItem('crow_sub_start_' + phone)) {
        let today = new Date().toISOString().split('T')[0];
        let weekLater = new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];
        localStorage.setItem('crow_sub_start_' + phone, today);
        localStorage.setItem('crow_sub_end_' + phone, weekLater);
    }

    document.getElementById('admin-dashboard').classList.add('hidden');
    document.getElementById('waseet-dashboard').classList.remove('hidden');
    
    document.getElementById('waseet-welcome-text').innerText = `أهلاً بك يا ${currentWaseetName}`;
    
    // عرض لوجو السوبر أدمن حصرياً في هيدر الوسيط
    let savedLogo = localStorage.getItem('crow_platform_logo');
    let logoContainer = document.getElementById('waseet-top-logo-container');
    if (savedLogo && logoContainer) {
        logoContainer.innerHTML = `<img src="${savedLogo}" class="logo-img" alt="Logo">`;
    }

    updateWaseetReferralDisplay(phone);
    updateWaseetSubscriptionUI(phone);
    loadLocalData(phone);
}

function updateWaseetSubscriptionUI(phone) {
    let start = localStorage.getItem('crow_sub_start_' + phone) || '2026-11-01';
    let end = localStorage.getItem('crow_sub_end_' + phone) || '2026-12-01';
    let refs = localStorage.getItem('crow_refs_' + phone) || '0';

    document.getElementById('sub-start-date').innerText = start;
    document.getElementById('sub-end-date').innerText = end;
    document.getElementById('referral-progress-count').innerText = refs;

    let endDate = new Date(end);
    let today = new Date();
    let diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    
    let badge = document.getElementById('sub-status-badge');
    if (diffDays > 0) {
        badge.className = "badge-green";
        badge.innerText = `نشط (${diffDays} يوم متبقي)`;
    } else {
        badge.className = "badge-red";
        badge.innerText = "منتهي الاشتراك";
    }
}

function getWaseetReferralCode(phone) {
    let cleanPhone = phone ? phone.replace(/\D/g, '') : '1234';
    let suffix = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : '1234';
    return `CROW-${suffix}`;
}

function updateWaseetReferralDisplay(phone) {
    let codeEl = document.getElementById('waseet-ref-code-display');
    if (codeEl) {
        codeEl.innerText = getWaseetReferralCode(phone);
    }
}

function shareWaseetInviteWhatsApp() {
    let refCode = getWaseetReferralCode(currentWaseetPhone);
    let waseetName = localStorage.getItem('crow_waseet_name_' + currentWaseetPhone) || currentWaseetName;

    let msg = `أهلاً بك 👋\n`;
    msg += `للتواصل المباشر مع مكتب ( ${waseetName} )\n`;
    msg += `أو طلب عقار/سلعة وخدمات الوساطة الميدانية، يرجى ذكر كود الإحالة الخاص بي:\n\n`;
    msg += `🔑 *كود الوسيط: ${refCode}*\n`;
    msg += `📞 رقم التواصل: ${currentWaseetPhone}\n\n`;
    msg += `يسعدنا خدمتكم دائماً!`;

    let encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
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
                const maxDim = 1200; 
                let width = img.width;
                let height = img.height;

                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round(height * (maxDim / width));
                        width = maxDim;
                    } else {
                        width = Math.round(width * (maxDim / height));
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                const highQualityBase64 = canvas.toDataURL('image/jpeg', 0.90);
                currentTempProductImages.push({
                    data: highQualityBase64,
                    inCatalog: true
                });
                renderTempImagesGallery();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
    event.target.value = '';
}

function renderTempImagesGallery() {
    const gallery = document.getElementById('prod-images-gallery');
    const countBadge = document.getElementById('prod-img-count-badge');
    if (countBadge) countBadge.innerText = currentTempProductImages.length;
    if (!gallery) return;

    gallery.innerHTML = '';

    currentTempProductImages.forEach((imgObj, idx) => {
        const card = document.createElement('div');
        card.style.cssText = `border: 2px solid ${imgObj.inCatalog ? '#10b981' : '#cbd5e1'}; border-radius: 8px; padding: 4px; background: #fff; text-align: center; width: 85px; position: relative;`;
        
        card.innerHTML = `
            <button type="button" onclick="removeTempImage(${idx})" style="position:absolute; top:-6px; left:-6px; background:#ef4444; color:white; border:none; border-radius:50%; width:22px; height:22px; font-size:12px; cursor:pointer; font-weight:bold; z-index:2;">×</button>
            <img src="${imgObj.data}" style="width:100%; height:65px; object-fit:cover; border-radius:5px; display:block; margin-bottom:4px;">
            <label style="font-size:10px; display:flex; align-items:center; justify-content:center; gap:3px; cursor:pointer; color:${imgObj.inCatalog ? '#059669' : '#64748b'}; font-weight:bold; margin:0;">
                <input type="checkbox" ${imgObj.inCatalog ? 'checked' : ''} onchange="toggleTempImageCatalog(${idx})" style="width:auto; margin:0;">
                في الكتالوج
            </label>
        `;
        gallery.appendChild(card);
    });
}

function toggleTempImageCatalog(idx) {
    currentTempProductImages[idx].inCatalog = !currentTempProductImages[idx].inCatalog;
    renderTempImagesGallery();
}

function removeTempImage(idx) {
    currentTempProductImages.splice(idx, 1);
    renderTempImagesGallery();
}

function openNewProductModal() {
    document.getElementById('edit-prod-index').value = "-1";
    document.getElementById('prod-img-file').value = '';
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
    const p = localProducts[index];
    if (!p) return;

    document.getElementById('edit-prod-index').value = String(index);
    document.getElementById('prod-img-file').value = '';
    document.getElementById('prod-modal-title').innerText = `✏️ معاينة وتعديل منتج (#${p.serial})`;
    document.getElementById('prod-name').value = p.name || '';
    document.getElementById('prod-price').value = p.price || '';
    document.getElementById('prod-desc').value = p.desc || '';
    document.getElementById('prod-owner-name').value = p.ownerName || '';
    document.getElementById('prod-owner-phone').value = p.ownerPhone || '';
    document.getElementById('prod-owner-address').value = p.ownerAddress || '';
    
    if (Array.isArray(p.images)) {
        currentTempProductImages = JSON.parse(JSON.stringify(p.images));
    } else if (p.image) {
        currentTempProductImages = [{ data: p.image, inCatalog: true }];
    } else {
        currentTempProductImages = [];
    }

    renderTempImagesGallery();
    document.getElementById('product-modal').classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

function saveProductFromModal() {
    let index = parseInt(document.getElementById('edit-prod-index').value, 10);
    let name = document.getElementById('prod-name').value.trim();
    let price = document.getElementById('prod-price').value.trim();
    let desc = document.getElementById('prod-desc').value.trim();
    let ownerName = document.getElementById('prod-owner-name').value.trim();
    let ownerPhone = document.getElementById('prod-owner-phone').value.trim();
    let ownerAddress = document.getElementById('prod-owner-address').value.trim();

    if (!name || !price) {
        alert("يرجى إدخال اسم المنتج والسعر!");
        return;
    }

    if (isNaN(index) || index < 0 || index >= localProducts.length) {
        let nextSerial = localProducts.length > 0 ? Math.max(...localProducts.map(item => item.serial)) + 1 : 1;
        localProducts.push({
            serial: nextSerial,
            name: name,
            price: price,
            desc: desc,
            images: JSON.parse(JSON.stringify(currentTempProductImages)),
            ownerName: ownerName,
            ownerPhone: ownerPhone,
            ownerAddress: ownerAddress,
            selectedForCatalog: true
        });
    } else {
        localProducts[index].name = name;
        localProducts[index].price = price;
        localProducts[index].desc = desc;
        localProducts[index].images = JSON.parse(JSON.stringify(currentTempProductImages));
        localProducts[index].ownerName = ownerName;
        localProducts[index].ownerPhone = ownerPhone;
        localProducts[index].ownerAddress = ownerAddress;
    }

    try {
        saveToLocalStorage();
        renderProducts();
        closeProductModal();
    } catch (e) {
        alert("مساحة التخزين ممتلئة! يرجى حذف بعض المنتجات القديمة.");
    }
}

function toggleProductCatalogSelection(index) {
    localProducts[index].selectedForCatalog = !localProducts[index].selectedForCatalog;
    saveToLocalStorage();
}

function openNewOrderModal() {
    document.getElementById('edit-order-index').value = "-1";
    document.getElementById('order-modal-title').innerText = "➕ تسجيل طلب زبون";
    document.getElementById('order-item').value = '';
    document.getElementById('order-client-name').value = '';
    document.getElementById('order-client-phone').value = '';
    document.getElementById('order-client-address').value = '';
    document.getElementById('order-modal').classList.remove('hidden');
}

function openEditOrderModal(index) {
    const o = localOrders[index];
    if (!o) return;
    document.getElementById('edit-order-index').value = String(index);
    document.getElementById('order-modal-title').innerText = "✏️ معاينة وتعديل الطلب";
    document.getElementById('order-item').value = o.itemNeeded || '';
    document.getElementById('order-client-name').value = o.clientName || '';
    document.getElementById('order-client-phone').value = o.clientPhone || '';
    document.getElementById('order-client-address').value = o.clientAddress === 'غير محدد' ? '' : (o.clientAddress || '');
    document.getElementById('order-modal').classList.remove('hidden');
}

function closeOrderModal() {
    document.getElementById('order-modal').classList.add('hidden');
}

function saveOrderFromModal() {
    let index = parseInt(document.getElementById('edit-order-index').value, 10);
    let itemNeeded = document.getElementById('order-item').value.trim();
    let clientName = document.getElementById('order-client-name').value.trim();
    let clientPhone = document.getElementById('order-client-phone').value.trim();
    let clientAddress = document.getElementById('order-client-address').value.trim() || 'غير محدد';

    if (!itemNeeded || !clientName || !clientPhone) {
        alert("يرجى إدخال المطلوب واسم الزبون ورقم موبايله!");
        return;
    }

    if (isNaN(index) || index < 0 || index >= localOrders.length) {
        localOrders.push({
            id: Date.now(),
            itemNeeded: itemNeeded,
            clientName: clientName,
            clientPhone: clientPhone,
            clientAddress: clientAddress,
            date: new Date().toLocaleDateString('ar-EG')
        });
    } else {
        localOrders[index].itemNeeded = itemNeeded;
        localOrders[index].clientName = clientName;
        localOrders[index].clientPhone = clientPhone;
        localOrders[index].clientAddress = clientAddress;
    }

    saveToLocalStorage();
    renderOrders();
    closeOrderModal();
}

function saveToLocalStorage() {
    localStorage.setItem('crow_prods_' + currentWaseetPhone, JSON.stringify(localProducts));
    localStorage.setItem('crow_orders_' + currentWaseetPhone, JSON.stringify(localOrders));
}

function loadLocalData(phone) {
    if(phone) currentWaseetPhone = phone;
    let savedName = localStorage.getItem('crow_waseet_name_' + currentWaseetPhone);
    if(savedName) currentWaseetName = savedName;
    
    let savedProds = localStorage.getItem('crow_prods_' + currentWaseetPhone);
    localProducts = savedProds ? JSON.parse(savedProds) : [];

    let savedOrders = localStorage.getItem('crow_orders_' + currentWaseetPhone);
    localOrders = savedOrders ? JSON.parse(savedOrders) : [];

    renderProducts();
    renderOrders();
}

function renderProducts() {
    let container = document.getElementById('products-list-container');
    if(!container) return;
    
    container.innerHTML = '';
    if(localProducts.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#94a3b8; font-size:13px;">لا توجد منتجات مسجلة حتى الآن.</p>`;
        return;
    }

    localProducts.forEach((p, index) => {
        let imagesArr = Array.isArray(p.images) ? p.images : (p.image ? [{data: p.image, inCatalog: true}] : []);
        let coverImg = imagesArr.length > 0 ? imagesArr[0].data : '';
        let catalogImgsCount = imagesArr.filter(i => i.inCatalog).length;

        let div = document.createElement('div');
        div.style.cssText = "background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; font-size:13px; gap:8px;";
        
        let imgTag = coverImg 
            ? `<div style="position:relative; flex-shrink:0;">
                 <img src="${coverImg}" style="width:54px; height:54px; object-fit:cover; border-radius:8px;" />
                 <span style="position:absolute; bottom:2px; right:2px; background:rgba(0,0,0,0.75); color:white; font-size:9px; padding:1px 4px; border-radius:4px;">📷 ${catalogImgsCount}/${imagesArr.length}</span>
               </div>` 
            : `<div style="width:54px; height:54px; background:#f1f5f9; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0;">📦</div>`;

        div.innerHTML = `
            <input type="checkbox" ${p.selectedForCatalog !== false ? 'checked' : ''} onchange="toggleProductCatalogSelection(${index})" title="تضمين في الكتالوج" style="width:18px; height:18px; cursor:pointer; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:8px; flex:1;">
                ${imgTag}
                <div>
                    <span style="background:#1b4982; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">#${p.serial}</span>
                    <b>${p.name}</b> - 💰 ${p.price} ج.م<br>
                    <small style="color:#64748b;">${p.desc || 'بدون وصف'}</small><br>
                    <small style="color:#059669; font-weight:bold;">🔒 المالك: ${p.ownerName || '-'} | ${p.ownerPhone || '-'}</small>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:5px; flex-shrink:0;">
                <button type="button" onclick="openEditProductModal(${index})" style="background:#0284c7; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;">✏️ تعديل</button>
                <button type="button" onclick="deleteProduct(${index})" style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:11px;">حذف</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderOrders() {
    let container = document.getElementById('orders-list-container');
    if(!container) return;

    container.innerHTML = '';
    if(localOrders.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#94a3b8; font-size:13px;">لا توجد طلبات زبائن مسجلة.</p>`;
        return;
    }

    localOrders.forEach((o, index) => {
        let div = document.createElement('div');
        div.style.cssText = "background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; font-size:13px; gap:8px;";
        div.innerHTML = `
            <div style="flex:1;">
                <b>🛒 المطلوب: ${o.itemNeeded}</b><br>
                <small style="color:#1b4982; font-weight:bold;">👤 الطالب: ${o.clientName} (${o.clientPhone})</small><br>
                <small style="color:#64748b;">📍 العنوان: ${o.clientAddress} | 📅 ${o.date}</small>
            </div>
            <div style="display:flex; flex-direction:column; gap:5px; flex-shrink:0;">
                <button type="button" onclick="openEditOrderModal(${index})" style="background:#0284c7; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;">✏️ تعديل</button>
                <button type="button" onclick="deleteOrder(${index})" style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:11px;">حذف</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function deleteProduct(index) {
    if(confirm("هل أنت متأكد من حذف هذا المنتج؟")) {
        localProducts.splice(index, 1);
        saveToLocalStorage();
        renderProducts();
    }
}

function deleteOrder(index) {
    if(confirm("هل أنت متأكد من حذف هذا الطلب؟")) {
        localOrders.splice(index, 1);
        saveToLocalStorage();
        renderOrders();
    }
}

// محرك توليد بوسترات الكتالوج
function loadImageElement(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

function drawImagePreserveAspect(ctx, img, boxX, boxY, boxW, boxH) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    const imgRatio = img.width / img.height;
    const boxRatio = boxW / boxH;

    let drawW, drawH, drawX, drawY;
    if (imgRatio > boxRatio) {
        drawW = boxW;
        drawH = boxW / imgRatio;
        drawX = boxX;
        drawY = boxY + (boxH - drawH) / 2;
    } else {
        drawH = boxH;
        drawW = boxH * imgRatio;
        drawX = boxX + (boxW - drawW) / 2;
        drawY = boxY;
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

async function renderSingleFlyerPage(product, imgsChunk, pageNum, totalPages, waseetDisplayName) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const W = 1080;
    
    const isFirstPage = (pageNum === 1);
    const hasImages = imgsChunk.length > 0;
    
    let imgGridHeight = 0;
    if (hasImages) {
        if (imgsChunk.length === 1) imgGridHeight = 680;
        else if (imgsChunk.length === 2) imgGridHeight = 480;
        else imgGridHeight = 820;
    }

    const headerHeight = 110;
    const infoHeight = isFirstPage ? (170 + (product.desc ? 75 : 0)) : 90;
    const footerHeight = 70;
    const H = headerHeight + infoHeight + imgGridHeight + footerHeight + 30;

    canvas.width = W;
    canvas.height = H;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#0d233a';
    ctx.fillRect(0, 0, W, headerHeight);

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(W - 230, 25, 195, 60, 14);
    } else {
        ctx.rect(W - 230, 25, 195, 60);
    }
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`كود #${product.serial}`, W - 132, 67);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'left';
    const pageTag = totalPages > 1 ? ` (صفحة ${pageNum} من ${totalPages})` : '';
    ctx.fillText(`👤 ${waseetDisplayName}${pageTag}`, 35, 67);

    let currentY = headerHeight + 55;

    if (isFirstPage) {
        ctx.fillStyle = '#0d233a';
        ctx.font = 'bold 44px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(product.name, W - 40, currentY);
        currentY += 65;

        ctx.fillStyle = '#059669';
        ctx.font = 'bold 40px sans-serif';
        ctx.fillText(`💰 السعر: ${product.price} ج.م`, W - 40, currentY);
        currentY += 55;

        if (product.desc) {
            ctx.fillStyle = '#475569';
            ctx.font = '30px sans-serif';
            ctx.fillText(`📝 ${product.desc.substring(0, 75)}`, W - 40, currentY + 10);
            currentY += 75;
        }
    } else {
        ctx.fillStyle = '#1b4982';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`📸 تابع صور: ${product.name} (كود #${product.serial})`, W - 40, currentY);
        currentY += 45;
    }

    if (hasImages) {
        const loadedImgs = await Promise.all(imgsChunk.map(i => loadImageElement(i.data)));
        const validImgs = loadedImgs.filter(img => img !== null);

        if (validImgs.length === 1) {
            drawImagePreserveAspect(ctx, validImgs[0], 40, currentY, W - 80, 660);
        } else if (validImgs.length === 2) {
            const boxW = (W - 100) / 2;
            drawImagePreserveAspect(ctx, validImgs[0], 40, currentY, boxW, 460);
            drawImagePreserveAspect(ctx, validImgs[1], 60 + boxW, currentY, boxW, 460);
        } else if (validImgs.length >= 3) {
            const boxW = (W - 100) / 2;
            const boxH = 390;
            drawImagePreserveAspect(ctx, validImgs[0], 40, currentY, boxW, boxH);
            drawImagePreserveAspect(ctx, validImgs[1], 60 + boxW, currentY, boxW, boxH);
            drawImagePreserveAspect(ctx, validImgs[2], 40, currentY + boxH + 20, validImgs[3] ? boxW : (W - 80), boxH);
            if (validImgs[3]) {
                drawImagePreserveAspect(ctx, validImgs[3], 60 + boxW, currentY + boxH + 20, boxW, boxH);
            }
        }
    }

    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, H - footerHeight, W, footerHeight);
    ctx.fillStyle = '#1b4982';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`للاستعلام أو المعاينة تواصل مع (${waseetDisplayName}) واذكر كود (#${product.serial})`, W / 2, H - 24);

    return new Promise(resolve => {
        canvas.toBlob(blob => {
            const fileName = totalPages > 1 
                ? `code_${product.serial}_page_${pageNum}.jpg` 
                : `code_${product.serial}.jpg`;
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            resolve({ file, dataUrl: canvas.toDataURL('image/jpeg', 0.92), fileName });
        }, 'image/jpeg', 0.92);
    });
}

async function createAllFlyersForProduct(product, waseetDisplayName) {
    let imagesArr = Array.isArray(product.images) ? product.images : (product.image ? [{data: product.image, inCatalog: true}] : []);
    let catalogImgs = imagesArr.filter(i => i.inCatalog);

    if (catalogImgs.length === 0) {
        const page = await renderSingleFlyerPage(product, [], 1, 1, waseetDisplayName);
        return [page];
    }

    const chunks = [];
    for (let i = 0; i < catalogImgs.length; i += 4) {
        chunks.push(catalogImgs.slice(i, i + 4));
    }

    const pages = [];
    for (let idx = 0; idx < chunks.length; idx++) {
        const page = await renderSingleFlyerPage(product, chunks[idx], idx + 1, chunks.length, waseetDisplayName);
        pages.push(page);
    }
    return pages;
}

async function openCatalogPreview() {
    const selectedProds = localProducts.filter(p => p.selectedForCatalog !== false);
    if (selectedProds.length === 0) {
        alert("يرجى تحديد منتج واحد على الأقل لتصديره في الكتالوج!");
        return;
    }

    let waseetName = localStorage.getItem('crow_waseet_name_' + currentWaseetPhone) || currentWaseetName;
    if (!waseetName || waseetName === "الوسيط") {
        let enteredName = prompt("أدخل اسمك (اسم الوسيط) ليظهر في رأس المجلة:", "أحمد محمود");
        if (enteredName && enteredName.trim()) {
            waseetName = enteredName.trim();
            localStorage.setItem('crow_waseet_name_' + currentWaseetPhone, waseetName);
            currentWaseetName = waseetName;
        }
    }

    const previewBox = document.getElementById('catalog-preview-content');
    previewBox.innerHTML = `<p style="text-align:center; color:#1b4982; font-weight:bold;">⏳ جاري تجهيز البوسترات بجودة عالية...</p>`;
    document.getElementById('catalog-modal').classList.remove('hidden');

    generatedCatalogImageFiles = [];
    let allGeneratedPages = [];

    for (const p of selectedProds) {
        const productPages = await createAllFlyersForProduct(p, waseetName);
        productPages.forEach(pg => {
            generatedCatalogImageFiles.push(pg.file);
            allGeneratedPages.push(pg);
        });
    }

    let htmlContent = `<div style="font-size:12px; color:#059669; background:#f0fdf4; padding:8px; border-radius:8px; margin-bottom:10px; text-align:center; font-weight:bold;">✅ تم تجهيز ${allGeneratedPages.length} بوستر بجودة عالية باسم (${waseetName})</div>`;

    allGeneratedPages.forEach(pg => {
        htmlContent += `
            <div style="margin-bottom:14px; border:1px solid #cbd5e1; border-radius:10px; overflow:hidden; background:#fff;">
                <img src="${pg.dataUrl}" style="width:100%; display:block;">
                <a href="${pg.dataUrl}" download="${pg.fileName}" style="display:block; text-align:center; background:#e2e8f0; color:#0d233a; padding:6px; font-size:12px; font-weight:bold; text-decoration:none;">⬇️ حفظ (${pg.fileName}) في الاستوديو</a>
            </div>
        `;
    });

    previewBox.innerHTML = htmlContent;
}

function closeCatalogModal() {
    document.getElementById('catalog-modal').classList.add('hidden');
}

async function shareCatalogWithImages() {
    if (generatedCatalogImageFiles.length === 0) {
        alert("لا توجد صور جاهزة للمشاركة!");
        return;
    }

    if (navigator.canShare && navigator.canShare({ files: generatedCatalogImageFiles })) {
        try {
            await navigator.share({
                files: generatedCatalogImageFiles,
                title: `عروض ${currentWaseetName}`
            });
        } catch (err) {
            console.log("تم إلغاء المشاركة:", err);
        }
    } else {
        alert("متصفحك لا يدعم المشاركة المباشرة للملفات، يمكنك الضغط على (⬇️ حفظ في الاستوديو) تحت كل بوستر وإرسالها من الاستوديو على واتساب.");
    }
}

function shareCatalogTextOnly() {
    const selectedProds = localProducts.filter(p => p.selectedForCatalog !== false);
    let waseetName = localStorage.getItem('crow_waseet_name_' + currentWaseetPhone) || currentWaseetName;
    let text = `📋 *عروض ${waseetName} المتاحة حالياً*\n\n`;
    selectedProds.forEach(p => {
        text += `🔹 *كود (#${p.serial})* : ${p.name}\n`;
        text += `💰 السعر: ${p.price} ج.م\n`;
        if(p.desc) text += `📝 ${p.desc}\n`;
        text += `-------------------\n`;
    });
    text += "\nللاستعلام اذكر رقم الكود في رسالة.";

    let encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
}
