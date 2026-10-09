import test from 'node:test';
import assert from 'node:assert/strict';
import { areSpouseMatch, areFamilyMembers, getLinkedFamilyMembers, clusterHouseholds } from './familyUtils.ts';

const mockMembers = [
  {
    id: 'm1',
    first_name: 'Alfred',
    last_name: 'Torgbo',
    gender: 'male',
    marital_status: 'married',
    spouse_name: 'Cynthia Sukah',
    spouse_is_member: true,
    age_group: 'adult',
    phone: '+233 53249920',
    residential_address: 'Joma, Accra',
    is_archived: false,
  },
  {
    id: 'm2',
    first_name: 'Cynthia',
    last_name: 'Suka',
    gender: 'female',
    marital_status: 'married',
    spouse_name: '',
    spouse_is_member: false,
    emergency_relationship: 'Spouse',
    age_group: 'adult',
    phone: '+233 24000000',
    residential_address: 'Joma, Accra',
    is_archived: false,
  },
  {
    id: 'm3',
    first_name: 'Samuel',
    last_name: 'Torgbo',
    gender: 'male',
    marital_status: 'single',
    age_group: 'youth',
    phone: '+233 545521495',
    residential_address: 'Joma, Accra',
    is_archived: false,
  },
  {
    id: 'm4',
    first_name: 'Patience',
    last_name: 'Babanawo',
    gender: 'female',
    marital_status: 'married',
    spouse_name: 'Christopher Babanawo',
    spouse_is_member: true,
    age_group: 'adult',
    phone: '+233 547942289',
    residential_address: 'Joma top',
    is_archived: false,
  },
  {
    id: 'm5',
    first_name: 'Christopher',
    last_name: 'Babanawo',
    gender: 'male',
    marital_status: 'married',
    spouse_name: 'Patience Babanawo',
    spouse_is_member: true,
    age_group: 'adult',
    phone: '+233 292009835',
    residential_address: 'Joma top',
    is_archived: false,
  },
  {
    id: 'm6',
    first_name: 'Vanessa',
    last_name: 'Babanawo',
    gender: 'female',
    marital_status: 'single',
    age_group: 'child',
    phone: '+233 547942289',
    residential_address: 'Joma top',
    is_archived: false,
  },
];

test('areSpouseMatch connects Alfred Torgbo and Cynthia Suka', () => {
  const result = areSpouseMatch(mockMembers[0], mockMembers[1]);
  assert.equal(result, true);
});

test('getLinkedFamilyMembers finds all family for Patience Babanawo', () => {
  const links = getLinkedFamilyMembers(mockMembers[3], mockMembers);
  assert.equal(links.length, 2);
  const names = links.map(l => l.member.first_name);
  assert.ok(names.includes('Christopher'));
  assert.ok(names.includes('Vanessa'));
});

test('areSpouseMatch tolerates punctuation and spacing variations in spouse names', () => {
  const husband = {
    ...mockMembers[0],
    spouse_name: 'Mrs. Cynthia Suka',
    emergency_relationship: 'Spouse',
    emergency_name: 'Cynthia Suka',
  };
  const wife = {
    ...mockMembers[1],
    spouse_name: 'Alfred Torgbo',
    emergency_relationship: 'Spouse',
    emergency_name: 'Alfred Torgbo',
  };

  assert.equal(areSpouseMatch(husband, wife), true);
});

test('clusterHouseholds forms distinct household clusters', () => {
  const households = clusterHouseholds(mockMembers);
  assert.equal(households.length, 2);
  assert.equal(households[0].totalMembers, 3);
  assert.equal(households[1].totalMembers, 3);
});
