import { fetchBeacon, type ChainClient, type ChainInfo, type RandomnessBeacon } from "drand-client";
import { z } from "zod";

export const QUICKNET: ChainInfo = {
  hash: "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
  public_key:
    "83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a",
  period: 3,
  genesis_time: 1692803367,
  groupHash: "f477d5c89f21a17c863a7f937c6a6d15859414d2be09cd448d4279af331c5d3e",
  schemeID: "bls-unchained-g1-rfc9380",
  metadata: { beaconID: "quicknet" },
};
const beaconSchema = z.object({
  round: z.number().int().positive().safe(),
  randomness: z.string().regex(/^[0-9a-f]{64}$/),
  signature: z.string().regex(/^[0-9a-f]{96}$/),
});
export type Beacon = z.infer<typeof beaconSchema>;

export async function verifyDrandBeacon(value: unknown, round: number): Promise<Beacon> {
  const beacon = beaconSchema.parse(value);
  const client: ChainClient = {
    options: { disableBeaconVerification: false, noCache: false },
    chain: () => ({ baseUrl: "https://api.drand.sh/" + QUICKNET.hash, info: async () => QUICKNET }),
    get: async () => beacon as RandomnessBeacon,
    latest: async () => beacon as RandomnessBeacon,
  };
  return beaconSchema.parse(await fetchBeacon(client, round));
}

export async function verifiedFutureBeacon(round: number): Promise<Beacon> {
  if (!Number.isSafeInteger(round) || round < 1) throw new Error("invalid_round");
  if (Date.now() < (QUICKNET.genesis_time + (round - 1) * QUICKNET.period) * 1000)
    throw new Error("beacon_pending");
  const response = await fetch(`https://api.drand.sh/${QUICKNET.hash}/public/${round}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("beacon_unavailable");
  return verifyDrandBeacon(await response.json(), round);
}

export async function sha256(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (n) => n.toString(16).padStart(2, "0")).join("");
}
export async function winningNumber(
  randomness: string,
  listHash: string,
  numbers: number[],
  version = 2,
) {
  if (!numbers.length) throw new Error("empty_snapshot");
  const hash = await sha256(`${randomness}:${listHash}:RIFATRACK_DRAW_V${version}`);
  const index = Number(
    (BigInt("0x" + hash.slice(0, 16)) & ((1n << 63n) - 1n)) % BigInt(numbers.length),
  );
  return numbers[index];
}
