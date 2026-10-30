import { useMemo, useState } from 'react';
import { Field, Sheet } from '../components/ui';
import { Icon } from '../components/Icon';
import { put } from '../lib/data';
import { colorOf } from '../lib/colors';
import { addDays, fmtDateShort, logicalToday, parseYmd, ymd } from '../lib/time';
import type { Bundle, Category, Todo } from '../lib/types';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const md = (s: string) => { const d = parseYmd(s); return `${d.getMonth() + 1}/${d.getDate()}`; };
const mdw = (s: string) => { const d = parseYmd(s); return `${d.getMonth() + 1}/${d.getDate()} (${WEEK[d.getDay()]})`; };

/** a - b (일) */
export const diffDays = (a: string, b: string) => Math.round((parseYmd(a).getTime() - parseYmd(b).getTime()) / 86400000);

/** 기한 칩의 모양과 글자 */
export function dueInfo(due: string, today: string): { kind: 'over' | 'today' | 'soon' | 'later'; text: string } {
  const n = diffDays(due, today);
  if (n < 0) return { kind: 'over', text: `${-n}일 지남` };
  if (n === 0) return { kind: 'today', text: '오늘' };
  if (n <= 3) return { kind: 'soon', text: `D-${n} · ${md(due)}` };
  return { kind: 'later', text: md(due) };
}

export function DueChip({ due, today }: { due: string; today: string }) {
  const i = dueInfo(due, today);
  return <span className={'due-chip ' + i.kind}>{i.text}</span>;
}

/** 기한 순으로 (기한 없음은 맨 아래, 같으면 원래 순서) */
export function sortByDue(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (!!a.due !== !!b.due) return a.due ? -1 : 1;
    if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
    return a.order - b.order;
  });
}

/** 기한 지남 · 오늘까지 · 이번 주(오늘 포함 7일) 개수 */
export function DueSummary({ todos, today }: { todos: Todo[]; today: string }) {
  const open = todos.filter((t) => !t.done && t.due);
  if (open.length === 0) return null;
  const over = open.filter((t) => diffDays(t.due!, today) < 0).length;
  const day = open.filter((t) => diffDays(t.due!, today) === 0).length;
  const week = open.filter((t) => { const n = diffDays(t.due!, today); return n >= 0 && n <= 6; }).length;
  const cell = (label: string, n: number, cls: string) => (
    <div className="due-sum-cell"><span className="muted xsmall">{label}</span><strong className={cls}>{n}<span className="muted xsmall"> 개</span></strong></div>
  );
  return (
    <section className="due-sum" aria-label="기한 요약">
      {cell('기한 지남', over, over ? 'over' : '')}
      {cell('오늘까지', day, day ? 'today' : '')}
      {cell('이번 주', week, '')}
    </section>
  );
}

/** 기한 정하기: 오늘 · 내일 · 이번 주말 · 직접 고르기 · 기한 없음 */
export function DueSheet({ open, value, today, title, onClose, onPick }: {
  open: boolean; value?: string; today: string; title?: string; onClose: () => void; onPick: (due: string | undefined) => void;
}) {
  const [date, setDate] = useState(value ?? '');
  const saturday = useMemo(() => {
    const d = parseYmd(today).getDay();
    return addDays(today, d === 6 ? 7 : (6 - d + 7) % 7 || 7);
  }, [today]);
  const quick = [
    { label: '오늘', v: today },
    { label: '내일', v: addDays(today, 1) },
    { label: '이번 주말', v: saturday },
  ];
  const pick = (v: string | undefined) => { onPick(v); onClose(); };
  return (
    <Sheet open={open} onClose={onClose} title="기한 정하기"
      footer={<button type="button" className="btn primary big grow" disabled={!date} onClick={() => pick(date)}>저장</button>}>
      {title && <p className="muted small">{title}</p>}
      <div className="chips">
        {quick.map((q) => (
          <button key={q.label} type="button" className={'chip lg' + (date === q.v ? ' on' : '')} aria-pressed={date === q.v}
            onClick={() => setDate(q.v)}>{q.label}</button>
        ))}
        <button type="button" className="chip lg" onClick={() => pick(undefined)}>기한 없음</button>
      </div>
      <Field label="날짜 직접 고르기">
        <input type="date" className="input" value={date} aria-label="기한 날짜"
          onChange={(e) => setDate(e.target.value)} />
      </Field>
      {date && <p className="muted small">{mdw(date)}</p>}
    </Sheet>
  );
}

/** 완료 모음: 묶음별로, 완료한 날짜와 기한 대비 결과 */
export function CompletedList({ todos, bundles, categories, today }: {
  todos: Todo[]; bundles: Bundle[]; categories: Category[]; today: string;
}) {
  const [cat, setCat] = useState<string>('all');
  const [recent, setRecent] = useState(false);
  const [day, setDay] = useState('');
  const doneOf = (t: Todo) => t.doneOn ?? logicalToday(new Date(t.updatedAt || Date.now()));
  const done = todos.filter((t) => t.done);
  const bundleMap = new Map(bundles.map((b) => [b.id, b]));
  const shown = done.filter((t) => {
    const b = bundleMap.get(t.bundleId);
    if (cat !== 'all' && b?.categoryId !== cat) return false;
    if (recent && diffDays(today, doneOf(t)) > 6) return false;
    if (day && doneOf(t) !== day) return false;
    return true;
  });
  const groups = bundles
    .map((b) => ({ b, items: shown.filter((t) => t.bundleId === b.id).sort((x, y) => (doneOf(x) < doneOf(y) ? 1 : doneOf(x) > doneOf(y) ? -1 : y.updatedAt - x.updatedAt)) }))
    .filter((g) => g.items.length > 0);
  const restore = (t: Todo) => put<Todo>('todos', { ...t, done: false, doneOn: undefined });
  const note = (t: Todo) => {
    if (!t.due) return null;
    const n = diffDays(t.due, doneOf(t));
    const rel = n > 0 ? `${n}일 일찍` : n < 0 ? `${-n}일 늦음` : '제때 완료';
    return `기한 ${md(t.due)} · ${rel}`;
  };
  return (
    <>
      <div className="chips scroll" role="group" aria-label="완료 모음 걸러 보기">
        <button type="button" className={'chip' + (cat === 'all' && !recent ? ' on' : '')} aria-pressed={cat === 'all' && !recent}
          onClick={() => { setCat('all'); setRecent(false); }}>전체</button>
        {categories.map((c) => (
          <button key={c.id} type="button" className={'chip' + (cat === c.id ? ' on' : '')} aria-pressed={cat === c.id}
            onClick={() => setCat(cat === c.id ? 'all' : c.id)}>{c.name}</button>
        ))}
        <button type="button" className={'chip' + (recent ? ' on' : '')} aria-pressed={recent} onClick={() => setRecent(!recent)}>최근 7일</button>
      </div>
      <div className="done-tools">
        <span className="muted xsmall">완료한 날짜가 최근인 순서 · {shown.length}개</span>
        <label className="date-search">
          <Icon name="calendar" size={16} />
          {day ? `${md(day)} 완료만` : '날짜 검색'}
          <input type="date" className="date-input" value={day} aria-label="완료한 날짜로 검색" onChange={(e) => setDay(e.target.value)} />
        </label>
        {day && <button type="button" className="date-clear" aria-label="날짜 검색 지우기" onClick={() => setDay('')}>지우기</button>}
      </div>
      {groups.length === 0 && (
        <p className="muted empty-note">{done.length === 0 ? '아직 완료한 할 일이 없어요. 체크하면 여기로 모여요.' : '조건에 맞는 완료 항목이 없어요.'}</p>
      )}
      {groups.map(({ b, items }) => (
        <section key={b.id} className="bundle-card" aria-label={`${b.name} 완료`}>
          <div className="done-head">
            <span className="dot md" style={{ background: colorOf(b.color).strong }} />
            <strong className="bundle-name">{b.name}</strong>
            <span className="muted small">{items.length}개</span>
          </div>
          <ul className="todo-list">
            {items.map((t) => (
              <li key={t.id} className="done-row">
                <span className="done-check"><Icon name="check" size={14} stroke={3} /></span>
                <div className="done-main">
                  <span className="done-title">{t.title}</span>
                  {note(t) && <span className="muted xsmall">{note(t)}</span>}
                </div>
                <span className="done-date">{doneOf(t) === today ? `${md(doneOf(t))} (오늘)` : fmtDateShort(doneOf(t)).replace(' ', ' (') + ')'} 완료</span>
                <button type="button" className="icon-btn faint" aria-label={`${t.title} 진행 중으로 되돌리기`} title="진행 중으로 되돌리기"
                  onClick={() => restore(t)}><Icon name="undo" size={18} /></button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export { ymd };
