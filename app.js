let platformConfig = {
    logoBase64: '',
    subtitle: 'منظومة الإدارة الذكية للوسطاء الميدانيين (عقارات، سيارات، دليفري، وخدمات)',
    whatsapp: '201000000000'
};

function showScreen(screenId) {
    document.getElementById('landing-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('register-screen').classList.add('hidden');
    document.getElementById('admin-dashboard').classList.add('hidden');
    document.getElementById('waseet-dashboard').classList.add('hidden');
    document.getElementById(screenId).classList.remove('hidden');
}

function handleLogin() {
    const phone = document.getElementById('login-phone').value.trim();
    const pin = document.getElementById('login-pin').value.trim();
    if(!phone || !pin) { alert("أدخل رقم الهاتف والـ PIN"); return; }
    
    // التحقق من رقم السري المخزن
    let savedPin = localStorage.getItem('crow_waseet_pin_' + phone) || '1234';
    if(pin !== savedPin) { alert("الرقم السري (PIN) غير صحيح!"); return; }

    let savedName = localStorage.getItem('crow_waseet_name_' + phone) || `وسيط (${phone})`;
    currentWaseetPhone = phone;
    currentWaseetName = savedName;

    showScreen('waseet-dashboard');
    document.getElementById('waseet-welcome-text').innerText = `أهلاً بك يا ${savedName}`;
    
    let savedLogo = localStorage.getItem('crow_platform_logo');
    let logoContainer = document.getElementById('waseet-top-logo-container');
    if (savedLogo && logoContainer) {
        logoContainer.innerHTML = `<img src="${savedLogo}" class="logo-img" alt="Logo">`;
    }

    updateWaseetReferralDisplay(phone);
    updateWaseetSubscriptionUI(phone);
    loadLocalData(phone);
}

function handleRegister() {
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const pin = document.getElementById('reg-pin').value.trim();
    const gov = document.getElementById('reg-gov').value.trim();
    const prof = document.getElementById('reg-prof').value;
    const refCodeInput = document.getElementById('reg-ref-code').value.trim();

    if(!name || !phone || !pin || !gov || !prof) { alert("أكمل الحقول الإجبارية"); return; }
    
    localStorage.setItem('crow_waseet_name_' + phone, name);
    localStorage.setItem('crow_waseet_pin_' + phone, pin);
    
    // منح أسبوع تجريبي مجاني عند التسجيل
    let today = new Date().toISOString().split('T')[0];
    let weekLater = new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];
    localStorage.setItem('crow_sub_start_' + phone, today);
    localStorage.setItem('crow_sub_end_' + phone, weekLater);

    // معالجة كود الإحالة أوتوماتيكياً لو الوسيط الجديد استخدم كود زميله
    if(refCodeInput) {
        let cleanRef = refCodeInput.toUpperCase().trim();
        // البحث عن الوسيط صاحب الكود
        let waseetPhones = [];
        for(let i=0; i<localStorage.length; i++) {
            let key = localStorage.key(i);
            if(key.startsWith('crow_waseet_name_')) {
                waseetPhones.push(key.replace('crow_waseet_name_', ''));
            }
        }
        
        let targetPhone = waseetPhones.find(p => `CROW-${p.slice(-4)}` === cleanRef);
        if(targetPhone) {
            // زيادة إحالة أوتوماتيكياً لصاحب الكود
            processAutomaticReferral(targetPhone);
        }
    }

    currentWaseetPhone = phone;
    currentWaseetName = name;

    alert("تم إنشاء حسابك بنجاح ومنحك أسبوعاً تجريبياً مجانياً!");
    showScreen('waseet-dashboard');
    document.getElementById('waseet-welcome-text').innerText = `أهلاً بك يا ${name} (${prof} - ${gov})`;
    
    let savedLogo = localStorage.getItem('crow_platform_logo');
    let logoContainer = document.getElementById('waseet-top-logo-container');
    if (savedLogo && logoContainer) {
        logoContainer.innerHTML = `<img src="${savedLogo}" class="logo-img" alt="Logo">`;
    }

    updateWaseetReferralDisplay(phone);
    updateWaseetSubscriptionUI(phone);
    loadLocalData(phone);
}

// دالة الأتمتة لإضافة الإحالة ومنح الأسبوع المجاني تلقائياً عند وصولها لـ 5
function processAutomaticReferral(ownerPhone) {
    let refs = parseInt(localStorage.getItem('crow_refs_' + ownerPhone) || '0', 10) + 1;
    
    if (refs >= 5) {
        refs = 0; // تصفير العداد ومنح أسبوع مجاني أوتوماتيك
        let currentEndStr = localStorage.getItem('crow_sub_end_' + ownerPhone) || new Date().toISOString().split('T')[0];
        let endDate = new Date(currentEndStr);
        if(endDate < new Date()) endDate = new Date();
        endDate.setDate(endDate.getDate() + 7); // إضافة 7 أيام مجانية
        let newEndStr = endDate.toISOString().split('T')[0];
        localStorage.setItem('crow_sub_end_' + ownerPhone, newEndStr);
        
        // حفظ إشعار للوسيط صاحب الكود
        localStorage.setItem('crow_reward_msg_' + ownerPhone, `🎉 تهانينا! أكملت 5 إحالات ناجحة وتم منحك أسبوع مجاني أوتوماتيكياً حتى ${newEndStr}!`);
    }
    
    localStorage.setItem('crow_refs_' + ownerPhone, refs);
}

function loginAsDemoUser() {
    let demoPhone = "01099998888";
    let demoName = localStorage.getItem('crow_waseet_name_' + demoPhone) || "أحمد محمود - وسيط معتمد";
    currentWaseetPhone = demoPhone;
    currentWaseetName = demoName;

    if(!localStorage.getItem('crow_sub_start_' + demoPhone)) {
        let today = new Date().toISOString().split('T')[0];
        let monthLater = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];
        localStorage.setItem('crow_sub_start_' + demoPhone, today);
        localStorage.setItem('crow_sub_end_' + demoPhone, monthLater);
        localStorage.setItem('crow_waseet_pin_' + demoPhone, '1234');
    }

    showScreen('waseet-dashboard');
    document.getElementById('waseet-welcome-text').innerText = `مرحباً بك يا ${demoName}`;
    
    let savedLogo = localStorage.getItem('crow_platform_logo');
    let logoContainer = document.getElementById('waseet-top-logo-container');
    if (savedLogo && logoContainer) {
        logoContainer.innerHTML = `<img src="${savedLogo}" class="logo-img" alt="Logo">`;
    }

    updateWaseetReferralDisplay(demoPhone);
    updateWaseetSubscriptionUI(demoPhone);
    loadLocalData(demoPhone);
}
