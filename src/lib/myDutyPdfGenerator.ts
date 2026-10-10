import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChurchSettings, Member, RosterAssignment } from '../types/database.types';

const PDFDocument = typeof jsPDF === 'function' ? jsPDF : ((jsPDF as any).jsPDF || (jsPDF as any).default);

export interface GenerateDutyPdfOptions {
  member: Member;
  assignments: RosterAssignment[];
  settings: ChurchSettings;
  scope?: 'all' | 'upcoming' | 'single';
  selectedAssignmentId?: string;
  includeGuidelines?: boolean;
  includeSignatures?: boolean;
}

const DEPT_NAMES: Record<string, string> = {
  sound_media: 'Sound & Media Engineering',
  praise_team: 'Voice of Dominion (Choir & Band)',
  ushers_protocol: 'Ushers & Protocol Board',
  intercessors: 'Altar & Intercessory Board',
  children_ministry: "Children's Ministry Teachers",
  car_park_security: 'Car Park & Security',
  sanctuary_cleaning: 'Sanctuary Care & Preparation',
};

function formatDept(dept: string): string {
  if (!dept) return 'Sanctuary Protocol';
  return DEPT_NAMES[dept] || dept.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateWithDay(dateStr: string): string {
  if (!dateStr) return 'N/A';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${months[month]} ${year} (${days[d.getDay()]})`;
    }
  } catch {}
  return dateStr;
}

export function generateMyDutyRosterPdf(options: GenerateDutyPdfOptions): jsPDF {
  const {
    member,
    assignments,
    settings,
    scope = 'upcoming',
    selectedAssignmentId,
    includeGuidelines = true,
    includeSignatures = true,
  } = options;

  const doc = new PDFDocument({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Primary colors
  const primaryEmerald: [number, number, number] = [6, 78, 59]; // #064e3b
  const accentGold: [number, number, number] = [217, 119, 6]; // #d97706
  const textDark: [number, number, number] = [15, 23, 42]; // #0f172a
  const textMuted: [number, number, number] = [100, 116, 139]; // #64748b
  const borderLight: [number, number, number] = [226, 232, 240]; // #e2e8f0

  // Filter duties based on scope
  let targetDuties: RosterAssignment[] = [];
  const todayStr = new Date().toISOString().split('T')[0];

  if (scope === 'single' && selectedAssignmentId) {
    const single = assignments.find((a) => a.id === selectedAssignmentId);
    targetDuties = single ? [single] : assignments.slice(0, 1);
  } else if (scope === 'upcoming') {
    const upcoming = assignments.filter((a) => a.date >= todayStr);
    targetDuties = upcoming.length > 0 ? upcoming : assignments;
  } else {
    targetDuties = assignments;
  }

  // Sort by date
  targetDuties = [...targetDuties].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.report_time || '').localeCompare(b.report_time || '');
  });

  let currentY = margin;

  // 1. Header Banner
  doc.setFillColor(...primaryEmerald);
  doc.rect(margin, currentY, contentWidth, 25, 'F');

  // Gold accent line
  doc.setFillColor(...accentGold);
  doc.rect(margin, currentY + 24, contentWidth, 1.2, 'F');

  // Church Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const churchName = (settings.church_name || 'GREATER WORKS CITY CHURCH').toUpperCase();
  doc.text(churchName, margin + 6, currentY + 8);

  // Church Location & Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(209, 250, 229);
  const locationLine = `${settings.location || 'Joma New Site, Accra, Ghana'} • GPS: ${settings.gps_address || 'GA-183-4921'} • Tel: ${settings.phone || '+233 24 456 7890'}`;
  doc.text(locationLine, margin + 6, currentY + 14);

  doc.setFontSize(7.5);
  doc.setTextColor(254, 243, 199);
  const motto = settings.tagline || (settings as any).church_motto || 'Exceeding Abundantly Above All We Ask or Think • Ephesians 3:20';
  doc.text(`MOTTO: "${motto}"`, margin + 6, currentY + 19.5);

  // Right Header Stamp
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  const badgeLabel = scope === 'single' ? 'DUTY APPOINTMENT SLIP' : 'MINISTERIAL ROSTER';
  const badgeWidth = doc.getTextWidth(badgeLabel);
  doc.text(badgeLabel, pageWidth - margin - badgeWidth - 6, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(167, 243, 208);
  const refCode = `GWCC-STW-${member.member_id.replace('GWCC-', '')}`;
  const refWidth = doc.getTextWidth(refCode);
  doc.text(refCode, pageWidth - margin - refWidth - 6, currentY + 16);

  currentY += 30;

  // 2. Document Title
  doc.setTextColor(...textDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  const docTitle =
    scope === 'single'
      ? 'OFFICIAL SERVICE DUTY APPOINTMENT SLIP'
      : 'PERSONAL SERVICE DUTY ROSTER & MINISTERIAL SCHEDULE';
  doc.text(docTitle, margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...textMuted);
  const docSubtitle =
    scope === 'single'
      ? 'Verified liturgical appointment for ministerial altar and sanctuary stewardship'
      : `Complete personal duty schedule for active church department operations (${targetDuties.length} scheduled duties)`;
  doc.text(docSubtitle, margin, currentY + 5);

  currentY += 10;

  // 3. Member Dossier Information Box
  const memberBoxHeight = 25;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin, currentY, contentWidth, memberBoxHeight, 2, 2, 'FD');

  // Decorative vertical accent
  doc.setFillColor(...primaryEmerald);
  doc.roundedRect(margin, currentY, 3, memberBoxHeight, 1, 1, 'F');

  // Row 1: Member Name & Member ID
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('MINISTERIAL STEWARD:', margin + 6, currentY + 6);

  doc.setFontSize(11);
  doc.setTextColor(...textDark);
  const fullName = `${member.first_name} ${member.last_name}`.toUpperCase();
  doc.text(fullName, margin + 46, currentY + 6.2);

  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('MEMBERSHIP ID:', margin + 120, currentY + 6);
  doc.setFontSize(9);
  doc.setTextColor(...primaryEmerald);
  doc.text(member.member_id, margin + 150, currentY + 6);

  // Row 2: Ministry & Phone
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('ASSIGNED MINISTRY:', margin + 6, currentY + 13);
  doc.setFontSize(8.5);
  doc.setTextColor(...textDark);
  const ministry = member.ministry_name || formatDept(targetDuties[0]?.department || 'ushers_protocol');
  doc.text(ministry, margin + 46, currentY + 13);

  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('CONTACT PHONE:', margin + 120, currentY + 13);
  doc.setFontSize(8.5);
  doc.setTextColor(...textDark);
  doc.text(member.phone || 'N/A', margin + 150, currentY + 13);

  // Row 3: Issued On & Senior Pastor
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('DATE ISSUED:', margin + 6, currentY + 20);
  doc.setFontSize(8);
  doc.setTextColor(...textDark);
  const now = new Date();
  doc.text(`${now.toLocaleDateString('en-GB')} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`, margin + 46, currentY + 20);

  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('GENERAL OVERSEER:', margin + 120, currentY + 20);
  doc.setFontSize(8);
  doc.setTextColor(...textDark);
  doc.text(settings.senior_pastor || 'Prophet Elisha K. Richard', margin + 150, currentY + 20);

  currentY += memberBoxHeight + 6;

  // 4. Quick KPI Summary Cards
  const kpiCount = 4;
  const kpiWidth = (contentWidth - (kpiCount - 1) * 3) / kpiCount;
  const kpiHeight = 14;

  const totalShifts = targetDuties.length;
  const confirmedShifts = targetDuties.filter((d) => d.status === 'confirmed').length;
  const nextDate = targetDuties[0]?.date ? formatDateWithDay(targetDuties[0].date).split(' ')[0] + ' ' + formatDateWithDay(targetDuties[0].date).split(' ')[1] : 'None';
  const earliestTime = targetDuties[0]?.report_time || '07:30 AM';

  // Card 1: Total Duties
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(187, 247, 208); // emerald-200
  doc.roundedRect(margin, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(22, 101, 52);
  doc.text('TOTAL SHIFTS', margin + 3, currentY + 4.5);
  doc.setFontSize(10);
  doc.text(`${totalShifts} Service${totalShifts !== 1 ? 's' : ''}`, margin + 3, currentY + 10.5);

  // Card 2: Confirmed Duties
  doc.setFillColor(254, 243, 199); // amber-50
  doc.setDrawColor(253, 230, 138); // amber-200
  doc.roundedRect(margin + kpiWidth + 3, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(180, 83, 9);
  doc.text('CONFIRMED', margin + kpiWidth + 6, currentY + 4.5);
  doc.setFontSize(10);
  doc.text(`${confirmedShifts} / ${totalShifts}`, margin + kpiWidth + 6, currentY + 10.5);

  // Card 3: Next Service Date
  doc.setFillColor(240, 249, 255); // sky-50
  doc.setDrawColor(186, 230, 253); // sky-200
  doc.roundedRect(margin + (kpiWidth + 3) * 2, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(3, 105, 161);
  doc.text('NEXT SERVICE', margin + (kpiWidth + 3) * 2 + 3, currentY + 4.5);
  doc.setFontSize(9);
  doc.text(nextDate, margin + (kpiWidth + 3) * 2 + 3, currentY + 10.5);

  // Card 4: Reporting Call Time
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(...borderLight);
  doc.roundedRect(margin + (kpiWidth + 3) * 3, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...textDark);
  doc.text('REPORT CALL', margin + (kpiWidth + 3) * 3 + 3, currentY + 4.5);
  doc.setFontSize(9);
  doc.setTextColor(...primaryEmerald);
  doc.text(earliestTime, margin + (kpiWidth + 3) * 3 + 3, currentY + 10.5);

  currentY += kpiHeight + 6;

  // 5. Duties Table
  if (targetDuties.length === 0) {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(153, 27, 27);
    doc.text('No active duty assignments found for this filter.', margin + 8, currentY + 11);
    currentY += 25;
  } else {
    const tableBody = targetDuties.map((duty, idx) => {
      const formattedDate = formatDateWithDay(duty.date);
      const dept = formatDept(duty.department);
      const role = duty.role_title || 'Ministerial Steward';
      const reportTime = duty.report_time || '08:00 AM';
      const status =
        duty.status === 'confirmed'
          ? 'Confirmed'
          : duty.status === 'substituted'
          ? 'Substituted'
          : duty.status === 'declined'
          ? 'Declined'
          : 'Scheduled';
      const notesParts = [];
      if (duty.announcement) {
        notesParts.push(`📢 Notice: ${duty.announcement}`);
      }
      notesParts.push(duty.notes || 'Arrive 20 mins prior for ministerial devotion and sanctuary briefing.');
      const notes = notesParts.join('\n');

      return [
        (idx + 1).toString(),
        formattedDate,
        duty.service_name || 'Sunday Worship Service',
        `${role}\n(${dept})`,
        reportTime,
        status,
        notes,
      ];
    });

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin, bottom: 25 },
      head: [['#', 'Date & Day', 'Worship Service', 'Role & Department', 'Report Time', 'Status', 'Instructions & Attire']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: primaryEmerald,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'left',
        cellPadding: 2.5,
      },
      bodyStyles: {
        fontSize: 7,
        textColor: textDark,
        cellPadding: 2.5,
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 26, fontStyle: 'bold' },
        2: { cellWidth: 32 },
        3: { cellWidth: 36, fontStyle: 'bold' },
        4: { cellWidth: 22, halign: 'center', textColor: [6, 78, 59], fontStyle: 'bold' },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 'auto' },
      },
      didDrawPage: () => {
        // Page numbering
        const pageCount = (doc as any).internal.getNumberOfPages();
        const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...textMuted);
        doc.text(
          `Greater Works City Church • Member Service Duty Register • Ref: GWCC-ROSTER-${member.member_id}`,
          margin,
          pageHeight - 8
        );
        doc.text(`Page ${currentPage} of ${pageCount}`, pageWidth - margin - 18, pageHeight - 8);
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Check if we have enough room on the current page for guidelines & signatures
  const neededHeight = (includeGuidelines ? 38 : 0) + (includeSignatures ? 32 : 0);
  if (currentY + neededHeight > pageHeight - 20) {
    doc.addPage();
    currentY = margin + 6;
  }

  // 6. Ministerial Code of Conduct & Guidelines
  if (includeGuidelines) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...borderLight);
    doc.roundedRect(margin, currentY, contentWidth, 34, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...primaryEmerald);
    doc.text('GREATER WORKS MINISTERIAL STEWARDSHIP PROTOCOL & INSTRUCTIONS', margin + 5, currentY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...textDark);
    const guidelines = [
      '1. Punctuality: Stewards must arrive strictly at or before the designated report time for pre-service altar prayer and operational briefing.',
      '2. Ministerial Attire: Dress impeccably according to department guidelines (modest, formal, respectful of the sanctuary atmosphere).',
      '3. Substitutions: If unable to serve due to unforeseen emergency, notify your department head or submit a substitute request via the Member Portal at least 48 hours prior.',
      '4. Spiritual Preparation: Serve with reverence, joy, and humility. Remember: "Serve the Lord with gladness: come before His presence with singing." (Psalm 100:2)',
    ];

    guidelines.forEach((g, i) => {
      doc.text(g, margin + 5, currentY + 11 + i * 5.2);
    });

    currentY += 38;
  }

  // 7. Official Endorsement & Signatures
  if (includeSignatures) {
    if (currentY + 28 > pageHeight - 20) {
      doc.addPage();
      currentY = margin + 6;
    }

    const sigColWidth = (contentWidth - 10) / 3;

    // Signature 1: General Overseer
    doc.setDrawColor(...borderLight);
    doc.line(margin, currentY + 15, margin + sigColWidth, currentY + 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...textDark);
    doc.text(settings.senior_pastor || 'Prophet Elisha K. Richard', margin, currentY + 19);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...textMuted);
    doc.text('General Overseer / Senior Pastor', margin, currentY + 23);

    // Signature 2: General Secretary / Secretariat
    const col2X = margin + sigColWidth + 5;
    doc.line(col2X, currentY + 15, col2X + sigColWidth, currentY + 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...textDark);
    doc.text(settings.general_secretary || 'Tamekloe Clara Gaewornu', col2X, currentY + 19);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...textMuted);
    doc.text('General Secretary / Church Secretariat', col2X, currentY + 23);

    // Signature 3: Member Steward Acknowledgment
    const col3X = margin + (sigColWidth + 5) * 2;
    doc.line(col3X, currentY + 15, col3X + sigColWidth, currentY + 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...textDark);
    doc.text(`${member.first_name} ${member.last_name}`, col3X, currentY + 19);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...textMuted);
    doc.text('Ministerial Steward Acknowledgment', col3X, currentY + 23);

    currentY += 28;
  }

  return doc;
}

export function downloadMyDutyRosterPdf(options: GenerateDutyPdfOptions): void {
  const doc = generateMyDutyRosterPdf(options);
  const memberCleanName = `${options.member.first_name}_${options.member.last_name}`.replace(/[^a-zA-Z0-9_]/g, '');
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `GWCC_Duty_Roster_${memberCleanName}_${dateStr}.pdf`;
  doc.save(filename);
}
