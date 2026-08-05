import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => {
      console.log('BROWSER CONSOLE:', msg.type(), msg.text());
    });
    
    page.on('pageerror', err => {
      console.error('BROWSER ERROR:', err.message);
    });

    await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
    
    console.log('Page loaded');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('SCRIPT ERROR:', err);
    process.exit(1);
  }
})();
