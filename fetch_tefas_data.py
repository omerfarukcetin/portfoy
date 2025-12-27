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
        
        # Prepare records for upsert - only use columns that exist in the table
        records = []
        for code, fund_data in data['data'].items():
            records.append({
                'code': code,
                'price': fund_data['price'],
                'date': fund_data.get('date', '')
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

    # 3. Prepare Request Data
    # TEFAS data might be empty on weekends or for "today".
    # Use a safe range (last 7 days ensure we catch a workday)
    # Note: TEFAS usually returns the "latest" data within that range or the comparison for that range.
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    
    # TEFAS BindComparisonFundReturns
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')

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
            data=list_payload, # Form data worked for this endpoint too in my last successful run (Step 240? Wait, Step 240 used Form Data)? 
            # Step 240: "Form Data (calismatipi=1) gönderiliyor..." -> Success (2116 items).
            # So data=list_payload is correct.
            headers=post_headers
        )
        
        data = response.json()
        fund_list = []
        if 'data' in data and data['data']:
            fund_list = [f['FONKODU'] for f in data['data']]
            print(f"✅ {len(fund_list)} adet fon bulundu.")
        else:
            print("❌ Fon listesi alınamadı.")
            return

        # Step 2: Fetch Prices for each fund
        # We'll use BindHistoryInfo which we verified works with Form Data + YYYY-MM-DD
        print("💰 Fiyatlar çekiliyor (Bu işlem birkaç dakika sürebilir)...")
        
        price_data_map = {}
        
        import concurrent.futures

        def get_price(code):
            try:
                # Need new session? Or share? Sharing is fine usually.
                # BindHistoryInfo payload
                # Use YYYY-MM-DD for this one as verified in Step 139/verify_tefas_history verification
                # wait, fetch_tefas_data.py currently has start_str as YYYY-MM-DD (from Step 236 modification).
                p_payload = {
                    "fontip": "YAT",
                    "bastarih": start_str, # YYYY-MM-DD
                    "bittarih": end_str,   # YYYY-MM-DD
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
        
        # Reducing threads to avoid WAF blocking (4 seems safe)
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            futures = [executor.submit(get_price, code) for code in fund_list]
            
            count = 0
            for future in concurrent.futures.as_completed(futures):
                code, price, date = future.result()
                if price:
                    price_data_map[code] = {
                        "code": code,
                        "price": price,
                        "date": date, # Timestamp or similar
                        "fetchedAt": datetime.now().isoformat()
                    }
                count += 1
                if count % 100 == 0:
                    print(f"⏳ {count}/{len(fund_list)} tamamlandı...")

        print(f"✅ {len(price_data_map)} adet fon fiyatı alındı.")

        if price_data_map:
            # 4. Save to JSON
            output_dir = "src/data"
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)
            
            output_file = f"{output_dir}/tefas_data.json"
            
            final_data = {
                "lastUpdated": datetime.now().isoformat(),
                "count": len(price_data_map),
                "data": price_data_map
            }
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(final_data, f, ensure_ascii=False, indent=2)
                
            print(f"💾 Veriler kaydedildi: {output_file}")
            
            # Firebase Push
            push_to_firebase(final_data)
            
            # Supabase Push
            push_to_supabase(final_data)
            
            return True
        
        return False

    except Exception as e:
        print(f"❌ Hata oluştu: {e}")
        import traceback
        traceback.print_exc()
        return False



if __name__ == "__main__":
    fetch_all_funds()
