/**
 * Account views index
 *
 * PlansView was removed from this barrel and deleted: it was never imported
 * anywhere (the 'plans' destination in Workbench resolves to
 * views/workspace/PlansView.tsx, an unrelated task-planning view), and it
 * advertised $29/mo and $99/mo tiers with feature comparisons for a product
 * that has no subscriptions, no checkout and no payment provider.
 */

export { ProfileView } from './ProfileView';
export { TeamView } from './TeamView';
export { BillingView } from './BillingView';
