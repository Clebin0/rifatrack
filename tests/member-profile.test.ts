import { describe, expect, it } from "vitest";
import {
  memberProfileFromMetadata,
  memberProfileMetadata,
  type MemberProfile,
} from "../lib/member-profile";

describe("public member profile", () => {
  it("stores a self-described affiliation without any authorization fields", () => {
    const profile: MemberProfile = {
      fullName: "Ana Exemplo",
      memberType: "athletic_representative",
      position: "Presidente",
      athletic: "Atlética Central",
      university: "Universidade Exemplo",
    };

    expect(memberProfileMetadata(profile)).toEqual({
      full_name: "Ana Exemplo",
      member_type: "athletic_representative",
      position: "Presidente",
      athletic: "Atlética Central",
      university: "Universidade Exemplo",
    });
    expect(memberProfileMetadata(profile)).not.toHaveProperty("role");
    expect(memberProfileMetadata(profile)).not.toHaveProperty("app_metadata");
  });

  it("falls back to a safe public profile for unsupported metadata values", () => {
    expect(memberProfileFromMetadata({ member_type: "owner" })).toEqual({
      fullName: "",
      memberType: "participant",
      position: "",
      athletic: "",
      university: "",
    });
  });

  it("limits saved text lengths and trims whitespace", () => {
    const profile = memberProfileFromMetadata({ full_name: `  ${"A".repeat(140)}  ` });
    expect(profile.fullName).toHaveLength(120);
    expect(profile.fullName.startsWith(" ")).toBe(false);
  });
});
