export const MEMBER_TYPES = [
  { value: "participant", label: "Participante" },
  { value: "student_athlete", label: "Atleta ou estudante" },
  { value: "athletic_representative", label: "Representante de atlética" },
  { value: "university_representative", label: "Representante de universidade" },
  { value: "organizer", label: "Organização ou coordenação" },
  { value: "seller", label: "Vendedor(a)" },
  { value: "other", label: "Outro" },
] as const;

export type MemberType = (typeof MEMBER_TYPES)[number]["value"];

export type MemberProfile = {
  fullName: string;
  memberType: MemberType;
  position: string;
  athletic: string;
  university: string;
};

export const EMPTY_MEMBER_PROFILE: MemberProfile = {
  fullName: "",
  memberType: "participant",
  position: "",
  athletic: "",
  university: "",
};

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function memberProfileFromMetadata(metadata: Record<string, unknown>): MemberProfile {
  const memberType = MEMBER_TYPES.some((item) => item.value === metadata.member_type)
    ? (metadata.member_type as MemberType)
    : "participant";

  return {
    fullName: text(metadata.full_name, 120),
    memberType,
    position: text(metadata.position, 120),
    athletic: text(metadata.athletic, 120),
    university: text(metadata.university, 120),
  };
}

export function memberProfileMetadata(profile: MemberProfile) {
  return {
    full_name: text(profile.fullName, 120),
    member_type: profile.memberType,
    position: text(profile.position, 120),
    athletic: text(profile.athletic, 120),
    university: text(profile.university, 120),
  };
}
