import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppTitle, Checkbox, ColorPicker, Field, IconButton, Sheet, Switch } from '../components/ui';
import { Icon } from '../components/Icon';
import { askConfirm } from '../components/confirm';
import { put, remove, uid } from '../lib/data';
import { colorOf } from '../lib/colors';
import { useApp, useEvents, useNow, useTodos, useBundles } from '../lib/hooks';
import { addDays, logicalToday, parseYmd, ymd } from '../lib/time';
import type { CalEvent, ColorKey, Todo } from '../lib/types';
import { dueInfo } from './TodoParts';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const md = (s: string) => { const d = parseYmd(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const mdw = (s: string) => { const d = parseYmd(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`; };
const monthOf = (s: string) => s.slice(0, 7);
const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return ymd(d).slice(0, 7);
};

/** 그 달을 덮는 주(일요일 시작) 날짜 목록 */
function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const start = addDays(first, -parseYmd(first).getDay());
  const [y, m] = month.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  const rows = Math.ceil((parseYmd(first).getDay() + dim) / 7);
  return Array.from({ length: rows }, (_, r) => Array.from({ length: 7 }, (_, c) => addDays(start, r * 7 + c)));
}

type Item =
  | { type: 'event'; ev: CalEvent; showTitle: boolean }
  | { type: 'due'; todo: Todo };

const evOnDay = (ev: CalEvent, d: string) => ev.start <= d && d <= ev.end;
const cmpEvent = (a: CalEvent, b: CalEvent) =>
  Number(b.allDay) - Number(a.allDay) || (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.start.localeCompare(b.start);

/** 시간표 자리의 월 캘린더 (일요일 시작): 일정과 할 일 기한(마감) */
export function CalendarScreen({ embedded, switcher }: { embedded?: boolean; switcher?: ReactNode }) {
  const { date, setDate } = useApp();
  const today = logicalToday(useNow());
  const events = useEvents();
  const todos = useTodos();
  const bundles = useBundles();
  const [month, setMonth] = useState(monthOf(date));
  const [editing, setEditing] = useState<{ ev?: CalEvent; day: string } | null>(null);

  const weeks = useMemo(() => monthGrid(month), [month]);
  const openDue = todos.filter((t) => !t.done && t.due);
  const bundleName = (id: string) => bundles.find((b) => b.id === id)?.name ?? '';

  const itemsOn = (d: string, col: number): Item[] => [
    ...events.filter((e) => evOnDay(e, d)).sort(cmpEvent).map<Item>((ev) => ({ type: 'event', ev, showTitle: d === ev.start || col === 0 })),
    ...openDue.filter((t) => t.due === d).map<Item>((todo) => ({ type: 'due', todo })),
  ];

  const go = (m: string) => { setMonth(m); };
  const pick = (d: string) => {
    setDate(d);
    if (monthOf(d) !== month) setMonth(monthOf(d));
  };
  const [yy, mm] = month.split('-').map(Number);
  const selEvents = events.filter((e) => evOnDay(e, date)).sort(cmpEvent);
  const selDue = openDue.filter((t) => t.due === date);

  const timeLabel = (e: CalEvent) => {
    if (e.start !== e.end) return `${md(e.start)} ~ ${md(e.end)}${e.allDay ? '' : ` · ${e.startTime ?? ''}`}`;
    if (e.allDay) return '종일';
    return `${e.startTime ?? ''}${e.endTime ? ` – ${e.endTime}` : ''}`;
  };

  return (
    <div className="screen">
      {!embedded && <AppTitle />}
      <div className="screen-body cal">
        {switcher}
        <div className="cal-nav">
          <IconButton icon="left" label="이전 달" onClick={() => go(shiftMonth(month, -1))} />
          <div className="cal-month">{yy}년 {mm}월</div>
          <IconButton icon="right" label="다음 달" onClick={() => go(shiftMonth(month, 1))} />
          {(month !== monthOf(today) || date !== today) && (
            <button type="button" className="date-today" onClick={() => { setDate(today); setMonth(monthOf(today)); }} aria-label="오늘로 이동">오늘</button>
          )}
          <button type="button" className="cal-add" aria-label="일정 추가" onClick={() => setEditing({ day: date })}>
            <Icon name="plus" size={18} stroke={2.4} />
          </button>
        </div>
        <div className="cal-legend" aria-hidden="true">
          <span><i className="lg ev" />일정</span><span><i className="lg due" />마감 (할 일 기한)</span><span><i className="lg over" />기한 지남</span>
        </div>

        <div className="cal-grid" role="grid" aria-label={`${yy}년 ${mm}월`}>
          <div className="cal-wk" role="row">
            {WEEK.map((w, i) => <span key={w} role="columnheader" className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</span>)}
          </div>
          {weeks.map((wk, r) => (
            <div key={r} className="cal-row" role="row">
              {wk.map((d, c) => {
                const items = itemsOn(d, c);
                const shown = items.slice(0, 2);
                const extra = items.length - shown.length;
                const out = monthOf(d) !== month;
                const dn = parseYmd(d).getDate();
                return (
                  <button key={d} type="button" role="gridcell" aria-selected={d === date}
                    aria-label={`${mdw(d)}${d === today ? ' 오늘' : ''}, 일정 ${items.filter((i) => i.type === 'event').length}개, 마감 ${items.filter((i) => i.type === 'due').length}개`}
                    className={'cal-cell' + (d === date ? ' sel' : '') + (out ? ' out' : '') + (c === 0 ? ' sun' : c === 6 ? ' sat' : '')}
                    onClick={() => pick(d)}>
                    <span className={'cal-num' + (d === today ? ' today' : '')}>{dn}</span>
                    {shown.map((it) => it.type === 'event' ? (
                      <span key={it.ev.id} className="cal-ev" style={{ background: colorOf(it.ev.color).light, color: colorOf(it.ev.color).ink }}>
                        {it.showTitle ? it.ev.title : ' '}
                      </span>
                    ) : (
                      <span key={it.todo.id} className={'cal-dl ' + dueInfo(it.todo.due!, today).kind}>
                        <Icon name="flag" size={10} stroke={2.6} />
                        <span>{it.todo.title}</span>
                      </span>
                    ))}
                    {extra > 0 && <span className="cal-more">+{extra}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <section className="card cal-day" aria-label={`${mdw(date)} 일정과 마감`}>
          <div className="cal-day-head">
            <strong>{mdw(date)}{date === today ? ' · 오늘' : ''}</strong>
            <button type="button" className="cal-day-add" onClick={() => setEditing({ day: date })}><Icon name="plus" size={14} stroke={2.4} /> 일정 추가</button>
          </div>
          {selEvents.length === 0 && selDue.length === 0 && <p className="muted small cal-empty">이 날은 일정과 마감이 없어요.</p>}
          {selEvents.map((e) => (
            <button key={e.id} type="button" className="cal-item" onClick={() => setEditing({ ev: e, day: date })} aria-label={`${e.title} 일정 편집`}>
              <span className="cal-bar" style={{ background: colorOf(e.color).strong }} />
              <span className="cal-item-main">
                <span className="cal-item-title">{e.title}</span>
                <span className="muted xsmall">{timeLabel(e)}</span>
              </span>
            </button>
          ))}
          {selDue.map((t) => {
            const info = dueInfo(t.due!, today);
            return (
              <div key={t.id} className="cal-item static">
                <Checkbox checked={false} label={`${t.title} 완료`} onChange={() => put<Todo>('todos', { ...t, done: true, doneOn: today })} />
                <span className="cal-item-main">
                  <span className="cal-item-title">{t.title}</span>
                  <span className="muted xsmall">마감 · {bundleName(t.bundleId)}</span>
                </span>
                <span className={'due-chip ' + info.kind}>{info.text}</span>
              </div>
            );
          })}
        </section>
      </div>
      <EventSheet target={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EventSheet({ target, onClose }: { target: { ev?: CalEvent; day: string } | null; onClose: () => void }) {
  const [e, setE] = useState<CalEvent | null>(null);
  useEffect(() => {
    if (!target) return setE(null);
    setE(target.ev ?? {
      id: uid(), title: '', start: target.day, end: target.day, allDay: true, color: 'blue' as ColorKey, memo: '', updatedAt: 0,
    });
  }, [target]);
  if (!target || !e) return null;
  const isNew = !target.ev;
  const set = (c: Partial<CalEvent>) => setE({ ...e, ...c });
  const valid = !!e.title.trim() && !!e.start && !!e.end;
  const save = async () => {
    if (!valid) return;
    let end = e.end < e.start ? e.start : e.end;
    let endTime = e.endTime;
    if (!e.allDay && end === e.start && e.startTime && endTime && endTime < e.startTime) endTime = e.startTime;
    await put<CalEvent>('events', {
      ...e, title: e.title.trim(), end,
      startTime: e.allDay ? undefined : e.startTime, endTime: e.allDay ? undefined : endTime,
    });
    onClose();
  };
  const del = async () => {
    if (!(await askConfirm(`‘${e.title || '이 일정'}’을(를) 지울까요?`, { okLabel: '지우기', danger: true }))) return;
    await remove('events', e.id);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={isNew ? '일정 추가' : '일정 편집'}
      footer={
        <>
          {!isNew && <button type="button" className="btn outline danger big del-btn" onClick={del}>지우기</button>}
          <button type="button" className="btn primary big grow" disabled={!valid} onClick={save}>저장</button>
        </>
      }>
      <Field label="제목">
        <input className="input" value={e.title} maxLength={60} placeholder="예: 스터디 모임" autoFocus={isNew}
          onChange={(ev) => set({ title: ev.target.value })} />
      </Field>
      <div className="row-between">
        <span>종일</span>
        <Switch checked={e.allDay} label="종일" onChange={(allDay) => set({ allDay, startTime: allDay ? undefined : e.startTime ?? '09:00', endTime: allDay ? undefined : e.endTime ?? '10:00' })} />
      </div>
      <div className="two-col">
        <Field label="시작 날짜">
          <input type="date" className="input" value={e.start} aria-label="시작 날짜"
            onChange={(ev) => ev.target.value && set({ start: ev.target.value, end: e.end < ev.target.value ? ev.target.value : e.end })} />
        </Field>
        {!e.allDay && (
          <Field label="시작 시간">
            <input type="time" className="input" value={e.startTime ?? '09:00'} aria-label="시작 시간" onChange={(ev) => set({ startTime: ev.target.value })} />
          </Field>
        )}
      </div>
      <div className="two-col">
        <Field label="끝 날짜">
          <input type="date" className="input" value={e.end} min={e.start} aria-label="끝 날짜"
            onChange={(ev) => ev.target.value && set({ end: ev.target.value })} />
        </Field>
        {!e.allDay && (
          <Field label="끝 시간">
            <input type="time" className="input" value={e.endTime ?? '10:00'} aria-label="끝 시간" onChange={(ev) => set({ endTime: ev.target.value })} />
          </Field>
        )}
      </div>
      <div className="field">
        <span className="field-label">색</span>
        <ColorPicker value={e.color} onChange={(color) => set({ color })} />
      </div>
      <Field label="메모">
        <textarea className="input textarea" rows={3} value={e.memo ?? ''} placeholder="메모 (선택)" onChange={(ev) => set({ memo: ev.target.value })} />
      </Field>
    </Sheet>
  );
}
