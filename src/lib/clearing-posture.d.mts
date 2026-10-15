export const MASTERCARD_SECRET_NAMES: readonly string[];

export function clearingPosture(): {
  parallax: { repo: string; contract: string; deployed: boolean; custody: boolean; note: string };
  stocklana: { repo: string; panStored: boolean; note: string };
  mastercard: { secrets: readonly string[]; note: string };
  monad: { chainId: number; signed: boolean; note: string };
};
