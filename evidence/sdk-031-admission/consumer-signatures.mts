import { createCortexClient, ApiError } from '@cortex/sdk';
import type {
  AuthSession, InteractiveAuthResponse, LocalSession, LibraryUploadResponse,
  Instance, RegistryModelPage, ProviderPage, StreamEvent, MfaRequirement,
} from '@cortex/sdk';

const client = createCortexClient({ baseUrl: 'https://instance.example', cookieJar: true });
async function signatures() {
  const instance: Instance = await client.instance.list();
  const providers: ProviderPage = await client.providers.list();
  const models: RegistryModelPage = await client.registry.models.list({ query: { configured: true, limit: 500, cursor: 'opaque' } });
  const sent: void = await client.auth.magicAuth.create({ body: { email: 'fixture@example.test' } });
  const verified: InteractiveAuthResponse = await client.auth.magicAuth.verify.create({ body: { email: 'fixture@example.test', code: '000000' } });
  const email: InteractiveAuthResponse = await client.auth.verifyEmail.create({ body: { code: '000000', pending_authentication_token: 'fixture-pending' } });
  const mfa: AuthSession = await client.auth.mfa.verify.create({ body: { code: '000000', pending_authentication_token: 'fixture-pending', authentication_challenge_id: 'fixture-challenge' } });
  const local: LocalSession = await client.auth.local.create({ body: { email: 'fixture@example.test', password: 'fixture-only' } });
  const signedOut: void = await client.auth.local.logout.create();
  const upload: LibraryUploadResponse = await client.library.create({ body: new Blob(['fixture']), query: { filename: 'fixture.txt' } });
  const download: Blob = await client.library.content.list({ path: { id: upload.id } });
  const turn: AsyncGenerator<StreamEvent, void, undefined> = client.streamTurn({ body: { message: 'fixture', model_slug: 'operator/fixture', reasoning_effort: 'high', attachment_ids: [upload.id] }, idempotencyKey: 'fixture-key' }, { lastEventId: '2' });
  const codeTurn: AsyncGenerator<StreamEvent, void, undefined> = client.streamCodeTurn('fixture-id', { body: { message: 'fixture' } });
  const raw: ReadableStream<Uint8Array> = await client.conversations.turns.start();
  const cloudModels: unknown = await client.models.list();
  const profile: unknown = await client.me.list();
  const conversations: unknown = await client.conversations.list();
  const messages: unknown = await client.conversations.messages.list({ path: { id: 'fixture-id' } });
  const createCode: unknown = await client.code.sessions.create({ body: { repo: 'fixture/repo' } });
  const cancelCode: unknown = await client.code.sessions.cancel.create({ path: { id: 'fixture-id' } });
  const password: unknown = await client.auth.password.create({ body: { email: 'fixture@example.test', password: 'fixture-only' } });
  const register: unknown = await client.auth.register.create({ body: { email: 'fixture@example.test', password: 'fixture-only' } });
  const refresh: unknown = await client.auth.refresh.create();
  const reauth: MfaRequirement = 'reauth_required';
  const error = new ApiError({ type: 'about:blank', title: 'Fixture', status: 422, code: 'invalid_state', request_id: 'fixture', mfa: reauth });
  // @ts-expect-error OTP verification requires its code.
  client.auth.magicAuth.verify.create({ body: { email: 'fixture@example.test' } });
  // @ts-expect-error Library filename is mandatory.
  client.library.create({ body: new Blob(['fixture']) });
  // @ts-expect-error Library upload is binary, never a JSON object.
  client.library.create({ body: { data: 'fixture' }, query: { filename: 'fixture.txt' } });
  // @ts-expect-error Password sign-in remains unknown, not InteractiveAuthResponse.
  const typedPassword: InteractiveAuthResponse = await client.auth.password.create();
  // @ts-expect-error Refresh remains unknown, not AuthSession.
  const typedRefresh: AuthSession = await client.auth.refresh.create();
  // @ts-expect-error Cloud catalogue response remains unknown.
  cloudModels.items;
  // @ts-expect-error Canonical turn body is absent; generated start rejects a body.
  client.conversations.turns.start({ body: { message: 'fixture' } });
  // @ts-expect-error Generated screenshot contract has no filename query.
  client.feedback.bugs.screenshots.create({ body: new Blob(['fixture']), query: { filename: 'fixture.png' } });
  // @ts-expect-error Media-terminal behavior has no helper opt-out in 0.3.1.
  client.streamTurn({ body: { message: 'fixture' } }, { stopAtTerminal: false });
  void [instance, providers, models, sent, verified, email, mfa, local, signedOut, upload, download, turn, codeTurn, raw, cloudModels, profile, conversations, messages, createCode, cancelCode, password, register, refresh, error, typedPassword, typedRefresh];
}
void signatures;
