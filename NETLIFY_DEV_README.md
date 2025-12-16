# Test Netlify Functions Locally

Netlify Functions'ı yerel olarak test etmek için:

```bash
# Netlify CLI kur (eğer yoksa)
npm install -g netlify-cli

# Development server başlat
netlify dev
```

Bu komut:
- Port 8888'de local Netlify server başlatır
- Functions otomatik algılanır
- `http://localhost:8888/.netlify/functions/yahoo-proxy` adresinde çalışır

**Alternatif:**
Netlify CLI kurulmamışsa, expo web server kullanabilirsiniz ama functions çalışmaz. Production'da (Netlify'da deploy edilince) otomatik çalışır.
