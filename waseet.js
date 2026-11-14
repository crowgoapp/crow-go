let localProducts = [];
let localOrders = [];
let currentWaseetPhone = "01000000000";

// التبديل بين تبويبات الوسيط (منتجات / طلبات)
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

// 1. إضافة منتج (عرض) مع الصورة والمالك السري والعنوان
function openAddProductModal() {
    let name = prompt("أدخل اسم المنتج (مثال: شقة للبيع / ثلاجة):");
    if(!name) return;
    let price = prompt("أدخل السعر (بالجنيه):");
    let desc = prompt("أدخل الوصف أو الحالة (مثال: استعمال خفيف):");
    let imgUrl = prompt("رابط صورة المنتج (اختياري - اتركها فارغة لو لا توجد):");
    
    // بيانات مالك السلعة (سرية للوسيط فقط بالعنوان)
    let ownerName = prompt("اسم صاحب السلعة (سري):");
    let ownerPhone = prompt("رقم تليفون صاحب السلعة (سري):");
    let ownerAddress = prompt("عنوان صاحب السلعة (سري):");

    if(!name || !price) {
        alert("اسم المنتج والسعر إجباريان!");
        return;
    }

    let nextSerial = localProducts.length > 0 ? localProducts[localProducts.length - 1].serial + 1 : 1;

    let newProd = {
        serial: nextSerial,
        name: name,
        price: price,
        desc: desc || '',
        image: imgUrl || '',
        ownerName: ownerName || '',
        ownerPhone: ownerPhone || '',
        ownerAddress: ownerAddress || '',
        selectedForCatalog: true
    };

    localProducts.push(newProd);
    saveToLocalStorage();
    renderProducts();
    alert(`تم حفظ المنتج برقم سيريال #${nextSerial} بنجاح!`);
}

// 2. تسجيل طلب زبون جديد
function openAddOrderModal() {
    let itemNeeded = prompt("ما هو المنتج أو السلعة المطلوبة؟ (مثال: شقة إيجار في حي بورفؤاد):");
    if(!itemNeeded) return;
    let clientName = prompt("اسم الزبون طالب السلعة:");
    let clientPhone = prompt("رقم موبايل الزبون:");
    let clientAddress = prompt("عنوان الزبون (اختياري):");

    if(!itemNeeded || !clientName || !clientPhone) {
        alert("اسم المطلوب واسم العميل ورقم التليفون إجبارية!");
        return;
    }

    let newOrder = {
        id: Date.now(),
        itemNeeded: itemNeeded,
        clientName: clientName,
        clientPhone: clientPhone,
        clientAddress: clientAddress || 'غير محدد',
        date: new Date().toLocaleDateString('ar-EG')
    };

    localOrders.push(newOrder);
    saveToLocalStorage();
    renderOrders();
    alert("تم تسجيل طلب الزبون بنجاح!");
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

// عرض المنتجات
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
        div.style.cssText = "background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; font-size:13px;";
        
        let imgTag = p.image ? `<img src="${p.image}" style="width:40px; height:40px; object-fit:cover; border-radius:6px; margin-left:8px;" />` : '';

        div.innerHTML = `
            <div style="display:flex; align-items:center;">
                ${imgTag}
                <div>
                    <span style="background:#1b4982; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">#${p.serial}</span>
                    <b>${p.name}</b> - 💰 ${p.price} ج.م<br>
                    <small style="color:#64748b;">${p.desc}</small><br>
                    <small style="color:#059669; font-weight:bold;">المالك (سري): ${p.ownerName} | ${p.ownerPhone} | ${p.ownerAddress}</small>
                </div>
            </div>
            <button onclick="deleteProduct(${index})" style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:11px;">حذف</button>
        `;
        container.appendChild(div);
    });
}

// عرض الطلبات
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
        div.style.cssText = "background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; font-size:13px;";
        div.innerHTML = `
            <div>
                <b>الطلب: ${o.itemNeeded}</b><br>
                <small style="color:#1b4982; font-weight:bold;">الطالب: ${o.clientName} (${o.clientPhone})</small><br>
                <small style="color:#64748b;">العنوان: ${o.clientAddress} - تاريخ الطلب: ${o.date}</small>
            </div>
            <button onclick="deleteOrder(${index})" style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:11px;">حذف</button>
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

// تصدير المجلة للواتساب (بدون بيانات المالك السرية)
function generateCatalog() {
    if(localProducts.length === 0) {
        alert("لا توجد منتجات لتصديرها في المجلة!");
        return;
    }

    let text = "🦅 *مجلة عروض الوسيط الحالية* 🦅\n\n";
    localProducts.forEach(p => {
        text += `🔹 *سيريال (#${p.serial})*\n`;
        text += `📦 *${p.name}*\n`;
        text += `💰 السعر: ${p.price} ج.م\n`;
        if(p.desc) text += `📝 التفاصيل: ${p.desc}\n`;
        text += `-------------------\n`;
    });
    text += "\nللتواصل والاستعلام عبر الوسيط.";

    let encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
}
