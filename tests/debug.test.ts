import { test, expect } from '@playwright/test';

test('Debug: Check Initial Value', async ({ page }) => {
    await page.route('**/*.supabase.co/**', async route => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    });

    await page.goto('http://localhost:3001');
    await page.waitForTimeout(10000); 
    
    const bodyText = await page.textContent('body');
    console.log('--- BODY TEXT START ---');
    console.log(bodyText?.substring(0, 2000)); // Print first 2000 chars
    console.log('--- BODY TEXT END ---');
});
