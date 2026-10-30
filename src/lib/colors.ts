import type { ColorKey, PresetColor } from './types';

export interface ColorSet { strong: string; light: string; ink: string; dark: string; name: string }

/** strong: 점·스와치·DONE 채움, light: 연한 바탕, ink: 블록 글자, dark: 진한 막대·PLAN 테두리 */
export const COLORS: Record<PresetColor, ColorSet> = {
  yellow: { strong: '#F5E59B', light: '#F9F2CB', ink: '#3D3500', dark: '#B9A141', name: '노랑' },
  blue: { strong: '#B6DCEF', light: '#D9ECF7', ink: '#0E3A52', dark: '#5999B9', name: '하늘' },
  green: { strong: '#9BD8B2', light: '#D7F1E0', ink: '#0F3D22', dark: '#59B181', name: '초록' },
  orange: { strong: '#EEB88F', light: '#F8E1CE', ink: '#4A2205', dark: '#D28851', name: '주황' },
  pink: { strong: '#F3BED3', light: '#FAE5ED', ink: '#4F1530', dark: '#CE7799', name: '분홍' },
  purple: { strong: '#CABEEF', light: '#EAE5FA', ink: '#2A1D5C', dark: '#8B79D1', name: '보라' },
  gray: { strong: '#CACAD0', light: '#EAEAEC', ink: '#2A2A30', dark: '#898991', name: '회색' },
};
/** 색상 고르기에 보이는 6가지 (회색은 대체용) */
export const COLOR_KEYS: PresetColor[] = ['yellow', 'blue', 'green', 'orange', 'pink', 'purple'];

export const isCustomColor = (k: ColorKey | undefined): k is `#${string}` => typeof k === 'string' && /^#[0-9a-fA-F]{6}$/.test(k);

const mix = (hex: string, to: number, t: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * t));
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
};

/** 직접 고른 색에서 나머지 색을 만든다 */
export function customColor(hex: string): ColorSet {
  const h = hex.toLowerCase();
  return { strong: mix(h, 255, 0.12), light: mix(h, 255, 0.68), ink: mix(h, 0, 0.72), dark: mix(h, 0, 0.3), name: '직접 고른 색' };
}

export const colorOf = (k: ColorKey | undefined): ColorSet =>
  isCustomColor(k) ? customColor(k) : COLORS[(k as PresetColor) ?? 'gray'] ?? COLORS.gray;
