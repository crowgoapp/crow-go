let localProducts = [];
let localOrders = [];
let currentWaseetPhone = "01000000000";
let currentTempProductImages = [];
let generatedCatalogImageFiles = []; // لتخزين بوسترات الكتالوج المولدة كصور

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

// --- رفع وضغط عدة صور للمنتج من الموبايل ---
function handleProductImagesUpload(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const maxDim = 600; 
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxDim) {
                        height *= maxDim / width;
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width *= maxDim / height;
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
                currentTempProductImages.push({
                    data: compressedBase64,
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
    gallery.innerHTML = '';

    currentTempProductImages.forEach((imgObj, idx) => {
        const card = document.createElement('div');
        card.style.cssText = `border: 2px solid ${imgObj.inCatalog ? '#10b981' : '#cbd5e1'}; border-radius: 8px; padding: 4px; background: #fff; text-align: center; width: 85px; position: relative;`;
        
        card.innerHTML = `
            <button type="button" onclick="removeTempImage(${idx})" style="position:absolute; top:-6px; left:-6px; background:#ef4444; color:white; border:none; border-radius:50%; width:20px; height:20px; font-size:11px; cursor:pointer; font-weight:bold;">×</button>
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

function openProductModal(index = -1) {
    document.getElementById('edit-prod-index').value = index;
    document.getElementById('prod-img-file').value = '';

    if (index === -1) {
        document.getElementById('prod-modal-title').innerText = "➕ إضافة منتج جديد";
        document.getElementById('prod-name').value = '';
        document.getElementById('prod-price').value = '';
        document.getElementById('prod-desc').value = '';
        document.getElementById('prod-owner-name').value = '';
        document.getElementById('prod-owner-phone').value = '';
        document.getElementById('prod-owner-address').value = '';
        currentTempProductImages = [];
    } else {
        let p = localProducts[index];
        document.getElementById('prod-modal-title').innerText = `✏️ معاينة وتعديل منتج (#${p.serial})`;
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-price').value = p.price;
        document.getElementById('prod-desc').value = p.desc;
        document.getElementById('prod-owner-name').value = p.ownerName;
        document.getElementById('prod-owner-phone').value = p.ownerPhone;
        document.getElementById('prod-owner-address').value = p.ownerAddress;
        
        if (Array.isArray(p.images)) {
            currentTempProductImages = JSON.parse(JSON.stringify(p.images));
        } else if (p.image) {
            currentTempProductImages = [{ data: p.image, inCatalog: true }];
        } else {
            currentTempProductImages = [];
        }
    }

    renderTempImagesGallery();
    document.getElementById('product-modal').classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

function saveProductFromModal() {
    let index = parseInt(document.getElementById('edit-prod-index').value);
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

    if (index === -1) {
        let nextSerial = localProducts.length > 0 ? localProducts[localProducts.length - 1].serial + 1 : 1;
        localProducts.push({
            serial: nextSerial,
            name: name,
            price: price,
            desc: desc,
            images: currentTempProductImages,
            ownerName: ownerName,
            ownerPhone: ownerPhone,
            ownerAddress: ownerAddress,
            selectedForCatalog: true
        });
    } else {
        localProducts[index].name = name;
        localProducts[index].price = price;
        localProducts[index].desc = desc;
        localProducts[index].images = currentTempProductImages;
        localProducts[index].ownerName = ownerName;
        localProducts[index].ownerPhone = ownerPhone;
        localProducts[index].ownerAddress = ownerAddress;
    }

    try {
        saveToLocalStorage();
        renderProducts();
        closeProductModal();
    } catch (e) {
        alert("مساحة التخزين ممتلئة! يرجى تقليل عدد الصور أو حذف منتجات قديمة.");
    }
}

function toggleProductCatalogSelection(index) {
    localProducts[index].selectedForCatalog = !localProducts[index].selectedForCatalog;
    saveToLocalStorage();
}

// --- نافذة الطلبات ---
function openOrderModal(index = -1) {
    document.getElementById('edit-order-index').value = index;

    if (index === -1) {
        document.getElementById('order-modal-title').innerText = "➕ تسجيل طلب زبون";
        document.getElementById('order-item').value = '';
        document.getElementById('order-client-name').value = '';
        document.getElementById('order-client-phone').value = '';
        document.getElementById('order-client-address').value = '';
    } else {
        let o = localOrders[index];
        document.getElementById('order-modal-title').innerText = "✏️ معاينة وتعديل الطلب";
        document.getElementById('order-item').value = o.itemNeeded;
        document.getElementById('order-client-name').value = o.clientName;
        document.getElementById('order-client-phone').value = o.clientPhone;
        document.getElementById('order-client-address').value = o.clientAddress === 'غير محدد' ? '' : o.clientAddress;
    }

    document.getElementById('order-modal').classList.remove('hidden');
}

function closeOrderModal() {
    document.getElementById('order-modal').classList.add('hidden');
}

function saveOrderFromModal() {
    let index = parseInt(document.getElementById('edit-order-index').value);
    let itemNeeded = document.getElementById('order-item').value.trim();
    let clientName = document.getElementById('order-client-name').value.trim();
    let clientPhone = document.getElementById('order-client-phone').value.trim();
    let clientAddress = document.getElementById('order-client-address').value.trim() || 'غير محدد';

    if (!itemNeeded || !clientName || !clientPhone) {
        alert("يرجى إدخال المطلوب واسم الزبون ورقم موبايله!");
        return;
    }

    if (index === -1) {
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
            ? `<div style="position:relative; flex-shrink:0;" onclick="openProductModal(${index})">
                 <img src="${coverImg}" style="width:54px; height:54px; object-fit:cover; border-radius:8px; cursor:pointer;" />
                 <span style="position:absolute; bottom:2px; right:2px; background:rgba(0,0,0,0.7); color:white; font-size:9px; padding:1px 4px; border-radius:4px;">📷 ${catalogImgsCount}/${imagesArr.length}</span>
               </div>` 
            : `<div onclick="openProductModal(${index})" style="width:54px; height:54px; background:#f1f5f9; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; cursor:pointer;">📦</div>`;

        div.innerHTML = `
            <input type="checkbox" ${p.selectedForCatalog !== false ? 'checked' : ''} onchange="toggleProductCatalogSelection(${index})" title="تضمين في الكتالوج" style="width:18px; height:18px; cursor:pointer; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:8px; flex:1; cursor:pointer;" onclick="openProductModal(${index})">
                ${imgTag}
                <div>
                    <span style="background:#1b4982; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">#${p.serial}</span>
                    <b>${p.name}</b> - 💰 ${p.price} ج.م<br>
                    <small style="color:#64748b;">${p.desc || 'بدون وصف'}</small><br>
                    <small style="color:#059669; font-weight:bold;">🔒 المالك: ${p.ownerName || '-'} | ${p.ownerPhone || '-'}</small>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
                <button onclick="openProductModal(${index})" style="background:#0284c7; color:white; border:none; padding:5px 8px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;">معاينة/تعديل</button>
                <button onclick="deleteProduct(${index})" style="background:#ef4444; color:white; border:none; padding:5px 8px; border-radius:6px; cursor:pointer; font-size:11px;">حذف</button>
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
            <div style="flex:1; cursor:pointer;" onclick="openOrderModal(${index})">
                <b>🛒 المطلوب: ${o.itemNeeded}</b><br>
                <small style="color:#1b4982; font-weight:bold;">👤 الطالب: ${o.clientName} (${o.clientPhone})</small><br>
                <small style="color:#64748b;">📍 العنوان: ${o.clientAddress} | 📅 ${o.date}</small>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
                <button onclick="openOrderModal(${index})" style="background:#0284c7; color:white; border:none; padding:5px 8px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;">معاينة/تعديل</button>
                <button onclick="deleteOrder(${index})" style="background:#ef4444; color:white; border:none; padding:5px 8px; border-radius:6px; cursor:pointer; font-size:11px;">حذف</button>
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

// =========================================================================
// محرك توليد بوسترات الكتالوج كصور حقيقية (Flyers) بدون أي روابط نهائياً
// =========================================================================

function loadImageElement(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

// رسم بوستر احترافي لكل منتج يجمع صوره المختارة + بياناته + الكود
async function createProductFlyerBlob(product) {
    let imagesArr = Array.isArray(product.images) ? product.images : (product.image ? [{data: product.image, inCatalog: true}] : []);
    let catalogImgs = imagesArr.filter(i => i.inCatalog);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const W = 800;
    
    // حساب الارتفاع حسب وجود صور أو تفاصيل
    const hasImages = catalogImgs.length > 0;
    const imgGridHeight = hasImages ? (catalogImgs.length === 1 ? 420 : (catalogImgs.length <= 2 ? 320 : 520)) : 0;
    const H = 260 + imgGridHeight + (product.desc ? 80 : 0);

    canvas.width = W;
    canvas.height = H;

    // الخلفية البيضاء النظيفة
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // الهيدر العلوي (أزرق ملكي)
    ctx.fillStyle = '#0d233a';
    ctx.fillRect(0, 0, W, 95);

    // شارة كود المنتج (#1)
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(W - 180, 22, 150, 50, 12);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`كود #${product.serial}`, W - 105, 57);

    // اسم المنصة في الهيدر
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🦅 Crow Go - عرض متاح', 30, 56);

    // اسم المنتج
    ctx.fillStyle = '#0d233a';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(product.name, W - 30, 150);

    // السعر
    ctx.fillStyle = '#059669';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(`💰 السعر: ${product.price} ج.م`, W - 30, 200);

    let currentY = 230;

    // الوصف إن وجد
    if (product.desc) {
        ctx.fillStyle = '#475569';
        ctx.font = '24px sans-serif';
        ctx.fillText(`📝 ${product.desc.substring(0, 65)}`, W - 30, currentY + 15);
        currentY += 65;
    }

    // رسم الصور المختارة للكتالوج
    if (hasImages) {
        const loadedImgs = await Promise.all(catalogImgs.slice(0, 4).map(i => loadImageElement(i.data)));
        const validImgs = loadedImgs.filter(img => img !== null);

        if (validImgs.length === 1) {
            ctx.drawImage(validImgs[0], 30, currentY, W - 60, 400);
        } else if (validImgs.length === 2) {
            const boxW = (W - 75) / 2;
            ctx.drawImage(validImgs[0], 30, currentY, boxW, 300);
            ctx.drawImage(validImgs[1], 45 + boxW, currentY, boxW, 300);
        } else if (validImgs.length >= 3) {
            const boxW = (W - 75) / 2;
            const boxH = 245;
            ctx.drawImage(validImgs[0], 30, currentY, boxW, boxH);
            ctx.drawImage(validImgs[1], 45 + boxW, currentY, boxW, boxH);
            ctx.drawImage(validImgs[2], 30, currentY + boxH + 15, validImgs[3] ? boxW : (W - 60), boxH);
            if (validImgs[3]) {
                ctx.drawImage(validImgs[3], 45 + boxW, currentY + boxH + 15, boxW, boxH);
            }
        }
    }

    // الفوتر السفلي (بدون أي روابط - للطلب اذكر رقم الكود فقط)
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, H - 55, W, 55);
    ctx.fillStyle = '#1b4982';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`للاستعلام أو المعاينة يرجى مراسلتي وذكر رقم الكود (#${product.serial})`, W / 2, H - 20);

    return new Promise(resolve => {
        canvas.toBlob(blob => {
            const file = new File([blob], `offer_code_${product.serial}.jpg`, { type: 'image/jpeg' });
            resolve({ file, dataUrl: canvas.toDataURL('image/jpeg', 0.85) });
        }, 'image/jpeg', 0.85);
    });
}

// فتح معاينة البوسترات المصورة الجاهزة
async function openCatalogPreview() {
    const selectedProds = localProducts.filter(p => p.selectedForCatalog !== false);
    if (selectedProds.length === 0) {
        alert("يرجى تحديد منتج واحد على الأقل لتصديره في الكتالوج!");
        return;
    }

    const previewBox = document.getElementById('catalog-preview-content');
    previewBox.innerHTML = `<p style="text-align:center; color:#1b4982; font-weight:bold;">⏳ جاري تجهيز بوسترات الكتالوج المصورة بدون روابط...</p>`;
    document.getElementById('catalog-modal').classList.remove('hidden');

    generatedCatalogImageFiles = [];
    let htmlContent = `<div style="font-size:12px; color:#059669; background:#f0fdf4; padding:8px; border-radius:8px; margin-bottom:10px; text-align:center; font-weight:bold;">✅ تم تجهيز ${selectedProds.length} بوستر مصور (جاهز للإرسال المباشر كصور بدون أي روابط)</div>`;

    for (const p of selectedProds) {
        const result = await createProductFlyerBlob(p);
        generatedCatalogImageFiles.push(result.file);
        htmlContent += `
            <div style="margin-bottom:14px; border:1px solid #cbd5e1; border-radius:10px; overflow:hidden; background:#fff;">
                <img src="${result.dataUrl}" style="width:100%; display:block;">
                <a href="${result.dataUrl}" download="offer_code_${p.serial}.jpg" style="display:block; text-align:center; background:#e2e8f0; color:#0d233a; padding:6px; font-size:12px; font-weight:bold; text-decoration:none;">⬇️ حفظ هذه الصورة في الاستوديو</a>
            </div>
        `;
    }

    previewBox.innerHTML = htmlContent;
}

function closeCatalogModal() {
    document.getElementById('catalog-modal').classList.add('hidden');
}

// مشاركة بوسترات الكتالوج كصور مباشرة على الواتساب بدون أي روابط
async function shareCatalogWithImages() {
    if (generatedCatalogImageFiles.length === 0) {
        alert("لا توجد صور جاهزة للمشاركة!");
        return;
    }

    if (navigator.canShare && navigator.canShare({ files: generatedCatalogImageFiles })) {
        try {
            await navigator.share({
                files: generatedCatalogImageFiles,
                title: 'مجلة عروض متاحة'
            });
        } catch (err) {
            console.log("تم إلغاء المشاركة:", err);
        }
    } else {
        alert("متصفحك لا يدعم المشاركة المباشرة للملفات، يمكنك الضغط على (⬇️ حفظ هذه الصورة في الاستوديو) تحت كل بوستر وإرسالها من الاستوديو على واتساب.");
    }
}

// مشاركة نصية خالصة بدون أي روابط
function shareCatalogTextOnly() {
    const selectedProds = localProducts.filter(p => p.selectedForCatalog !== false);
    let text = "🦅 *قائمة العروض المتاحة حالياً* 🦅\n\n";
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
