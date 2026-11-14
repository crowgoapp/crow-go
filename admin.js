function openAdminDirect() {
    let pass = prompt("أدخل كلمة مرور السوبر أدمن:");
    if (pass === (localStorage.getItem('crow_admin_pass') || 'admin123')) {
        showScreen('admin-dashboard');
        loadAdminSettingsToUI();
        renderAdminWaseetsTable();
    } else if (pass !== null) {
        alert("كلمة المرور غير صحيحة!");
    }
}

function changeAdminPassword() {
    let newPass = document.getElementById('admin-new-pass').value.trim();
    if (!newPass || newPass.length < 4) { alert("أدخل 4 أحرف/أرقام على الأقل"); return; }
    localStorage.setItem('crow_admin_pass', newPass);
    let passInput = document.getElementById('admin-new-pass');
    if(passInput) passInput.value = '';
    alert("تم تحديث كلمة المرور بنجاح!");
}

function loadAdminSettingsToUI() {
    let savedLogo = localStorage.getItem('crow_platform_logo');
    let savedSub = localStorage.getItem('crow_platform_sub');
    let logoContainer = document.getElementById('logo-display-container');
    let subInput = document.getElementById('admin-subtitle-input');
    if(savedLogo && logoContainer) logoContainer.innerHTML = `<img src="${savedLogo}" class="logo-img">`;
    if(savedSub && subInput) subInput.value = savedSub;
}

function previewNewLogo(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            platformConfig.logoBase64 = e.target.result;
            let logoContainer = document.getElementById('logo-display-container');
            if(logoContainer) logoContainer.innerHTML = `<img src="${e.target.result}" class="logo-img">`;
        };
        reader.readAsDataURL(file);
    }
}

function savePlatformSettings() {
    let subInput = document.getElementById('admin-subtitle-input');
    if(subInput) localStorage.setItem('crow_platform_sub', subInput.value);
    if(platformConfig.logoBase64) localStorage.setItem('crow_platform_logo', platformConfig.logoBase64);
    alert("تم الحفظ بنجاح!");
    showScreen('landing-screen');
}

function renderAdminWaseetsTable() {
    let tbody = document.getElementById('admin-waseets-tbody');
    if(!tbody) return;
    let waseetPhones = [];
    for(let i=0; i<localStorage.length; i++) {
        let key = localStorage.key(i);
        if(key.startsWith('crow_waseet_name_')) waseetPhones.push(key.replace('crow_waseet_name_', ''));
    }
    if(waseetPhones.length === 0) {
        waseetPhones.push("0101111");
        localStorage.setItem('crow_waseet_name_0101111', "محمود السيد");
        localStorage.setItem('crow_waseet_pin_0101111', "1234");
        localStorage.setItem('crow_sub_start_0101111', new Date().toISOString().split('T')[0]);
        localStorage.setItem('crow_sub_end_0101111', new Date(Date.now() + 7*86400000).toISOString().split('T')[0]);
    }
    tbody.innerHTML = '';
    waseetPhones.forEach(phone => {
        let name = localStorage.getItem('crow_waseet_name_' + phone);
        let start = localStorage.getItem('crow_sub_start_' + phone) || '--';
        let end = localStorage.getItem('crow_sub_end_' + phone) || '--';
        let refs = localStorage.getItem('crow_refs_' + phone) || '0';
        
        tbody.innerHTML += `<tr>
            <td><b>${name}</b><br><small>${phone}</small></td>
            <td>CROW-${phone.slice(-4)}<br><small style="color:green;">إحالات: ${refs}/5</small></td>
            <td><span class="badge-green">${start} إلى ${end}</span></td>
            <td><button class="btn-warning" onclick="adminExtendSub('${phone}', 30)">+شهر</button></td>
            <td><button class="btn-warning" onclick="adminExtendSub('${phone}', 7)">+أسبوع</button></td>
            <td><button class="btn-info" onclick="adminChangeWaseetPin('${phone}')">PIN</button></td>
            <td><button class="btn-danger" onclick="adminDeleteWaseet('${phone}')">حذف</button></td>
            <td><button class="btn-success" onclick="loginAsWaseetDirectly('${phone}', '${name}')">دخول</button></td>
        </tr>`;
    });
}

function adminExtendSub(phone, days) {
    let endDate = new Date(localStorage.getItem('crow_sub_end_' + phone) || new Date());
    if(endDate < new Date()) endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    localStorage.setItem('crow_sub_end_' + phone, endDate.toISOString().split('T')[0]);
    alert("تم التجديد بنجاح!");
    renderAdminWaseetsTable();
}

function adminChangeWaseetPin(phone) {
    let pin = prompt("أدخل PIN الجديد (4 أرقام):");
    if(pin && pin.length >= 4) { localStorage.setItem('crow_waseet_pin_' + phone, pin); alert("تم التغيير!"); }
}

function adminDeleteWaseet(phone) {
    if(confirm("هل أنت متأكد من الحذف؟")) {
        ['crow_waseet_name_', 'crow_waseet_pin_', 'crow_sub_start_', 'crow_sub_end_', 'crow_refs_', 'crow_prods_', 'crow_orders_'].forEach(k => localStorage.removeItem(k + phone));
        renderAdminWaseetsTable();
    }
}
