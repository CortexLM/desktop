export function validateConfig(env: Record<string, string | undefined>): void;
export function verifyArtifacts(directory: string, sha: string): {
  sha: string;
  files: { name: string; sha512: string }[];
};
