type Inventory = {
  sha: string;
  platform: 'linux' | 'win';
  files: { name: string; sha512: string }[];
};
export function validateConfig(env: Record<string, string | undefined>): void;
export function builderConfig(env: Record<string, string | undefined>, platform?: 'linux' | 'win'): {
  extends: string;
  appId: string;
  productName: string;
  executableName: string;
  artifactName: string;
  publish: { provider: string; url: string; channel: string };
  forceCodeSigning?: boolean;
  win?: { target: { target: string; arch: string[] }[]; verifyUpdateCodeSignature: boolean; signtoolOptions: { publisherName: string } };
  nsis?: { shortcutName: string; uninstallDisplayName: string };
};
export function verifyArtifacts(directory: string, sha: string, platform?: 'linux' | 'win'): Inventory;
export function inventoryArtifacts(directory: string, sha: string, platform?: 'linux' | 'win'): Inventory;
