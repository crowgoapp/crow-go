function openAdminDirect() {
    let savedAdminPass = localStorage.getItem('crow_admin_pass') || 'admin123';
    let pass = prompt("أدخل كلمة مرور السوبر أدمن:");
    if (pass === savedAdminPass) {
        showScreen('admin-dashboard');
        loadAdminSettingsToUI();
    } else if (pass !== null) {
        alert("كلمة المرور غير صحيحة!");
    }
}

// دالة تغيير كلمة مرور الأدمن بنفسه
function changeAdminPassword() {
    let newPass = document.getElementById('admin-new-pass').value.trim();
    if (!newPass || newPass.length < 4) {
        alert("يرجى إدخال كلمة مرور جديدة لا تقل عن 4 أرقام/حروف!");
        return;
    }
    localStorage.setItem('crow_admin_pass', newPass);
    document.getElementById('admin-new-pass').value = '';
    alert("تم تحديث كلمة مرور الأدمن بنجاح! احتفظ بها جيداً.");
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

window.addEventListener('DOMContentLoaded', () => {
    let savedLogo = localStorage.getItem('crow_platform_logo');
    let savedSub = localStorage.getItem('crow_platform_sub');
    if(savedLogo) {
        document.getElementById('logo-display-container').innerHTML = `<img src="${savedLogo}" class="logo-img" alt="Logo">`;
    }
    if(savedSub) {
        document.getElementById('display-subtitle').innerText = savedSub;
    }
});
