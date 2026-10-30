/** Child registration requires a named, reachable guardian, not a personal mobile. */
export function childContactErrors(
  age: number | null,
  phone: string | undefined,
  guardianName: string | undefined,
  guardianPhone: string | undefined
): Record<string, string> {
  const errors: Record<string, string> = {};
  const digits = (value?: string) => (value || '').replace(/\D/g, '');
  const personal = (phone || '').trim();
  const isChild = age !== null && age >= 0 && age < 13;
  if (isChild) {
    if ((guardianName || '').trim().length < 2) errors.emergency_name = 'Enter the child’s parent or guardian’s full name.';
    if (digits(guardianPhone).length < 9) errors.emergency_phone = 'A valid parent or guardian phone number is required for children.';
    if (personal && personal !== '+233' && digits(personal).length < 9) errors.phone = 'Enter a valid phone number or leave the child’s personal phone blank.';
  } else if (digits(phone).length < 9) {
    errors.phone = 'Valid Ghana phone number is required (min 9-10 digits, e.g. +233 24 123 4567).';
  }
  return errors;
}
