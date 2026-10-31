import React, { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import type { Member } from '../../types/database.types';
import { attendancePassValue } from '../../features/attendance/attendancePass';

export const AttendancePassQr: React.FC<{ member: Member }> = ({ member }) => {
  const value = attendancePassValue(member);
  const matrix = useMemo(() => {
    if (!value) return null;
    const qr = qrcode(0, 'M');
    qr.addData(value, 'Byte'); qr.make();
    const count = qr.getModuleCount(), margin = 4;
    let path = '';
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) path += `M${col + margin} ${row + margin}h1v1h-1z`;
    }
    return { size: count + margin * 2, path };
  }, [value]);
  if (!matrix) return <p role="status" className="text-xs text-slate-700 text-center">Attendance pass unavailable. Contact the church office.</p>;
  return <svg role="img" aria-label={`Attendance QR code for ${member.member_id}`} xmlns="http://www.w3.org/2000/svg"
    viewBox={`0 0 ${matrix.size} ${matrix.size}`} width="180" height="180" shapeRendering="crispEdges" className="h-full w-full">
    <rect width={matrix.size} height={matrix.size} fill="#fff" />
    <path d={matrix.path} fill="#000" />
  </svg>;
};
