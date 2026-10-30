import type { Member } from '../types/database.types';
import type { MemberGuardian } from '../types/database.types';

export interface VerifiedGuardianLink {
  guardian: Member;
  relationship: MemberGuardian['relationship'];
  isPrimary: boolean;
  pickupAuthorized: boolean;
}

/**
 * Resolve only explicitly recorded guardian relationships.
 * No surname, address, or shared-phone inference is used here.
 */
export function getVerifiedGuardians(
  childMemberId: string,
  links: MemberGuardian[],
  members: Member[]
): VerifiedGuardianLink[] {
  const byId = new Map(members.map(member => [member.id, member]));
  return links
    .filter(link => link.child_member_id === childMemberId && link.verified_at)
    .map(link => {
      const guardian = byId.get(link.guardian_member_id);
      if (!guardian || guardian.is_archived) return null;
      return {
        guardian,
        relationship: link.relationship,
        isPrimary: link.is_primary,
        pickupAuthorized: link.pickup_authorized,
      };
    })
    .filter((link): link is VerifiedGuardianLink => link !== null)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}
