import { ClipType } from '../types/clipboard';

export interface DetectionResult {
  type: ClipType;
  language?: string;
  colorHex?: string;
  colorRgb?: string;
  colorHsl?: string;
  suggestedTitle?: string;
}

// Convert RGB to HEX
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Convert HEX to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace(/^#/, '');
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return { r, g, b };
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

// Convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number): string {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

export function detectClipType(content: string): DetectionResult {
  const trimmed = content.trim();

  // 1. Image Check (Data URL)
  if (trimmed.startsWith('data:image/')) {
    return {
      type: 'image',
      suggestedTitle: 'Pasted Image',
    };
  }

  // 2. Color check: #FFFFFF, rgb(255, 255, 255), hsl(0, 0%, 100%)
  const hexMatch = trimmed.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (hexMatch) {
    const hex = trimmed.toUpperCase();
    const rgb = hexToRgb(hex);
    return {
      type: 'color',
      colorHex: hex,
      colorRgb: rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : undefined,
      colorHsl: rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : undefined,
      suggestedTitle: `Color ${hex}`,
    };
  }

  const rgbMatch = trimmed.match(/^rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\)$/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const hex = rgbToHex(r, g, b);
    return {
      type: 'color',
      colorHex: hex,
      colorRgb: `rgb(${r}, ${g}, ${b})`,
      colorHsl: rgbToHsl(r, g, b),
      suggestedTitle: `Color ${hex}`,
    };
  }

  // 3. URL Check
  const urlPattern = /^(https?:\/\/[^\s]+|www\.[^\s]+)$/i;
  if (urlPattern.test(trimmed)) {
    let hostname = '';
    try {
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      hostname = parsed.hostname.replace(/^www\./, '');
    } catch {
      hostname = trimmed.slice(0, 30);
    }
    return {
      type: 'url',
      suggestedTitle: hostname || 'Web Link',
    };
  }

  // 4. Checklist / Task list check
  const lines = trimmed.split('\n');
  const checklistLines = lines.filter((l) => /^\s*[-*]\s*\[[ xX]\]/i.test(l));
  if (lines.length >= 2 && checklistLines.length >= lines.length * 0.5) {
    return {
      type: 'text',
      suggestedTitle: lines[0].replace(/^[-*]\s*\[[ xX]\]\s*/i, '').slice(0, 30) || 'Checklist',
    };
  }

  // 5. Code Check
  // JSON check
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return {
        type: 'code',
        language: 'json',
        suggestedTitle: 'JSON Object',
      };
    } catch {
      // not valid JSON, check further code heuristics
    }
  }

  // HTML / XML check
  if (/<(!DOCTYPE|[a-z][\s\S]*>)/i.test(trimmed) && trimmed.includes('</') || trimmed.endsWith('/>')) {
    return {
      type: 'code',
      language: 'html',
      suggestedTitle: 'HTML Snippet',
    };
  }

  // SQL check
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\s+/i.test(trimmed) && /(FROM|INTO|SET|TABLE|JOIN|WHERE)/i.test(trimmed)) {
    return {
      type: 'code',
      language: 'sql',
      suggestedTitle: 'SQL Query',
    };
  }

  // Python check
  if (/\b(def\s+\w+\(|import\s+\w+|from\s+\w+\s+import|class\s+\w+.*:|if\s+__name__\s*==\s*['"]__main__['"])/.test(trimmed)) {
    return {
      type: 'code',
      language: 'python',
      suggestedTitle: 'Python Script',
    };
  }

  // JavaScript / TypeScript
  if (
    /\b(const\s+\w+|let\s+\w+|function\s*\w*\(|import\s+.*from|export\s+(default|const|function)|interface\s+\w+|type\s+\w+\s*=|console\.(log|error|warn))\b/.test(
      trimmed
    ) ||
    /=>\s*\{/.test(trimmed)
  ) {
    const isTs = /\b(interface|type\s+\w+\s*=|as\s+\w+|:\s*(string|number|boolean|any)[\s;,)>])\b/.test(trimmed);
    return {
      type: 'code',
      language: isTs ? 'typescript' : 'javascript',
      suggestedTitle: isTs ? 'TypeScript Code' : 'JavaScript Snippet',
    };
  }

  // Shell / Bash
  if (/^(\$|#|curl|git|docker|npm|yarn|pnpm|brew|sudo|ssh|cat|echo|chmod)\s+/m.test(trimmed)) {
    return {
      type: 'code',
      language: 'shell',
      suggestedTitle: 'Shell Command',
    };
  }

  // Default: Plain Text
  const firstLine = lines[0].slice(0, 40).trim();
  return {
    type: 'text',
    suggestedTitle: firstLine.length > 0 ? (firstLine.length >= 35 ? firstLine + '…' : firstLine) : 'Quick Note',
  };
}

export function getContentStats(text: string) {
  const characters = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text ? text.split('\n').length : 0;
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

  return {
    characters,
    words,
    lines,
    readingTimeMinutes,
  };
}
