import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ChurchSettings,
  GivingRecord,
  ExpenseRecord,
  Member,
  Visitor,
  AttendanceRecord,
  PledgeRecord,
  UserProfile,
} from '../types/database.types';

export type ReportTemplateType =
  | 'financial_ledger'
  | 'financial_executive_summary'
  | 'membership_roster'
  | 'attendance_register'
  | 'visitor_follow_up'
  | 'comprehensive_executive';

export interface PdfExportOptions {
  template: ReportTemplateType;
  startDate: string;
  endDate: string;
  orientation?: 'portrait' | 'landscape';
  includeSignatures?: boolean;
  includeSummaryKpis?: boolean;
  includeOfficialSeal?: boolean;
  preparedBy?: string;
  preparedRole?: string;
  notes?: string;
}

export interface ChurchReportData {
  settings: ChurchSettings;
  members: Member[];
  visitors: Visitor[];
  attendance: AttendanceRecord[];
  giving: GivingRecord[];
  expenses: ExpenseRecord[];
  pledges: PledgeRecord[];
  currentUser?: UserProfile;
}

export function formatGHS(amount: number): string {
  return `GH₵ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Generate the complete PDF document
export function generateChurchReportPdf(
  data: ChurchReportData,
  options: PdfExportOptions
): jsPDF {
  const {
    template,
    startDate,
    endDate,
    orientation = template === 'membership_roster' || template === 'financial_ledger' ? 'landscape' : 'portrait',
    includeSignatures = true,
    includeSummaryKpis = true,
    includeOfficialSeal = true,
    preparedBy = data.currentUser ? `${data.currentUser.first_name} ${data.currentUser.last_name}` : 'Church Administrator',
    preparedRole = data.currentUser?.role ? data.currentUser.role.replace(/_/g, ' ').toUpperCase() : 'ADMINISTRATOR',
    notes,
  } = options;

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const primaryGreen: [number, number, number] = [6, 78, 59]; // #064e3b
  const accentGold: [number, number, number] = [217, 119, 6]; // #d97706
  const textDark: [number, number, number] = [15, 23, 42]; // #0f172a
  const textMuted: [number, number, number] = [100, 116, 139]; // #64748b
  const borderLight: [number, number, number] = [226, 232, 240]; // #e2e8f0

  // Filter data by dates
  const filteredGiving = data.giving.filter((g) => {
    if (!startDate && !endDate) return true;
    if (startDate && g.date < startDate) return false;
    if (endDate && g.date > endDate) return false;
    return true;
  });

  const filteredExpenses = data.expenses.filter((e) => {
    if (!startDate && !endDate) return true;
    if (startDate && e.date < startDate) return false;
    if (endDate && e.date > endDate) return false;
    return true;
  });

  const filteredAttendance = data.attendance.filter((a) => {
    if (!startDate && !endDate) return true;
    if (startDate && a.date < startDate) return false;
    if (endDate && a.date > endDate) return false;
    return true;
  });

  const filteredVisitors = data.visitors.filter((v) => {
    if (!startDate && !endDate) return true;
    if (startDate && v.visit_date < startDate) return false;
    if (endDate && v.visit_date > endDate) return false;
    return true;
  });

  const filteredMembers = data.members.filter((m) => !m.is_archived);

  // Financial aggregates
  const totalIncome = filteredGiving.reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  const netSurplus = totalIncome - totalExpense;

  // Tithes & Offerings Breakdown
  const tithesTotal = filteredGiving
    .filter((g) => g.category.toLowerCase().includes('tithe'))
    .reduce((s, g) => s + g.amount, 0);
  const offeringsTotal = filteredGiving
    .filter((g) => g.category.toLowerCase().includes('offering'))
    .reduce((s, g) => s + g.amount, 0);
  const buildingFundTotal = filteredGiving
    .filter((g) => g.category.toLowerCase().includes('building'))
    .reduce((s, g) => s + g.amount, 0);
  const otherGivingTotal = totalIncome - (tithesTotal + offeringsTotal + buildingFundTotal);

  // Pledges summary
  const totalPledged = data.pledges.reduce((s, p) => s + p.amount_pledged, 0);
  const totalPledgePaid = data.pledges.reduce((s, p) => s + p.amount_paid, 0);
  const totalPledgeBalance = data.pledges.reduce((s, p) => s + p.balance, 0);

  // Template titles & headers
  let reportTitle = 'CHURCH FINANCIAL LEDGER & AUDIT RECORD';
  let reportSubtitle = 'Detailed revenue transactions and verified ministerial giving logs';
  if (template === 'financial_executive_summary') {
    reportTitle = 'EXECUTIVE FINANCIAL STATEMENT & TREASURY REPORT';
    reportSubtitle = 'Comprehensive analysis of church inflows, expenditures, and pledge fulfillments';
  } else if (template === 'membership_roster') {
    reportTitle = 'OFFICIAL CHURCH MEMBERSHIP REGISTER & DIRECTORY';
    reportSubtitle = 'Master record of enrolled disciples, ministerial units, and verified contact profiles';
  } else if (template === 'attendance_register') {
    reportTitle = 'CONGREGATIONAL ATTENDANCE & PARTICIPATION REGISTER';
    reportSubtitle = 'Worship services headcount, check-in tracking, and member engagement statistics';
  } else if (template === 'visitor_follow_up') {
    reportTitle = 'FIRST-TIME VISITORS & SOULS CARE RETENTION REPORT';
    reportSubtitle = 'Visitor evangelism logging, follow-up progression, and conversion audit';
  } else if (template === 'comprehensive_executive') {
    reportTitle = 'QUARTERLY EXECUTIVE INTELLIGENCE DOSSIER';
    reportSubtitle = 'All-round administrative appraisal: treasury, discipleship, growth, and attendance';
  }

  // Draw Header on first page
  let currentY = margin;

  // Header band (Emerald banner)
  doc.setFillColor(...primaryGreen);
  doc.rect(margin, currentY, contentWidth, 24, 'F');

  // Gold accent bar
  doc.setFillColor(...accentGold);
  doc.rect(margin, currentY + 23, contentWidth, 1.5, 'F');

  // Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text((data.settings.church_name || 'GREATER WORKS CITY CHURCH').toUpperCase(), margin + 6, currentY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(209, 250, 229);
  doc.text(
    `${data.settings.location || 'Joma, Accra'} • Ghana • GPS: ${data.settings.gps_address || 'GA-183-4921'} • Tel: ${data.settings.phone || '+233 24 000 0000'}`,
    margin + 6,
    currentY + 14
  );

  doc.setFontSize(7.5);
  doc.setTextColor(254, 243, 199);
  doc.text('AFFILIATED TO THE WORLDWIDE BODY OF CHRIST • VERIFIED ECCLESIASTICAL RECORDS', margin + 6, currentY + 19);

  // Document Type Tag on the right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  const tagText = 'OFFICIAL ARCHIVE';
  const tagWidth = doc.getTextWidth(tagText);
  doc.text(tagText, pageWidth - margin - tagWidth - 6, currentY + 11);

  currentY += 30;

  // Report Title & Meta Grid
  doc.setTextColor(...textDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(reportTitle, margin, currentY);

  currentY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...textMuted);
  doc.text(reportSubtitle, margin, currentY);

  currentY += 6;

  // Document Metadata Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...borderLight);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, 16, 2, 2, 'FD');

  const colWidth = contentWidth / 4;
  const metaY = currentY + 5;

  // Col 1: Report ID
  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text('DOCUMENT REF', margin + 4, metaY);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  const reportRef = `GWCC-${template.substring(0, 3).toUpperCase()}-${new Date().toISOString().substring(0, 10).replace(/-/g, '')}`;
  doc.text(reportRef, margin + 4, metaY + 5);

  // Col 2: Date Span
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text('REPORTING PERIOD', margin + colWidth + 4, metaY);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  const periodText = startDate && endDate ? `${startDate} to ${endDate}` : 'Complete Historical Record';
  doc.text(periodText, margin + colWidth + 4, metaY + 5);

  // Col 3: Generation Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text('ISSUED DATE & TIME', margin + colWidth * 2 + 4, metaY);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  const nowStr = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(nowStr, margin + colWidth * 2 + 4, metaY + 5);

  // Col 4: Prepared By
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text('PREPARED BY', margin + colWidth * 3 + 4, metaY);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryGreen);
  const prepText = preparedBy.length > 20 ? preparedBy.substring(0, 18) + '...' : preparedBy;
  doc.text(prepText, margin + colWidth * 3 + 4, metaY + 5);

  currentY += 21;

  // KPI Summary Cards
  if (includeSummaryKpis) {
    if (template === 'financial_ledger' || template === 'financial_executive_summary' || template === 'comprehensive_executive') {
      const kpiWidth = (contentWidth - 6) / 3;
      const kpiHeight = 16;

      // Card 1: Total Revenue
      doc.setFillColor(240, 253, 244); // emerald-50
      doc.setDrawColor(187, 247, 208); // emerald-200
      doc.roundedRect(margin, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(22, 101, 52);
      doc.text('TOTAL REVENUE / INFLOW', margin + 3, currentY + 4.5);
      doc.setFontSize(11);
      doc.text(formatGHS(totalIncome), margin + 3, currentY + 11.5);

      // Card 2: Total Expenses
      doc.setFillColor(255, 241, 242); // rose-50
      doc.setDrawColor(254, 205, 211); // rose-200
      doc.roundedRect(margin + kpiWidth + 3, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(159, 18, 57);
      doc.text('EXPENDITURES & DISBURSEMENTS', margin + kpiWidth + 6, currentY + 4.5);
      doc.setFontSize(11);
      doc.text(formatGHS(totalExpense), margin + kpiWidth + 6, currentY + 11.5);

      // Card 3: Net Surplus
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.roundedRect(margin + (kpiWidth + 3) * 2, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...textDark);
      doc.text('NET TREASURY BALANCE', margin + (kpiWidth + 3) * 2 + 3, currentY + 4.5);
      doc.setFontSize(11);
      doc.setTextColor(netSurplus >= 0 ? 6 : 190, netSurplus >= 0 ? 78 : 18, netSurplus >= 0 ? 59 : 57);
      doc.text(formatGHS(netSurplus), margin + (kpiWidth + 3) * 2 + 3, currentY + 11.5);

      currentY += 21;
    } else if (template === 'membership_roster') {
      const kpiWidth = (contentWidth - 6) / 3;
      const kpiHeight = 16;
      const activeCount = filteredMembers.length;
      const maleCount = filteredMembers.filter((m) => m.gender === 'male').length;
      const femaleCount = filteredMembers.filter((m) => m.gender === 'female').length;

      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(margin, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(22, 101, 52);
      doc.text('TOTAL ACTIVE COMMUNICANTS', margin + 3, currentY + 4.5);
      doc.setFontSize(12);
      doc.text(`${activeCount} Members`, margin + 3, currentY + 11.5);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(...borderLight);
      doc.roundedRect(margin + kpiWidth + 3, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...textDark);
      doc.text('GENDER DISTRIBUTION', margin + kpiWidth + 6, currentY + 4.5);
      doc.setFontSize(10);
      doc.text(`Male: ${maleCount}  |  Female: ${femaleCount}`, margin + kpiWidth + 6, currentY + 11.5);

      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(253, 230, 138);
      doc.roundedRect(margin + (kpiWidth + 3) * 2, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(146, 64, 14);
      doc.text('REGISTERED BAPTISMS', margin + (kpiWidth + 3) * 2 + 3, currentY + 4.5);
      doc.setFontSize(10);
      const baptized = filteredMembers.filter((m) => m.baptism_status).length;
      doc.text(`${baptized} Baptized (${Math.round((baptized / (activeCount || 1)) * 100)}%)`, margin + (kpiWidth + 3) * 2 + 3, currentY + 11.5);

      currentY += 21;
    } else if (template === 'attendance_register') {
      const kpiWidth = (contentWidth - 6) / 3;
      const kpiHeight = 16;
      const totalCheckIns = filteredAttendance.length;
      const membersCheckIns = filteredAttendance.filter((a) => a.person_type === 'member' || a.member_id).length;
      const visitorsCheckIns = totalCheckIns - membersCheckIns;

      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(margin, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(22, 101, 52);
      doc.text('TOTAL CHECK-IN HEADCOUNT', margin + 3, currentY + 4.5);
      doc.setFontSize(12);
      doc.text(`${totalCheckIns} Attendances`, margin + 3, currentY + 11.5);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(...borderLight);
      doc.roundedRect(margin + kpiWidth + 3, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...textDark);
      doc.text('ATTENDEE CLASSIFICATION', margin + kpiWidth + 6, currentY + 4.5);
      doc.setFontSize(10);
      doc.text(`Members: ${membersCheckIns}  |  Visitors: ${visitorsCheckIns}`, margin + kpiWidth + 6, currentY + 11.5);

      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(253, 230, 138);
      doc.roundedRect(margin + (kpiWidth + 3) * 2, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(146, 64, 14);
      doc.text('DIGITAL QR / SEARCH CHECK-INS', margin + (kpiWidth + 3) * 2 + 3, currentY + 4.5);
      doc.setFontSize(10);
      const digital = filteredAttendance.filter((a) => a.check_in_method === 'qr_code' || a.check_in_method === 'search').length;
      doc.text(`${digital} Verified (${Math.round((digital / (totalCheckIns || 1)) * 100)}%)`, margin + (kpiWidth + 3) * 2 + 3, currentY + 11.5);

      currentY += 21;
    } else if (template === 'visitor_follow_up') {
      const kpiWidth = (contentWidth - 6) / 3;
      const kpiHeight = 16;
      const totalVisitors = filteredVisitors.length;
      const converted = filteredVisitors.filter((v) => v.follow_up_status === 'converted_to_member').length;
      const followUpReq = filteredVisitors.filter((v) => v.follow_up_status === 'follow_up_required' || v.follow_up_status === 'new').length;

      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(margin, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(22, 101, 52);
      doc.text('RECORDED NEW VISITING SOULS', margin + 3, currentY + 4.5);
      doc.setFontSize(12);
      doc.text(`${totalVisitors} Visitors`, margin + 3, currentY + 11.5);

      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(253, 230, 138);
      doc.roundedRect(margin + kpiWidth + 3, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(146, 64, 14);
      doc.text('FOLLOW-UP PIPELINE PENDING', margin + kpiWidth + 6, currentY + 4.5);
      doc.setFontSize(10);
      doc.text(`${followUpReq} In Progress`, margin + kpiWidth + 6, currentY + 11.5);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(...borderLight);
      doc.roundedRect(margin + (kpiWidth + 3) * 2, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...textDark);
      doc.text('CONVERTED TO DISCIPLESHIP', margin + (kpiWidth + 3) * 2 + 3, currentY + 4.5);
      doc.setFontSize(10);
      doc.text(`${converted} Established (${Math.round((converted / (totalVisitors || 1)) * 100)}%)`, margin + (kpiWidth + 3) * 2 + 3, currentY + 11.5);

      currentY += 21;
    }
  }

  // BUILD DATA TABLES
  if (template === 'financial_ledger') {
    const tableBody = filteredGiving.map((g, idx) => [
      (idx + 1).toString(),
      g.date,
      g.category,
      g.member_name || g.donor_name || 'Anonymous Contributor',
      g.payment_method.replace(/_/g, ' ').toUpperCase(),
      g.reference_number || '-',
      `GH₵ ${g.amount.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin, bottom: 25 },
      head: [['#', 'Date', 'Giving Category', 'Contributor / Member', 'Payment Method', 'Ref No.', 'Amount (GH₵)']],
      body: tableBody,
      foot: [
        ['', '', 'TOTAL REVENUE', '', '', '', `GH₵ ${totalIncome.toFixed(2)}`],
      ],
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: textDark,
        lineColor: borderLight,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: primaryGreen,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: primaryGreen,
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 20 },
        2: { cellWidth: 32 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 30 },
        5: { cellWidth: 28 },
        6: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });
  } else if (template === 'financial_executive_summary') {
    // 1. Inflow Categories Breakdown
    const categoryRows = [
      ['Tithes & Pastoral Support', formatGHS(tithesTotal), `${Math.round((tithesTotal / (totalIncome || 1)) * 100)}%`],
      ['General & Sunday Offerings', formatGHS(offeringsTotal), `${Math.round((offeringsTotal / (totalIncome || 1)) * 100)}%`],
      ['Church Building & Infrastructure Fund', formatGHS(buildingFundTotal), `${Math.round((buildingFundTotal / (totalIncome || 1)) * 100)}%`],
      ['Missions, Seeds & Special Sacrifices', formatGHS(otherGivingTotal), `${Math.round((otherGivingTotal / (totalIncome || 1)) * 100)}%`],
    ];

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin, bottom: 25 },
      head: [['Revenue Inflow Classification', 'Total Amount Collected', 'Percentage of Treasury']],
      body: categoryRows,
      foot: [['TOTAL REVENUE RECORDED', formatGHS(totalIncome), '100%']],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: primaryGreen, textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [240, 253, 244], textColor: primaryGreen, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
        2: { cellWidth: 35, halign: 'center' },
      },
    });

    const nextY = (doc as any).lastAutoTable.finalY + 8;

    // 2. Expenditures by Department
    const expenseByCategory: Record<string, number> = {};
    filteredExpenses.forEach((exp) => {
      expenseByCategory[exp.category] = (expenseByCategory[exp.category] || 0) + exp.amount;
    });

    const expenseRows = Object.entries(expenseByCategory).map(([cat, amt]) => [
      cat,
      formatGHS(amt),
      `${Math.round((amt / (totalExpense || 1)) * 100)}%`,
    ]);

    if (expenseRows.length === 0) {
      expenseRows.push(['Operational & Facility Maintenance', formatGHS(0), '0%']);
    }

    autoTable(doc, {
      startY: nextY,
      margin: { left: margin, right: margin, bottom: 25 },
      head: [['Expenditure & Operating Disbursal', 'Total Disbursed', 'Percentage of Outflow']],
      body: expenseRows,
      foot: [['TOTAL EXPENDITURES RECORDED', formatGHS(totalExpense), '100%']],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [159, 18, 57], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [255, 241, 242], textColor: [159, 18, 57], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
        2: { cellWidth: 35, halign: 'center' },
      },
    });

    const pledgeY = (doc as any).lastAutoTable.finalY + 8;

    // 3. Pledges & Capital Campaigns Table
    const pledgeRows = [
      ['Capital Pledges Committed', formatGHS(totalPledged)],
      ['Pledges Redeemed to Date', formatGHS(totalPledgePaid)],
      ['Outstanding Pledge Balance to Collect', formatGHS(totalPledgeBalance)],
    ];

    autoTable(doc, {
      startY: pledgeY,
      margin: { left: margin, right: margin, bottom: 25 },
      head: [['Capital Project Pledges & Campaigns', 'Audited Value']],
      body: pledgeRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: accentGold, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
      },
    });
  } else if (template === 'membership_roster') {
    const tableBody = filteredMembers.map((m, idx) => [
      (idx + 1).toString(),
      m.member_id,
      `${m.first_name} ${m.last_name}`,
      m.gender.toUpperCase(),
      m.phone,
      m.ministry_name || 'General Congregation',
      m.small_group_name || 'Central',
      m.gps_address || '-',
      m.status.toUpperCase(),
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin, bottom: 25 },
      head: [['#', 'Member ID', 'Full Name', 'Gender', 'Phone', 'Ministry', 'Cell Group', 'GPS Address', 'Status']],
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.8,
        textColor: textDark,
        lineColor: borderLight,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: primaryGreen,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 22, fontStyle: 'bold' },
        2: { cellWidth: 38 },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 26 },
        5: { cellWidth: 35 },
        6: { cellWidth: 30 },
        7: { cellWidth: 26 },
        8: { cellWidth: 22, halign: 'center' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });
  } else if (template === 'attendance_register') {
    const tableBody = filteredAttendance.map((a, idx) => [
      (idx + 1).toString(),
      a.date,
      a.service_name,
      a.person_name || a.member_name || a.visitor_name || 'Congregant',
      (a.person_type || (a.member_id ? 'member' : 'visitor')).toUpperCase(),
      a.check_in_method.toUpperCase(),
      a.status.toUpperCase(),
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin, bottom: 25 },
      head: [['#', 'Date', 'Worship Service', 'Attendee Name', 'Type', 'Check-In Mode', 'Status']],
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: textDark,
        lineColor: borderLight,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: primaryGreen,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 22 },
        2: { cellWidth: 40 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 28, halign: 'center' },
        6: { cellWidth: 22, halign: 'center' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });
  } else if (template === 'visitor_follow_up') {
    const tableBody = filteredVisitors.map((v, idx) => [
      (idx + 1).toString(),
      v.visit_date,
      v.full_name,
      v.phone,
      v.service_attended,
      v.follow_up_status.replace(/_/g, ' ').toUpperCase(),
      v.prayer_request ? (v.prayer_request.length > 35 ? v.prayer_request.substring(0, 32) + '...' : v.prayer_request) : 'None Recorded',
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin, bottom: 25 },
      head: [['#', 'Visit Date', 'Visitor Name', 'Phone', 'Service Attended', 'Follow-Up Status', 'Prayer Request / Needs']],
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: textDark,
        lineColor: borderLight,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: primaryGreen,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 22 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25 },
        4: { cellWidth: 35 },
        5: { cellWidth: 30, halign: 'center' },
        6: { cellWidth: 'auto' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });
  } else if (template === 'comprehensive_executive') {
    // Multi-section executive briefing table
    const briefingData = [
      ['Total Active Congregation (Enrolled)', `${filteredMembers.length} Members`],
      ['Total Recorded Sunday & Weekly Attendance', `${filteredAttendance.length} Check-ins`],
      ['Total New First-Time Visiting Souls', `${filteredVisitors.length} Visitors`],
      ['Total Church Revenue & Tithes', formatGHS(totalIncome)],
      ['Total Operating Disbursements', formatGHS(totalExpense)],
      ['Treasury Net Surplus (GH₵)', formatGHS(netSurplus)],
      ['Active Capital Pledges Committed', formatGHS(totalPledged)],
      ['Total Redeemed Project Funds', formatGHS(totalPledgePaid)],
    ];

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin, bottom: 25 },
      head: [['Executive Key Performance Indicator', 'Official Metric Value']],
      body: briefingData,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: primaryGreen, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 55, halign: 'right', fontStyle: 'bold' },
      },
    });
  }

  // Check if we need to add a signature page or append to final page
  let finalY = (doc as any).lastAutoTable?.finalY || currentY + 40;

  // Add notes if provided
  if (notes) {
    if (finalY + 25 > pageHeight - 35) {
      doc.addPage();
      finalY = margin + 10;
    } else {
      finalY += 8;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...textDark);
    doc.text('ADMINISTRATIVE NOTES & OBSERVATIONS:', margin, finalY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    const splitNotes = doc.splitTextToSize(notes, contentWidth);
    doc.text(splitNotes, margin, finalY + 4);
    finalY += 4 + splitNotes.length * 3.5;
  }

  // Official Endorsement & Verification Block
  if (includeSignatures) {
    if (finalY + 38 > pageHeight - 25) {
      doc.addPage();
      finalY = margin + 15;
    } else {
      finalY += 10;
    }

    const sigColWidth = (contentWidth - 10) / 3;

    // Signature Box 1: Senior Pastor
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.3);
    doc.line(margin, finalY + 14, margin + sigColWidth - 5, finalY + 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...textDark);
    doc.text(data.settings.senior_pastor || 'Prophet Elisha K. Richard', margin, finalY + 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...textMuted);
    doc.text('Senior Pastor & General Overseer', margin, finalY + 22);

    // Signature Box 2: General Secretary
    const sig2X = margin + sigColWidth + 5;
    doc.line(sig2X, finalY + 14, sig2X + sigColWidth - 5, finalY + 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...textDark);
    doc.text(data.settings.general_secretary || 'Tamekloe Clara Gaewornu', sig2X, finalY + 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...textMuted);
    doc.text('General Secretary / Secretariat', sig2X, finalY + 22);

    // Seal Stamp Box on right
    if (includeOfficialSeal) {
      const stampX = margin + (sigColWidth + 5) * 2;
      doc.setDrawColor(...accentGold);
      doc.setLineWidth(0.6);
      doc.roundedRect(stampX, finalY - 2, sigColWidth - 5, 26, 2, 2, 'D');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...accentGold);
      doc.text('GREATER WORKS CITY CHURCH', stampX + (sigColWidth - 5) / 2, finalY + 4, { align: 'center' });

      doc.setFontSize(6);
      doc.setTextColor(...primaryGreen);
      doc.text('OFFICIAL VERIFIED AUDIT', stampX + (sigColWidth - 5) / 2, finalY + 9, { align: 'center' });
      doc.text('JOMA, ACCRA - GHANA', stampX + (sigColWidth - 5) / 2, finalY + 13, { align: 'center' });

      doc.setFontSize(5.5);
      doc.setTextColor(...textMuted);
      doc.text(`ARCHIVED: ${nowStr.split(',')[0]}`, stampX + (sigColWidth - 5) / 2, finalY + 18, { align: 'center' });
      doc.text('AUTHENTIC DOCUMENT', stampX + (sigColWidth - 5) / 2, finalY + 22, { align: 'center' });
    }
  }

  // Page Numbers & Footer on EVERY page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...textMuted);

    const footerLeft = `Greater Works City Church • ChMS Official Document • Ref: ${reportRef}`;
    doc.text(footerLeft, margin, pageHeight - 8);

    const footerRight = `Page ${i} of ${totalPages} • Confidential Record`;
    doc.text(footerRight, pageWidth - margin - doc.getTextWidth(footerRight), pageHeight - 8);
  }

  return doc;
}
