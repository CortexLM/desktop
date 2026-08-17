import { test, expect } from '../fixtures/electron';
import { AccountPage } from '../page-objects';

test.describe('Account Tests', () => {
  let accountPage: AccountPage;

  test.beforeEach(async ({ page }) => {
    accountPage = new AccountPage(page);
    await page.waitForLoadState('domcontentloaded');
    await accountPage.openAccountPanel();
  });

  test('should open account panel', async ({ page }) => {
    await expect(page.locator('[data-testid="account-panel"]')).toBeVisible();
  });

  test('should display profile tab', async ({ page }) => {
    await accountPage.switchToProfile();
    
    await page.waitForTimeout(500);
    
    // Verify profile elements
    await expect(page.locator('[data-testid="profile-name"]')).toBeVisible();
  });

  test('should display team tab', async ({ page }) => {
    await accountPage.switchToTeam();
    
    await page.waitForTimeout(500);
    
    // Verify team elements
    await expect(page.locator('[data-testid="team-members"]')).toBeVisible();
  });

  test('should display billing tab', async ({ page }) => {
    await accountPage.switchToBilling();
    
    await page.waitForTimeout(500);
    
    // Verify billing elements
    await expect(page.locator('[data-testid="billing-plan"]')).toBeVisible();
  });

  test('should get profile information', async ({ page }) => {
    await accountPage.switchToProfile();
    
    const name = await accountPage.getProfileName();
    const email = await accountPage.getProfileEmail();
    
    expect(typeof name).toBe('string');
    expect(typeof email).toBe('string');
  });

  test('should edit profile', async ({ page }) => {
    await accountPage.switchToProfile();
    
    const newName = `Test User ${Date.now()}`;
    const newEmail = `test${Date.now()}@example.com`;
    
    await accountPage.editProfile(newName, newEmail);
    
    await page.waitForTimeout(1000);
    
    // Verify changes saved
    const savedName = await accountPage.getProfileName();
    expect(savedName).toContain(newName);
  });

  test('should display team members', async ({ page }) => {
    await accountPage.switchToTeam();
    
    const memberCount = await accountPage.getTeamMembersCount();
    
    expect(typeof memberCount).toBe('number');
    expect(memberCount).toBeGreaterThanOrEqual(0);
  });

  test('should invite team member', async ({ page }) => {
    await accountPage.switchToTeam();
    
    const email = `invite${Date.now()}@example.com`;
    
    await accountPage.inviteTeamMember(email, 'member');
    
    await page.waitForTimeout(1000);
  });

  test('should display current billing plan', async ({ page }) => {
    await accountPage.switchToBilling();
    
    const plan = await accountPage.getCurrentPlan();
    
    expect(typeof plan).toBe('string');
    expect(plan.length).toBeGreaterThan(0);
  });

  test('should get usage statistics', async ({ page }) => {
    await accountPage.switchToBilling();
    
    const stats = await accountPage.getUsageStats();
    
    expect(typeof stats).toBe('object');
  });

  test('should switch between tabs multiple times', async ({ page }) => {
    await accountPage.switchToProfile();
    await page.waitForTimeout(300);
    
    await accountPage.switchToTeam();
    await page.waitForTimeout(300);
    
    await accountPage.switchToBilling();
    await page.waitForTimeout(300);
    
    await accountPage.switchToProfile();
    await page.waitForTimeout(300);
  });
});
