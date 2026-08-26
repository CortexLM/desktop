import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Static fidelity checks: each component's CSS against the Concept 03 JSX it
 * transcribes (design/paper/jsx/*, re-archived with `bun run paper:jsx`).
 *
 * These are deliberately not rendering tests. jsdom does not lay out, so asking it
 * for a button's height would prove nothing; a real engine does that in the visual
 * parity suite. What is checkable here, cheaply and on every run, is that the
 * numbers written into the CSS are the numbers Paper exported — which is where
 * transcription drift actually happens.
 */

const COMPONENTS = join(import.meta.dirname, '..');
const PAPER_JSX = join(import.meta.dirname, '../../../../../design/paper/jsx');

function css(name: string): string {
  return readFileSync(join(COMPONENTS, `${name}.css`), 'utf8');
}

function jsx(name: string): string {
  return readFileSync(join(PAPER_JSX, `${name}.jsx`), 'utf8');
}

describe('button matches the Basics board', () => {
  const source = css('button');
  const paper = jsx('basics');

  it('is a 36px pill with an 18px inset, as the kit draws every button', () => {
    expect(paper).toContain("height: '36px'");
    expect(paper).toContain("paddingInline: '18px'");
    expect(paper).toContain("borderRadius: 'var(--radius-pill)'");

    expect(source).toContain('height: 36px;');
    expect(source).toContain('padding-inline: 18px;');
    expect(source).toContain('border-radius: var(--radius-pill);');
  });

  it('sets labels at 14/18 on the optical UI weight', () => {
    expect(paper).toContain("fontSize: '14px'");
    expect(paper).toContain('fontWeight: 480');

    expect(source).toContain('font-size: 14px;');
    expect(source).toContain("font-variation-settings: 'wght' var(--font-wght-ui);");
    expect(source).toContain('line-height: 18px;');
  });

  it('paints primary as ink — fill from the text colour, label from the page colour', () => {
    // "le noir chaud est le vrai bouton primaire"
    expect(paper).toContain("backgroundColor: 'var(--color-text)'");
    expect(paper).toContain("color: 'var(--color-bg)'");

    expect(source).toMatch(/\.cx-button--primary \{[\s\S]*?background: var\(--color-text\);/);
    expect(source).toMatch(/\.cx-button--primary \{[\s\S]*?color: var\(--color-bg\);/);
  });

  it('steps primary states by alpha of the same hue, never a new tint', () => {
    // Hover #1F1D1AD1 is ink at 82%; active #1F1D1AAD is 68%; disabled 14% + 40% label.
    expect(paper).toContain("backgroundColor: '#1F1D1AD1'");
    expect(paper).toContain("backgroundColor: '#1F1D1AAD'");

    expect(source).toContain('color-mix(in srgb, var(--color-text) 82%, transparent)');
    expect(source).toContain('color-mix(in srgb, var(--color-text) 68%, transparent)');
    expect(source).toContain('color-mix(in srgb, var(--color-text) 14%, transparent)');
  });

  it('outlines secondary with the hairline and washes on hover', () => {
    expect(paper).toContain("borderColor: 'var(--color-border)'");
    expect(source).toMatch(/\.cx-button--secondary \{[\s\S]*?border: 1px solid var\(--color-border\);/);
    expect(source).toMatch(/\.cx-button--secondary:hover[\s\S]*?background: var\(--color-hover\);/);
  });

  it('keeps ghost quiet: muted label, 14px inset, hover restores ink on the wash', () => {
    expect(source).toMatch(/\.cx-button--ghost \{[\s\S]*?padding-inline: 14px;/);
    expect(source).toMatch(/\.cx-button--ghost \{[\s\S]*?color: var\(--color-text-muted\);/);
    expect(source).toMatch(/\.cx-button--ghost:hover[\s\S]*?color: var\(--color-text\);/);
  });

  it('reserves solid green for decisive moments, with the kit hover', () => {
    // "le vert plein est réservé aux moments décisifs (envoi, confirmation)"
    expect(paper).toContain("backgroundColor: 'var(--color-green)'");
    expect(paper).toContain("backgroundColor: 'var(--color-green-hover)'");

    expect(source).toMatch(/\.cx-button--green \{[\s\S]*?background: var\(--color-green\);/);
    expect(source).toMatch(/\.cx-button--green \{[\s\S]*?color: var\(--color-on-green\);/);
    expect(source).toMatch(/\.cx-button--green:hover[\s\S]*?background: var\(--color-green-hover\);/);
  });

  it('draws icon-only buttons as the 32px pill from the kit', () => {
    expect(paper).toContain("height: '32px'");
    expect(source).toMatch(/\.cx-button--icon \{[\s\S]*?width: 32px;[\s\S]*?height: 32px;/);
  });
});

describe('tabs match the controls board', () => {
  const source = css('tabs');
  const paper = jsx('tabs-chips-controls');

  it('underlines the active tab with 2px of ink — never the accent', () => {
    // "tab actif = soulignement encre 2 px (jamais l'accent)"
    expect(paper).toContain("backgroundColor: 'var(--color-text)', borderRadius: '1px'");

    expect(source).toMatch(/\.cx-tabs__indicator \{[\s\S]*?height: 2px;/);
    expect(source).toMatch(/\.cx-tabs__indicator \{[\s\S]*?background: var\(--color-text\);/);
    expect(source).not.toMatch(/\.cx-tabs__indicator \{[\s\S]*?--color-green/);
  });

  it('weighs the active label at 560 and pads inactive ones level', () => {
    expect(paper).toContain('fontWeight: 560');
    expect(source).toMatch(/aria-selected='true'\] \.cx-tabs__label \{[\s\S]*?'wght' 560/);
    expect(source).toContain('padding-bottom: 10px;');
  });

  it('closes the strip with the hairline the underline sits on', () => {
    expect(source).toMatch(/\.cx-tabs__list \{[\s\S]*?border-bottom: 1px solid var\(--color-border\);/);
  });
});

describe('segmented control matches the controls board', () => {
  const source = css('segmented');
  const paper = jsx('tabs-chips-controls');

  it('raises the active segment on the surface with the segment shadow', () => {
    // "SEGMENTED — ACTIF RAISED + LABEL ENCRE"
    expect(paper).toContain("boxShadow: '#1F1D1A14 0px 1px 2px'");

    expect(source).toMatch(/aria-pressed='true'\] \{[\s\S]*?background: var\(--color-surface\);/);
    expect(source).toMatch(/aria-pressed='true'\] \{[\s\S]*?box-shadow: var\(--shadow-segment\);/);
  });

  it('tracks on the ink wash with a 3px inset and 2px gaps', () => {
    expect(paper).toContain("gap: '2px', padding: '3px'");
    expect(source).toMatch(/\.cx-segmented \{[\s\S]*?gap: 2px;/);
    expect(source).toMatch(/\.cx-segmented \{[\s\S]*?padding: 3px;/);
  });

  it('sizes segments 28px tall with caption labels', () => {
    expect(source).toContain('height: 28px;');
    expect(source).toContain('font-size: var(--text-caption);');
  });
});

describe('chips match the controls board', () => {
  const source = css('chip');
  const paper = jsx('tabs-chips-controls');

  it('draws suggestion chips as bordered surface pills, 32 tall with a 14px inset', () => {
    expect(paper).toContain("height: '32px'");
    expect(paper).toContain("paddingInline: '14px'");

    expect(source).toMatch(/\.cx-chip--outlined \{[\s\S]*?height: 32px;/);
    expect(source).toMatch(/\.cx-chip--outlined \{[\s\S]*?padding-inline: 14px;/);
    expect(source).toMatch(/\.cx-chip--outlined \{[\s\S]*?border: 1px solid var\(--color-border\);/);
  });

  it('marks the selected chip with the neutral active wash — selection is never green', () => {
    expect(paper).toContain("backgroundColor: 'var(--color-active)'");
    expect(source).toMatch(/\.cx-chip--selected \{[\s\S]*?background: var\(--color-active\);/);
    expect(source).not.toContain('--color-green-tint-16');
  });
});

describe('menu matches the controls board', () => {
  const source = css('menu');
  const paper = jsx('tabs-chips-controls');

  it('raises the surface on a 12px radius with the kit shadow grammar', () => {
    expect(paper).toContain("borderRadius: '12px'");
    expect(source).toMatch(/\.cx-menu \{[\s\S]*?border-radius: 12px;/);
    expect(source).toMatch(/\.cx-menu \{[\s\S]*?box-shadow: var\(--shadow-menu\);/);
  });

  it('marks selection with a green check, not a filled row', () => {
    // "sélection de menu = coche, pas de fond"
    expect(paper).toContain('stroke="#1F4945"');
    expect(source).toMatch(/\.cx-menu__trailing \{[\s\S]*?color: var\(--color-green\);/);
  });

  it('insets items 8px 10px on the small radius', () => {
    expect(paper).toContain("paddingBlock: '8px', paddingInline: '10px'");
    expect(source).toContain('padding: 8px 10px;');
    expect(source).toMatch(/\.cx-menu__item \{[\s\S]*?border-radius: var\(--radius-sm\);/);
  });
});

describe('nav item matches the sidebar board', () => {
  const source = css('nav-item');
  const paper = jsx('sidebar-app');

  it('is a 32px row on the small radius with an 8px inset', () => {
    expect(paper).toContain("height: '32px'");
    expect(paper).toContain("paddingInline: '8px'");

    expect(source).toContain('height: 32px;');
    expect(source).toContain('padding-inline: 8px;');
    expect(source).toMatch(/\.cx-nav-item \{[\s\S]*?border-radius: var\(--radius-sm\);/);
  });

  it('marks the active row with the ink wash and a heavier label — never green', () => {
    // "L'état actif porte un fond encre alpha 9 % (--color-active) … Le vert reste
    // réservé aux accents — jamais aux états de navigation."
    expect(paper).toContain("backgroundColor: 'var(--color-active)'");
    expect(paper).toContain('fontWeight: 560');

    expect(source).toMatch(/aria-current='page'\] \{[\s\S]*?background: var\(--color-active\);/);
    expect(source).toMatch(/aria-current='page'\] \{[\s\S]*?'wght' 560/);
    expect(source).not.toMatch(/aria-current='page'\] \{[\s\S]*?--color-green/);
  });

  it('hovers on the lighter wash', () => {
    expect(paper).toContain("backgroundColor: 'var(--color-hover)'");
    expect(source).toMatch(/\.cx-nav-item:hover[\s\S]*?background: var\(--color-hover\);/);
  });

  it('paints the unread dot with the copper accent', () => {
    expect(source).toMatch(/\.cx-nav-item__indicator--unread \{[\s\S]*?background: var\(--color-accent\);/);
  });
});

describe('composer matches the composer board', () => {
  const source = css('composer');
  const paper = jsx('composer-apps-row');

  it('is a raised card on the composer radius with the double shadow', () => {
    // "carte raised radius 24, ring 1px, ombre subtile"
    expect(paper).toContain("borderRadius: 'var(--radius-composer)'");
    expect(paper).toContain("boxShadow: '#1F1D1A0A 0px 1px 2px, #1F1D1A0A 0px 4px 12px'");

    expect(source).toContain('border-radius: var(--radius-composer);');
    expect(source).toContain('#1f1d1a0a 0 1px 2px');
    expect(source).toContain('#1f1d1a0a 0 4px 12px');
  });

  it('insets 16/16/12/20 with a 14px stack gap, as exported', () => {
    expect(paper).toContain(
      "paddingBottom: '12px', paddingLeft: '20px', paddingRight: '16px', paddingTop: '16px'",
    );
    expect(source).toContain('padding: 16px 16px 12px 20px;');
    expect(source).toMatch(/\.cx-composer \{[\s\S]*?gap: 14px;/);
  });

  it('sets the prompt at 15/22', () => {
    expect(paper).toContain("fontSize: '15px', lineHeight: '22px'");
    expect(source).toContain('font-size: 15px;');
    expect(source).toContain('line-height: 22px;');
  });

  it('radiates the accent on focus — the only moment it does', () => {
    // "Au focus : bordure verte 40 % + glow — le seul moment où l'accent rayonne."
    expect(paper).toContain("borderColor: '#1F494573'");
    expect(paper).toContain("boxShadow: '#1F494514 0px 0px 0px 3px, #1F49452E 0px 0px 36px 4px'");

    expect(source).toMatch(/\.cx-composer:focus-within \{[\s\S]*?color-mix\(in srgb, var\(--color-green\) 45%, transparent\)/);
    expect(source).toMatch(/\.cx-composer:focus-within \{[\s\S]*?0 0 36px 4px/);
  });

  it('sends through the 32px green circle', () => {
    expect(source).toMatch(/\.cx-composer__send \{[\s\S]*?width: 32px;/);
    expect(source).toMatch(/\.cx-composer__send \{[\s\S]*?background: var\(--color-green\);/);
    expect(source).toMatch(/\.cx-composer__send \{[\s\S]*?border-radius: var\(--radius-pill\);/);
  });

  it('keeps the model picker as bare 13px text with a chevron', () => {
    expect(paper).toContain("fontSize: '13px'");
    expect(source).toMatch(/\.cx-composer__model \{[\s\S]*?font-size: 13px;/);
    expect(source).toMatch(/\.cx-composer__model \{[\s\S]*?color: var\(--color-text-muted\);/);
  });
});

describe('toast stays warm ink in both themes', () => {
  const source = css('toast');

  it('paints from the toast tokens rather than the theme surfaces', () => {
    expect(source).toContain('background: var(--color-toast-bg);');
    expect(source).toContain('color: var(--color-toast-text);');
    expect(source).toContain('color: var(--color-toast-accent);');
  });
});

describe('session rows read chrome-free', () => {
  const source = css('session-card');

  it('separates rows with hairlines instead of boxing each one', () => {
    expect(source).toMatch(/\.cx-session-card \+ \.cx-session-card \{[\s\S]*?border-top: 1px solid var\(--color-border\);/);
    expect(source).toMatch(/\.cx-session-card \{[\s\S]*?background: transparent;/);
  });

  it('colours the diff stat with the status hues, in mono', () => {
    expect(source).toMatch(/\.cx-session-card__added \{[\s\S]*?color: var\(--color-green\);/);
    expect(source).toMatch(/\.cx-session-card__removed \{[\s\S]*?color: var\(--color-error\);/);
    expect(source).toMatch(/\.cx-session-card__added \{[\s\S]*?font-family: var\(--font-mono-stack\);/);
  });
});

describe('status badges match the C3 status hues', () => {
  const source = css('badge');

  it('draws zero-chrome text with a 6px dot in the current colour', () => {
    expect(source).toMatch(/\.cx-badge__dot \{[\s\S]*?width: 6px;/);
    expect(source).toMatch(/\.cx-badge__dot \{[\s\S]*?background: currentcolor;/);
  });

  it('maps tones onto the C3 hues: green for landed, copper for live, oxblood for failed', () => {
    expect(source).toMatch(/\.cx-badge--success \{[\s\S]*?color: var\(--color-green\);/);
    expect(source).toMatch(/\.cx-badge--accent \{[\s\S]*?color: var\(--color-accent\);/);
    expect(source).toMatch(/\.cx-badge--error \{[\s\S]*?color: var\(--color-error\);/);
  });
});
