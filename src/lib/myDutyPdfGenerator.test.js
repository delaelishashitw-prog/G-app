import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateMyDutyRosterPdf } from './myDutyPdfGenerator.ts';

describe('My Duty Roster PDF Generator', () => {
  const sampleMember = {
    id: 'mem-001',
    member_id: 'GWCC-0001',
    first_name: 'Alfred',
    last_name: 'Torgbo',
    phone: '+233 24 123 4567',
    email: 'alfred.torgbo@example.com',
    ministry_name: 'Ushers & Protocol Board',
    status: 'active',
  };

  const sampleSettings = {
    church_name: 'Greater Works City Church',
    short_name: 'GWCC',
    church_motto: 'Exceeding Abundantly Above All We Ask or Think',
    senior_pastor: 'Prophet Elisha K. Richard',
    general_secretary: 'Tamekloe Clara Gaewornu',
    location: 'Joma New Site, Accra, Ghana',
    address: 'Off Ablekuma-Joma Highway',
    gps_address: 'GA-183-4921',
    phone: '+233 24 000 0000',
    email: 'info@greaterworkscitychurch.org',
    currency: 'GHS',
    currency_symbol: 'GH₵',
    timezone: 'Africa/Accra',
  };

  const sampleAssignments = [
    {
      id: 'duty-001',
      service_id: 'srv-001',
      service_name: 'Sunday Prophetic Celebration Service',
      date: '2026-10-11',
      member_id: 'mem-001',
      member_name: 'Alfred Torgbo',
      department: 'ushers_protocol',
      role_title: 'Head Usher - Sanctuary Main Entrance',
      report_time: '07:30 AM',
      status: 'confirmed',
      notes: 'Arrive 30 mins prior for pre-service prayer.',
      created_at: '2026-10-01T00:00:00Z',
    },
    {
      id: 'duty-002',
      service_id: 'srv-002',
      service_name: 'Wednesday Midweek Miracle Service',
      date: '2026-10-14',
      member_id: 'mem-001',
      member_name: 'Alfred Torgbo',
      department: 'ushers_protocol',
      role_title: 'Protocol & Offertory Steward',
      report_time: '05:30 PM',
      status: 'pending',
      notes: 'Sanctuary seating coordination.',
      created_at: '2026-10-01T00:00:00Z',
    },
  ];

  it('generates a valid jsPDF document for all assigned duties', () => {
    const doc = generateMyDutyRosterPdf({
      member: sampleMember,
      assignments: sampleAssignments,
      settings: sampleSettings,
      scope: 'all',
      includeGuidelines: true,
      includeSignatures: true,
    });

    assert.ok(doc);
    assert.equal(typeof doc.output, 'function');
    const pdfDataUri = doc.output('datauristring');
    assert.ok(pdfDataUri.startsWith('data:application/pdf'));
  });

  it('generates a valid jsPDF document for a single duty shift voucher', () => {
    const doc = generateMyDutyRosterPdf({
      member: sampleMember,
      assignments: sampleAssignments,
      settings: sampleSettings,
      scope: 'single',
      selectedAssignmentId: 'duty-001',
      includeGuidelines: false,
      includeSignatures: true,
    });

    assert.ok(doc);
    const pdfDataUri = doc.output('datauristring');
    assert.ok(pdfDataUri.startsWith('data:application/pdf'));
  });

  it('handles empty assignments gracefully without crashing', () => {
    const doc = generateMyDutyRosterPdf({
      member: sampleMember,
      assignments: [],
      settings: sampleSettings,
      scope: 'upcoming',
    });

    assert.ok(doc);
    const pdfDataUri = doc.output('datauristring');
    assert.ok(pdfDataUri.startsWith('data:application/pdf'));
  });
});
