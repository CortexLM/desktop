// Consumer-facing checks: compile against dist, never private source aliases.
import { ApiError, createCortexClient, type Problem, type MfaRequirement, type LibraryCreateData, type InteractiveAuthResponse } from '@cortex/sdk';

const client = createCortexClient();
const upload: LibraryCreateData = { url: '/v1/library', body: new Blob(['file']), query: { filename: 'file.txt' } };
void upload;
// @ts-expect-error filename is required
const noFilename: LibraryCreateData = { url: '/v1/library', body: new Blob() };
// @ts-expect-error raw bytes, never JSON metadata
const jsonUpload: LibraryCreateData = { url: '/v1/library', body: { bytes: 'file' }, query: { filename: 'file.txt' } };
void noFilename; void jsonUpload;

async function signatures(error: ApiError, problem: Problem) {
  const mfa: MfaRequirement | undefined = error.problem.mfa ?? problem.mfa;
  void mfa;
  const sent: void = await client.auth.magicAuth.create({ body: { email: 'owner@example.test' } });
  void sent;
  // @ts-expect-error send requires its email body
  client.auth.magicAuth.create();
  // @ts-expect-error verify requires code, including the Writable schema field
  client.auth.magicAuth.verify.create({ body: { email: 'owner@example.test' } });
  // @ts-expect-error pending token and challenge id are both required
  client.auth.mfa.verify.create({ body: { code: '123456' } });
  // @ts-expect-error email verification requires the pending token
  client.auth.verifyEmail.create({ body: { code: '123456' } });
  const auth: InteractiveAuthResponse = await client.auth.magicAuth.verify.create({ body: { email: 'owner@example.test', code: '123456' } });
  switch (auth.status) {
    case 'session': auth.access_token.toUpperCase(); break;
    case 'verify_email': auth.pending_authentication_token.toUpperCase(); auth.email.toUpperCase(); break;
    case 'mfa_challenge': auth.authentication_challenge_id.toUpperCase(); break;
    case 'mfa_enrollment': auth.qr_code.toUpperCase(); break;
    default: { const impossible: never = auth; void impossible; }
  }
  const session = await client.auth.mfa.verify.create({ body: { code: '123456', pending_authentication_token: 'pending', authentication_challenge_id: 'challenge' } });
  const status: 'session' = session.status;
  void status;
  // Legacy refresh body is intentionally unknown until its schema is supplied.
  const refresh: unknown = await client.auth.refresh.create({ body: { refresh_token: 'fixture' } });
  void refresh;
  const file = await client.library.create({ body: new File(['bytes'], 'file.txt'), query: { filename: 'file.txt' } });
  const size: number = file.byte_size;
  void size;
  const screenshot = await client.feedback.bugs.screenshots.create({ body: new File(['png'], 'screen.png'), query: { filename: 'screen.png' } });
  const screenshotSize: number = screenshot.byte_size;
  void screenshotSize;
  // @ts-expect-error screenshot filename is required
  client.feedback.bugs.screenshots.create({ body: new Blob() });
  // @ts-expect-error screenshot bytes cannot be JSON metadata
  client.feedback.bugs.screenshots.create({ body: { bytes: 'png' }, query: { filename: 'screen.png' } });
  const models = await client.registry.models.list({ query: { configured: true } });
  const reasoning: boolean | undefined = models.items[0]?.capabilities.reasoning;
  void reasoning;
  const blob: Blob = await client.library.content.list({ path: { id: 'file' } });
  // @ts-expect-error transport overrides belong on client.http
  client.library.content.list({ path: { id: 'file' }, parseAs: 'text' });
  // @ts-expect-error generated methods return data, never a fields envelope
  client.library.content.list({ path: { id: 'file' }, responseStyle: 'fields' });
  const stream: ReadableStream<Uint8Array> = await client.conversations.turns.start({ body: { message: 'Hello' } });
  const codeStream: ReadableStream<Uint8Array> = await client.code.sessions.turns.create({ path: { id: 'session' }, body: { message: 'Hello' } });
  const ws: never = await client.realtime.list();
  void blob; void stream; void codeStream; void ws;
}
void signatures;
