#R
const supabaseUrl = 'https://iaihwnbbebjsirlhezwb.supabase.co';
const supabaseKey = 'sb_publishable_JOxGwNl2y2S-wUL2Xp3LLA_Xn9UxEHJ';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let allCoupons = [];
let profile = null;
let groupKey = null;
let selectedTab = 'הכל';

// משתנה חדש למעקב אחרי הקופונים המסומנים
let selectedCoupons = new Set(); 

function safeStr(str) { return str ? str.replace(/'/g, "\\'").replace(/"/g, '&quot;') : ''; }

window.toggleGroup = function(idx) {
    const el = document.getElementById(`group-${idx}`);
    const icon = document.getElementById(`icon-${idx}`);
    if(el) {
        el.classList.toggle('hidden');
        if(icon) icon.style.transform = el.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
    }
};

async function checkUser() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        const { data: userProfile } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        if (userProfile) {
            profile = userProfile;
            profile.email = session.user.email;
            document.getElementById('login-screen').classList.add('hidden');
            if (profile.is_approved) {
                document.getElementById('app-content').classList.remove('hidden');
                document.getElementById('pending-screen').classList.add('hidden');
                await fetchOrCreateGroupKey(profile.group_id);
                loadFromCloud();
            } else {
                document.getElementById('pending-screen').classList.remove('hidden');
            }
        }
    }
}

async function fetchOrCreateGroupKey(groupId) {
    const { data } = await supabaseClient.from('group_keys').select('encryption_key').eq('group_id', groupId).maybeSingle();
    if (data && data.encryption_key) groupKey = data.encryption_key;
    else {
        const randomKey = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');
        await supabaseClient.from('group_keys').insert([{ group_id: groupId, encryption_key: randomKey }]);
        groupKey = randomKey;
    }
}

function encrypt(text) { return text ? CryptoJS.AES.encrypt(text, groupKey).toString() : ""; }
function decrypt(ciphertext) {
    if(!ciphertext) return "";
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, groupKey);
        const text = bytes.toString(CryptoJS.enc.Utf8);
        return text.length > 0 ? text : ciphertext;
    } catch (e) { return ciphertext; }
}

async function loadFromCloud() {
    const { data } = await supabaseClient.from('coupons').select('*').order('is_redeemed', { ascending: true }).order('company', { ascending: true });
    if (data) {
        allCoupons = data.map(c => ({ 
            ...c, 
            code_or_link: decrypt(c.code_or_link),
            cvv: decrypt(c.cvv)
        }));
        updateAutocomplete();
        renderTabs();
        render();
    }
}

function updateAutocomplete() {
    const companies = [...new Set(allCoupons.map(c => c.company).filter(Boolean)), "רמי לוי", "שופרסל", "וולט", "פוקס", "נופשונית", "תו הזהב", "Max"].sort();
    document.getElementById('companiesList').innerHTML = [...new Set(companies)].map(name => `<option value="${name}">`).join('');
    const categories = [...new Set(allCoupons.map(c => c.category).filter(Boolean)), "מזון", "פארם", "אופנה", "דלק", "מתנות"].sort();
    document.getElementById('categoriesList').innerHTML = [...new Set(categories)].map(cat => `<option value="${cat}">`).join('');
}

function renderTabs() {
    const uniqueCategories = [...new Set(allCoupons.map(c => c.category).filter(Boolean))].sort();
    const allTabs = ['הכל', ...uniqueCategories];
    document.getElementById('tabs-container').innerHTML = allTabs.map(tab => `
        <button onclick="selectTab('${tab}')" class="whitespace-nowrap px-5 py-2 rounded-full text-sm font-bold border transition-all ${selectedTab === tab ? 'bg-dark text-white border-dark shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}">${tab}</button>
    `).join('');
}

function selectTab(tab) { 
    selectedTab = tab; 
    selectedCoupons.clear(); // מנקה בחירות במעבר בין חוצצים
    updateBulkActionsUI();
    renderTabs(); 
    render(); 
}

// --- פונקציות הבחירה החדשות ---
window.toggleCouponSelection = function(id, isChecked) {
    if(isChecked) selectedCoupons.add(id);
    else selectedCoupons.delete(id);
    updateBulkActionsUI();
};

window.toggleGroupSelection = function(idx, isChecked) {
    // מציאת הרשת שעליה לחצו
    const filteredCoupons = selectedTab === 'הכל' ? allCoupons : allCoupons.filter(c => c.category === selectedTab);
    const grouped = {};
    filteredCoupons.forEach(c => {
        const name = c.company || "אחר";
        if (!grouped[name]) grouped[name] = { list: [] };
        grouped[name].list.push(c);
    });
    
    const groupName = Object.keys(grouped)[idx];
    const groupCoupons = grouped[groupName].list;
    
    // סימון או ביטול סימון לכל הקופונים ברשת הזו
    groupCoupons.forEach(c => {
        if(isChecked) selectedCoupons.add(c.id);
        else selectedCoupons.delete(c.id);
    });
    
    render(); // מרענן כדי להראות את ה-V על הקופונים
    updateBulkActionsUI();
};

window.updateBulkActionsUI = function() {
    const bar = document.getElementById('bulk-actions-bar');
    const countSpan = document.getElementById('bulk-selected-count');
    if(selectedCoupons.size > 0) {
        countSpan.innerText = selectedCoupons.size;
        bar.classList.remove('hidden');
        bar.classList.add('flex');
    } else {
        bar.classList.add('hidden');
        bar.classList.remove('flex');
    }
};

window.clearSelection = function() {
    selectedCoupons.clear();
    render();
    updateBulkActionsUI();
};

window.deleteSelectedCoupons = async function() {
    if(selectedCoupons.size === 0) return;
    if(confirm(`האם אתה בטוח שברצונך למחוק ${selectedCoupons.size} קופונים לצמיתות?`)) {
        const idsToDelete = Array.from(selectedCoupons);
        
        // מחיקה מרובה מהשרת בפקודה אחת!
        await supabaseClient.from('coupons').delete().in('id', idsToDelete);
        
        selectedCoupons.clear();
        updateBulkActionsUI();
        loadFromCloud(); // טוען מחדש מהשרת
    }
};

function render() {
    const container = document.getElementById('main-container');
    const filteredCoupons = selectedTab === 'הכל' ? allCoupons : allCoupons.filter(c => c.category === selectedTab);
    let totalVal = 0; const grouped = {};

    filteredCoupons.forEach(c => {
        const name = c.company || "אחר";
        if (!grouped[name]) grouped[name] = { list: [], sum: 0 };
        grouped[name].list.push(c);
        if(!c.is_redeemed) {
            const val = parseFloat(String(c.value).replace(/[^0-9.]/g, '')) || 0;
            grouped[name].sum += val; totalVal += val;
        }
    });

    document.getElementById('total-value').innerText = `סה"כ: ₪${totalVal.toLocaleString()}`;

    if (filteredCoupons.length === 0) {
        container.innerHTML = `<div class="text-center p-10 text-slate-400">החוצץ ריק...</div>`; return;
    }

    container.innerHTML = Object.keys(grouped).map((name, idx) => {
        const g = grouped[name]; const isOpen = idx === 0; 
        
        // בדיקה האם כל הקופונים בקבוצה הזו נבחרו (בשביל תיבת ה-V הראשית)
        const groupIds = g.list.map(c => c.id);
        const allSelected = groupIds.length > 0 && groupIds.every(id => selectedCoupons.has(id));

        return `
        <div class="bg-white rounded-3xl overflow-hidden shadow-sm mb-4 border border-slate-200">
            <div onclick="toggleGroup(${idx})" class="p-5 flex justify-between items-center cursor-pointer active:bg-slate-50 transition-colors">
                <div class="flex items-center gap-3 sm:gap-4">
                    <div class="flex items-center" onclick="event.stopPropagation()">
                        <input type="checkbox" class="w-5 h-5 accent-primary cursor-pointer border-slate-300 rounded" ${allSelected ? 'checked' : ''} onchange="toggleGroupSelection(${idx}, this.checked)">
                    </div>
                    <div class="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-bold border border-slate-100 hidden sm:flex">${name.charAt(0)}</div>
                    <h3 class="font-extrabold text-slate-800">${name}</h3>
                </div>
                <div class="flex items-center gap-3">
                    <span class="bg-green-50 text-green-700 px-3 py-1 rounded-full text-[10px] font-black tracking-tighter">₪${g.sum.toLocaleString()}</span>
                    <span class="material-symbols-rounded text-slate-300 transition-transform" id="icon-${idx}" style="transform: ${isOpen ? 'rotate(180deg)' : 'rotate(0deg)'}">expand_more</span>
                </div>
            </div>
            <div id="group-${idx}" class="${isOpen ? '' : 'hidden'} px-5 pb-5 space-y-3 bg-slate-50/50 pt-3 border-t border-slate-100">
                ${g.list.map(c => {
                    const isRedeemed = c.is_redeemed;
                    const isLink = c.code_or_link && (c.code_or_link.includes('http') || c.code_or_link.includes('.co.il'));
                    const isChecked = selectedCoupons.has(c.id);

                    return `
                    <div class="${isRedeemed ? 'bg-white opacity-60' : 'bg-white'} ${isChecked ? 'ring-2 ring-primary border-transparent' : 'border-slate-200'} p-4 rounded-2xl shadow-sm border relative overflow-hidden transition-all">
                        
                        <div class="absolute top-4 right-4 z-10">
                            <input type="checkbox" class="w-5 h-5 accent-primary cursor-pointer border-slate-300 rounded" value="${c.id}" ${isChecked ? 'checked' : ''} onchange="toggleCouponSelection(${c.id}, this.checked)">
                        </div>

                        ${isRedeemed ? '<div class="absolute top-4 left-4 bg-slate-200 text-slate-500 text-[10px] px-2 py-1 rounded-md font-bold uppercase">מומש</div>' : ''}
                        
                        <div class="flex justify-between items-start mb-3 mt-8">
                            <div>
                                <p class="text-lg font-black text-primary mb-1 ${isRedeemed ? 'text-slate-400' : ''}">${c.value || '₪0'}</p>
                                <p class="text-[11px] font-bold text-slate-400 flex items-center gap-1"><span class="material-symbols-rounded text-[13px]">calendar_month</span> ${c.expiry_date ? 'תוקף: ' + c.expiry_date : 'ללא תוקף'}</p>
                            </div>
                            <button onclick="toggleRedeemed(${c.id}, ${isRedeemed})" class="w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-sm ${isRedeemed ? 'bg-slate-200 text-slate-500' : 'bg-green-50 text-green-600 border border-green-100'}"><span class="material-symbols-rounded text-xl">${isRedeemed ? 'undo' : 'check'}</span></button>
                        </div>
                        <div class="bg-slate-50 p-3 rounded-xl text-center font-mono font-bold text-lg text-slate-700 break-all select-all border border-slate-100 mb-3 ${isRedeemed ? 'line-through text-slate-400' : ''}">
                            <span>${c.code_or_link}</span>
                            ${c.cvv ? `<div class="text-sm text-slate-500 mt-1 bg-white inline-block px-2 py-0.5 rounded-lg border border-slate-200 shadow-sm">CVV: ${c.cvv}</div>` : ''}
                        </div>
                        <div class="flex gap-2">
                            ${isLink ? `<button onclick="window.open('${escapeStr(c.code_or_link.startsWith('http') ? c.code_or_link : 'https://' + c.code_or_link)}', '_blank')" class="flex-1 bg-primary text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-sm"><span class="material-symbols-rounded text-[16px]">open_in_new</span>פתח</button>` : ''}
                            <button onclick="copyCode('${safeStr(c.code_or_link)}')" class="flex-1 bg-dark text-white py-2 rounded-xl text-xs font-bold shadow-sm">העתק</button>
                            <button onclick="openEdit(${c.id})" class="w-10 h-8 bg-white rounded-xl text-slate-400 border border-slate-200 flex items-center justify-center"><span class="material-symbols-rounded text-[16px]">edit</span></button>
                            </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }).join('');
}

window.copyCode = function(text) { navigator.clipboard.writeText(text); alert("הקוד הועתק!"); };
window.escapeStr = function(str) { return str.replace(/'/g, "\\'").replace(/"/g, '&quot;'); };

window.toggleRedeemed = async function(id, state) { await supabaseClient.from('coupons').update({ is_redeemed: !state }).eq('id', id); loadFromCloud(); };

// כל שאר הפונקציות (ייבוא, ייצוא, מודאלים) ללא שינוי מהגרסה הקודמת
window.openBulkAddModal = function() {
    document.getElementById('rows-container').innerHTML = '';
    addCouponRow(); 
    document.getElementById('bulkAddModal').classList.remove('hidden');
};

window.closeBulkAdd = function() { document.getElementById('bulkAddModal').classList.add('hidden'); };

window.addCouponRow = function(company='', category='', value='', expiry='', code='', cvv='', idToEdit='new') {
    const rowId = 'row-' + Date.now() + Math.floor(Math.random() * 1000);
    const html = `
    <div class="coupon-row flex flex-wrap lg:flex-nowrap gap-2 items-center bg-slate-50 p-3 rounded-2xl border border-slate-200 relative" id="${rowId}" data-db-id="${idToEdit}">
        <button onclick="document.getElementById('${rowId}').remove()" class="text-red-400 hover:text-red-600 p-2"><span class="material-symbols-rounded text-xl">delete</span></button>
        <div class="w-full sm:w-[calc(50%-1rem)] lg:w-1/6"><input type="text" list="companiesList" class="c-company w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-primary text-sm font-bold" placeholder="מותג (למשל וולט)" value="${company}"></div>
        <div class="w-full sm:w-[calc(50%-1rem)] lg:w-1/6"><input type="text" list="categoriesList" class="c-category w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-primary text-sm font-bold" placeholder="חוצץ (למשל מזון)" value="${category}"></div>
        <div class="w-full sm:w-[calc(25%-1rem)] lg:w-[12%]"><input type="text" class="c-value w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-primary text-sm" placeholder="שווי (₪)" value="${value}"></div>
        <div class="w-full sm:w-[calc(25%-1rem)] lg:w-[15%]"><input type="date" class="c-expiry w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-primary text-sm text-right" value="${expiry}"></div>
        <div class="w-full sm:w-[calc(20%-1rem)] lg:w-[10%]"><input type="text" class="c-cvv w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-primary text-sm font-mono" placeholder="CVV" value="${cvv}"></div>
        <div class="w-full sm:w-[calc(30%-1rem)] lg:flex-1"><input type="text" class="c-code w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-primary text-sm font-mono" placeholder="קוד או קישור" value="${code}"></div>
    </div>`;
    document.getElementById('rows-container').insertAdjacentHTML('beforeend', html);
    const container = document.getElementById('rows-container');
    container.scrollTop = container.scrollHeight;
};

window.openEdit = function(id) {
    const c = allCoupons.find(x => x.id === id);
    document.getElementById('rows-container').innerHTML = '';
    addCouponRow(c.company || '', c.category || '', c.value || '', c.expiry_date || '', c.code_or_link || '', c.cvv || '', c.id);
    document.getElementById('bulkAddModal').classList.remove('hidden');
};

window.saveBulkToCloud = async function() {
    const rows = document.querySelectorAll('.coupon-row');
    if(rows.length === 0) return closeBulkAdd();

    const newCoupons = [];
    const updateCoupons = [];

    rows.forEach(row => {
        const dbId = row.getAttribute('data-db-id');
        const company = row.querySelector('.c-company').value.trim();
        const code = row.querySelector('.c-code').value.trim();
        const cvv = row.querySelector('.c-cvv').value.trim();
        
        if(!company && !code && !cvv) return;

        const payload = {
            company: company,
            category: row.querySelector('.c-category').value.trim() || 'כללי',
            value: row.querySelector('.c-value').value.trim(),
            expiry_date: row.querySelector('.c-expiry').value || null,
            code_or_link: encrypt(code),
            cvv: encrypt(cvv), 
            group_id: profile.group_id
        };

        if(dbId === 'new') {
            payload.is_redeemed = false;
            newCoupons.push(payload);
        } else {
            payload.id = parseInt(dbId);
            updateCoupons.push(payload);
        }
    });

    if(newCoupons.length > 0) await supabaseClient.from('coupons').insert(newCoupons);
    for(let u of updateCoupons) { await supabaseClient.from('coupons').update(u).eq('id', u.id); }

    closeBulkAdd();
    loadFromCloud();
};

window.handleExcelUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const workbook = XLSX.read(e.target.result, {type: 'binary'});
        const excelRows = XLSX.utils.sheet_to_row_object_array(workbook.Sheets[workbook.SheetNames[0]]);
        
        const container = document.getElementById('rows-container');
        if(container.children.length === 1) { 
            const firstRow = container.firstElementChild;
            if(!firstRow.querySelector('.c-company').value && !firstRow.querySelector('.c-code').value) {
                container.innerHTML = ''; 
            }
        }

        excelRows.forEach(row => {
            const company = row['network'] || row['מותג'] || '';
            const category = row['קטגוריה'] || row['category'] || 'כללי';
            const value = row['value'] || row['שווי'] || '';
            const expiry = row['expiry'] || row['תוקף'] || '';
            const code = row['code_or_link'] || row['קוד'] || '';
            const cvv = row['cvv'] || row['CVV'] || ''; 
            if(company || code || cvv) addCouponRow(company, category, value, expiry, code, cvv);
        });
        event.target.value = ''; 
    };
    reader.readAsBinaryString(file);
};

window.downloadTemplate = function() {
    const ws = XLSX.utils.json_to_sheet([{
        'מותג': '', 'קטגוריה': '', 'שווי': '', 'תוקף': 'YYYY-MM-DD', 'קוד או לינק': '', 'CVV': ''
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "תבנית");
    XLSX.writeFile(wb, "Coupon_Template.xlsx");
};

window.openExportModal = function() {
    if(allCoupons.length === 0) { alert("אין קופונים לייצוא!"); return; }
    const companies = [...new Set(allCoupons.map(c => c.company || 'אחר'))].sort();
    let html = '';
    companies.forEach(comp => {
        html += `
        <label class="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors">
            <input type="checkbox" class="export-comp-cb w-4 h-4 accent-primary" value="${comp}" checked>
            <span class="text-slate-700 font-bold">${comp}</span>
        </label>`;
    });
    document.getElementById('export-companies-list').innerHTML = html;
    document.getElementById('export_all_checkbox').checked = true;
    document.getElementById('exportModal').classList.remove('hidden');
};

window.closeExportModal = function() { document.getElementById('exportModal').classList.add('hidden'); };

window.toggleAllExport = function(el) {
    document.querySelectorAll('.export-comp-cb').forEach(cb => cb.checked = el.checked);
};

window.executeExport = function() {
    const selected = Array.from(document.querySelectorAll('.export-comp-cb:checked')).map(cb => cb.value);
    if(selected.length === 0) { alert("אנא בחר לפחות מותג אחד לייצוא"); return; }
    
    const toExport = allCoupons.filter(c => selected.includes(c.company || 'אחר')).map(c => ({
        'מותג': c.company || '',
        'קטגוריה': c.category || '',
        'שווי': c.value || '',
        'תוקף': c.expiry_date || '',
        'קוד או לינק': c.code_or_link || '',
        'CVV': c.cvv || '',
        'סטטוס': c.is_redeemed ? 'מומש' : 'פעיל'
    }));
    
    const ws = XLSX.utils.json_to_sheet(toExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Coupons");
    XLSX.writeFile(wb, "My_Smart_Wallet_Coupons.xlsx");
    closeExportModal();
};

window.toggleSubOptions = function() {
    const master = document.getElementById('master_toggle').checked;
    document.getElementById('sub_options').style.opacity = master ? '1' : '0.5';
    document.getElementById('sub_options').style.pointerEvents = master ? 'auto' : 'none';
};

window.openSettings = function() {
    document.getElementById('master_toggle').checked = profile.email_alerts_active ?? true;
    document.getElementById('set_14_days').checked = profile.remind_14_days ?? true;
    document.getElementById('set_7_days').checked = profile.remind_7_days ?? true;
    document.getElementById('set_1_day').checked = profile.remind_1_day ?? true;
    toggleSubOptions(); document.getElementById('settingsModal').classList.remove('hidden');
};

window.closeSettings = function() { document.getElementById('settingsModal').classList.add('hidden'); };

window.saveSettings = async function() {
    const master = document.getElementById('master_toggle').checked;
    const r14 = document.getElementById('set_14_days').checked;
    const r7 = document.getElementById('set_7_days').checked;
    const r1 = document.getElementById('set_1_day').checked;

    await supabaseClient.from('profiles').update({ email_alerts_active: master, remind_14_days: r14, remind_7_days: r7, remind_1_day: r1 }).eq('id', profile.id);
    profile.email_alerts_active = master; profile.remind_14_days = r14; profile.remind_7_days = r7; profile.remind_1_day = r1;
    closeSettings();
};

window.testEmail = async function() {
    const email = prompt("לאיזו כתובת מייל תרצה לשלוח את הודעת הבדיקה?", profile?.email || "");
    if(!email) return;

    alert("שולח בקשה לשרת... אנא המתן.");
    try {
        const res = await fetch('/api/test-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        const data = await res.json();
        if (data.id) alert("✅ המייל נשלח בהצלחה! בדוק את תיבת הדואר שלך (וגם את תיקיית הספאם).");
        else alert("❌ שגיאה בשליחה מהשרת:\n" + JSON.stringify(data));
    } catch (err) {
        alert("❌ שגיאת תקשורת עם השרת:\n" + err.message);
    }
};

window.signInWithGoogle = async function() { await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }); };
window.signOut = async function() { await supabaseClient.auth.signOut(); window.location.reload(); };

window.onload = checkUser;
