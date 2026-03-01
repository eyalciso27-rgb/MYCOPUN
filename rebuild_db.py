import sqlite3
import csv
import os

def rebuild_and_import():
    db_name = "coupons.db"
    file_name = "Coupons_DB_NEW.csv"

    # חיבור לבסיס הנתונים
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # שלב 1: מחיקה מוחלטת של הטבלה הקיימת (כדי למנוע כפילויות)
    print("מנקה נתונים קיימים...")
    cursor.execute("DROP TABLE IF EXISTS coupons")

    # שלב 2: יצירת הטבלה מחדש עם הגדרות נכונות
    cursor.execute('''
        CREATE TABLE coupons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company TEXT,
            title TEXT,
            coupon_type TEXT,
            value TEXT,
            code_or_link TEXT,
            expiry_date TEXT,
            cvv TEXT,
            category TEXT,
            status TEXT DEFAULT 'פעיל',
            notes TEXT
        )
    ''')

    if not os.path.exists(file_name):
        print(f"שגיאה: הקובץ {file_name} לא נמצא בתיקייה!")
        conn.close()
        return

    # שלב 3: ייבוא הנתונים מה-CSV
    try:
        with open(file_name, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                # ניקוי רווחים משמות העמודות ומהערכים
                row = {k.strip(): str(v).strip() for k, v in row.items() if k}
                
                # שליפת הנתונים לפי שמות העמודות בקובץ שלך
                company = row.get('network', '')
                value = row.get('value', '')
                code = row.get('code_or_link', '')
                expiry = row.get('expiry', '')
                cvv = row.get('cvv', '')
                status = row.get('sstatus', 'פעיל')
                category = row.get('קטגוריה', 'כללי')

                if company and value:
                    cursor.execute('''
                        INSERT INTO coupons (company, title, value, code_or_link, expiry_date, cvv, status, category)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (company, "קופון מיובא", value, code, expiry, cvv, status, category))
                    count += 1

            conn.commit()
            print(f"הצלחה! בסיס הנתונים אופס ו-{count} קופונים יובאו מחדש בצורה נקייה.")
    except Exception as e:
        print(f"שגיאה במהלך הייבוא: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    rebuild_and_import()