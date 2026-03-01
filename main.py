from fastapi import FastAPI
from fastapi.responses import FileResponse
from pydantic import BaseModel
import sqlite3

app = FastAPI()
DB_NAME = "coupons.db" 

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS coupons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company TEXT,
            title TEXT,
            coupon_type TEXT,
            value TEXT,
            code_or_link TEXT,
            expiry_date DATE,
            cvv TEXT,
            category TEXT,
            status TEXT DEFAULT 'פעיל',
            notes TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

class Coupon(BaseModel):
    company: str
    title: str = ""
    coupon_type: str = "code"
    value: str
    code_or_link: str
    expiry_date: str = ""
    cvv: str = ""
    category: str = "כללי"
    notes: str = ""

@app.get("/")
def serve_home():
    return FileResponse("index.html")

@app.get("/api/coupons")
def get_coupons():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM coupons ORDER BY company ASC")
    coupons = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return coupons

@app.post("/api/coupons")
def add_coupon(coupon: Coupon):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO coupons (company, title, coupon_type, value, code_or_link, expiry_date, cvv, category, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (coupon.company, coupon.title, coupon.coupon_type, coupon.value, coupon.code_or_link, coupon.expiry_date, coupon.cvv, coupon.category, coupon.notes))
    conn.commit()
    conn.close()
    return {"message": "Success"}

@app.delete("/api/coupons/{coupon_id}")
def delete_coupon(coupon_id: int):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM coupons WHERE id = ?", (coupon_id,))
    conn.commit()
    conn.close()
    return {"message": "Deleted"}

@app.put("/api/coupons/{coupon_id}")
def update_coupon(coupon_id: int, coupon: Coupon):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE coupons 
        SET company=?, title=?, value=?, code_or_link=?, expiry_date=?, cvv=?
        WHERE id=?
    ''', (coupon.company, coupon.title, coupon.value, coupon.code_or_link, coupon.expiry_date, coupon.cvv, coupon_id))
    conn.commit()
    conn.close()
    return {"message": "Updated"}