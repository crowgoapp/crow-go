// --- ملف إدارة الوسيط، المنتجات، والتخزين المحلي ---

let localProducts = [];
let currentWaseetPhone = "01000000000"; // رقم مؤقت لحين ربط تسجيل الدخول

// فتح مودال إضافة منتج
function openAddProductModal() {
    // لو مش عاملين شاشة المودال في الهيكل، هنخليها تظهر أو نتحكم فيها
    let name = prompt("أدخل اسم المنتج (مثال: شقة للبيع / ثلاجة):");
    if(!name) return;
    let price = prompt("أدخل السعر (بالجنيه):");
    let desc = prompt("أدخل الوصف أو الحالة (مثال: استعمال خفيف كالجديد):");
    let ownerName = prompt("اسم صاحب السلعة (سري للوسيط فقط):");
    let ownerPhone = prompt("تليفون صاحب السلعة (سري):");

    if(!name || !price) {
        alert("اسم المنتج والسعر إجباريان!");
        return;
    }

    // توليد سيريال تسلسلي ثابت لا يتكرر أبداً للوسيط
    let nextSerial = localProducts.length > 0 ? localProducts[localProducts.length - 1].serial + 1 : 1;

    let newProd = {
        serial: nextSerial,
        name: name,
        price: price,
        desc: desc || '',
        ownerName: ownerName || '',
        ownerPhone: ownerPhone || '',
        selected: false
    };

    localProducts.push(newProd);
    saveToLocalStorage();
    renderProducts();
    alert(`تم حفظ المنتج برقم سيريال #${nextSerial} بنجاح!`);
}

// حفظ البيانات محلياً على الجهاز
function saveToLocalStorage() {
    localStorage.setItem('crow_prods_' + currentWaseetPhone, JSON.stringify(localProducts));
}

// تحميل المنتجات عند فتح حساب الوسيط
function loadLocalProducts(phone) {
    if(phone) currentWaseetPhone = phone;
    let saved = localStorage.getItem('crow_prods_' + currentWaseetPhone);
    if(saved) {
        localProducts = JSON.parse(saved);
    } else {
        localProducts = [];
    }
    renderProducts();
}

// عرض المنتجات في الواجهة
function renderProducts() {
    let container = document.getElementById('products-list-container');
    if(!container) return; // لو مش موجودة حالياً في الصفحة نتخطى
    
    container.innerHTML = '';
    if(localProducts.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#94a3b8; font-size:13px;">لا توجد منتجات مسجلة محلياً حتى الآن.</p>`;
        return;
    }

    localProducts.forEach((p, index) => {
        let div = document.createElement('div');
        div.style.cssText = "background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; font-size:13px;";
        div.innerHTML = `
            <div>
                <span style="background:#1b4982; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">#${p.serial}</span>
                <b>${p.name}</b> - 💰 ${p.price} ج.م<br>
                <small style="color:#64748b;">${p.desc}</small><br>
                <small style="color:#059669;">مالك السلعة (سري): ${p.ownerName} (${p.ownerPhone})</small>
            </div>
            <button onclick="deleteProduct(${index})" style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:11px;">حذف</button>
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
