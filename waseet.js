let localProducts = [];
let localOrders = [];
let currentWaseetPhone = "01000000000";
let currentTempProductImage = "";

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

// --- رفع وضغط صورة المنتج من الموبايل ---
function handleProductImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxDim = 500; // ضغط ذكي للحفاظ على مساحة التخزين
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

            currentTempProductImage = canvas.toDataURL('image/jpeg', 0.7);
            document.getElementById('prod-img-preview-box').innerHTML = 
                `<img src="${currentTempProductImage}" style="max-height:110px; border-radius:8px; border:1px solid #cbd5e1;">`;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// --- فتح نافذة إضافة أو معاينة/تعديل المنتج ---
function openProductModal(index = -1) {
    document.getElementById('edit-prod-index').value = index;
    document.getElementById('prod-img-file').value = '';

    if (index === -1) {
        // وضع الإضافة الجديدة
        document.getElementById('prod-modal-title').innerText = "➕ إضافة منتج جديد";
        document.getElementById('prod-name').value = '';
        document.getElementById('prod-price').value = '';
        document.getElementById('prod-desc').value = '';
        document.getElementById('prod-owner-name').value = '';
        document.getElementById('prod-owner-phone').value = '';
        document.getElementById('prod-owner-address').value = '';
        document.getElementById('prod-img-preview-box').innerHTML = '';
        currentTempProductImage = '';
    } else {
        // وضع المعاينة والتعديل
        let p = localProducts[index];
        document.getElementById('prod-modal-title').innerText = `✏️ معاينة وتعديل منتج (#${p.serial})`;
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-price').value = p.price;
        document.getElementById('prod-desc').value = p.desc;
        document.getElementById('prod-owner-name').value = p.ownerName;
        document.getElementById('prod-owner-phone').value = p.ownerPhone;
        document.getElementById('prod-owner-address').value = p.ownerAddress;
        currentTempProductImage = p.image || '';
        document.getElementById('prod-img-preview-box').innerHTML = currentTempProductImage ? 
            `<img src="${currentTempProductImage}" style="max-height:110px; border-radius:8px; border:1px solid #cbd5e1;">` : '';
    }

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
            image: currentTempProductImage,
            ownerName: ownerName,
            ownerPhone: ownerPhone,
            ownerAddress: ownerAddress,
            selectedForCatalog: true
        });
    } else {
        // تحديث المنتج مع الحفاظ على السيريال الثابت
        localProducts[index].name = name;
        localProducts[index].price = price;
        localProducts[index].desc = desc;
        localProducts[index].image = currentTempProductImage;
        localProducts[index].ownerName = ownerName;
        localProducts[index].ownerPhone = ownerPhone;
        localProducts[index].ownerAddress = ownerAddress;
    }

    saveToLocalStorage();
    renderProducts();
    closeProductModal();
}

// --- فتح نافذة إضافة أو معاينة/تعديل الطلب ---
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

// --- عرض المنتجات مع أزرار المعاينة/التعديل والحذف ---
function renderProducts() {
    let container = document.getElementById('products-list-container');
    if(!container) return;
    
    container.innerHTML = '';
    if(localProducts.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#94a3b8; font-size:13px;">لا توجد منتجات مسجلة حتى الآن.</p>`;
        return;
    }

    localProducts.forEach((p, index) => {
        let div = document.createElement('div');
        div.style.cssText = "background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; font-size:13px; gap:8px;";
        
        let imgTag = p.image 
            ? `<img src="${p.image}" onclick="openProductModal(${index})" style="width:52px; height:52px; object-fit:cover; border-radius:8px; flex-shrink:0; cursor:pointer;" />` 
            : `<div onclick="openProductModal(${index})" style="width:52px; height:52px; background:#f1f5f9; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; cursor:pointer;">📦</div>`;

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; flex:1; cursor:pointer;" onclick="openProductModal(${index})">
                ${imgTag}
                <div>
                    <span style="background:#1b4982; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">#${p.serial}</span>
                    <b>${p.name}</b> - 💰 ${p.price} ج.م<br>
                    <small style="color:#64748b;">${p.desc || 'بدون وصف إضافي'}</small><br>
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

// --- عرض الطلبات مع أزرار المعاينة/التعديل والحذف ---
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

function generateCatalog() {
    if(localProducts.length === 0) {
        alert("لا توجد منتجات لتصديرها في المجلة!");
        return;
    }

    let text = "🦅 *مجلة عروض الوسيط الحالية* 🦅\n\n";
    localProducts.forEach(p => {
        text += `🔹 *كود (#${p.serial})*\n`;
        text += `📦 *${p.name}*\n`;
        text += `💰 السعر: ${p.price} ج.م\n`;
        if(p.desc) text += `📝 التفاصيل: ${p.desc}\n`;
        text += `-------------------\n`;
    });
    text += "\nللتواصل والاستعلام يرجى مراسلة الوسيط.";

    let encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
}
