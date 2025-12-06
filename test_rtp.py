import requests
import json
from datetime import datetime, timedelta

def test_rtp():
    print("🚀 RTP Testi Başlıyor...")
    
    session = requests.Session()
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.tefas.gov.tr/FonKarsilastirma.aspx'
    }
    session.headers.update(headers)

    # Warmup
    try:
        session.get('https://www.tefas.gov.tr/FonKarsilastirma.aspx')
        print("✅ Oturum açıldı")
    except Exception as e:
        print(f"❌ Oturum hatası: {e}")
        return

    end_date = datetime.now()
    start_date = end_date - timedelta(days=30) # 30 days history
    
    start_str = start_date.strftime('%Y-%m-%d')
    end_str = end_date.strftime('%Y-%m-%d')

    print(f"📅 Tarih: {start_str} - {end_str}")

    # Try GetAllFundAnalyzeData (Fund Detail)
    print("📋 Fon Detay (GetAllFundAnalyzeData) isteniyor...")
    
    # Payload similar to marketData.ts getFundDetail
    # fonTip: type, fonKod: code, bastarih, bittarih
    detail_payload = {
        "fonTip": "YAT", 
        "fonKod": "RTP",
        "bastarih": start_str, # DD.MM.YYYY? Python uses ISO in fetch_tefas_data (sometimes). marketData.ts used Locale string.
        # TEFAS usually likes DD.MM.YYYY for legacy ASPX endpoints or YYYY-MM-DD for API.
        # Let's try ISO YYYY-MM-DD since start_str is YYYY-MM-DD
        "bittarih": end_str
    }
    
    try:
        response = session.post(
            'https://www.tefas.gov.tr/api/DB/GetAllFundAnalyzeData',
            data=detail_payload,
            headers={'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}
        )
        
        print(f"Status: {response.status_code}")
        data = response.json()
        if data.get('data'):
             print(f"✅ DETAY VERİ GELDİ: {len(data['data'])} kayıt.")
             print(data['data'][0]) # Check for FIYAT
        else:
             print("❌ Detay Veri Yok.")
             print("Body:", response.text[:200])

    except Exception as e:
        print(f"❌ İstek hatası: {e}")

if __name__ == "__main__":
    test_rtp()
