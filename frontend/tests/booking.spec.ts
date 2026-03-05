import { test, expect } from '@playwright/test';

test.describe('Booking Flow', () => {
  test('should complete the booking flow as a vendor', async ({ page }) => {
    test.setTimeout(60000); // Increase timeout for slow dev server
    
    // Browser logs
    page.on('console', msg => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    page.on('request', request => {
        if (request.url().includes('/api/user/login')) {
            console.log('Login Request Payload:', request.postData());
        }
    });
    page.on('response', async response => {
      if (!response.ok()) {
        console.log(`Failed Response: ${response.url()} ${response.status()}`);
        try {
            console.log(await response.text());
        } catch (e) {}
      }
    });
    
    // 1. Login
    await page.goto('/antrian');
    console.log('Page loaded:', await page.url(), await page.title());
    
    // Use getByRole for more robust selection
    const mulaiOrderBtn = page.getByRole('link', { name: /Mulai Order/i });
    try {
        await expect(mulaiOrderBtn).toBeVisible({ timeout: 20000 });
    } catch (e) {
        console.log('Mulai Order button not found. Page content snippet:', (await page.content()).slice(0, 1000));
        throw e;
    }
    await mulaiOrderBtn.click();
    console.log('Clicked Mulai Order. Current URL:', page.url());
    
    // Check if login modal is visible
    const loginModal = page.locator('#login_modal');
    await expect(loginModal).toBeVisible();
    console.log('Login modal visible.');
    
    // Select "App" account type
    await page.getByRole('button', { name: /App/i }).click();
    console.log('Clicked App button.');
    
    // Fill credentials
    // Using placeholder-based selection
    await page.getByPlaceholder('ham').fill('vendor');
    await page.getByPlaceholder('******').fill('Zxcv1234');
    console.log('Filled credentials.');
    
    // Submit login
    await page.getByRole('button', { name: /Login Sekarang/i }).click();
    console.log('Clicked Login Sekarang. Waiting for navigation...');
    
    // Wait for navigation/redirection
    await page.waitForURL('**/vendor/**', { timeout: 30000 });
    
    // 2. Navigate to Booking Page (if not already there)
    if (!page.url().includes('/vendor/booking')) {
        await page.goto('/vendor/booking');
    }
    
    // 3. Warehouse Step
    await expect(page.getByText('Pilih Gudang')).toBeVisible({ timeout: 20000 });
    // Click "Pilih" on the first warehouse card
    await page.getByText('Pilih').first().click();
    
    // 4. Driver Step
    await expect(page.getByText('Pilih Driver')).toBeVisible({ timeout: 20000 });
    await page.getByText('Pilih Driver Ini').first().click();
    
    // 5. Vehicle Step
    await expect(page.getByText('Pilih Kendaraan')).toBeVisible({ timeout: 20000 });
    await page.getByText('Pilih').first().click();
    
    // 6. Dock Step
    await expect(page.getByText('Pilih Dock')).toBeVisible({ timeout: 20000 });
    // Select the first available dock select button
    await page.getByRole('button', { name: 'Pilih' }).first().click();
    
    // 7. Time Slot Selection
    await expect(page.getByText('Minggu yang dapat dipilih')).toBeVisible({ timeout: 20000 });
    
    // Click on a track to select a time
    const tracks = page.locator('.h-10.relative');
    await expect(tracks.first()).toBeVisible();
    await tracks.first().click({ position: { x: 200, y: 20 } });
    
    // 8. Confirmation Step
    await page.getByRole('button', { name: /Konfirmasi Booking/i }).click();
    
    // Verify confirmation details are visible
    await expect(page.getByText('Tinjau detail sebelum konfirmasi')).toBeVisible();
    
    console.log('E2E Test reached confirmation step successfully');
  });
});
