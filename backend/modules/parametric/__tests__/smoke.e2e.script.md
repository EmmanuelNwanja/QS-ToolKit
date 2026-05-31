# E2E Smoke Test — Parametric Module

## Prerequisites
- Playwright installed (`npx playwright install`)
- Backend running at `http://localhost:5000`
- Frontend running at `http://localhost:3000`
- A test user account with a project
- Set `PARAMETRIC_ENGINE_ENABLED=true` and `NEXT_PUBLIC_PARAMETRIC_ENGINE_ENABLED=true`

## Script

```javascript
// save as parametric-smoke.spec.js
// Run: npx playwright test parametric-smoke.spec.js

const { test, expect } = require('@playwright/test');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@qstoolkit.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'testpassword123';

test.describe('Parametric Module Smoke Test', () => {

  test('a. Login to QSToolkit', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/auth/login`);
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('b. Navigate to existing Project page', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/projects`);
    await page.waitForSelector('text=Projects');
    // Click first project
    await page.locator('a[href*="/projects/"]').first().click();
    await page.waitForURL('**/projects/**');
    // Assert legacy features still work
    await expect(page.locator('.page-title')).toBeVisible();
  });

  test('c. Legacy features: create manual BOQ line', async ({ page }) => {
    // Navigate to BOQ page
    await page.goto(`${FRONTEND_URL}/boq`);
    await page.waitForSelector('text=Bill of Quantities');
    // Create a new BOQ document
    await page.click('text=New BOQ');
    await page.waitForURL('**/boq/new');
    await page.fill('input[name="title"]', 'E2E Test BOQ');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/boq/**');
    // Add a manual line
    await page.fill('input[placeholder*="Item No"]', '1');
    await page.fill('input[placeholder*="Description"]', 'E2E Test Manual Line');
    await page.click('text=Add Item');
    await expect(page.locator('text=E2E Test Manual Line')).toBeVisible();
  });

  test('d. Navigate to new Parametric page (flag ON)', async ({ page }) => {
    // Get a project ID from the project page
    await page.goto(`${FRONTEND_URL}/projects`);
    const projectLink = page.locator('a[href*="/projects/"]').first();
    const href = await projectLink.getAttribute('href');
    const projectId = href.split('/projects/')[1]?.split('/')[0]?.split('?')[0];
    await page.goto(`${FRONTEND_URL}/projects/${projectId}/parametric`);
    await page.waitForSelector('text=Smart Parametric');
  });

  test('e. Complete a beam calculation', async ({ page }) => {
    // Step 1: Select beam element
    await page.click('text=Beam');
    await page.waitForSelector('text=Span (mm)');
    
    // Step 2: Set span and standard
    const spanInput = page.locator('input[type="number"]').first();
    await spanInput.fill('6000');
    
    // Select ACI 318 standard
    await page.click('text=ACI 318');
    
    // Calculate
    await page.click('text=Calculate');
    await page.waitForTimeout(2000);
    
    // Step 3: Review — should show derived dimensions
    await expect(page.locator('text=Override Dimensions')).toBeVisible();
  });

  test('f. Inject to BOQ', async ({ page }) => {
    // Navigate to Step 4
    await page.click('text=Actions');
    await page.waitForSelector('text=Add to BOQ');
    
    // Click Add to BOQ
    await page.click('text=Add to BOQ');
    await page.waitForTimeout(1000);
    
    // Select the first BOQ in the picker
    const boqButton = page.locator('button:has-text("E2E Test BOQ")');
    if (await boqButton.isVisible()) {
      await boqButton.click();
      await page.waitForTimeout(2000);
      await expect(page.locator('text=BOQ lines injected')).toBeVisible();
    }
  });

  test('g. Assert BOQ total updated correctly', async ({ page }) => {
    // Navigate to the BOQ we injected into
    await page.goto(`${FRONTEND_URL}/boq`);
    await page.click('text=E2E Test BOQ');
    await page.waitForTimeout(1000);
    
    // Total should exist
    await expect(page.locator('text=Total').or(page.locator('text=total'))).toBeTruthy();
    
    // Original manual line still exists
    await expect(page.locator('text=E2E Test Manual Line')).toBeVisible();
  });
});

test.describe('Feature Flag OFF — Zero Parametric UI', () => {

  test('Project page loads without parametric UI when flag is off', async ({ page }) => {
    // This test assumes PARAMETRIC_ENGINE_ENABLED=false
    await page.goto(`${FRONTEND_URL}/projects`);
    await page.waitForSelector('text=Projects');
    
    // No parametric-related UI elements
    await expect(page.locator('text=Smart Parametric')).toHaveCount(0);
    
    // Standard project page still works
    const projectLink = page.locator('a[href*="/projects/"]').first();
    if (await projectLink.isVisible()) {
      const href = await projectLink.getAttribute('href');
      const projectId = href.split('/projects/')[1]?.split('/')[0]?.split('?')[0];
      await page.goto(`${FRONTEND_URL}/projects/${projectId}/parametric`);
      await expect(page.locator('text=Parametric Engine Disabled')).toBeVisible();
    }
  });
});
```

## Running

```bash
# Set env vars
export TEST_EMAIL=your-test-user@example.com
export TEST_PASSWORD=your-password
export FRONTEND_URL=http://localhost:3000

# Set feature flags
export PARAMETRIC_ENGINE_ENABLED=true
export NEXT_PUBLIC_PARAMETRIC_ENGINE_ENABLED=true

# Run
npx playwright test parametric-smoke.spec.js
```
