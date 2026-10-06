import type { CortexClient, PluginConsentRequest, BotApprovalRuleRequest } from "@cortex/sdk";
import { AppCatalog, AppConnections, AppConnection, OwnedConnectors, OwnedConnector, ToolRules, EffectiveToolPolicy } from "@cortex/schema";
import { CortexError, type BotAppsBinding } from "@cortex/core";
import { PendingApprovals, ApprovalAcknowledged, PolicyEvaluations } from "@cortex/schema";

export function createBotAppsBinding(client: CortexClient, guard: () => void, openExternal?: (url: string) => Promise<void>): BotAppsBinding {
  const redirects = new Map<string, string>();
  return {
    async catalog(q) { guard(); const result = await client.plugins.catalog.list({ query: { q, limit: 100 } }); guard(); return AppCatalog.parse(result); },
    async connections() { guard(); const result = await client.plugins.connections.list(); guard(); return AppConnections.parse(result); },
    async connect(slug, input) {
      guard(); const body: PluginConsentRequest = input;
      const result = await client.plugins.connect.create({ path: { slug }, body }); guard();
      const url = new URL(result.redirect_url);
      if (url.protocol !== "https:" || url.username || url.password) throw new CortexError("provider_error", "App authorization link refused");
      redirects.set(slug, url.href);
      return AppConnection.parse(result.connection);
    },
    async authorize(slug) { guard(); const url = redirects.get(slug); if (!url || !openExternal) throw new CortexError("provider_unsupported", "App authorization is unavailable"); await openExternal(url); guard(); },
    async consent(slug, input) { guard(); const body: PluginConsentRequest = input; const result = await client.plugins.update({ path: { slug }, body }); guard(); return AppConnection.parse(result); },
    async revoke(slug) { guard(); await client.plugins.delete({ path: { slug } }); guard(); redirects.delete(slug); },
    async connectors(id) { guard(); const result = await client.mascots.connectors.list({ path: { id } }); guard(); return OwnedConnectors.parse(result); },
    async enable(id, connection_id, enabled) { guard(); const result = await client.mascots.connectors.put({ path: { id, connection_id }, body: { enabled } }); guard(); return OwnedConnector.parse(result); },
    async rules(id) { guard(); const result = await client.mascots.approvals.list({ path: { id } }); guard(); return ToolRules.parse(result); },
    async upsert(id, input) {
      guard(); const body: BotApprovalRuleRequest = input;
      await client.mascots.approvals.create({ path: { id }, body }); guard();
      // The producer returns an attempt ID on conflict. Only the re-listed IDs are durable.
      const result = await client.mascots.approvals.list({ path: { id } }); guard(); return ToolRules.parse(result);
    },
    async remove(id, rid) {
      guard(); const current = await client.mascots.approvals.list({ path: { id } }); guard();
      if (!current.items.some(rule => rule.id === rid)) throw new CortexError("not_found", "Tool rule no longer exists");
      const result = await client.mascots.approvals.delete({ path: { id, rid } }); guard();
      if (result.deleted !== 1) throw new CortexError("conflict", "Tool rule deletion was not confirmed");
      return { deleted: result.deleted };
    },
    async policy(id) { guard(); const result = await client.mascots.toolPolicy.list({ path: { id } }); guard(); return EffectiveToolPolicy.parse(result); },
    async pending(id) { guard(); const result = id ? await client.mascots.approvals.pending.list({ path: { id } }) : await client.bot.approvals.list(); guard(); return PendingApprovals.parse(result); },
    async decide(id, message_id, action) { guard(); const result = await client.mascots.messages.respond.create({ path: { id, message_id }, body: { action } }); guard(); return ApprovalAcknowledged.parse(result); },
    async evaluations(id) { guard(); const result = await client.mascots.toolPolicy.evaluations.list({ path: { id }, query: { limit: 50 } }); guard(); return PolicyEvaluations.parse(result); },
  };
}
