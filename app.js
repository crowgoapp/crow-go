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
    document.getElementById(screenId).classList.remove('hidden');
}

function handleLogin() {
    const phone = document.getElementById('login-phone').value;
    const pin = document.getElementById('login-pin').value;
    if(!phone || !pin) { alert("أدخل رقم الهاتف والـ PIN"); return; }
    alert("تم تسجيل الدخول بنجاح!");
}

function handleRegister() {
    const name = document.getElementById('reg-name').value;
    const phone = document.getElementById('reg-phone').value;
    const pin = document.getElementById('reg-pin').value;
    const gov = document.getElementById('reg-gov').value;
    const prof = document.getElementById('reg-prof').value;
    if(!name || !phone || !pin || !gov || !prof) { alert("أكمل الحقول الإجبارية"); return; }
    alert("تم إنشاء حسابك ومنحك أسبوعاً تجريبياً مجانياً!");
}
