const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    let hasError = false;

    page.on('console', msg => {
        console.log(`BROWSER ${msg.type().toUpperCase()}:`, msg.text());
        if (msg.type() === 'error') {
            hasError = true;
        }
    });

    page.on('pageerror', error => {
        console.log('PAGE ERROR:', error.message);
        hasError = true;
    });

    try {
        await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 30000 });
        console.log('Page loaded. Waiting for 10s to detect potential loops...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        console.log('HTML Snippet (first 1000 chars):');
        const html = await page.content();
        console.log(html.substring(0, 1000));
        
        // Check if #root has children
        const hasContent = await page.evaluate(() => {
            const root = document.getElementById('root');
            return root && root.children.length > 0;
        });
        console.log('App rendered content into #root:', hasContent);
        
    } catch (e) {
        console.log('GOTO ERROR:', e.message);
    }
    
    await browser.close();
})();
