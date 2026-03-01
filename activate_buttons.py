import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. חיבור תפריט הניווט למטה
nav_replacements = [
    ("ראשי", "/"),
    ("חיפוש", "search.html"),
    ("פרופיל", "profile.html"),
    ("מועדפים", "history.html"),
    ("סריקה", "category.html"),
    ("ארנק", "index.html")
]

for name, link in nav_replacements:
    pattern = r'href="[^"]*"([^>]*>[\s\S]*?' + name + r')'
    content = re.sub(pattern, f'href="{link}"\\1', content)

# 2. החלפת הסקריפט הישן בסקריפט החדש שכולל את כפתורי ה"העתק" ו"לאתר"
parts = content.split('<script>')
last_script = parts[-1].split('</script>')

new_script = """
    document.addEventListener("DOMContentLoaded", () => {
        const modal = document.getElementById("addCouponModal");
        const addButtons = Array.from(document.querySelectorAll("button")).filter(b => b.textContent.includes("add"));
        if(addButtons.length > 0) {
            const fabButton = addButtons[addButtons.length - 1]; 
            fabButton.onclick = () => modal.classList.remove("hidden");
        }
        loadCoupons();
    });
    function closeModal() { document.getElementById("addCouponModal").classList.add("hidden"); }
    async function submitCoupon(event) {
        event.preventDefault();
        const data = {
            company: document.getElementById("coupon_company").value,
            title: document.getElementById("coupon_title").value,
            coupon_type: document.getElementById("coupon_type").value,
            value: document.getElementById("coupon_value").value,
            code_or_link: document.getElementById("coupon_code").value,
            expiry_date: document.getElementById("coupon_expiry").value,
            cvv: document.getElementById("coupon_cvv").value,
            category: "כללי", notes: ""
        };
        try {
            const res = await fetch("/api/coupons", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(data) });
            if(res.ok) { alert("הקופון נשמר בהצלחה!"); closeModal(); document.getElementById("addCouponForm").reset(); loadCoupons(); }
        } catch(e) { alert("שגיאה בתקשורת מול השרת."); }
    }
    async function loadCoupons() {
        try {
            const res = await fetch("/api/coupons"); const coupons = await res.json();
            const headers = Array.from(document.querySelectorAll("h3")).filter(h => h.textContent.includes("הארנק שלי"));
            if (!headers.length) return;
            const section = headers[0].closest("section");
            section.innerHTML = "<h3 class=\\"text-lg font-bold text-slate-900 dark:text-white px-1 mb-4\\">הארנק שלי (" + coupons.length + ")</h3>";
            coupons.forEach(c => {
                const cvvHTML = c.cvv ? `<div class="text-left pl-2 border-l border-slate-200 dark:border-slate-700 ml-4"><p class="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">CVV</p><p class="text-sm font-mono font-bold text-slate-600 dark:text-slate-300">${c.cvv}</p></div>` : "";
                const isLink = c.code_or_link.includes('http');
                const linkBtn = isLink ? `<button onclick="window.open('${c.code_or_link}', '_blank')" class="flex-1 bg-primary text-white rounded-xl py-3 flex flex-col items-center justify-center gap-1 hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"><span class="material-symbols-outlined text-[20px]">open_in_new</span><span class="text-[10px] font-bold">לאתר</span></button>` : '';
                
                section.innerHTML += `
                <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden relative mb-4">
                    <div class="p-5 relative z-10">
                        <div class="flex justify-between items-start mb-4">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-800 border border-slate-200">${c.company.charAt(0)}</div>
                                <div><h4 class="font-bold text-slate-900 dark:text-white text-lg">${c.company}</h4><span class="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">${c.title}</span></div>
                            </div>
                            <div class="text-left"><span class="block text-xl font-black text-primary">${c.value}</span></div>
                        </div>
                        <div class="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-dashed border-slate-300 dark:border-slate-600 mb-4 flex justify-between items-center">
                            <div><p class="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">קוד / קישור</p><p class="text-lg font-mono font-bold text-slate-800 dark:text-slate-200 tracking-widest">${c.code_or_link}</p></div>${cvvHTML}
                        </div>
                        <div class="flex justify-between items-center text-sm mb-4"><span class="text-xs text-slate-400 font-bold px-1">תוקף: ${c.expiry_date || "ללא תוקף"}</span></div>
                        <div class="bg-slate-50 dark:bg-slate-900 p-3 flex gap-2 rounded-xl border border-slate-100 dark:border-slate-800">
                            <button onclick="navigator.clipboard.writeText('${c.code_or_link}'); alert('הקוד הועתק בהצלחה!')" class="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-colors">
                                <span class="material-symbols-outlined text-primary text-[20px]">content_copy</span>
                                <span class="text-[10px] font-bold text-slate-600 dark:text-slate-300">העתק קוד</span>
                            </button>
                            ${linkBtn}
                        </div>
                    </div>
                </div>`;
            });
        } catch(e) {}
    }
"""

last_script[0] = new_script
parts[-1] = '</script>'.join(last_script)
content = '<script>'.join(parts)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("DONE! הכפתורים הופעלו בהצלחה.")