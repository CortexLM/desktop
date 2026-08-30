import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { navigableRoutes, paperRoutes, routeBySlug, SCREEN_ROUTES, SHELL_PRODUCTS } from '../routes.ts';

/**
 * Ties the route table to the design.
 *
 * This is the guard that stops a screen from being quietly forgotten. The Paper manifest is
 * generated from the file itself, so a screen added to the design shows up here as a
 * missing route on the next run - and a route with no screen behind it shows up as the
 * reverse. Without the second direction, deleting a screen from the design would leave a
 * route pointing at nothing.
 */
const manifest = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../../design/paper/screens.json'), 'utf8'),
) as {
  screens: Array<{ slug: string; screen: string; artboards: { light?: string; dark?: string } }>;
};

const designSlugs = manifest.screens.map((screen) => screen.slug).sort();
const paperSlugs = paperRoutes().map((route) => route.slug).sort();
const routedSlugs = SCREEN_ROUTES.map((route) => route.slug).sort();

describe('route table against the Paper manifest', () => {
  it('covers every screen in the design', () => {
    const missing = designSlugs.filter((slug) => !paperSlugs.includes(slug));
    expect(missing, `screens in the design with no route: ${missing.join(', ')}`).toEqual([]);
  });

  it('has no Paper route for a screen the design does not contain', () => {
    const orphaned = paperSlugs.filter((slug) => !designSlugs.includes(slug));
    expect(orphaned, `Paper routes with no screen: ${orphaned.join(', ')}`).toEqual([]);
  });

  it('covers all 26 Paper screens', () => {
    expect(designSlugs).toHaveLength(26);
    expect(paperSlugs).toHaveLength(26);
  });

  it('has no Secrets screen, in the manifest or in the route table', () => {
    // Cortex Code has no Secrets page (`.rules/06-product.md` § 6.2.1). The Paper file
    // still carries the board it was transcribed from, so `paper-sync` filters the
    // screen out of the manifest — this asserts neither side grew it back.
    expect(designSlugs).not.toContain('code-secrets');
    expect(routeBySlug('code-secrets')).toBeUndefined();
    expect(navigableRoutes().map((route) => route.path)).not.toContain('/code/secrets');
  });

  it('lists each slug exactly once', () => {
    expect(new Set(routedSlugs).size).toBe(routedSlugs.length);
  });

  it('lists Chat and Code as the shell switcher products', () => {
    expect(SHELL_PRODUCTS.map((product) => product.id)).toEqual(['chat', 'code']);
  });

  it('keeps Chat and Bot product destinations out of the Paper manifest check', () => {
    expect(SCREEN_ROUTES.some((route) => route.source === 'product' && route.product === 'bot')).toBe(
      true,
    );
    expect(routeBySlug('planning')?.path).toBe('/planning');
    expect(routeBySlug('bot-home')?.path).toBe('/bot');
  });
});

describe('route shape', () => {
  it('gives every navigable screen a path', () => {
    for (const route of navigableRoutes()) {
      expect(route.path, `${route.slug} is navigable but has no path`).toBeTruthy();
      expect(route.path, `${route.slug} path must be absolute`).toMatch(/^\//);
    }
  });

  it('gives every overlay and state a host to layer over', () => {
    // An overlay with no host has nowhere to render, and a state with no host is really a
    // screen that was mis-classified.
    for (const route of SCREEN_ROUTES) {
      if (route.kind === 'route') continue;
      expect(route.host, `${route.slug} is a ${route.kind} with no host`).toBeTruthy();
    }
  });

  it('points every host at a navigable screen', () => {
    const navigable = new Set(navigableRoutes().map((route) => route.slug));
    for (const route of SCREEN_ROUTES) {
      if (!route.host) continue;
      expect(navigable.has(route.host), `${route.slug} hosts on ${route.host}, which is not navigable`).toBe(
        true,
      );
    }
  });

  it('never gives a path to an overlay or a state', () => {
    for (const route of SCREEN_ROUTES) {
      if (route.kind === 'route') continue;
      expect(route.path, `${route.slug} is a ${route.kind} but has a path`).toBeUndefined();
    }
  });

  it('gives every screen a title', () => {
    for (const route of SCREEN_ROUTES) {
      expect(route.title.length, route.slug).toBeGreaterThan(0);
    }
  });

  it('uses distinct paths', () => {
    const paths = navigableRoutes().map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('roots the app at the Chat home', () => {
    expect(routeBySlug('home')?.path).toBe('/');
    expect(routeBySlug('home')?.product).toBe('chat');
  });

  it('keeps every Bot screen under the /bot prefix', () => {
    for (const route of navigableRoutes()) {
      if (route.product !== 'bot' || !route.path) continue;
      expect(route.path, route.slug).toMatch(/^\/bot(\/|$)/);
    }
  });

  it('keeps every Code screen under the /code prefix', () => {
    for (const route of navigableRoutes()) {
      if (route.product !== 'code' || !route.path) continue;
      // The auth and onboarding screens are drawn on the Code page but serve both
      // products, so their paths stay unprefixed.
      if (route.slug.startsWith('code-auth-') || route.slug === 'code-onboarding') continue;
      expect(route.path, route.slug).toMatch(/^\/code(\/|$)/);
    }
  });
});

describe('authentication gating', () => {
  it('leaves the surfaces that work signed out ungated', () => {
    // Anonymous Chat is a product requirement: conversations with the user's own provider
    // keys have to work with no account at all. Code and Bot stay shown and locked.
    for (const slug of [
      'home',
      'conversation',
      'planning',
      'projects',
      'plugins',
      'bot-home',
      'code-home',
      'code-sessions',
      'code-session-detail',
      'code-settings',
    ]) {
      expect(routeBySlug(slug)?.requiresAuth, slug).toBeFalsy();
    }
  });

  it('gates the surfaces that are Cortex-only', () => {
    for (const slug of ['code-automations', 'code-review', 'code-usage', 'code-new-automation', 'code-ssh-connect']) {
      expect(routeBySlug(slug)?.requiresAuth, slug).toBe(true);
    }
  });

  it('never gates a sign-in screen behind being signed in', () => {
    for (const route of SCREEN_ROUTES) {
      if (!route.slug.startsWith('code-auth-')) continue;
      expect(route.requiresAuth, `${route.slug} would be unreachable`).toBeFalsy();
    }
  });
});

describe('design coverage', () => {
  /**
   * Screens the file deliberately draws in one theme only: the collapsed-sidebar
   * variant and the conversation exist as light boards. Listed here so a NEW
   * screen missing its dark twin still fails.
   */
  const LIGHT_ONLY = new Set(['code-home-sidebar-collapsed', 'conversation']);

  it('has both a light and a dark artboard for every screen', () => {
    for (const screen of manifest.screens) {
      expect(screen.artboards.light, `${screen.slug} has no light artboard`).toBeTruthy();
      if (LIGHT_ONLY.has(screen.slug)) continue;
      expect(screen.artboards.dark, `${screen.slug} has no dark artboard`).toBeTruthy();
    }
  });
});
