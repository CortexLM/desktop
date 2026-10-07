// Bot call capture tap: forwards each 128-sample input block to the main thread (see src/screens/work/bot-call.tsx).
/* global registerProcessor, AudioWorkletProcessor -- AudioWorkletGlobalScope */
registerProcessor("cortex-call-tap", class extends AudioWorkletProcessor {
  process(inputs) { const c = inputs[0] && inputs[0][0]; if (c) this.port.postMessage(c.slice(0)); return true; }
});
