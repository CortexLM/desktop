# Desktop Chat catalog ownership

Remote Chat and signed-in feature screens call `remoteChatModels()` from
`remote-owner.ts`. It coalesces in-flight `api.remoteSessions.models()` reads
under `chat-feature-models`. Capability discovery must use this same loader.
Do not put `api.code.models()` under that key: it does not populate the Chat
core catalog, so a later Chat create can refuse `catalog_unavailable`.

Only concurrent requests are shared; settled reads are refreshed on the next
call. Existing route and epoch fences still decide whether a response may render.
No backend cancellation or native integration is implied by this renderer fix.
