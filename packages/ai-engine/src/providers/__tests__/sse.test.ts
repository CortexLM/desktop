/**
 * Tests - Parsing SSE partagé
 *
 * Couvre les bugs de l'implémentation dupliquée précédente (Grok/OpenRouter) :
 * buffer résiduel perdu, CRLF, `data:` sans espace, `finish_reason` absent
 * interprété comme fin de flux, reader jamais libéré.
 */

import { describe, it, expect } from 'vitest';
import {
  parseSSEStream,
  parseSSELine,
  splitSSELines,
  isSSEDoneMarker,
  toStreamChunk,
} from '../sse';

/** Construit un ReadableStream à partir de morceaux de texte bruts. */
function streamFrom(...pieces: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const piece of pieces) {
        controller.enqueue(encoder.encode(piece));
      }
      controller.close();
    },
  });
}

function chunk(content: string, finishReason: string | null = null): string {
  return `data: ${JSON.stringify({
    id: 'gen-1',
    model: 'test',
    choices: [{ delta: { content }, finish_reason: finishReason }],
  })}\n\n`;
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const chunks = [];
  for await (const c of parseSSEStream(stream)) {
    chunks.push(c);
  }
  return chunks;
}

describe('splitSSELines', () => {
  it('conserve la ligne partielle finale', () => {
    const { lines, rest } = splitSSELines('a\nb\npartial');
    expect(lines).toEqual(['a', 'b']);
    expect(rest).toBe('partial');
  });

  it('retire les \\r des flux CRLF', () => {
    const { lines } = splitSSELines('data: {"a":1}\r\ndata: {"b":2}\r\n');
    expect(lines).toEqual(['data: {"a":1}', 'data: {"b":2}']);
  });
});

describe('parseSSELine', () => {
  it('accepte `data: ` avec espace', () => {
    expect(parseSSELine('data: {"a":1}')).toBe('{"a":1}');
  });

  it('accepte `data:` sans espace', () => {
    expect(parseSSELine('data:{"a":1}')).toBe('{"a":1}');
  });

  it('ignore les lignes non-data', () => {
    expect(parseSSELine('event: message')).toBeUndefined();
    expect(parseSSELine(': keep-alive comment')).toBeUndefined();
    expect(parseSSELine('')).toBeUndefined();
    expect(parseSSELine('id: 42')).toBeUndefined();
  });
});

describe('isSSEDoneMarker', () => {
  it('reconnaît [DONE]', () => {
    expect(isSSEDoneMarker('[DONE]')).toBe(true);
    expect(isSSEDoneMarker('{"a":1}')).toBe(false);
  });
});

describe('toStreamChunk', () => {
  it('extrait le contenu du delta', () => {
    expect(toStreamChunk({ choices: [{ delta: { content: 'hi' }, finish_reason: null }] })).toEqual({
      content: 'hi',
      done: false,
    });
  });

  it('marque done quand finish_reason est présent', () => {
    expect(toStreamChunk({ choices: [{ delta: {}, finish_reason: 'stop' }] })).toEqual({
      content: '',
      done: true,
    });
  });

  it('ne marque PAS done quand finish_reason est absent', () => {
    // Régression : l'ancien test `!== null` renvoyait done: true ici,
    // ce qui coupait le flux dès le premier chunk pour certains providers.
    expect(toStreamChunk({ choices: [{ delta: { content: 'hi' } }] })).toEqual({
      content: 'hi',
      done: false,
    });
  });

  it('ne marque PAS done quand choices est vide', () => {
    expect(toStreamChunk({ choices: [] })).toEqual({ content: '', done: false });
    expect(toStreamChunk({})).toEqual({ content: '', done: false });
  });

  it('traite content: null comme une chaîne vide', () => {
    expect(toStreamChunk({ choices: [{ delta: { content: null }, finish_reason: null }] })).toEqual({
      content: '',
      done: false,
    });
  });
});

describe('parseSSEStream', () => {
  it('parse un flux complet', async () => {
    const chunks = await collect(
      streamFrom(chunk('Hello '), chunk('world'), chunk('', 'stop'), 'data: [DONE]\n\n')
    );

    expect(chunks.map((c) => c.content).join('')).toBe('Hello world');
    expect(chunks[chunks.length - 1].done).toBe(true);
  });

  it('gère un chunk JSON découpé sur plusieurs reads', async () => {
    const full = chunk('découpé');
    const mid = Math.floor(full.length / 2);

    const chunks = await collect(streamFrom(full.slice(0, mid), full.slice(mid), 'data: [DONE]\n\n'));

    expect(chunks.map((c) => c.content).join('')).toBe('découpé');
  });

  it('ne perd pas le dernier chunk sans newline final', async () => {
    // Régression : le buffer résiduel n'était jamais vidé => contenu perdu
    const chunks = await collect(
      streamFrom(chunk('premier'), `data: ${JSON.stringify({
        choices: [{ delta: { content: 'dernier' }, finish_reason: null }],
      })}`)
    );

    expect(chunks.map((c) => c.content).join('')).toBe('premierdernier');
  });

  it('gère les flux CRLF', async () => {
    const chunks = await collect(
      streamFrom(
        `data: ${JSON.stringify({ choices: [{ delta: { content: 'crlf' }, finish_reason: null }] })}\r\n\r\n`,
        'data: [DONE]\r\n\r\n'
      )
    );

    expect(chunks.map((c) => c.content).join('')).toBe('crlf');
  });

  it('gère `data:` sans espace', async () => {
    const chunks = await collect(
      streamFrom(
        `data:${JSON.stringify({ choices: [{ delta: { content: 'compact' }, finish_reason: null }] })}\n\n`,
        'data: [DONE]\n\n'
      )
    );

    expect(chunks.map((c) => c.content).join('')).toBe('compact');
  });

  it('ne s\'arrête pas au premier chunk quand finish_reason est absent', async () => {
    // Régression principale : ces chunks (sans finish_reason) étaient tous
    // marqués done, le consommateur s'arrêtait donc après le premier.
    const withoutFinishReason = (content: string) =>
      `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

    const chunks = await collect(
      streamFrom(
        withoutFinishReason('un '),
        withoutFinishReason('deux '),
        withoutFinishReason('trois'),
        'data: [DONE]\n\n'
      )
    );

    expect(chunks.map((c) => c.content).join('')).toBe('un deux trois');
    expect(chunks.filter((c) => c.done)).toHaveLength(1); // seul le chunk terminal
  });

  it('ignore les lignes mal formées sans casser le flux', async () => {
    const chunks = await collect(
      streamFrom(chunk('valide'), 'data: {json invalide\n\n', chunk(' suite'), 'data: [DONE]\n\n')
    );

    expect(chunks.map((c) => c.content).join('')).toBe('valide suite');
  });

  it('ignore les commentaires keep-alive et les champs event/id', async () => {
    const chunks = await collect(
      streamFrom(': keep-alive\n\n', 'event: message\n', 'id: 1\n', chunk('ok'), 'data: [DONE]\n\n')
    );

    expect(chunks.map((c) => c.content).join('')).toBe('ok');
  });

  it('s\'arrête à [DONE] et ignore ce qui suit', async () => {
    const chunks = await collect(
      streamFrom(chunk('avant'), 'data: [DONE]\n\n', chunk('après'))
    );

    expect(chunks.map((c) => c.content).join('')).toBe('avant');
  });

  it('gère un flux vide', async () => {
    const chunks = await collect(streamFrom());
    expect(chunks).toEqual([]);
  });

  it('gère les caractères multi-octets découpés entre deux reads', async () => {
    const encoder = new TextEncoder();
    const payload = `data: ${JSON.stringify({
      choices: [{ delta: { content: 'héllo 🎉' }, finish_reason: null }],
    })}\n\n`;
    const bytes = encoder.encode(payload);
    const cut = 20; // coupe potentiellement au milieu d'un caractère UTF-8

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, cut));
        controller.enqueue(bytes.slice(cut));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    const chunks = await collect(stream);
    expect(chunks.map((c) => c.content).join('')).toBe('héllo 🎉');
  });

  it('libère le reader quand le consommateur abandonne l\'itération', async () => {
    let cancelled = false;
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(chunk('premier')));
        controller.enqueue(encoder.encode(chunk('deuxième')));
      },
      cancel() {
        cancelled = true;
      },
    });

    for await (const c of parseSSEStream(stream)) {
      expect(c.content).toBe('premier');
      break; // abandon volontaire
    }

    // Régression : sans releaseLock/cancel, la connexion HTTP et son buffer
    // restaient ouverts.
    expect(cancelled).toBe(true);
  });

  it('propage l\'erreur et libère le reader si le flux casse en cours', async () => {
    const encoder = new TextEncoder();
    let pulls = 0;

    // Livre un chunk valide, puis casse : simule une connexion interrompue
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) {
          controller.enqueue(encoder.encode(chunk('partiel')));
        } else {
          controller.error(new Error('network dropped'));
        }
      },
    });

    const received: string[] = [];
    let caught: unknown;

    try {
      for await (const c of parseSSEStream(stream)) {
        received.push(c.content);
      }
    } catch (error) {
      caught = error;
    }

    // Le contenu déjà reçu est bien remonté au consommateur...
    expect(received.join('')).toBe('partiel');
    // ...et l'erreur n'est pas avalée silencieusement
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('network dropped');
  });
});
