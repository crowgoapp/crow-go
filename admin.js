function openAdminDirect() {
    let pass = prompt("أدخل كلمة مرور السوبر أدمن:");
    if (pass === "admin123") {
        showScreen('admin-dashboard');
    } else if (pass !== null) {
        alert("كلمة المرور غير صحيحة!");
    }
}

let tempLogo = '';
function previewNewLogo(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            tempLogo = e.target.result;
        }
        reader.readAsDataURL(file);
    }
}

function savePlatformSettings() {
    platformConfig.subtitle = document.getElementById('admin-subtitle-input').value;
    platformConfig.whatsapp = document.getElementById('admin-whatsapp-input').value;
    if(tempLogo) {
        platformConfig.logoBase64 = tempLogo;
    }

    document.getElementById('display-subtitle').innerText = platformConfig.subtitle;
    if(platformConfig.logoBase64) {
        document.getElementById('logo-display-container').innerHTML = `<img src="${platformConfig.logoBase64}" class="logo-img" alt="Logo">`;
    }

    alert("تم حفظ التعديلات وتحديث اللوجو والنصوص ورقم الواتساب بنجاح!");
    showScreen('landing-screen');
}
