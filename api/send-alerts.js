export default async function handler(req, res) {
    // משיכת סודות מהשרת
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const resendKey = process.env.RESEND_API_KEY;

    // הגדרת תאריכי יעד (מחר, בעוד 7 ימים, בעוד 14 ימים)
    const today = new Date();
    const addDays = (days) => new Date(today.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const target1Day = addDays(1);
    const target7Days = addDays(7);
    const target14Days = addDays(14);

    try {
        // 1. שליפת כל הקופונים שפגים בתאריכים האלו ולא מומשו
        const couponsRes = await fetch(`${supabaseUrl}/rest/v1/coupons?is_redeemed=eq.false&expiry_date=in.(${target1Day},${target7Days},${target14Days})`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        const expiringCoupons = await couponsRes.json();

        if (!expiringCoupons.length) return res.status(200).json({ message: 'No coupons expiring soon.' });

        // 2. שליפת פרופילים של משתמשים כדי לבדוק הגדרות התראה והשגת כתובת אימייל
        const profilesRes = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id,email,group_id,email_alerts_active,remind_1_day,remind_7_days,remind_14_days`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        const profiles = await profilesRes.json();

        // 3. הצלבת הנתונים ושליחת מיילים
        for (const coupon of expiringCoupons) {
            // מציאת בעל הקופון לפי הקבוצה
            const owner = profiles.find(p => p.group_id === coupon.group_id);
            if (!owner || !owner.email_alerts_active) continue; // אם ביטל התראות לגמרי

            let shouldSend = false;
            let daysLeft = '';

            if (coupon.expiry_date === target1Day && owner.remind_1_day) { shouldSend = true; daysLeft = 'מחר'; }
            if (coupon.expiry_date === target7Days && owner.remind_7_days) { shouldSend = true; daysLeft = 'בעוד 7 ימים'; }
            if (coupon.expiry_date === target14Days && owner.remind_14_days) { shouldSend = true; daysLeft = 'בעוד 14 ימים'; }

            if (shouldSend) {
                // שליחת הבקשה ל-Resend
                await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: 'Coupons Wallet <onboarding@resend.dev>',
                        to: owner.email,
                        subject: `תזכורת: קופון ל${coupon.company} פג תוקף ${daysLeft}!`,
                        html: `
                            <div style="direction: rtl; font-family: Arial; text-align: right; background: #f4f7f6; padding: 20px; border-radius: 10px;">
                                <h2 style="color: #00C853;">היי! הכסף שלך מחכה לך 💸</h2>
                                <p>הקופון ששמרת בארנק עבור <strong>${coupon.company}</strong> עומד לפוג <strong>${daysLeft}</strong>.</p>
                                <p>אל תפספס אותו! היכנס עכשיו לאפליקציה, חפש את הקופון וסמן אותו כמומש לאחר השימוש.</p>
                                <a href="https://mycoupon.vercel.app/" style="display: inline-block; background: #1a1a1a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; margin-top: 10px;">פתח את הארנק</a>
                            </div>
                        `
                    })
                });
            }
        }

        return res.status(200).json({ message: 'Emails processed successfully' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
