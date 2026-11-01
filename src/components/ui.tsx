import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useApp } from '../lib/hooks';
import { COLOR_KEYS, COLORS, isCustomColor } from '../lib/colors';
import type { ColorKey } from '../lib/types';

/** Enter 키 (한글 조합 중인 Enter는 무시: 마지막 글자가 아직 확정되지 않았다) */
export const isEnter = (e: { key: string; nativeEvent: KeyboardEvent }) =>
  e.key === 'Enter' && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229;

export function TitleBar({ name }: { name: string }) {
  return (
    <header className="titlebar">
      <h1 className="titlebar-text">{name}의 비서</h1>
    </header>
  );
}

/** 모든 화면 맨 위 제목 */
export function AppTitle() {
  const { settings } = useApp();
  return <TitleBar name={settings.displayName} />;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label}
      className={'switch' + (checked ? ' on' : '')} onClick={() => onChange(!checked)}>
      <span className="switch-knob" />
    </button>
  );
}

export function Checkbox({ checked, onChange, label, color, indeterminate, number }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; color?: string; indeterminate?: boolean; number?: number;
}) {
  return (
    <button type="button" role="checkbox" aria-checked={indeterminate ? 'mixed' : checked} aria-label={label}
      className={'checkbox' + (checked ? ' on' : '') + (indeterminate ? ' mixed' : '')}
      style={color ? { ['--check' as string]: color } : undefined}
      onClick={() => onChange(!checked)}>
      <span className="checkbox-box">
        {number !== undefined ? number : checked ? <Icon name="check" size={14} stroke={3} /> : indeterminate ? <span className="dash" /> : null}
      </span>
    </button>
  );
}

/** 날짜 카드: ‹ 날짜 › (가운데를 누르면 오늘로) */
export function DateCard({ date, today, onChange, twoLine, addDays }: {
  date: string; today: string; onChange: (d: string) => void; twoLine?: boolean; addDays: (d: string, n: number) => string;
}) {
  const [y, m, d] = date.split('-').map(Number);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()];
  return (
    <div className={'date-card' + (twoLine ? ' two' : '')}>
      <IconButton icon="left" label="어제" onClick={() => onChange(addDays(date, -1))} />
      <button type="button" className="date-card-label" onClick={() => onChange(today)}
        aria-label={`${y}년 ${m}월 ${d}일 ${wd}요일${date === today ? ', 오늘' : ', 오늘로 이동'}`}>
        {twoLine ? (
          <>
            <span className="date-card-year">{y}년</span>
            <span className="date-card-main">{m}월 {d}일 {wd}{date === today && <span className="today-dot" aria-hidden="true" />}</span>
          </>
        ) : (
          <span className="date-card-main">{y}년 {m}월 {d}일 {wd}{date === today && <span className="today-dot" aria-hidden="true" />}</span>
        )}
      </button>
      <IconButton icon="right" label="내일" onClick={() => onChange(addDays(date, 1))} />
      {date !== today && (
        <button type="button" className="date-today" onClick={() => onChange(today)} aria-label="오늘로 이동">오늘</button>
      )}
      <label className="icon-btn date-pick" title="날짜 고르기">
        <Icon name="calendar" />
        <input type="date" className="date-input" value={date} aria-label="날짜 고르기"
          onChange={(e) => { if (e.target.value) onChange(e.target.value); }} />
      </label>
    </div>
  );
}

export function IconButton({ icon, label, onClick, className = '', pressed }: {
  icon: string; label: string; onClick: () => void; className?: string; pressed?: boolean;
}) {
  return (
    <button type="button" className={'icon-btn ' + className} aria-label={label} title={label} onClick={onClick}
      aria-pressed={pressed}>
      <Icon name={icon} />
    </button>
  );
}

export function Sheet({ open, onClose, title, children, footer, tall, heading, page, action }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; tall?: boolean;
  /** 제목 대신 보여줄 머리 (예: 블록 제목) */
  heading?: ReactNode;
  /** 전체 화면 페이지 (뒤로 · 제목 · 오른쪽 버튼) */
  page?: boolean;
  action?: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  /** 바깥을 눌러 닫기: 누르기 시작한 곳도 바깥이어야 한다 (탭으로 연 직후의 click 무시) */
  const downOutside = useRef(false);
  closeRef.current = onClose;
  /** 키보드가 올라오면 보이는 영역(visualViewport)에 맞춰 시트를 키보드 위로 올린다 */
  const [vv, setVv] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const v = window.visualViewport;
    if (!v) return;
    const upd = () => {
      const kb = window.innerHeight - v.height - v.offsetTop > 80 || v.offsetTop > 0 || window.innerHeight - v.height > 80;
      setVv(kb ? { top: v.offsetTop, height: v.height } : null);
      if (kb) (document.activeElement as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' });
    };
    upd();
    v.addEventListener('resize', upd);
    v.addEventListener('scroll', upd);
    return () => { v.removeEventListener('resize', upd); v.removeEventListener('scroll', upd); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className={'sheet-backdrop' + (vv ? ' kb' : '')}
      style={vv ? { top: vv.top, bottom: 'auto', height: vv.height } : undefined}
      onPointerDown={(e) => { downOutside.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && downOutside.current) onClose(); downOutside.current = false; }}>
      <div className={'sheet' + (tall ? ' tall' : '') + (page ? ' page' : '')} role="dialog" aria-modal="true" aria-labelledby={id}
        ref={ref} tabIndex={-1}>
        {page ? (
          <div className="page-head">
            <IconButton icon="left" label="뒤로" onClick={onClose} />
            <h2 id={id}>{title}</h2>
            <div className="page-action">{action}</div>
          </div>
        ) : (
          <>
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-head">
              <h2 id={id}>{heading ?? title}</h2>
              <IconButton icon="x" label="닫기" onClick={onClose} />
            </div>
          </>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ColorPicker({ value, onChange }: { value: ColorKey; onChange: (c: ColorKey) => void }) {
  const custom = isCustomColor(value);
  return (
    <div className="color-picker" role="radiogroup" aria-label="색상">
      {COLOR_KEYS.map((k) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} aria-label={COLORS[k].name}
          className={'color-dot' + (value === k ? ' on' : '')} style={{ background: COLORS[k].strong }}
          onClick={() => onChange(k)}>
          {value === k && <Icon name="check" size={16} stroke={3} />}
        </button>
      ))}
      <label className={'color-dot custom' + (custom ? ' on' : '')} aria-label="색 직접 고르기"
        style={custom ? { background: value } : undefined}>
        {custom ? <Icon name="check" size={16} stroke={3} /> : <Icon name="plus" size={18} />}
        <input type="color" className="color-input" value={custom ? value : '#4B55D6'}
          aria-label="색 직접 고르기" onChange={(e) => onChange(e.target.value as ColorKey)} />
      </label>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ScreenHeading({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="screen-heading">
      <h2>{children}</h2>
      {right && <div className="screen-heading-right">{right}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Row({ label, children, sub }: { label: ReactNode; children?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="row">
      <div className="row-text">
        <div className="row-label">{label}</div>
        {sub && <div className="row-sub">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export function Stepper({ label, value, onDec, onInc, decLabel, incLabel }: {
  label: string; value: string; onDec: () => void; onInc: () => void; decLabel: string; incLabel: string;
}) {
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <button type="button" className="step-btn" aria-label={decLabel} onClick={onDec}>−10분</button>
      <output className="stepper-value" aria-live="polite">{value}</output>
      <button type="button" className="step-btn" aria-label={incLabel} onClick={onInc}>+10분</button>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/** 월/날짜 라벨. 누르면 달력(월 선택)이 열려 원하는 달로 바로 이동한다 */
export function PickLabel({ text, type, value, onChange, label }: {
  text: string; type: 'month' | 'date'; value: string; onChange: (v: string) => void; label: string;
}) {
  return (
    <span className="pick-label">
      <span className="pick-text" aria-hidden="true">{text}</span>
      <input type={type} className="pick-input" aria-label={label} value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)} />
    </span>
  );
}
