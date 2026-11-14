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
    
    let savedName = localStorage.getItem('crow_waseet_name_' + phone) || `وسيط (${phone})`;
    currentWaseetPhone = phone;
    currentWaseetName = savedName;

    showScreen('waseet-dashboard');
    document.getElementById('waseet-welcome-text').innerText = `أهلاً بك يا ${savedName}`;
    updateWaseetReferralDisplay(phone);
    loadLocalData(phone);
}

function handleRegister() {
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const pin = document.getElementById('reg-pin').value.trim();
    const gov = document.getElementById('reg-gov').value.trim();
    const prof = document.getElementById('reg-prof').value;
    if(!name || !phone || !pin || !gov || !prof) { alert("أكمل الحقول الإجبارية"); return; }
    
    localStorage.setItem('crow_waseet_name_' + phone, name);
    currentWaseetPhone = phone;
    currentWaseetName = name;

    alert("تم إنشاء حسابك ومنحك أسبوعاً تجريبياً مجانياً!");
    showScreen('waseet-dashboard');
    document.getElementById('waseet-welcome-text').innerText = `أهلاً بك يا ${name} (${prof} - ${gov})`;
    updateWaseetReferralDisplay(phone);
    loadLocalData(phone);
}

function loginAsDemoUser() {
    let demoPhone = "01099998888";
    let demoName = localStorage.getItem('crow_waseet_name_' + demoPhone) || "أحمد محمود - وسيط معتمد";
    currentWaseetPhone = demoPhone;
    currentWaseetName = demoName;

    showScreen('waseet-dashboard');
    document.getElementById('waseet-welcome-text').innerText = `مرحباً بك يا ${demoName}`;
    updateWaseetReferralDisplay(demoPhone);
    loadLocalData(demoPhone);
}
