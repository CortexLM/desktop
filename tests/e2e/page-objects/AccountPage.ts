import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Account Page Object - Handles account, team, and billing views
 */
export class AccountPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  private selectors = {
    accountPanel: '[data-testid="account-panel"]',
    profileTab: '[data-testid="profile-tab"]',
    teamTab: '[data-testid="team-tab"]',
    billingTab: '[data-testid="billing-tab"]',
    profileName: '[data-testid="profile-name"]',
    profileEmail: '[data-testid="profile-email"]',
    profileAvatar: '[data-testid="profile-avatar"]',
    editProfileButton: '[data-testid="edit-profile"]',
    saveProfileButton: '[data-testid="save-profile"]',
    teamMembers: '[data-testid="team-members"]',
    inviteMemberButton: '[data-testid="invite-member"]',
    memberItem: '[data-testid="member-item"]',
    billingPlan: '[data-testid="billing-plan"]',
    usageStats: '[data-testid="usage-stats"]',
    upgradePlanButton: '[data-testid="upgrade-plan"]',
    paymentMethod: '[data-testid="payment-method"]'
  };

  /**
   * Open account panel
   */
  async openAccountPanel(): Promise<void> {
    await this.page.click('[data-testid="sidebar-account"]');
    await this.waitForElement(this.selectors.accountPanel);
  }

  /**
   * Switch to profile tab
   */
  async switchToProfile(): Promise<void> {
    await this.page.click(this.selectors.profileTab);
  }

  /**
   * Switch to team tab
   */
  async switchToTeam(): Promise<void> {
    await this.page.click(this.selectors.teamTab);
  }

  /**
   * Switch to billing tab
   */
  async switchToBilling(): Promise<void> {
    await this.page.click(this.selectors.billingTab);
  }

  /**
   * Get profile name
   *
   * These are `<input>` elements, so read `value` — `textContent()` on an input
   * is always empty.
   */
  async getProfileName(): Promise<string> {
    return this.page.locator(this.selectors.profileName).inputValue();
  }

  /**
   * Get profile email
   */
  async getProfileEmail(): Promise<string> {
    return this.page.locator(this.selectors.profileEmail).inputValue();
  }

  /**
   * Edit profile
   *
   * ProfileView has no separate edit mode: the fields are always editable and
   * Save enables once something changes. So there is no "edit" button to click
   * first.
   */
  async editProfile(name: string, email: string): Promise<void> {
    await this.page.fill(this.selectors.profileName, name);
    await this.page.fill(this.selectors.profileEmail, email);
    await this.page.click(this.selectors.saveProfileButton);
  }

  /**
   * Get team members count
   */
  async getTeamMembersCount(): Promise<number> {
    return this.page.locator(this.selectors.memberItem).count();
  }

  /**
   * Invite team member
   *
   * The role picker is a custom Select (a button + listbox), not a native
   * `<select>`, so it is driven by clicking rather than `selectOption`. The role
   * defaults to "Member"; only open the picker when a different one is asked
   * for.
   */
  async inviteTeamMember(email: string, role: string): Promise<void> {
    await this.page.click(this.selectors.inviteMemberButton);
    await this.page.fill('[data-testid="invite-email"]', email);

    if (role && role.toLowerCase() !== 'member') {
      await this.page.click('[data-testid="invite-role"]');
      await this.page
        .getByRole('option', { name: new RegExp(`^${role}$`, 'i') })
        .click();
    }

    await this.page.click('[data-testid="send-invite"]');
  }

  /**
   * Get current billing plan
   */
  async getCurrentPlan(): Promise<string> {
    return this.page.locator(this.selectors.billingPlan).textContent() || '';
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<Record<string, string>> {
    const stats: Record<string, string> = {};
    const items = this.page.locator('[data-testid="usage-item"]');
    const count = await items.count();
    
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const label = await item.locator('[data-testid="usage-label"]').textContent();
      const value = await item.locator('[data-testid="usage-value"]').textContent();
      if (label && value) {
        stats[label] = value;
      }
    }
    
    return stats;
  }

  /**
   * Upgrade plan
   */
  async upgradePlan(planName: string): Promise<void> {
    await this.page.click(this.selectors.upgradePlanButton);
    await this.page.click(`[data-testid="plan-${planName}"]`);
    await this.page.click('[data-testid="confirm-upgrade"]');
  }
}
