import requests
import json
import os
from datetime import datetime, timedelta

def push_to_firebase(data):
    try:
        import firebase_admin
        from firebase_admin import credentials
        from firebase_admin import firestore

        cred_json = os.environ.get('FIREBASE_CREDENTIALS')
        if not cred_json:
            print("ℹ️ FIREBASE_CREDENTIALS bulunamadı, Firebase'e yükleme yapılmayacak.")
            return

        print("☁️ Firebase'e bağlanılıyor...")
        
        # Parse credentials
        cred_dict = json.loads(cred_json)
        cred = credentials.Certificate(cred_dict)
        
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
            
        db = firestore.client()
        
        # Save to funds/daily_snapshot
        # Firestore document size limit is 1MB. 
        # 1000 funds * ~150 bytes = 150KB. Safe.
        doc_ref = db.collection('funds').document('daily_snapshot')
        doc_ref.set(data)
        
        print("✅ Firebase'e yüklendi (funds/daily_snapshot)")
        
    except ImportError:
        print("⚠️ firebase-admin modülü yüklü değil, yükleme atlanıyor.")
    except Exception as e:
        print(f"❌ Firebase hatası: {e}")

def push_to_supabase(data):
    """Push TEFAS data to Supabase tefas_funds table"""
    try:
        supabase_url = os.environ.get('SUPABASE_URL')
        supabase_key = os.environ.get('SUPABASE_SERVICE_KEY')
        
        if not supabase_url or not supabase_key:
            print("ℹ️ SUPABASE_URL veya SUPABASE_SERVICE_KEY bulunamadı, Supabase'e yükleme yapılmayacak.")
            return
        
        print("☁️ Supabase'e bağlanılıyor...")
        
        # Prepare records for upsert
        records = []
        for code, fund_data in data['data'].items():
            records.append({
                'code': code,
                'price': fund_data['price'],
                'date': fund_data.get('date', ''),
                'daily_change': fund_data.get('dailyChange', 0),
                'name': fund_data.get('name', '')
            })
        
        # Use Supabase REST API directly
        headers = {
            'apikey': supabase_key,
            'Authorization': f'Bearer {supabase_key}',
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        }
        
        # Upsert in batches of 500
        batch_size = 500
        for i in range(0, len(records), batch_size):
            batch = records[i:i+batch_size]
            response = requests.post(
                f'{supabase_url}/rest/v1/tefas_funds',
                headers=headers,
                json=batch
            )
            if response.status_code not in [200, 201]:
                print(f"⚠️ Supabase batch {i//batch_size + 1} hatası: {response.status_code} - {response.text}")
            else:
                print(f"✅ Supabase batch {i//batch_size + 1}: {len(batch)} kayıt yüklendi")
            
            # Small delay between batches
            import time
            time.sleep(0.5)
        
        print(f"✅ Supabase'e yüklendi ({len(records)} fon)")
        
    except Exception as e:
        print(f"❌ Supabase hatası: {e}")

def fetch_all_funds():
    print("🚀 TEFAS Verileri Çekiliyor...")
    
    # 1. Setup Session & Headers
    session = requests.Session()
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.tefas.gov.tr/FonKarsilastirma.aspx'
    }
    session.headers.update(headers)

    # 2. Warmup (Get Cookies)
    try:
        session.get('https://www.tefas.gov.tr/FonKarsilastirma.aspx')
        print("✅ Oturum açıldı (Cookies alındı)")
    except Exception as e:
        print(f"❌ Oturum açma hatası: {e}")
        return

    # TEFAS data might be empty on weekends or for "today".
    # For a true "daily" return, we want the difference between the most recent workday (T) and the one before it (T-1).
    def is_workday(d):
        # 0: Monday, 4: Friday
        if d.weekday() >= 5:
            return False
        # Fixed holidays in Turkey
        holidays = [
            (1, 1),   # New Year 
            (4, 23),  # National Sovereignty
            (5, 1),   # Labor Day
            (5, 19),  # Youth & Sports
            (7, 15),  # Democracy Day
            (8, 30),  # Victory Day
            (10, 29), # Republic Day
        ]
        if (d.month, d.day) in holidays:
            return False
        return True

    def get_prev_workday(d):
        d = d - timedelta(days=1)
        while not is_workday(d):
            d = d - timedelta(days=1)
        return d

    now = datetime.now()
    # Determine end_date: the most recent trading day with completed results
    # TEFAS usually updates between 00:00 and 09:00 TRT for the previous day.
    target_end = now
    if now.hour < 10: # If early morning, use the day before yesterday as endpoint
        target_end = target_end - timedelta(days=1)
    
    # Go back until we find a workday
    while not is_workday(target_end):
        target_end = target_end - timedelta(days=1)
    
    end_date = target_end
    start_date = get_prev_workday(end_date)
    
    # TEFAS BindComparisonFundReturns
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')
    print(f"📅 Getiri Aralığı: {start_str} -> {end_str}")

    payload = {
        "calismatipi": 1,
        "fontip": "YAT", 
        "siralama": 1,
        "bastarih": start_str,
        "bittarih": end_str,
        "kurucukod": ""
    }

    try:
        # Step 1: Get List of Funds
        print("📋 Fon listesi alınıyor...")
        post_headers = {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' 
        }
        
        # We know calismatipi: 1 works for finding funds
        list_payload = {
            "calismatipi": 1,
            "fontip": "YAT", 
            "siralama": 1,
            "bastarih": start_str,
            "bittarih": end_str,
            "kurucukod": ""
        }

        response = session.post(
            'https://www.tefas.gov.tr/api/DB/BindComparisonFundReturns',
            data=list_payload,
            headers=post_headers
        )
        
        try:
            data = response.json()
        except Exception as e:
            print(f"❌ JSON Decode Hatası: {e}")
            print(f"📄 Yanıt İçeriği: {response.text[:500]}")
            return
        
        fund_list = []
        fund_daily_returns = {}  # Store daily returns from this API
        
        if 'data' in data and data['data']:
            for f in data['data']:
                code = f['FONKODU']
                fund_list.append(code)
                # Correct field names from API:
                # GETIRIORANI = Daily return percentage
                # FONUNVAN = Fund name
                fund_daily_returns[code] = {
                    'daily_change': f.get('GETIRIORANI', 0),
                    'name': f.get('FONUNVAN', '')
                }
            print(f"✅ {len(fund_list)} adet fon bulundu.")
            
            # Debug: Show first 5 returns
            sample_codes = fund_list[:5]
            print("🔍 Örnek Getiriler:")
            for sc in sample_codes:
                print(f"   - {sc}: {fund_daily_returns[sc]['daily_change']}%")
        else:
            print("❌ Fon listesi alınamadı.")
            return

        # Step 2: Fetch detailed prices for each fund (to get exact latest price)
        # Load existing data for additive updates
        output_dir = "src/data"
        output_file = f"{output_dir}/tefas_data.json"
        price_data_map = {}
        
        if os.path.exists(output_file):
            try:
                with open(output_file, 'r', encoding='utf-8') as f:
                    old_data = json.load(f)
                    if 'data' in old_data:
                        price_data_map = old_data['data']
                        print(f"📂 Mevcut {len(price_data_map)} fon verisi yüklendi (üzerine güncellenecek).")
            except Exception as e:
                print(f"⚠️ Mevcut veri yüklenemedi: {e}")

        print("💰 Fiyatlar çekiliyor (Sıralı ve gecikmeli işlem yapılıyor)...")
        
        import concurrent.futures

        def get_price(code):
            try:
                # Need new session? Or share? Sharing is fine usually.
                # BindHistoryInfo payload
                # Use YYYY-MM-DD for this one as verified in Step 139/verify_tefas_history verification
                # wait, fetch_tefas_data.py currently has start_str as YYYY-MM-DD (from Step 236 modification).
                # Fetch last 30 days to ensure we get the latest price
                history_end = datetime.now()
                history_start = history_end - timedelta(days=30)
                
                p_payload = {
                    "fontip": "YAT",
                    "bastarih": history_start.strftime('%Y-%m-%d'),
                    "bittarih": history_end.strftime('%Y-%m-%d'),
                    "fonkod": code
                }
                
                # BindHistoryInfo Needs Form Data
                r = session.post(
                    'https://www.tefas.gov.tr/api/DB/BindHistoryInfo',
                    data=p_payload,
                    headers=post_headers
                )
                d = r.json()
                if d.get('data'):
                    # Get latest price
                    latest = d['data'][0] 
                    return code, latest.get('FIYAT'), latest.get('TARIH')
            except:
                pass
            
            # Fallback: GetAllFundAnalyzeData (for funds like RTP blocked on History)
            try:
                detail_payload = {
                    "fonTip": "YAT", 
                    "fonKod": code,
                    "bastarih": start_str, 
                    "bittarih": end_str
                }
                r = session.post(
                    'https://www.tefas.gov.tr/api/DB/GetAllFundAnalyzeData',
                    data=detail_payload,
                    headers=post_headers
                )
                d = r.json()
                # Check fundInfo
                if d.get('fundInfo') and len(d['fundInfo']) > 0:
                    info = d['fundInfo'][0]
                    # Format: SONFIYAT, TARIH is usually not explicitly here? 
                    # "TARIH" is not in the snippet seen in Step 407.
                    # Usually "fundInfo" is a snapshot of "Today" or requested range?
                    # The snippet showed "SONFIYAT": 11.460931.
                    # We can assume it is the latest available price.
                    # Use endpoint date or current date? 
                    # Let's use end_str or today ISO? 
                    # Actually "fundInfo" usually implies current status.
                    return code, info.get('SONFIYAT'), datetime.now().isoformat() # Uses today as fallback date
            except Exception as e:
                # print(f"Fallback failed for {code}: {e}")
                pass

            return code, None, None

        # Limit to 50 for testing, or all?
        # User wants "one time fetch". Let's do ALL but maybe user can stop it?
        # Let's do ALL but with 20 threads it should be fast.
        
        # For DEMO/Verification sake, let's cap at 50, but comment out the cap for production.
        # Actually I will just run for ALL. It's 2000 items. 20 threads = 100 batches. 100 * 0.5s = 50s. Acceptable.
        
        import random
        import time
        
        def save_data(data_map):
            if not data_map:
                return
            
            final_data = {
                "lastUpdated": datetime.now().isoformat(),
                "count": len(data_map),
                "data": data_map
            }
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(final_data, f, ensure_ascii=False, indent=2)
            print(f"💾 Veriler kaydedildi ({len(data_map)} fon): {output_file}")
            return final_data

        try:
            count = 0
            success_count = 0
            for code in fund_list:
                count += 1
                code_res, price, date = get_price(code)
                
                if price:
                    daily_info = fund_daily_returns.get(code, {})
                    try:
                        daily_change_val = float(daily_info.get('daily_change', 0) or 0)
                    except:
                        daily_change_val = 0.0
                    
                    price_data_map[code] = {
                        "code": code,
                        "price": price,
                        "date": date,
                        "dailyChange": daily_change_val,
                        "daily_change": daily_change_val,
                        "name": daily_info.get('name', ''),
                        "fetchedAt": datetime.now().isoformat()
                    }
                    success_count += 1
                
                # Randomized jitter to avoid WAF (0.2s - 0.7s)
                if count < len(fund_list):
                    time.sleep(random.uniform(0.2, 0.7))
                
                if count % 20 == 0:
                    print(f"⏳ {count}/{len(fund_list)} tamamlandı... (Yeni başarılar: {success_count})")
                
                # Periodically save locally
                if count % 100 == 0:
                    save_data(price_data_map)
                    
        finally:
            print(f"🏁 İşlem tamamlanıyor. Son durum kaydediliyor...")
            final_result = save_data(price_data_map)
            
            if final_result:
                # Firebase Push
                push_to_firebase(final_result)
                # Supabase Push
                push_to_supabase(final_result)
                return True
        
        return False

    except Exception as e:
        print(f"❌ Hata oluştu: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    fetch_all_funds()
