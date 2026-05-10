import { test, expect } from '@playwright/test';

test('Diagnostic: Check userId and IndexedDB', async ({ page }) => {
  await page.goto('http://localhost:3001');
  
  await page.waitForSelector('text=Dashboard', { timeout: 15000 });

  const userId = await page.evaluate(() => localStorage.getItem('vesper_user_id'));
  console.log('DIAGNOSTIC: Browser userId:', userId);

  const dbInfo = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const request = indexedDB.open('VesperDB');
      request.onsuccess = (event: any) => {
        const db = event.target.result;
        resolve({
          name: db.name,
          version: db.version,
          objectStoreNames: Array.from(db.objectStoreNames)
        });
      };
      request.onerror = () => resolve('Error opening DB');
    });
  });
  console.log('DIAGNOSTIC: DB Info:', JSON.stringify(dbInfo));

  const txCount = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const request = indexedDB.open('VesperDB');
      request.onsuccess = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('transactions')) {
            resolve(0);
            return;
        }
        const transaction = db.transaction(['transactions'], 'readonly');
        const store = transaction.objectStore('transactions');
        const countRequest = store.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
        countRequest.onerror = () => resolve('Error counting');
      };
      request.onerror = () => resolve('Error opening DB');
    });
  });
  console.log('DIAGNOSTIC: Transaction count in IndexedDB:', txCount);
});
