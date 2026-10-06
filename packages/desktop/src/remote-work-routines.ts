import type { CortexClient, BotRoutineRequest, BotRoutineEventIngest } from "@cortex/sdk";
import { WorkRoutine, WorkRoutineRun, WorkRoutineFired } from "@cortex/schema";
import { CortexError, type WorkRoutinesBinding } from "@cortex/core";

export function createWorkRoutinesBinding(client: CortexClient, guard: () => void): WorkRoutinesBinding {
  const exact = (result: unknown, rid: string) => { const row = WorkRoutine.parse(result); if (row.id !== rid) throw new CortexError("provider_error", "Routine identity did not match"); return row; };
  return {
    async list(id) { guard(); const result = await client.mascots.routines.list({ path: { id } }); guard(); return WorkRoutine.array().parse(result.items); },
    async get(id, rid) { guard(); const result = await client.mascots.routines.get({ path: { id, rid } }); guard(); return exact(result, rid); },
    async create(id, input) { guard(); const body: BotRoutineRequest = input; const result = await client.mascots.routines.create({ path: { id }, body }); guard(); return WorkRoutine.parse(result); },
    async update(id, rid, input) { guard(); const body: BotRoutineRequest = input; const result = await client.mascots.routines.update({ path: { id, rid }, body }); guard(); return exact(result, rid); },
    async remove(id, rid) { guard(); const result = await client.mascots.routines.delete({ path: { id, rid } }); guard(); if (result.deleted !== true) throw new CortexError("provider_error", "Routine deletion is unconfirmed"); return { deleted: true }; },
    async pause(id, rid) { guard(); const result = await client.mascots.routines.pause.create({ path: { id, rid } }); guard(); const row = exact(result, rid); if (!row.paused) throw new CortexError("provider_error", "Routine pause is unconfirmed"); return row; },
    async resume(id, rid) { guard(); const result = await client.mascots.routines.resume.create({ path: { id, rid } }); guard(); const row = exact(result, rid); if (row.paused) throw new CortexError("provider_error", "Routine resume is unconfirmed"); return row; },
    async history(id, rid) { guard(); const result = await client.mascots.routines.runs.list({ path: { id, rid } }); guard(); return WorkRoutineRun.array().parse(result.items); },
    async event(input) { guard(); const body: BotRoutineEventIngest = input; const result = await client.bot.routines.events.create({ body }); guard(); return WorkRoutineFired.parse(result); },
  };
}
