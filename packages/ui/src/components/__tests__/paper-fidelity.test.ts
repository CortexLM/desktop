import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Static fidelity checks: each component's CSS against the Paper JSX it transcribes.
 *
 * These are deliberately not rendering tests. jsdom does not lay out, so asking it for a
 * button's height would prove nothing; a real engine does that in the Playwright geometry
 * suite. What is checkable here, cheaply and on every run, is that the numbers written into
 * the CSS are the numbers Paper exported - which is where transcription drift actually
 * happens.
 */

const COMPONENTS = join(import.meta.dirname, '..');
const PAPER_JSX = join(import.meta.dirname, '../../../../../design/paper/jsx');

function css(name: string): string {
  return readFileSync(join(COMPONENTS, `${name}.css`), 'utf8');
}

function jsx(name: string): string {
  return readFileSync(join(PAPER_JSX, `${name}.jsx`), 'utf8');
}

/** Pulls `paddingBlock`/`paddingInline` out of a Paper export as a CSS shorthand. */
function paperPadding(source: string, occurrence = 0): string {
  const blocks = [...source.matchAll(/paddingBlock: '(\d+)px'[\s\S]{0,400}?paddingInline: '(\d+)px'/g)];
  const match = blocks[occurrence];
  if (!match) throw new Error(`no paddingBlock/paddingInline pair #${occurrence} in export`);
  return `${match[1]}px ${match[2]}px`;
}

describe('button matches the Paper button rows', () => {
  const source = css('button');

  it('uses the padding Paper exports', () => {
    // 8px 16px on a 16px line is what makes the button 32px tall.
    expect(paperPadding(jsx('button-primary'))).toBe('8px 16px');
    expect(source).toContain('padding: 8px 16px;');
  });

  it('sets the label at 13px medium on a 16px line', () => {
    const paper = jsx('button-primary');
    expect(paper).toContain("fontSize: '13px'");
    expect(paper).toContain("lineHeight: '16px'");

    expect(source).toContain('font-size: var(--text-sm);');
    expect(source).toContain('font-weight: var(--font-weight-medium);');
    expect(source).toContain('line-height: 16px;');
  });

  it('fills primary and destructive from their token, and hovers to the named literal', () => {
    expect(source).toContain('background: var(--color-primary);');
    expect(source).toContain('background: var(--color-primary-hover);');
    expect(source).toContain('background: var(--color-error);');
    expect(source).toContain('background: var(--color-error-hover);');
  });

  it('outlines secondary with border-strong over the page background', () => {
    expect(jsx('button-secondary')).toContain("borderColor: 'var(--color-border-strong)'");
    expect(source).toContain('border: 1px solid var(--color-border-strong);');
    expect(source).toContain('background: var(--color-bg);');
  });

  it('hovers ghost and secondary onto the inset surface', () => {
    expect(jsx('button-ghost')).toContain("backgroundColor: 'var(--color-inset)'");
    expect(source).toContain('background: var(--color-inset);');
  });

  it('fades the filled variants when disabled, and mutes the unfilled ones instead', () => {
    // Paper drops the filled buttons to 40%. Ghost has no fill to fade, and secondary
    // softens its border, so both keep full opacity and change their label colour.
    expect(jsx('button-primary')).toContain("opacity: '0.4'");
    expect(source).toContain('opacity: var(--opacity-disabled);');
    expect(source).toMatch(/\.cx-button--ghost:disabled \{[\s\S]*?opacity: 1;/);
    expect(source).toMatch(/\.cx-button--secondary:disabled \{[\s\S]*?border-color: var\(--color-border\);/);
  });

  it('rounds to radius-sm', () => {
    expect(jsx('button-primary')).toContain("borderRadius: 'var(--radius-sm)'");
    expect(source).toContain('border-radius: var(--radius-sm);');
  });
});

describe('badge matches the Paper badge row', () => {
  const source = css('badge');
  const paper = jsx('badge');

  it('uses the padding and gap Paper exports', () => {
    // 3px 10px on a 16px line is what makes the badge 22px tall.
    expect(paperPadding(paper)).toBe('3px 10px');
    expect(source).toContain('padding: 3px 10px;');
    expect(paper).toContain("gap: '5px'");
    expect(source).toContain('gap: 5px;');
  });

  it('sets the label at 12px medium', () => {
    expect(paper).toContain("fontSize: '12px'");
    expect(source).toContain('font-size: var(--text-xs);');
  });

  it('draws the status dot at 6px', () => {
    expect(paper).toContain("height: '6px'");
    expect(paper).toContain("width: '6px'");
    expect(source).toMatch(/\.cx-badge__dot \{[\s\S]*?width: 6px;[\s\S]*?height: 6px;/);
  });

  it('is a full pill', () => {
    expect(paper).toContain("borderRadius: 'var(--radius-full)'");
    expect(source).toContain('border-radius: var(--radius-full);');
  });

  it('pairs each tone with the tint and colour Paper uses', () => {
    for (const tone of ['success', 'warning', 'error'] as const) {
      expect(paper, tone).toContain(`backgroundColor: 'var(--color-${tone}-tint)'`);
      expect(source, tone).toContain(`background: var(--color-${tone}-tint);`);
      expect(source, tone).toContain(`color: var(--color-${tone});`);
    }
  });

  it('gives draft the neutral inset fill and merged the accent tint', () => {
    expect(paper).toContain("backgroundColor: 'var(--color-inset)'");
    expect(paper).toContain("backgroundColor: 'var(--color-primary-tint)'");
    expect(source).toMatch(/\.cx-badge--neutral \{[\s\S]*?background: var\(--color-inset\);/);
    expect(source).toMatch(/\.cx-badge--accent \{[\s\S]*?background: var\(--color-primary-tint\);/);
  });
});

describe('nav item matches the Paper sidebar nav', () => {
  const source = css('nav-item');
  const paper = jsx('nav-item');

  it('uses the padding and gap Paper exports', () => {
    expect(paperPadding(paper)).toBe('8px 10px');
    expect(source).toContain('padding: var(--cx-nav-item-padding-block) 10px;');
    expect(source).toContain('--cx-nav-item-padding-block: 8px;');
    expect(paper).toContain("gap: '10px'");
    expect(source).toContain('gap: 10px;');
  });

  it('sets the label at 13px on a 16px line', () => {
    expect(paper).toContain("fontSize: '13px'");
    expect(source).toContain('font-size: var(--text-sm);');
    expect(source).toContain('line-height: 16px;');
  });

  it('shifts weight only on the active row', () => {
    // Paper draws the active label medium and every other row regular, so weight marks
    // selection while colour alone carries hover.
    expect(paper).toContain("fontWeight: 'var(--font-weight-medium)'");
    expect(paper).toContain("fontWeight: 'var(--font-weight-regular)'");
    expect(source).toMatch(
      /\.cx-nav-item--active \{[\s\S]*?font-weight: var\(--font-weight-medium\);/,
    );
    expect(source).toContain('font-weight: var(--font-weight-regular);');
  });

  it('fills the active row with inset and hover with the hover role', () => {
    expect(paper).toContain("backgroundColor: 'var(--color-inset)'");
    expect(source).toMatch(/\.cx-nav-item--active \{[\s\S]*?background: var\(--color-inset\);/);
    expect(source).toContain('background: var(--color-hover);');
  });

  it('reserves the 8px indicator slot whether or not there is a dot', () => {
    // Paper renders an empty 8x8 box on the rows with no indicator; without it the labels
    // would stop sharing a vertical lane.
    expect(paper).toContain("height: '8px'");
    expect(source).toContain('width: var(--layout-dot);');
    expect(source).toContain('height: var(--layout-dot);');
  });

  it('paints the unread dot with the accent', () => {
    expect(paper).toContain("backgroundColor: 'var(--color-primary)'");
    expect(source).toMatch(
      /\.cx-nav-item__indicator--unread \{[\s\S]*?background: var\(--color-primary\);/,
    );
  });

  it('grows the label so the indicator stays right-aligned', () => {
    expect(paper).toContain("flexGrow: '1'");
    expect(source).toMatch(/\.cx-nav-item__label \{[\s\S]*?flex-grow: 1;/);
  });
});

describe('text field matches the Paper input', () => {
  const source = css('text-field');
  const paper = jsx('text-field');

  it('uses the padding Paper exports', () => {
    // 9px 12px on a 16px line plus a 1px border is what makes the control 36px.
    expect(paperPadding(paper)).toBe('9px 12px');
    expect(source).toContain('padding: 9px 12px;');
  });

  it('stacks label, control and hint with an 8px gap', () => {
    expect(paper).toContain("gap: '8px'");
    expect(source).toContain('gap: var(--spacing-2);');
  });

  it('sets the label at 13px medium and the hint at 12px', () => {
    expect(source).toMatch(/\.cx-field__label \{[\s\S]*?font-size: var\(--text-sm\);/);
    expect(source).toMatch(/\.cx-field__hint \{[\s\S]*?font-size: var\(--text-xs\);/);
    expect(paper).toContain("fontSize: '12px'");
  });

  it('sets the value in mono, as the design does for identifiers', () => {
    expect(paper).toContain("fontFamily: 'var(--font-mono)'");
    expect(source).toMatch(/\.cx-field__input \{[\s\S]*?font-family: var\(--font-mono-stack\);/);
  });

  it('outlines with border-strong and rounds to radius-sm', () => {
    expect(paper).toContain("borderColor: 'var(--color-border-strong)'");
    expect(paper).toContain("borderRadius: 'var(--radius-sm)'");
    expect(source).toContain('border: 1px solid var(--color-border-strong);');
    expect(source).toContain('border-radius: var(--radius-sm);');
  });

  it('places the placeholder on the faint role', () => {
    expect(paper).toContain("color: 'var(--color-text-faint)'");
    expect(source).toContain('color: var(--color-text-faint);');
  });
});

describe('session card matches the Paper session card', () => {
  const source = css('session-card');
  const paper = jsx('session-card');

  it('uses the padding, gap and width Paper exports', () => {
    expect(paper).toContain("padding: '16px'");
    expect(paper).toContain("gap: '12px'");
    expect(paper).toContain("width: '360px'");

    expect(source).toContain('padding: var(--spacing-4);');
    expect(source).toContain('gap: var(--spacing-3);');
  });

  it('is a raised surface with a hairline border at radius-md', () => {
    expect(paper).toContain("borderColor: 'var(--color-border)'");
    expect(paper).toContain("borderRadius: 'var(--radius-md)'");
    expect(source).toContain('border: 1px solid var(--color-border);');
    expect(source).toContain('background: var(--color-surface-raised);');
  });

  it('sets the title at 14px medium on an 18px line', () => {
    expect(paper).toContain("fontSize: '14px'");
    expect(source).toMatch(/\.cx-session-card__title \{[\s\S]*?font-size: var\(--text-base\);/);
    expect(source).toMatch(/\.cx-session-card__title \{[\s\S]*?line-height: 18px;/);
  });

  it('grows the title so the badge stays right-aligned', () => {
    expect(paper).toContain("flexGrow: '1'");
    expect(source).toMatch(/\.cx-session-card__title \{[\s\S]*?flex-grow: 1;/);
  });

  it('colours the diff counts from the success and error roles', () => {
    expect(paper).toContain("color: 'var(--color-success)'");
    expect(paper).toContain("color: 'var(--color-error)'");
    expect(source).toMatch(/\.cx-session-card__added \{[\s\S]*?color: var\(--color-success\);/);
    expect(source).toMatch(/\.cx-session-card__removed \{[\s\S]*?color: var\(--color-error\);/);
  });

  it('places the age on the faint role', () => {
    expect(paper).toContain("color: 'var(--color-text-faint)'");
    expect(source).toMatch(/\.cx-session-card__age \{[\s\S]*?color: var\(--color-text-faint\);/);
  });
});

describe('toast matches the Paper toast', () => {
  const source = css('toast');
  const paper = jsx('tabs-toast-menu');

  it('uses the padding and gap Paper exports', () => {
    expect(paper).toContain("paddingBlock: '12px'");
    expect(paper).toContain("paddingInline: '16px'");
    expect(source).toContain('padding: 12px 16px;');
    expect(paper).toContain("gap: '10px'");
    expect(source).toContain('gap: 10px;');
  });

  it('stays dark in both themes, from the toast tokens', () => {
    // The dark kit draws the same #1F1F1F surface, so this is a snackbar rather than a
    // themed surface.
    expect(paper).toContain("backgroundColor: '#1F1F1F'");
    expect(source).toContain('background: var(--color-toast-bg);');
    expect(source).toContain('color: var(--color-toast-text);');
  });

  it('carries the toast elevation and radius-md', () => {
    expect(paper).toContain("boxShadow: '#00000026 0px 4px 12px'");
    expect(source).toContain('box-shadow: var(--shadow-toast);');
    expect(source).toContain('border-radius: var(--radius-md);');
  });

  it('sets the message at 13px medium', () => {
    expect(source).toContain('font-size: var(--text-sm);');
    expect(source).toContain('font-weight: var(--font-weight-medium);');
  });
});

describe('menu matches the Paper dropdown', () => {
  const source = css('menu');
  const paper = jsx('tabs-toast-menu');

  it('uses the padding, gap and width Paper exports', () => {
    expect(paper).toContain("padding: '6px'");
    expect(paper).toContain("width: '240px'");
    expect(source).toContain('padding: 6px;');
    expect(source).toContain('width: var(--layout-menu-width, 240px);');
    expect(source).toContain('gap: 2px;');
  });

  it('is a raised surface with the menu elevation', () => {
    expect(paper).toContain("boxShadow: '#00000014 0px 4px 16px'");
    expect(source).toContain('box-shadow: var(--shadow-menu);');
    expect(source).toContain('background: var(--color-surface-raised);');
  });

  it('uses the row padding and gap Paper exports', () => {
    expect(source).toMatch(/\.cx-menu__item \{[\s\S]*?padding: 8px 10px;/);
    expect(source).toMatch(/\.cx-menu__item \{[\s\S]*?gap: 10px;/);
  });

  it('hovers a row onto the inset surface', () => {
    expect(paper).toContain("backgroundColor: 'var(--color-inset)'");
    expect(source).toContain('background: var(--color-inset);');
  });

  it('reserves a 20px trailing slot on every row', () => {
    // Paper renders the empty box on rows without a shortcut, for the same lane reason as
    // the sidebar's indicator.
    expect(paper).toContain("width: '20px'");
    expect(source).toMatch(/\.cx-menu__trailing \{[\s\S]*?width: 20px;/);
  });

  it('tints a destructive row from the error role', () => {
    expect(paper).toContain("color: 'var(--color-error)'");
    expect(source).toMatch(/\.cx-menu__item--destructive \{[\s\S]*?color: var\(--color-error\);/);
  });
});

describe('tabs match the Paper tab strip', () => {
  const source = css('tabs');
  const paper = jsx('tabs-toast-menu');

  it('uses the spacing Paper exports', () => {
    expect(paper).toContain("gap: '7px'");
    expect(paper).toContain("paddingTop: '8px'");
    expect(source).toContain('gap: 7px;');
    expect(source).toContain('padding: 8px 4px 0;');
  });

  it('sets the label at 13px, medium when active and regular otherwise', () => {
    expect(paper).toContain("fontWeight: 'var(--font-weight-medium)'");
    expect(paper).toContain("fontWeight: 'var(--font-weight-regular)'");
    expect(source).toContain('font-weight: var(--font-weight-regular);');
    expect(source).toMatch(
      /aria-selected='true'\] \.cx-tabs__label \{[\s\S]*?font-weight: var\(--font-weight-medium\);/,
    );
  });

  it('draws the 2px indicator at radius 1px from the text role', () => {
    expect(paper).toContain("borderRadius: '1px'");
    expect(source).toMatch(/\.cx-tabs__indicator \{[\s\S]*?height: 2px;[\s\S]*?border-radius: 1px;/);
    expect(source).toMatch(
      /aria-selected='true'\] \.cx-tabs__indicator \{[\s\S]*?background: var\(--color-text\);/,
    );
  });

  it('keeps the indicator transparent rather than absent when inactive', () => {
    // Omitting it would change the strip's height as selection moved.
    expect(source).toMatch(/\.cx-tabs__indicator \{[\s\S]*?background: transparent;/);
  });

  it('rules the strip with a hairline border', () => {
    expect(source).toMatch(/\.cx-tabs__rule \{[\s\S]*?background: var\(--color-border\);/);
  });
});

describe('composer matches the Paper hero composer', () => {
  const source = css('composer');
  const paper = jsx('composer');

  it('uses the padding, gap and radius Paper exports', () => {
    expect(paper).toContain("padding: '16px'");
    expect(paper).toContain("gap: '12px'");
    expect(paper).toContain("borderRadius: 'var(--radius-md)'");

    expect(source).toContain('padding: var(--spacing-4);');
    expect(source).toContain('gap: var(--spacing-3);');
    expect(source).toContain('border-radius: var(--radius-md);');
  });

  it('is a raised surface outlined with border-strong and the raised shadow', () => {
    expect(paper).toContain("borderColor: 'var(--color-border-strong)'");
    expect(paper).toContain("boxShadow: '#0000000A 0px 1px 3px'");
    expect(source).toContain('border: 1px solid var(--color-border-strong);');
    expect(source).toContain('box-shadow: var(--shadow-raised);');
    expect(source).toContain('background: var(--color-surface-raised);');
  });

  it('sets the prompt at 16px on a 24px line', () => {
    // The only use of --text-md in the design: the one field the user composes prose in.
    expect(paper).toContain("fontSize: 'var(--text-md)'");
    expect(paper).toContain("lineHeight: '24px'");
    expect(source).toMatch(/\.cx-composer__prompt \{[\s\S]*?font-size: var\(--text-md\);/);
    expect(source).toMatch(/\.cx-composer__prompt \{[\s\S]*?line-height: 24px;/);
  });

  it('draws the mention chip with the accent tint at 14px medium', () => {
    expect(paper).toContain("backgroundColor: 'var(--color-primary-tint)'");
    expect(source).toMatch(/\.cx-composer__mention \{[\s\S]*?background: var\(--color-primary-tint\);/);
    expect(source).toMatch(/\.cx-composer__mention \{[\s\S]*?padding: 1px 7px;/);
  });

  it('makes send a 32px accent pill rather than a padded button', () => {
    expect(paper).toContain("height: '32px'");
    expect(paper).toContain("borderRadius: 'var(--radius-full)'");
    expect(source).toMatch(/\.cx-composer__send \{[\s\S]*?width: 32px;[\s\S]*?height: 32px;/);
    expect(source).toMatch(/\.cx-composer__send \{[\s\S]*?border-radius: var\(--radius-full\);/);
    expect(source).toMatch(/\.cx-composer__send \{[\s\S]*?background: var\(--color-primary\);/);
  });

  it('spaces the attachment and control rows by 8px, as Paper does', () => {
    expect(paper).toContain("gap: '8px'");
    expect(source).toMatch(/\.cx-composer__attachments \{[\s\S]*?gap: var\(--spacing-2\);/);
    expect(source).toMatch(/\.cx-composer__controls \{[\s\S]*?gap: var\(--spacing-2\);/);
  });
});

describe('chip matches the Paper composer control row', () => {
  const source = css('chip');
  const paper = jsx('composer');

  it('uses the control padding and gap Paper exports', () => {
    expect(paper).toContain("paddingBlock: '5px'");
    expect(paper).toContain("paddingInline: '11px'");
    expect(source).toMatch(/\.cx-chip--control \{[\s\S]*?padding: 5px 11px;/);
    expect(paper).toContain("gap: '6px'");
    expect(source).toContain('gap: 6px;');
  });

  it('fills the control variant from inset with no border', () => {
    expect(paper).toContain("backgroundColor: 'var(--color-inset)'");
    expect(source).toContain('background: var(--color-inset);');
  });

  it('outlines the attachment variant over the panel surface', () => {
    // The composer's attachment chip is bordered where its pickers are not.
    expect(paper).toContain("backgroundColor: 'var(--color-panel)'");
    expect(paper).toContain("borderColor: 'var(--color-border)'");
    expect(source).toMatch(/\.cx-chip--outlined \{[\s\S]*?border: 1px solid var\(--color-border\);/);
    expect(source).toMatch(/\.cx-chip--outlined \{[\s\S]*?background: var\(--color-panel\);/);
  });

  it('is a full pill at 12px medium', () => {
    expect(source).toContain('border-radius: var(--radius-full);');
    expect(source).toContain('font-size: var(--text-xs);');
    expect(paper).toContain("fontSize: '12px'");
  });

  it('sets a mono chip at regular weight, letting the face do the work', () => {
    expect(source).toMatch(
      /\.cx-chip--mono \{[\s\S]*?font-family: var\(--font-mono-stack\);[\s\S]*?font-weight: var\(--font-weight-regular\);/,
    );
  });
});
