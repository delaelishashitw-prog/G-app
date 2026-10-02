import { Member } from '../types/database.types';

export type FamilyRelationshipType =
  | 'Spouse (Husband)'
  | 'Spouse (Wife)'
  | 'Spouse'
  | 'Parent / Guardian'
  | 'Child / Dependent'
  | 'Sibling (Brother)'
  | 'Sibling (Sister)'
  | 'Sibling'
  | 'Household Relative'
  | 'Emergency Contact';

export type ConnectionReason =
  | 'Spouse Record'
  | 'Shared Surname'
  | 'Shared Household Line'
  | 'Emergency Contact'
  | 'Shared Residence'
  | 'GhanaPost GPS';

export interface LinkedFamilyMember {
  member: Member;
  relationship: FamilyRelationshipType;
  connectionReason: ConnectionReason;
  isSpouse: boolean;
}

export interface ChurchHousehold {
  id: string;
  name: string;
  headOfHousehold: Member;
  members: Member[];
  surnames: string[];
  totalMembers: number;
  adultCount: number;
  youthCount: number;
  childrenCount: number;
  primaryPhone: string;
  residentialAddress: string;
  gpsAddress: string;
  hasMarriedCouple: boolean;
}

function normalizeStr(s?: string | null): string {
  return (s || '').trim().toLowerCase();
}

function cleanPhone(p?: string | null): string {
  return (p || '').replace(/[^0-9]/g, '');
}

const GENERIC_LOCALITIES = new Set([
  'joma',
  'joma, accra',
  'joma, agbozome',
  'agbozome',
  'joma new site',
  'joma top',
  'accra',
  'ghana',
  'ga-',
]);

/**
 * Resolves age group for a member based on explicit age_group, date_of_birth, or ministry.
 */
export function getMemberAgeGroup(m: Member): 'child' | 'youth' | 'adult' | 'senior' {
  if (m.age_group) return m.age_group;

  if (m.date_of_birth) {
    const birthYear = new Date(m.date_of_birth).getFullYear();
    if (!isNaN(birthYear) && birthYear > 1900) {
      const currentYear = new Date().getFullYear();
      const age = currentYear - birthYear;
      if (age < 13) return 'child';
      if (age < 25) return 'youth';
      if (age >= 65) return 'senior';
      return 'adult';
    }
  }

  const ministryLower = (m.ministry_name || '').toLowerCase();
  if (ministryLower.includes('children') || ministryLower.includes('sunday school')) {
    return 'child';
  }
  if (ministryLower.includes('youth') || ministryLower.includes('champions')) {
    return 'youth';
  }

  return 'adult';
}

/**
 * Checks if two members are spouses based on explicit marital details.
 */
export function areSpouseMatch(m1: Member, m2: Member): boolean {
  if (m1.id === m2.id) return false;

  const m1Spouse = normalizeStr(m1.spouse_name);
  const m2Spouse = normalizeStr(m2.spouse_name);

  const m1First = normalizeStr(m1.first_name);
  const m1Last = normalizeStr(m1.last_name);
  const m2First = normalizeStr(m2.first_name);
  const m2Last = normalizeStr(m2.last_name);

  // Check if m1 has m2 recorded as spouse
  if (m1Spouse && m1Spouse.length >= 3) {
    if (m1Spouse.includes(m2First) && (m2Last.length < 3 || m1Spouse.includes(m2Last.slice(0, 4)))) {
      return true;
    }
    if (m1Spouse.includes(`${m2First} ${m2Last}`)) {
      return true;
    }
  }

  // Check if m2 has m1 recorded as spouse
  if (m2Spouse && m2Spouse.length >= 3) {
    if (m2Spouse.includes(m1First) && (m1Last.length < 3 || m2Spouse.includes(m1Last.slice(0, 4)))) {
      return true;
    }
    if (m2Spouse.includes(`${m1First} ${m1Last}`)) {
      return true;
    }
  }

  return false;
}

/**
 * Determines whether two members share a family / household bond.
 */
export function areFamilyMembers(m1: Member, m2: Member): {
  isLinked: boolean;
  reason?: ConnectionReason;
  relationship?: FamilyRelationshipType;
} {
  if (m1.id === m2.id || m1.is_archived || m2.is_archived) {
    return { isLinked: false };
  }

  // 1. Explicit Spouse Match
  if (areSpouseMatch(m1, m2)) {
    const rel: FamilyRelationshipType =
      m2.gender === 'male' ? 'Spouse (Husband)' : m2.gender === 'female' ? 'Spouse (Wife)' : 'Spouse';
    return { isLinked: true, reason: 'Spouse Record', relationship: rel };
  }

  // 2. Shared Surname
  const s1 = normalizeStr(m1.last_name);
  const s2 = normalizeStr(m2.last_name);
  if (s1 && s2 && s1 === s2 && s1.length >= 2) {
    let rel: FamilyRelationshipType = 'Household Relative';

    // Age / generation heuristic
    const m1Age = getMemberAgeGroup(m1);
    const m2Age = getMemberAgeGroup(m2);

    if (m1Age === 'adult' && (m2Age === 'child' || m2Age === 'youth')) {
      rel = 'Child / Dependent';
    } else if ((m1Age === 'child' || m1Age === 'youth') && m2Age === 'adult') {
      rel = 'Parent / Guardian';
    } else if (m1.marital_status === 'married' && m2.marital_status === 'married' && m1.gender !== m2.gender) {
      rel = m2.gender === 'male' ? 'Spouse (Husband)' : 'Spouse (Wife)';
    } else if (m1.gender === m2.gender) {
      rel = m2.gender === 'male' ? 'Sibling (Brother)' : 'Sibling (Sister)';
    } else {
      rel = 'Sibling';
    }

    return { isLinked: true, reason: 'Shared Surname', relationship: rel };
  }

  // 3. Shared Phone number (excluding placeholder / test numbers)
  const p1 = cleanPhone(m1.phone);
  const p2 = cleanPhone(m2.phone);
  if (p1 && p2 && p1.length >= 8 && p1 === p2 && !p1.includes('24000000')) {
    return { isLinked: true, reason: 'Shared Household Line', relationship: 'Household Relative' };
  }

  // 4. Emergency Contact Relationship
  const ep1 = cleanPhone(m1.emergency_phone);
  const ep2 = cleanPhone(m2.emergency_phone);
  if (ep1 && ep1.length >= 8 && !ep1.includes('24000000') && ep1 === p2) {
    const relStr = normalizeStr(m1.emergency_relationship);
    let rel: FamilyRelationshipType = 'Emergency Contact';
    if (relStr.includes('spouse') || relStr.includes('wife') || relStr.includes('husband')) {
      rel = m2.gender === 'male' ? 'Spouse (Husband)' : 'Spouse (Wife)';
    } else if (relStr.includes('parent') || relStr.includes('father') || relStr.includes('mother')) {
      rel = 'Parent / Guardian';
    } else if (relStr.includes('child') || relStr.includes('son') || relStr.includes('daughter')) {
      rel = 'Child / Dependent';
    } else if (relStr.includes('sibling') || relStr.includes('brother') || relStr.includes('sister')) {
      rel = m2.gender === 'male' ? 'Sibling (Brother)' : 'Sibling (Sister)';
    }
    return { isLinked: true, reason: 'Emergency Contact', relationship: rel };
  }

  if (ep2 && ep2.length >= 8 && !ep2.includes('24000000') && ep2 === p1) {
    const relStr = normalizeStr(m2.emergency_relationship);
    let rel: FamilyRelationshipType = 'Household Relative';
    if (relStr.includes('spouse') || relStr.includes('wife') || relStr.includes('husband')) {
      rel = m2.gender === 'male' ? 'Spouse (Husband)' : 'Spouse (Wife)';
    }
    return { isLinked: true, reason: 'Emergency Contact', relationship: rel };
  }

  // 5. Specific street address (ignore generic "Joma", "Joma, Accra")
  const a1 = normalizeStr(m1.residential_address);
  const a2 = normalizeStr(m2.residential_address);
  if (a1 && a2 && a1 === a2 && a1.length > 12 && !GENERIC_LOCALITIES.has(a1)) {
    return { isLinked: true, reason: 'Shared Residence', relationship: 'Household Relative' };
  }

  // 6. Specific GhanaPost GPS address (e.g. GA-183-4921)
  const g1 = normalizeStr(m1.gps_address);
  const g2 = normalizeStr(m2.gps_address);
  if (g1 && g2 && g1 === g2 && g1.length > 7 && g1 !== 'ga-') {
    return { isLinked: true, reason: 'GhanaPost GPS', relationship: 'Household Relative' };
  }

  return { isLinked: false };
}

/**
 * Returns all connected family and household members for a given member.
 */
export function getLinkedFamilyMembers(
  member: Member,
  allMembers: Member[]
): LinkedFamilyMember[] {
  const links: LinkedFamilyMember[] = [];

  for (const other of allMembers) {
    if (other.id === member.id || other.is_archived) continue;

    const check = areFamilyMembers(member, other);
    if (check.isLinked && check.reason && check.relationship) {
      links.push({
        member: other,
        relationship: check.relationship,
        connectionReason: check.reason,
        isSpouse: check.reason === 'Spouse Record' || check.relationship.includes('Spouse'),
      });
    }
  }

  // Sort spouses first, then siblings/children/parents, then others
  links.sort((a, b) => {
    if (a.isSpouse && !b.isSpouse) return -1;
    if (!a.isSpouse && b.isSpouse) return 1;
    return a.member.first_name.localeCompare(b.member.first_name);
  });

  return links;
}

/**
 * Clusters all members of the church into cohesive Household & Family Units.
 */
export function clusterHouseholds(members: Member[]): ChurchHousehold[] {
  const activeMembers = members.filter((m) => !m.is_archived);
  const visited = new Set<string>();
  const households: ChurchHousehold[] = [];

  for (const member of activeMembers) {
    if (visited.has(member.id)) continue;

    // Breadth-first graph clustering
    const cluster: Member[] = [];
    const queue: Member[] = [member];
    visited.add(member.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);

      for (const other of activeMembers) {
        if (!visited.has(other.id)) {
          const check = areFamilyMembers(current, other);
          if (check.isLinked) {
            visited.add(other.id);
            queue.push(other);
          }
        }
      }
    }

    // Determine Head of Household heuristic:
    // Prefer adult male head, or adult with spouse, or oldest/first adult
    const head =
      cluster.find((m) => getMemberAgeGroup(m) === 'adult' && m.gender === 'male' && m.marital_status === 'married') ||
      cluster.find((m) => getMemberAgeGroup(m) === 'adult' && m.gender === 'male') ||
      cluster.find((m) => getMemberAgeGroup(m) === 'adult') ||
      cluster[0];

    // Compute distinct surnames
    const surnames = Array.from(new Set(cluster.map((m) => m.last_name).filter(Boolean)));

    // Generate household name
    let name = '';
    if (surnames.length === 1) {
      name = `The ${surnames[0]} Family`;
    } else if (surnames.length === 2) {
      name = `${surnames[0]} & ${surnames[1]} Household`;
    } else {
      name = `The ${head.last_name} Household (${surnames.join(' / ')})`;
    }

    const adultCount = cluster.filter((m) => getMemberAgeGroup(m) === 'adult' || getMemberAgeGroup(m) === 'senior').length;
    const youthCount = cluster.filter((m) => getMemberAgeGroup(m) === 'youth').length;
    const childrenCount = cluster.filter((m) => getMemberAgeGroup(m) === 'child').length;

    // Primary contact phone
    const primaryPhone =
      head.phone ||
      cluster.find((m) => m.phone && !m.phone.includes('24000000'))?.phone ||
      cluster[0]?.phone ||
      '';

    // Primary address
    const residentialAddress =
      cluster.find((m) => m.residential_address && !GENERIC_LOCALITIES.has(normalizeStr(m.residential_address)))
        ?.residential_address ||
      head.residential_address ||
      'Joma, Accra';

    const gpsAddress =
      cluster.find((m) => m.gps_address && m.gps_address !== 'GA-')?.gps_address || head.gps_address || '';

    const hasMarriedCouple = cluster.some(
      (m1) => m1.marital_status === 'married' && cluster.some((m2) => m2.id !== m1.id && areSpouseMatch(m1, m2))
    );

    households.push({
      id: `hh-${head.id}`,
      name,
      headOfHousehold: head,
      members: cluster,
      surnames,
      totalMembers: cluster.length,
      adultCount,
      youthCount,
      childrenCount,
      primaryPhone,
      residentialAddress,
      gpsAddress,
      hasMarriedCouple,
    });
  }

  // Sort multi-member households first, then alphabetically by name
  households.sort((a, b) => {
    if (b.totalMembers !== a.totalMembers) {
      return b.totalMembers - a.totalMembers;
    }
    return a.name.localeCompare(b.name);
  });

  return households;
}

/**
 * Pre-composes a pastoral WhatsApp blessing message tailored for a church household.
 */
export function buildFamilyBlessingWhatsAppUrl(
  phone: string,
  householdName: string,
  headFirstName: string
): string {
  const clean = cleanPhone(phone);
  const intlPhone = clean.startsWith('0') ? '233' + clean.slice(1) : clean;

  const text = `Shalom ${headFirstName}! 🕊️\n\nWarm pastoral greetings from Prophet Elisha K. Richard and the entire Greater Works City Church (GWCC) family.\n\nWe are interceding for the *${householdName}* this week. May the Lord sanctify your home, open doors of supernatural breakthrough, and preserve every member of your family under His protective wings (Psalm 91).\n\nWe look forward to worshiping with your household this Sunday!\n\n_Greater Works City Church, Joma_`;

  return `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`;
}
