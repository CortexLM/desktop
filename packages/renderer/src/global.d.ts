import type { CortexAPI } from '../../preload/src/index';

declare global {
  interface Window {
    cortex: CortexAPI;
  }
}

export {};
