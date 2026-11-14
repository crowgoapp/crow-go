function openAdminDirect() {
    let savedAdminPass = localStorage.getItem('crow_admin_pass') || 'admin123';
    let pass = prompt("أدخل كلمة مرور السوبر أدمن:");
    if (pass === savedAdminPass) {
        showScreen('admin-dashboard');
        loadAdminSettingsToUI();
        renderAdminWaseetsTable();
    } else if (pass !== null) {
        alert("كلمة المرور غير صحيحة!");
    }
}

function changeAdminPassword() {
    let newPass = document.getElementById('admin-new-pass').value.trim();
    if (!newPass || newPass.length < 4) {
        alert("يرجى إدخال كلمة مرور جديدة لا تقل عن 4 أرقام/حروف!");
        return;
    }
    localStorage.setItem('crow_admin_pass', newPass);
    document.getElementById('admin-new-pass').value = '';
    alert("تم تحديث كلمة مرور الأدمن بنجاح!");
}

function loadAdminSettingsToUI() {
    let savedLogo = localStorage.getItem('crow_platform_logo');
    let savedSub = localStorage.getItem('crow_platform_sub');
    let savedWa = localStorage.getItem('crow_platform_wa');

    if(savedLogo) {
        platformConfig.logoBase64 = savedLogo;
        document.getElementById('logo-display-container').innerHTML = `<img src="${savedLogo}" class="logo-img" alt="Logo">`;
    }
    if(savedSub) {
        platformConfig.subtitle = savedSub;
        document.getElementById('display-subtitle').innerText = savedSub;
        document.getElementById('admin-subtitle-input').value = savedSub;
    }
    if(savedWa) {
        platformConfig.whatsapp = savedWa;
        document.getElementById('admin-whatsapp-input').value = savedWa;
    }
}

function previewNewLogo(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            platformConfig.logoBase64 = e.target.result;
            document.getElementById('logo-display-container').innerHTML = `<img src="${platformConfig.logoBase64}" class="logo-img" alt="Logo">`;
        }
        reader.readAsDataURL(file);
    }
}

function savePlatformSettings() {
    platformConfig.subtitle = document.getElementById('admin-subtitle-input').value;
    platformConfig.whatsapp = document.getElementById('admin-whatsapp-input').value;

    localStorage.setItem('crow_platform_sub', platformConfig.subtitle);
    localStorage.setItem('crow_platform_wa', platformConfig.whatsapp);
    if(platformConfig.logoBase64) {
        localStorage.setItem('crow_platform_logo', platformConfig.logoBase64);
    }

    document.getElementById('display-subtitle').innerText = platformConfig.subtitle;
    alert("تم حفظ وتثبيت إعدادات المنصة واللوجو بنجاح!");
    showScreen('landing-screen');
}

// عرض وتشغيل جدول الوسطاء في لوحة الأدمن مع متابعة الاشتراكات والإحالات بدقة
function renderAdminWaseetsTable() {
    let tbody = document.getElementById('admin-waseets-tbody');
    if(!tbody) return;

    let waseetPhones = [];
    for(let i=0; i<localStorage.length; i++) {
        let key = localStorage.key(i);
        if(key.startsWith('crow_waseet_name_')) {
            waseetPhones.push(key.replace('crow_waseet_name_', ''));
        }
    }

    if(waseetPhones.length === 0) {
        waseetPhones.push("0101111");
        localStorage.setItem('crow_waseet_name_0101111', "محمود السيد");
        let today = new Date().toISOString().split('T')[0];
        let weekLater = new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];
        localStorage.setItem('crow_sub_start_0101111', today);
        localStorage.setItem('crow_sub_end_0101111', weekLater);
    }

    tbody.innerHTML = '';
    waseetPhones.forEach(phone => {
        let name = localStorage.getItem('crow_waseet_name_' + phone) || `وسيط (${phone})`;
        let start = localStorage.getItem('crow_sub_start_' + phone) || '2026-11-01';
        let end = localStorage.getItem('crow_sub_end_' + phone) || '2026-12-01';
        let refs = parseInt(localStorage.getItem('crow_refs_' + phone) || '0', 10);
        let refCode = `CROW-${phone.slice(-4)}`;

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${name}</b><br><small>${phone}</small></td>
            <td>ميداني عام</td>
            <td><b>${refCode}</b><br><small style="color:#059669;">إحالات: ${refs}/5</small></td>
            <td><span class="badge-green">${start} إلى ${end}</span></td>
            <td><button type="button" class="btn-warning" onclick="adminExtendSub('${phone}', 30)">+شهر</button></td>
            <td><button type="button" class="btn-warning" onclick="adminExtendSub('${phone}', 7)">+أسبوع</button></td>
            <td><button type="button" class="btn-info" onclick="adminAddReferral('${phone}')">+إحالة (+1)</button></td>
            <td><button type="button" class="btn-success" onclick="loginAsWaseetDirectly('${phone}', '${name}')">دخول</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function adminExtendSub(phone, days) {
    let currentEndStr = localStorage.getItem('crow_sub_end_' + phone) || new Date().toISOString().split('T')[0];
    let endDate = new Date(currentEndStr);
    if(endDate < new Date()) endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    
    let newEndStr = endDate.toISOString().split('T')[0];
    localStorage.setItem('crow_sub_end_' + phone, newEndStr);
    alert(`تم تجديد الاشتراك للوسيط بنجاح حتى ${newEndStr}!`);
    renderAdminWaseetsTable();
}

function adminAddReferral(phone) {
    let refs = parseInt(localStorage.getItem('crow_refs_' + phone) || '0', 10) + 1;
    let msg = `تم تسجيل إحالة جديدة! (العدد الحالي: ${refs}/5)`;
    
    if (refs >= 5) {
        refs = 0; // تصفير العداد ومنح أسبوع مجاني تلقائياً
        let currentEndStr = localStorage.getItem('crow_sub_end_' + phone) || new Date().toISOString().split('T')[0];
        let endDate = new Date(currentEndStr);
        if(endDate < new Date()) endDate = new Date();
        endDate.setDate(endDate.getDate() + 7); // أسبوع مجاني مكافأة
        let newEndStr = endDate.toISOString().split('T')[0];
        localStorage.setItem('crow_sub_end_' + phone, newEndStr);
        msg += `\n🎉 مبروك! أكمل الوسيط 5 إحالات وتم تمديد اشتراكه تلقائياً (أسبوع مجاني) حتى ${newEndStr}!`;
    }
    
    localStorage.setItem('crow_refs_' + phone, refs);
    alert(msg);
    renderAdminWaseetsTable();
}
