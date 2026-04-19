const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    let hasError = false;

    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log('BROWSER ERROR:', msg.text());
            hasError = true;
        }
    });

    page.on('pageerror', error => {
        console.log('PAGE ERROR:', error.message);
        hasError = true;
    });

    try {
        await page.goto('http://localhost:8081', { waitUntil: 'networkidle0', timeout: 30000 });
        if (!hasError) {
            console.log('No errors detected on load. HTML Snippet:');
            const html = await page.content();
            console.log(html.substring(0, 500));
        }
    } catch (e) {
        console.log('GOTO ERROR:', e.message);
    }
    
    await browser.close();
})();
