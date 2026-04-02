export function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If it starts with 55 and has 12 or 13 digits, remove the 55
  if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
    return cleaned.substring(2);
  }
  
  return cleaned;
}
