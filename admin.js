function openAdminDirect() {
    let pass = prompt("أدخل كلمة مرور السوبر أدمن:");
    if (pass === "admin123") {
        showScreen('admin-dashboard');
        loadAdminSettingsToUI();
    } else if (pass !== null) {
        alert("كلمة المرور غير صحيحة!");
    }
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
