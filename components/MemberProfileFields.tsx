import { MEMBER_TYPES, type MemberProfile } from "@/lib/member-profile";

export default function MemberProfileFields({
  profile,
  onChange,
  disabled = false,
}: {
  profile: MemberProfile;
  onChange: (profile: MemberProfile) => void;
  disabled?: boolean;
}) {
  const inputClass = "ui-input mt-1";
  const update = (field: keyof MemberProfile, value: string) =>
    onChange({ ...profile, [field]: value } as MemberProfile);

  return (
    <>
      <div>
        <label htmlFor="member-full-name" className="text-sm font-semibold">
          Nome completo
        </label>
        <input
          id="member-full-name"
          className={inputClass}
          autoComplete="name"
          maxLength={120}
          required
          disabled={disabled}
          value={profile.fullName}
          onChange={(event) => update("fullName", event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="member-type" className="text-sm font-semibold">
          Como você participa?
        </label>
        <select
          id="member-type"
          className={inputClass}
          required
          disabled={disabled}
          value={profile.memberType}
          onChange={(event) => update("memberType", event.target.value)}
        >
          {MEMBER_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="member-position" className="text-sm font-semibold">
          Cargo ou função <span className="ui-muted font-normal">(opcional)</span>
        </label>
        <input
          id="member-position"
          className={inputClass}
          autoComplete="organization-title"
          maxLength={120}
          disabled={disabled}
          placeholder="Ex.: presidente, estudante, coordenador(a)"
          value={profile.position}
          onChange={(event) => update("position", event.target.value)}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="member-athletic" className="text-sm font-semibold">
            Atlética <span className="ui-muted font-normal">(opcional)</span>
          </label>
          <input
            id="member-athletic"
            className={inputClass}
            maxLength={120}
            disabled={disabled}
            placeholder="Nome da atlética"
            value={profile.athletic}
            onChange={(event) => update("athletic", event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="member-university" className="text-sm font-semibold">
            Universidade <span className="ui-muted font-normal">(opcional)</span>
          </label>
          <input
            id="member-university"
            className={inputClass}
            autoComplete="organization"
            maxLength={120}
            disabled={disabled}
            placeholder="Nome da universidade"
            value={profile.university}
            onChange={(event) => update("university", event.target.value)}
          />
        </div>
      </div>
    </>
  );
}
