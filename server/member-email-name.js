export function getMemberEmailName(member = {}) {
  const candidates = [
    member.displayName,
    member.authDisplayName,
    member.username,
    member.fullName,
    member.memberName,
    member.name,
  ];
  return candidates.find((value) => typeof value === "string" && value.trim())?.trim() || "member";
}
