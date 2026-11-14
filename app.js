let platformConfig = { logoBase64: '', subtitle: 'منظومة الإدارة الذكية للوسطاء الميدانيين' };

function showScreen(screenId) {
    ['landing-screen', 'login-screen', 'register-screen', 'admin-dashboard', 'waseet-dashboard'].forEach(id => {
        let el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
    let target = document.getElementById(screenId);
    if(target) target.classList.remove('hidden');
}

function handleLogin() {
    const phone = document.getElementById('login-phone').value.trim();
    const pin = document.getElementById('login-pin').value.trim();
    if(!phone || !pin) { alert("أدخل رقم الهاتف والـ PIN"); return; }
    let savedPin = localStorage.getItem('crow_waseet_pin_' + phone) || '1234';
    if(pin !== savedPin) { alert("الرقم السري غير صحيح!"); return; }
    let savedName = localStorage.getItem('crow_waseet_name_' + phone) || `وسيط (${phone})`;
    loginAsWaseetDirectly(phone, savedName);
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
    
    let today = new Date().toISOString().split('T')[0];
    let weekLater = new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];
    localStorage.setItem('crow_sub_start_' + phone, today);
    localStorage.setItem('crow_sub_end_' + phone, weekLater);

    if(refCodeInput) {
        let cleanRef = refCodeInput.toUpperCase().trim();
        let waseetPhones = [];
        for(let i=0; i<localStorage.length; i++) {
            let key = localStorage.key(i);
            if(key.startsWith('crow_waseet_name_')) waseetPhones.push(key.replace('crow_waseet_name_', ''));
        }
        let targetPhone = waseetPhones.find(p => `CROW-${p.slice(-4)}` === cleanRef);
        if(targetPhone) processAutomaticReferral(targetPhone);
    }

    alert("تم إنشاء حسابك ومنحك أسبوعاً تجريبياً مجانياً!");
    loginAsWaseetDirectly(phone, name);
}

function processAutomaticReferral(ownerPhone) {
    let refs = parseInt(localStorage.getItem('crow_refs_' + ownerPhone) || '0', 10) + 1;
    if (refs >= 5) {
        refs = 0;
        let currentEndStr = localStorage.getItem('crow_sub_end_' + ownerPhone) || new Date().toISOString().split('T')[0];
        let endDate = new Date(currentEndStr);
        if(endDate < new Date()) endDate = new Date();
        endDate.setDate(endDate.getDate() + 7);
        let newEndStr = endDate.toISOString().split('T')[0];
        localStorage.setItem('crow_sub_end_' + ownerPhone, newEndStr);
        localStorage.setItem('crow_reward_msg_' + ownerPhone, `🎉 تهانينا! أكملت 5 إحالات وتم منحك أسبوع مجاني حتى ${newEndStr}!`);
    }
    localStorage.setItem('crow_refs_' + ownerPhone, refs);
}

function loginAsDemoUser() { loginAsWaseetDirectly("01099998888", "أحمد محمود - وسيط معتمد"); }

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    let btn = document.getElementById('install-pwa-btn');
    if(btn) btn.style.display = 'block';
});

async function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
    }
}
