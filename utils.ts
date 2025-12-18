
/**
 * Formats a Chinese name for Form display (2 chars -> space in middle)
 * e.g., "张三" -> "张 三"
 * This should be applied to ALL inputs (Excel, Text, OCR, Manual)
 */
export const formatNameForForm = (name: string): string => {
  if (!name) return "";
  const cleanName = name.replace(/\s+/g, ''); // Remove existing spaces first
  // Check if it's purely Chinese and length is 2
  if (/^[\u4e00-\u9fa5]{2}$/.test(cleanName)) {
    return cleanName.split('').join(' ');
  }
  return name; // Return original if not matching rule
};

/**
 * Formats a Chinese name for Agenda display (2 chars -> full-width space)
 * e.g., "张三" -> "张　三"
 */
export const formatNameForAgenda = (name: string): string => {
  if (!name) return "";
  const cleanName = name.replace(/\s+/g, '');
  if (/^[\u4e00-\u9fa5]{2}$/.test(cleanName)) {
    return cleanName.split('').join('\u3000'); // \u3000 is Ideographic Space
  }
  return name;
};

/**
 * Robust parser for Excel copy-paste (TSV)
 */
export const parsePasteInput = (text: string) => {
  // Remove empty lines
  const lines = text.trim().split('\n').filter(line => line.trim() !== '');
  
  return lines.map(line => {
    // Excel copy-paste uses Tabs (\t). 
    // We strictly split by Tab first. 
    // If no tabs are found, we fallback to comma, but usually Excel is Tab.
    let parts = line.split('\t');
    
    // Fallback for CSV format if user pasted comma-separated values
    if (parts.length === 1 && line.includes(',')) {
        parts = line.split(',');
    }
    
    // Clean up whitespace for each cell
    return parts.map(p => p.trim());
  });
};
