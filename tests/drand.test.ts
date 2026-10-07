import { describe, it, expect } from "vitest";
import beacon from "./drand-beacon.json";
import { verifyDrandBeacon, winningNumber, sha256 } from "@/lib/drand";
describe("External draw verification", () => {
  it("verifies a quicknet BLS signature against the pinned public key", async () => {
    expect((await verifyDrandBeacon(beacon, beacon.round)).randomness).toBe(beacon.randomness);
  });
  it("rejects a forged signature and another round", async () => {
    await expect(
      verifyDrandBeacon({ ...beacon, signature: "00".repeat(48) }, beacon.round),
    ).rejects.toThrow();
    await expect(verifyDrandBeacon(beacon, beacon.round + 1)).rejects.toThrow();
  });
  it("reproduces a deterministic eligible winner", async () => {
    const list = [1, 3, 9];
    const hash = await sha256(list.join(","));
    const winner = await winningNumber(beacon.randomness, hash, list);
    expect(list).toContain(winner);
    expect(await winningNumber(beacon.randomness, hash, list)).toBe(winner);
  });
});
