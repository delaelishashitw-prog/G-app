/**
 * Currency and Ghanaian Financial formatting utilities for Greater Works City Church
 */

export function formatGHS(amount: number): string {
  const safe = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return `GH₵ ${safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function convertThreeDigit(num: number): string {
  let str = '';
  if (num >= 100) {
    str += `${ONES[Math.floor(num / 100)]} Hundred`;
    num %= 100;
    if (num > 0) str += ' and ';
  }
  if (num >= 20) {
    str += TENS[Math.floor(num / 10)];
    if (num % 10 > 0) {
      str += `-${ONES[num % 10]}`;
    }
  } else if (num > 0) {
    str += ONES[num];
  }
  return str;
}

/**
 * Converts a numeric amount to English words formatted for Ghana Cedis & Pesewas
 * e.g. 1450.50 -> "One Thousand, Four Hundred and Fifty Ghana Cedis and Fifty Pesewas Only"
 */
export function numberToCedisWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Zero Ghana Cedis Only';

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const cedis = Math.floor(absAmount);
  const pesewas = Math.round((absAmount - cedis) * 100);

  if (cedis === 0 && pesewas === 0) return 'Zero Ghana Cedis Only';

  if (cedis === 0 && pesewas > 0) {
    return `${isNegative ? 'Negative ' : ''}${convertThreeDigit(pesewas)} Pesewa${pesewas === 1 ? '' : 's'} Only`;
  }

  const millions = Math.floor(cedis / 1000000);
  const thousands = Math.floor((cedis % 1000000) / 1000);
  const remainder = cedis % 1000;

  const parts: string[] = [];

  if (millions > 0) {
    parts.push(`${convertThreeDigit(millions)} Million`);
  }
  if (thousands > 0) {
    parts.push(`${convertThreeDigit(thousands)} Thousand`);
  }
  if (remainder > 0) {
    parts.push(convertThreeDigit(remainder));
  }

  let words = (isNegative ? 'Negative ' : '') + parts.join(', ');
  if (!words.trim()) {
    words = 'Zero';
  }

  let result = `${words} Ghana Cedi${cedis === 1 ? '' : 's'}`;

  if (pesewas > 0) {
    result += ` and ${convertThreeDigit(pesewas)} Pesewa${pesewas === 1 ? '' : 's'}`;
  }

  return `${result} Only`;
}

/**
 * Standardize Ghanaian phone number to international format without symbols
 */
export function cleanGhanaPhone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('2330') && digits.length === 13) {
    return '233' + digits.substring(4);
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return '233' + digits.substring(1);
  }
  if (digits.startsWith('233')) {
    return digits;
  }
  if (digits.length === 9) {
    return '233' + digits;
  }
  return digits;
}
