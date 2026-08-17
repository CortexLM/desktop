/**
 * Contrat de validation des automations.
 *
 * Ce fichier existe d'abord pour verrouiller le **snake_case**. Une seconde
 * définition d'`Automation` en kebab-case (`type: 'file-watch'`, `config:
 * Record<string, any>`) a coexisté avec celle-ci ; elle a été supprimée parce
 * qu'elle n'était pas validable sans perdre le typage. Les tests ci-dessous
 * échouent si quelqu'un la réintroduit, dans un sens comme dans l'autre :
 * l'ensemble EXACT des discriminants est asserté, donc un ajout silencieux
 * (`'file-watch'` à côté de `'file_watch'`) rougit aussi.
 */

import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  ActionSchema,
  CreateAutomationRequestSchema,
  DeleteAutomationRequestSchema,
  GetAutomationLogsRequestSchema,
  ToggleAutomationRequestSchema,
  TriggerSchema,
  UpdateAutomationRequestSchema,
} from '../automation';
import type {
  Action,
  CreateAutomationRequest,
  Trigger,
  UpdateAutomationRequest,
} from '../../types/ipc/automation';

/**
 * Égalité structurelle bidirectionnelle. `Expect<Equal<A, B>>` ne compile que si
 * les deux types sont mutuellement assignables — c'est ce qui fait de ce fichier
 * un garde-fou pour `bun run typecheck`, en plus des assertions d'exécution.
 */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;
type Expect<T extends true> = T;

const FILE_TRIGGER = {
  type: 'file_watch',
  patterns: ['src/**/*.ts'],
  events: ['change'],
  workspacePath: '/w',
} as const;

const SCRIPT_ACTION = {
  type: 'run_script',
  script: 'bun test',
} as const;

describe('TriggerSchema', () => {
  it('expose exactement les quatre discriminants snake_case', () => {
    const discriminants = TriggerSchema.options.map((option) => option.shape.type.value);

    // Ensemble exact, trié : un ajout comme un retrait fait rougir.
    expect([...discriminants].sort()).toEqual([
      'file_watch',
      'git_hook',
      'manual',
      'schedule',
    ]);
  });

  it('accepte un file_watch complet', () => {
    const parsed = TriggerSchema.parse(FILE_TRIGGER);
    expect(parsed).toEqual(FILE_TRIGGER);
  });

  it("rejette la forme kebab-case 'file-watch'", () => {
    const result = TriggerSchema.safeParse({ ...FILE_TRIGGER, type: 'file-watch' });
    expect(result.success).toBe(false);
  });

  it.each(['git-hook', 'fileWatch', 'file watch', 'FILE_WATCH'])(
    'rejette le discriminant %s',
    (type) => {
      expect(TriggerSchema.safeParse({ ...FILE_TRIGGER, type }).success).toBe(false);
    }
  );

  it("rejette l'ancienne forme { type, config }", () => {
    // C'est littéralement la définition supprimée : un discriminant kebab-case
    // et un sac de propriétés non typées.
    const legacy = { type: 'file-watch', config: { patterns: ['**/*.ts'] } };
    expect(TriggerSchema.safeParse(legacy).success).toBe(false);
  });

  it('rejette un file_watch sans patterns', () => {
    const result = TriggerSchema.safeParse({ ...FILE_TRIGGER, patterns: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('At least one pattern is required');
    }
  });

  it('rejette un file_watch sans events', () => {
    expect(TriggerSchema.safeParse({ ...FILE_TRIGGER, events: [] }).success).toBe(false);
  });

  it("rejette un event hors de ('add'|'change'|'unlink')", () => {
    expect(
      TriggerSchema.safeParse({ ...FILE_TRIGGER, events: ['rename'] }).success
    ).toBe(false);
  });

  it('rejette un file_watch sans workspacePath', () => {
    expect(TriggerSchema.safeParse({ ...FILE_TRIGGER, workspacePath: '' }).success).toBe(
      false
    );
  });

  it('accepte les quatre hooks git et rejette les autres', () => {
    for (const hook of ['pre-commit', 'post-commit', 'pre-push', 'post-merge']) {
      expect(
        TriggerSchema.safeParse({ type: 'git_hook', hook, repoPath: '/r' }).success
      ).toBe(true);
    }

    expect(
      TriggerSchema.safeParse({ type: 'git_hook', hook: 'pre_commit', repoPath: '/r' })
        .success
    ).toBe(false);
  });

  it('exige un cron non vide pour schedule et rend timezone optionnel', () => {
    expect(TriggerSchema.parse({ type: 'schedule', cron: '* * * * *' })).toEqual({
      type: 'schedule',
      cron: '* * * * *',
    });

    expect(TriggerSchema.safeParse({ type: 'schedule', cron: '' }).success).toBe(false);
  });

  it('accepte manual sans autre champ', () => {
    expect(TriggerSchema.parse({ type: 'manual' })).toEqual({ type: 'manual' });
  });
});

describe('ActionSchema', () => {
  it('expose exactement les quatre discriminants snake_case', () => {
    const discriminants = ActionSchema.options.map((option) => option.shape.type.value);

    expect([...discriminants].sort()).toEqual([
      'ai_task',
      'git_operation',
      'notification',
      'run_script',
    ]);
  });

  it.each(['run-script', 'ai-task', 'git-operation', 'runScript'])(
    'rejette le discriminant kebab/camel %s',
    (type) => {
      expect(ActionSchema.safeParse({ ...SCRIPT_ACTION, type }).success).toBe(false);
    }
  );

  it('accepte run_script minimal et rejette un script vide', () => {
    expect(ActionSchema.parse(SCRIPT_ACTION)).toEqual(SCRIPT_ACTION);
    expect(ActionSchema.safeParse({ type: 'run_script', script: '' }).success).toBe(false);
  });

  it('accepte grok comme provider ai_task', () => {
    // `schemas/ai.ts` (sessions de chat) ne connaît PAS grok ; ici si. Les deux
    // énumérations sont distinctes et ce test fixe celle des automations.
    const action = {
      type: 'ai_task',
      prompt: 'p',
      model: 'm',
      provider: 'grok',
    };
    expect(ActionSchema.safeParse(action).success).toBe(true);
  });

  it('rejette un provider ai_task inconnu', () => {
    expect(
      ActionSchema.safeParse({
        type: 'ai_task',
        prompt: 'p',
        model: 'm',
        provider: 'mistral',
      }).success
    ).toBe(false);
  });

  it('exige prompt et model pour ai_task', () => {
    expect(
      ActionSchema.safeParse({ type: 'ai_task', prompt: '', model: 'm', provider: 'openai' })
        .success
    ).toBe(false);
    expect(
      ActionSchema.safeParse({ type: 'ai_task', prompt: 'p', model: '', provider: 'openai' })
        .success
    ).toBe(false);
  });

  it('restreint git_operation aux quatre opérations connues', () => {
    for (const operation of ['commit', 'push', 'pull', 'branch']) {
      expect(
        ActionSchema.safeParse({ type: 'git_operation', operation, repoPath: '/r' }).success
      ).toBe(true);
    }

    expect(
      ActionSchema.safeParse({ type: 'git_operation', operation: 'rebase', repoPath: '/r' })
        .success
    ).toBe(false);
  });

  it('restreint le niveau de notification', () => {
    const base = { type: 'notification', title: 't', message: 'm' };

    for (const level of ['info', 'warning', 'error', 'success']) {
      expect(ActionSchema.safeParse({ ...base, level }).success).toBe(true);
    }

    // 'warn' est le nom utilisé par `LogLevel` ; ce n'est PAS un niveau de
    // notification. Confondre les deux énumérations est l'erreur attendue.
    expect(ActionSchema.safeParse({ ...base, level: 'warn' }).success).toBe(false);
  });
});

describe('CreateAutomationRequestSchema', () => {
  const VALID: unknown = {
    workspaceId: 'w1',
    name: 'Lint on save',
    enabled: true,
    trigger: FILE_TRIGGER,
    actions: [SCRIPT_ACTION],
  };

  it('accepte une requête complète', () => {
    expect(CreateAutomationRequestSchema.safeParse(VALID).success).toBe(true);
  });

  it('exige au moins une action', () => {
    const result = CreateAutomationRequestSchema.safeParse({
      ...(VALID as object),
      actions: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('At least one action is required');
    }
  });

  it('exige enabled explicitement (pas de défaut implicite)', () => {
    const { enabled: _enabled, ...withoutEnabled } = VALID as Record<string, unknown>;
    expect(CreateAutomationRequestSchema.safeParse(withoutEnabled).success).toBe(false);
  });

  it('rejette workspaceId ou name vide', () => {
    expect(
      CreateAutomationRequestSchema.safeParse({ ...(VALID as object), workspaceId: '' })
        .success
    ).toBe(false);
    expect(
      CreateAutomationRequestSchema.safeParse({ ...(VALID as object), name: '' }).success
    ).toBe(false);
  });

  it('rejette une action invalide nichée dans un tableau valide par ailleurs', () => {
    expect(
      CreateAutomationRequestSchema.safeParse({
        ...(VALID as object),
        actions: [SCRIPT_ACTION, { type: 'run_script' }],
      }).success
    ).toBe(false);
  });
});

describe('UpdateAutomationRequestSchema', () => {
  it("n'exige que l'id", () => {
    expect(UpdateAutomationRequestSchema.parse({ id: 'a1' })).toEqual({ id: 'a1' });
  });

  it('rejette un id vide', () => {
    expect(UpdateAutomationRequestSchema.safeParse({ id: '' }).success).toBe(false);
  });

  it('valide trigger et actions quand ils sont fournis', () => {
    expect(
      UpdateAutomationRequestSchema.safeParse({ id: 'a1', trigger: { type: 'file-watch' } })
        .success
    ).toBe(false);
    expect(
      UpdateAutomationRequestSchema.safeParse({ id: 'a1', actions: [] }).success
    ).toBe(false);
  });
});

describe('schémas d’identifiant simples', () => {
  it('exigent un id non vide', () => {
    expect(DeleteAutomationRequestSchema.safeParse({ id: '' }).success).toBe(false);
    expect(ToggleAutomationRequestSchema.safeParse({ id: 'a', enabled: true }).success).toBe(
      true
    );
    expect(ToggleAutomationRequestSchema.safeParse({ id: 'a' }).success).toBe(false);
  });

  it('exigent une limite de logs entière positive', () => {
    expect(
      GetAutomationLogsRequestSchema.parse({ automationId: 'a', limit: 10 })
    ).toEqual({ automationId: 'a', limit: 10 });

    for (const limit of [0, -1, 1.5]) {
      expect(
        GetAutomationLogsRequestSchema.safeParse({ automationId: 'a', limit }).success
      ).toBe(false);
    }
  });
});

describe('accord schéma ↔ type IPC (vérifié par tsc)', () => {
  /**
   * Ces alias ne produisent aucune assertion d'exécution : ils échouent à la
   * compilation (`bun run typecheck`) si `schemas/automation.ts` et
   * `types/ipc/automation.ts` divergent. C'est exactement la divergence qui a
   * permis à deux `Automation` de coexister.
   */
  type TriggerAgreement = Expect<Equal<z.infer<typeof TriggerSchema>, Trigger>>;
  type ActionAgreement = Expect<Equal<z.infer<typeof ActionSchema>, Action>>;
  type CreateAgreement = Expect<
    Equal<z.infer<typeof CreateAutomationRequestSchema>, CreateAutomationRequest>
  >;
  type UpdateAgreement = Expect<
    Equal<z.infer<typeof UpdateAutomationRequestSchema>, UpdateAutomationRequest>
  >;

  it('les alignements de types ci-dessus sont compilés', () => {
    // Les types ne survivent pas à l'exécution ; ce test documente qu'ils sont
    // évalués par tsc et évite un bloc `describe` vide.
    const witnesses: Array<TriggerAgreement | ActionAgreement | CreateAgreement | UpdateAgreement> =
      [true, true, true, true];
    expect(witnesses).toEqual([true, true, true, true]);
  });
});
