import type { ColorKey, PresetColor } from './types';

export interface ColorSet { strong: string; light: string; ink: string; dark: string; name: string }

/** strong: 점·스와치·DONE 채움, light: 연한 바탕, ink: 블록 글자, dark: 진한 막대·PLAN 테두리 */
export const COLORS: Record<PresetColor, ColorSet> = {
  yellow: { strong: '#F2DC7A', light: '#F5E9A8', ink: '#3D3500', dark: '#A88A12', name: '노랑' },
  blue: { strong: '#9DD0EA', light: '#BFE0F2', ink: '#0E3A52', dark: '#2F7FA8', name: '하늘' },
  green: { strong: '#7ACB98', light: '#BDE7CB', ink: '#0F3D22', dark: '#2F9E62', name: '초록' },
  orange: { strong: '#E8A16A', light: '#F3CDAE', ink: '#4A2205', dark: '#C76A25', name: '주황' },
  pink: { strong: '#EFA9C4', light: '#F7D3E1', ink: '#4F1530', dark: '#C2557F', name: '분홍' },
  purple: { strong: '#B9A8EA', light: '#DCD3F6', ink: '#2A1D5C', dark: '#6E58C6', name: '보라' },
  gray: { strong: '#B9B9C0', light: '#DCDCE0', ink: '#2A2A30', dark: '#6B6B76', name: '회색' },
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
  return { strong: h, light: mix(h, 255, 0.55), ink: mix(h, 0, 0.72), dark: mix(h, 0, 0.3), name: '직접 고른 색' };
}

export const colorOf = (k: ColorKey | undefined): ColorSet =>
  isCustomColor(k) ? customColor(k) : COLORS[(k as PresetColor) ?? 'gray'] ?? COLORS.gray;
