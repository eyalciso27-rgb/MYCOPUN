import pandas as pd
import requests

# פרטי החיבור לענן שלך
URL = "https://iaihwnbbebjsirlhezwb.supabase.co/rest/v1/coupons"
ANON_KEY = "sb_publishable_JOxGwNl2y2S-wUL2Xp3LLA_Xn9UxEHJ"

headers = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

def sync():
    file_name = "Coupons_DB_NEW.xlsx"
    print("טוען נתונים מהאקסל...")
    
    # קריאת האקסל ושמירה על פורמט טקסט למספרים ארוכים
    df = pd.read_excel(file_name, dtype=str)
    df.columns = [c.strip().lower() for c in df.columns]
    
    payload = []
    for _, row in df.iterrows():
        payload.append({
            "company": str(row.get('network', 'אחר')),
            "title": "קופון מיובא",
            "value": str(row.get('value', '')),
            "code_or_link": str(row.get('code_or_link', '')),
            "expiry_date": str(row.get('expiry', '')),
            "cvv": str(row.get('cvv', '')),
            "category": str(row.get('קטגוריה', 'כללי'))
        })

    print(f"מעלה {len(payload)} קופונים לענן...")
    response = requests.post(URL, headers=headers, json=payload)
    
    if response.status_code in [200, 201]:
        print("הצלחה! רענן את הדף בדפדפן ותראה את הקופונים.")
    else:
        print(f"שגיאה בהעלאה: {response.text}")

if __name__ == "__main__":
    sync()