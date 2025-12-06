const https = require('https');
const querystring = require('querystring');

const request = (method, url, headers, data) => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);

        const options = {
            method: method,
            headers: headers,
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            port: 443,
            rejectUnauthorized: false, // Mimic verify=False
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body), raw: body });
                    } catch (e) {
                        resolve({ status: res.statusCode, headers: res.headers, data: null, raw: body });
                    }
                } else {
                    resolve({ status: res.statusCode, headers: res.headers, data: null, raw: body });
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (data) {
            req.write(data);
        }
        req.end();
    });
};

const TEFAS_BASE_URL = 'https://www.tefas.gov.tr/api/DB';

async function testTefas() {
    console.log('Testing TEFAS API (Attempt 2: Form Data + No SSL Verify)...');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    // Format dates as YYYY-MM-DD or whatever the Python code effectively sent?
    // Python code: `data` keys are snake_case in source but the dict keys are:
    // {"fontip": fund_type, "bastarih": start_date, "bittarih": end_date, "fonkod": fund_code}
    // The Python example start_date was "2024-01-01".
    // My previous attempt used ISO string. Let's try to match Python:

    const formatDate = (d) => {
        // YYYY-MM-DD
        return d.toISOString().split('T')[0];
    };

    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);

    // Note: Python `BindHistoryInfo` uses: fontip, bastarih, bittarih, fonkod.
    const formData = querystring.stringify({
        fontip: "YAT", // Try YAT or ALL
        bastarih: startStr,
        bittarih: endStr,
        fonkod: "RTP"
    });

    const directHeaders = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://www.tefas.gov.tr/TarihselVeriler.aspx',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
        'Content-Length': Buffer.byteLength(formData)
    };

    console.log("Sending Form Data:", formData);

    try {
        // First get cookies just in case (handshake)
        const getCookies = () => new Promise((resolve, reject) => {
            const options = {
                method: 'GET',
                hostname: 'www.tefas.gov.tr',
                path: '/TarihselVeriler.aspx',
                port: 443,
                rejectUnauthorized: false,
                headers: {
                    'User-Agent': directHeaders['User-Agent']
                }
            };
            https.request(options, (res) => resolve(res.headers['set-cookie'])).end();
        });

        const cookies = await getCookies();
        const cookieStr = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
        console.log("Cookies:", cookieStr);

        const headersWithCookie = { ...directHeaders, 'Cookie': cookieStr };

        const res = await request('POST', `${TEFAS_BASE_URL}/BindHistoryInfo`, headersWithCookie, formData);
        console.log(`Response Status: ${res.status}`);

        if (res.data) {
            console.log("Success! Data length:", res.data?.data?.length);
            // console.log("Sample:", res.data?.data?.[0]);
        } else {
            console.log("Failed. Raw body:", res.raw.substring(0, 500));
        }

    } catch (e) {
        console.log("Error:", e.message);
    }
}

testTefas();
