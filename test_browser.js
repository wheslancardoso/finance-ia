const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'wheslancardoso1064@gmail.com');
  await page.fill('input[type="password"]', 'vesper123');
  await page.click('button:has-text("Entrar")');
  
  await page.waitForNavigation();
  console.log("Navigated to:", page.url());
  
  const cookies = await page.context().cookies();
  console.log("Cookies:", cookies.map(c => c.name));
  
  // Also get the HTML to see what's on the page
  const html = await page.content();
  console.log("Contains Erro ao carregar?", html.includes("Erro ao carregar estado financeiro"));
  
  await browser.close();
})();
