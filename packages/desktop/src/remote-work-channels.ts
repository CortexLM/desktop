import type { CortexClient, BotChannelCreateRequest, BotChannelUpdateRequest } from "@cortex/sdk";
import { WorkChannel } from "@cortex/schema";
import type { WorkChannelsBinding } from "@cortex/core";
import { CortexError } from "@cortex/core";

export function createWorkChannelsBinding(client: CortexClient, guard: () => void): WorkChannelsBinding {
  const exact = (id: string, result: WorkChannel) => { if (result.id !== id) throw new CortexError("provider_error", "Channel identity did not match"); return result; };
  return {
    async list() { guard(); const result = await client.channels.list(); guard(); return result.items.map(item => WorkChannel.parse(item)); },
    async get(id) { guard(); const result = await client.channels.get({ path: { id } }); guard(); return exact(id, WorkChannel.parse(result)); },
    async create(input) { guard(); const body: BotChannelCreateRequest = input; const result = await client.channels.create({ body }); guard(); return WorkChannel.parse(result); },
    async update(id, input) { guard(); const body: BotChannelUpdateRequest = input; const result = await client.channels.update({ path: { id }, body }); guard(); return exact(id, WorkChannel.parse(result)); },
    async remove(id) { guard(); const result = await client.channels.delete({ path: { id } }); guard(); if (result.deleted !== true) throw new CortexError("provider_error", "Channel removal was not confirmed"); return { deleted: true }; },
  };
}
