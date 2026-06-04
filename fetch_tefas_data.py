import json
import os
import sys
from urllib.parse import quote
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pandas as pd
import requests
from pytefas import Crawler


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

        cred_dict = json.loads(cred_json)
        cred = credentials.Certificate(cred_dict)

        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)

        db = firestore.client()
        db.collection('funds').document('daily_snapshot').set(data)
        print("✅ Firebase'e yüklendi (funds/daily_snapshot)")
    except ImportError:
        print("⚠️ firebase-admin modülü yüklü değil, yükleme atlanıyor.")
    except Exception as e:
        print(f"❌ Firebase hatası: {e}")


def push_to_supabase(data):
    """Push TEFAS data to Supabase latest and snapshot tables."""
    try:
        supabase_url = os.environ.get('SUPABASE_URL')
        supabase_key = os.environ.get('SUPABASE_SERVICE_KEY')

        if not supabase_url or not supabase_key:
            print("ℹ️ SUPABASE_URL veya SUPABASE_SERVICE_KEY bulunamadı, Supabase'e yükleme yapılmayacak.")
            return {
                "success": False,
                "uploaded_count": 0,
                "total_count": len(data.get('data', {})) if isinstance(data, dict) else 0,
                "skipped": True,
                "error": "Supabase credentials missing",
            }

        print("☁️ Supabase'e bağlanılıyor...")
        sync_timestamp = data.get("lastUpdated") or datetime.now().isoformat()

        latest_records = []
        snapshot_records = []
        source_run_id = sync_timestamp

        for code, fund_data in data['data'].items():
            latest_records.append({
                'code': code,
                'price': fund_data['price'],
                'date': fund_data.get('date', ''),
                'daily_change': fund_data.get('dailyChange', 0),
                'name': fund_data.get('name', ''),
                'updated_at': sync_timestamp,
                'last_seen_at': sync_timestamp,
                'stale_since': None,
                'is_stale': False,
            })
            snapshot_records.append({
                'fund_code': code,
                'fund_name': fund_data.get('name', ''),
                'price': fund_data['price'],
                'daily_change': fund_data.get('dailyChange', 0),
                'price_date': fund_data.get('date', ''),
                'fetched_at': sync_timestamp,
                'source_run_id': source_run_id,
            })

        headers = {
            'apikey': supabase_key,
            'Authorization': f'Bearer {supabase_key}',
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
        }

        batch_size = 500
        uploaded_latest_count = 0
        uploaded_snapshot_count = 0

        for i in range(0, len(latest_records), batch_size):
            batch = latest_records[i:i + batch_size]
            response = requests.post(
                f'{supabase_url}/rest/v1/tefas_funds?on_conflict=code',
                headers=headers,
                json=batch,
                timeout=60,
            )
            if response.status_code not in [200, 201]:
                print(f"⚠️ Supabase batch {i // batch_size + 1} hatası: {response.status_code} - {response.text}")
            else:
                uploaded_latest_count += len(batch)
                print(f"✅ Supabase latest batch {i // batch_size + 1}: {len(batch)} kayıt yüklendi")

        for i in range(0, len(snapshot_records), batch_size):
            batch = snapshot_records[i:i + batch_size]
            response = requests.post(
                f'{supabase_url}/rest/v1/tefas_fund_snapshots?on_conflict=fund_code,price_date',
                headers=headers,
                json=batch,
                timeout=60,
            )
            if response.status_code not in [200, 201]:
                print(f"⚠️ Snapshot batch {i // batch_size + 1} hatası: {response.status_code} - {response.text}")
            else:
                uploaded_snapshot_count += len(batch)
                print(f"✅ Supabase snapshot batch {i // batch_size + 1}: {len(batch)} kayıt yüklendi")

        stale_response = requests.patch(
            f"{supabase_url}/rest/v1/tefas_funds?updated_at=lt.{quote(sync_timestamp, safe='')}",
            headers=headers,
            json={
                'is_stale': True,
                'stale_since': sync_timestamp,
            },
            timeout=60,
        )

        stale_marked = None
        if stale_response.status_code not in [200, 204]:
            print(f"⚠️ Stale işaretleme hatası: {stale_response.status_code} - {stale_response.text}")
        else:
            content_range = stale_response.headers.get('content-range')
            if content_range and '/' in content_range:
                stale_marked = content_range.split('/')[-1]

        print(
            "✅ Supabase'e yüklendi "
            f"(latest: {uploaded_latest_count}/{len(latest_records)}, "
            f"snapshot: {uploaded_snapshot_count}/{len(snapshot_records)})"
        )
        return {
            "success": uploaded_latest_count == len(latest_records) and uploaded_snapshot_count == len(snapshot_records),
            "uploaded_count": uploaded_latest_count,
            "snapshot_uploaded_count": uploaded_snapshot_count,
            "total_count": len(latest_records),
            "snapshot_total_count": len(snapshot_records),
            "stale_marked": stale_marked,
        }
    except Exception as e:
        print(f"❌ Supabase hatası: {e}")
        return {
            "success": False,
            "uploaded_count": 0,
            "snapshot_uploaded_count": 0,
            "total_count": len(data.get('data', {})) if isinstance(data, dict) else 0,
            "snapshot_total_count": len(data.get('data', {})) if isinstance(data, dict) else 0,
            "error": str(e),
        }


def is_workday(day):
    if day.weekday() >= 5:
        return False

    holidays = [
        (1, 1),
        (4, 23),
        (5, 1),
        (5, 19),
        (7, 15),
        (8, 30),
        (10, 29),
    ]
    return (day.month, day.day) not in holidays


def get_prev_workday(day):
    day = day - timedelta(days=1)
    while not is_workday(day):
        day = day - timedelta(days=1)
    return day


def get_target_trading_day():
    now = datetime.now(ZoneInfo("Europe/Istanbul"))
    target_day = now

    # TEFAS verileri genelde sabah saatlerinde önceki iş gününü yansıtabilir.
    # Kararı UTC yerine Istanbul saatine göre veriyoruz.
    if now.hour < 10:
        target_day = target_day - timedelta(days=1)

    while not is_workday(target_day):
        target_day = target_day - timedelta(days=1)

    return target_day


def fetch_snapshot_for_day(crawler, day):
    day_str = day.strftime('%Y-%m-%d')
    kinds = ("YAT", "EMK", "BYF", "GYF", "GSYF")
    print(f"📥 TEFAS snapshot alınıyor: {day_str}")

    if hasattr(crawler, 'fetch_many'):
        frame = crawler.fetch_many(day_str, kinds=kinds, columns="info")
        return frame if frame is not None else pd.DataFrame()

    frames = []
    for kind in kinds:
        try:
            frame = crawler.fetch(day_str, kind=kind, columns="info")
            if frame is not None and not frame.empty:
                frames.append(frame)
        except Exception as e:
            print(f"⚠️ {kind} tipi alınamadı: {e}")

    if not frames:
        return pd.DataFrame()

    return pd.concat(frames, ignore_index=True)


def fetch_latest_available_snapshot(crawler, start_day, max_lookback_days=5):
    day = start_day
    for _ in range(max_lookback_days):
        if is_workday(day):
            frame = fetch_snapshot_for_day(crawler, day)
            normalized = normalize_frame(frame)
            if not normalized.empty:
                return day, normalized
        day = get_prev_workday(day)
    return start_day, pd.DataFrame()


def normalize_frame(frame):
    if frame is None or frame.empty:
        return pd.DataFrame()

    normalized = frame.copy()
    normalized.columns = [str(col).strip() for col in normalized.columns]

    rename_map = {
        'fund_code': 'code',
        'fon_kodu': 'code',
        'symbol': 'code',
        'fund_name': 'name',
        'fon_adi': 'name',
        'title': 'name',
        'date': 'date',
        'tarih': 'date',
        'price': 'price',
        'fiyat': 'price',
    }
    normalized = normalized.rename(columns={k: v for k, v in rename_map.items() if k in normalized.columns})

    required_cols = {'code', 'name', 'date', 'price'}
    missing = required_cols - set(normalized.columns)
    if missing:
        raise ValueError(f"TEFAS verisinde beklenen alanlar eksik: {sorted(missing)}")

    normalized['code'] = normalized['code'].astype(str).str.upper().str.strip()
    normalized['name'] = normalized['name'].astype(str).str.strip()
    normalized['date'] = pd.to_datetime(normalized['date'], errors='coerce')
    normalized['price'] = pd.to_numeric(normalized['price'], errors='coerce')

    normalized = normalized.dropna(subset=['code', 'date', 'price'])
    normalized = normalized.sort_values(['code', 'date']).drop_duplicates(subset=['code'], keep='last')
    return normalized[['code', 'name', 'date', 'price']]


def build_payload(current_frame, previous_frame):
    previous_prices = {}
    if previous_frame is not None and not previous_frame.empty:
        previous_prices = {
            row['code']: float(row['price'])
            for _, row in previous_frame.iterrows()
        }

    data_map = {}
    fetch_time = datetime.now().isoformat()

    for _, row in current_frame.iterrows():
        code = row['code']
        price = float(row['price'])
        prev_price = previous_prices.get(code)

        daily_change = 0.0
        if prev_price and prev_price > 0:
            daily_change = ((price - prev_price) / prev_price) * 100

        data_map[code] = {
            "code": code,
            "price": price,
            "date": row['date'].strftime('%Y-%m-%d'),
            "dailyChange": round(daily_change, 6),
            "daily_change": round(daily_change, 6),
            "name": row['name'],
            "fetchedAt": fetch_time,
        }

    return {
        "lastUpdated": fetch_time,
        "count": len(data_map),
        "data": data_map,
    }


def save_payload(payload):
    output_dir = "src/data"
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, "tefas_data.json")

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"💾 Veriler kaydedildi ({payload['count']} fon): {output_file}")


def print_verification_summary(payload, supabase_result):
    data_map = payload.get("data", {})
    unique_dates = sorted({item.get("date") for item in data_map.values() if item.get("date")})
    latest_price_date = unique_dates[-1] if unique_dates else "unknown"

    print("========== TEFAS VERIFY ==========")
    print(f"Snapshot Updated At : {payload.get('lastUpdated')}")
    print(f"Fund Count          : {payload.get('count')}")
    print(f"Latest Price Date   : {latest_price_date}")

    if supabase_result:
        print(
            "Supabase Upload     : "
            f"{'OK' if supabase_result.get('success') else 'FAILED'} "
            f"({supabase_result.get('uploaded_count', 0)}/{supabase_result.get('total_count', 0)})"
        )
        print(
            "Snapshot Upload     : "
            f"({supabase_result.get('snapshot_uploaded_count', 0)}/{supabase_result.get('snapshot_total_count', 0)})"
        )
        if supabase_result.get("stale_marked") is not None:
            print(f"Stale Rows Marked   : {supabase_result['stale_marked']}")
        if supabase_result.get("error"):
            print(f"Supabase Error      : {supabase_result['error']}")
    else:
        print("Supabase Upload     : SKIPPED")

    print("==================================")


def fetch_all_funds():
    print("🚀 TEFAS verileri yeni API üzerinden çekiliyor...")

    try:
        crawler = Crawler(timeout=60, max_retry=5)

        initial_target_day = get_target_trading_day()
        target_day, current_frame = fetch_latest_available_snapshot(crawler, initial_target_day)
        if current_frame.empty:
            raise RuntimeError("TEFAS'tan güncel fon snapshot'ı alınamadı.")

        previous_day = get_prev_workday(target_day)
        _, previous_frame = fetch_latest_available_snapshot(crawler, previous_day, max_lookback_days=5)

        print(f"📅 Kullanılan fiyat günü: {target_day.strftime('%Y-%m-%d')}")
        print(f"📅 Karşılaştırma günü: {previous_day.strftime('%Y-%m-%d')}")

        payload = build_payload(current_frame, previous_frame)

        save_payload(payload)
        push_to_firebase(payload)
        supabase_result = push_to_supabase(payload)
        print_verification_summary(payload, supabase_result)

        credentials_present = bool(os.environ.get('SUPABASE_URL') and os.environ.get('SUPABASE_SERVICE_KEY'))
        if credentials_present and (not supabase_result or not supabase_result.get("success")):
            raise RuntimeError("Supabase upload failed")

        print(f"✅ İşlem tamamlandı. Toplam {payload['count']} fon güncellendi.")
        return True
    except Exception as e:
        print(f"❌ Hata oluştu: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = fetch_all_funds()
    sys.exit(0 if success else 1)
