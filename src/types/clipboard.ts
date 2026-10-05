export type ClipType = 'text' | 'code' | 'url' | 'color' | 'image';

export interface ClipItem {
  id: string;
  content: string;
  type: ClipType;
  language?: string;
  colorHex?: string;
  colorRgb?: string;
  imageData?: string;
  createdAt: number;
  copyCount: number;
}

export type ViewMode = 'grid' | 'compact';
