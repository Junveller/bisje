import { useMemo, useState } from 'react';
import { AppTitle, Empty, IconButton, PickLabel, ScreenHeading, Segmented } from '../components/ui';
import { useBlocksBetween, useBundles, useCategories, useToday } from '../lib/hooks';
import { colorOf } from '../lib/colors';
import {
  addDays, addMonths, fmtMinutes, monthRange, nextPayday, parseYmd, settlementRange, weekday, weekRange, won,
  earnings, wageLabel,
} from '../lib/time';
import type { Block, Bundle } from '../lib/types';
import { LAST_DAY } from './BundleEdit';

type Period = 'week' | 'month';
const mins = (b: Block) => (b.end - b.start) * 10;
const minDate = (a: string, b: string) => (a < b ? a : b);
const maxDate = (a: string, b: string) => (a > b ? a : b);

export function StatsScreen({ embedded }: { embedded?: boolean }) {
  const today = useToday();
  const [period, setPeriod] = useState<Period>('month');
  const [catFilter, setCatFilter] = useState<string | 'all'>('all');
  const categories = useCategories();
  const bundles = useBundles();

  /** 보고 있는 기준 날짜 (없으면 오늘) — 지난 주/달로 이동할 수 있다 */
  const [anchor, setAnchor] = useState<string | undefined>();
  const ref = anchor ?? today;
  const [from, to] = period === 'week' ? weekRange(ref) : monthRange(ref);
  const isCurrent = today >= from && today <= to;
  const [ry, rm] = ref.split('-').map(Number);
  const shift = (n: number) => setAnchor(period === 'week' ? addDays(from, 7 * n) : `${addMonths(ref.slice(0, 7), n)}-01`);
  const pLabel = period === 'week' ? (isCurrent ? '이번 주' : `${short(from)}~${short(to)}`) : (isCurrent ? '이번 달' : `${rm}월`);
  const incomeBundles = bundles.filter((b) => b.income);
  const settle = new Map(incomeBundles.map((b) => [b.id, settlementRange(ref, Math.min(28, Math.max(1, b.settleStart || 1)))]));
  let qFrom = from;
  let qTo = to;
  for (const [s, e] of settle.values()) {
    qFrom = minDate(qFrom, s);
    qTo = maxDate(qTo, e);
  }
  const blocks = useBlocksBetween(qFrom, qTo);

  const inFilter = (b: Bundle | undefined) => !!b && (catFilter === 'all' || b.categoryId === catFilter);
  const bundleMap = useMemo(() => new Map(bundles.map((b) => [b.id, b])), [bundles]);
  const periodBlocks = blocks.filter((b) => b.date >= from && b.date <= to && (b.bundleId ? inFilter(bundleMap.get(b.bundleId)) : catFilter === 'all'));

  // 묶음별 합계 (DONE / PLAN)
  const totals = new Map<string, { done: number; plan: number }>();
  for (const b of periodBlocks) {
    const t = totals.get(b.bundleId) ?? { done: 0, plan: 0 };
    t[b.kind] += mins(b);
    totals.set(b.bundleId, t);
  }
  const maxTotal = Math.max(1, ...[...totals.values()].map((t) => Math.max(t.done, t.plan)));

  // 막대: 이번 주 = 요일별, 이번 달 = 주별 근무시간 (수입 계산 묶음)
  const workBlocks = periodBlocks.filter((b) => b.kind === 'done' && bundleMap.get(b.bundleId)?.income);
  const bars = period === 'week'
    ? Array.from({ length: 7 }, (_, i) => {
      const d = addDays(from, i);
      return { label: weekday(d), done: workBlocks.filter((b) => b.date === d).reduce((s, b) => s + mins(b), 0), current: d === today };
    })
    : monthWeeks(from, to).map(([s, e], i) => ({
      label: `${i + 1}주`,
      done: workBlocks.filter((b) => b.date >= s && b.date <= e).reduce((s2, b) => s2 + mins(b), 0),
      current: today >= s && today <= e,
    }));
  const maxBar = Math.max(60, ...bars.map((b) => b.done));
  const barTotal = bars.reduce((s, b) => s + b.done, 0);

  // 알바 수입 (현재 정산기간)
  const jobs = incomeBundles.filter(inFilter).map((b) => {
    const [s, e] = period === 'week' ? [from, to] : settle.get(b.id)!;
    const mine = blocks.filter((x) => x.bundleId === b.id && x.date >= s && x.date <= e);
    let doneMin = 0;
    let planMin = 0;
    for (const d of new Set(mine.map((x) => x.date))) {
      const day = mine.filter((x) => x.date === d);
      const dm = sum(day, 'done');
      const pm = sum(day, 'plan');
      doneMin += dm;
      planMin += d < today ? dm : Math.max(dm, pm);
    }
    return { b, s, e, doneMin, planMin, earned: earnings(doneMin, b), pay: nextPayday(today, b.payday) };
  });
  // 날짜별 실제(DONE) 기록: 며칠에 몇 시간 했는지
  const dayMap = new Map<string, Map<string, number>>();
  for (const b of periodBlocks) {
    if (b.kind !== 'done') continue;
    const m = dayMap.get(b.date) ?? new Map<string, number>();
    m.set(b.bundleId, (m.get(b.bundleId) ?? 0) + mins(b));
    dayMap.set(b.date, m);
  }
  const dayRows = [...dayMap.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([date, m]) => {
    const items = [...m.entries()].map(([id, min]) => ({ b: bundleMap.get(id) ?? ({ id: '', name: '분류 없음', income: false } as unknown as Bundle), min }));
    const total = items.reduce((t, x) => t + x.min, 0);
    const money = items.reduce((t, x) => t + (x.b.income ? earnings(x.min, x.b) : 0), 0);
    return { date, items, total, money };
  });
  const saveCsv = () => {
    const rows = [['날짜', '요일', '묶음', '시간(분)', '시간', '수입(원)']];
    for (const r of [...dayRows].reverse()) {
      for (const x of r.items) rows.push([r.date, weekday(r.date), x.b.name, String(x.min), fmtMinutes(x.min), x.b.income ? String(earnings(x.min, x.b)) : '']);
    }
    const csv = '\ufeff' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `bisje-${from}_${to}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const heroLabel = period === 'week' ? `알바로 ${pLabel}에 번 돈` : isCurrent ? '알바로 지금까지 모인 돈' : `알바로 ${rm}월 정산 기간에 번 돈`;
  const earnedTotal = jobs.reduce((s, j) => s + j.earned, 0);
  const planMax = Math.max(1, ...jobs.map((j) => j.planMin));
  const m = rm;

  return (
    <div className="screen">
      {!embedded && <AppTitle />}
      <div className="screen-body">
        {!embedded && <ScreenHeading>통계</ScreenHeading>}
        <Segmented label="기간" value={period} onChange={(v) => { setPeriod(v); }}
          options={[{ value: 'week', label: '이번 주' }, { value: 'month', label: '이번 달' }]} />
        <div className="nav-row">
          <IconButton icon="left" label={period === 'week' ? '지난 주' : '지난달'} onClick={() => shift(-1)} />
          {period === 'week'
            ? <PickLabel text={`${short(from)} ~ ${short(to)}`} type="date" value={ref} label="주 선택 (그 주로 이동)" onChange={(v) => setAnchor(v)} />
            : <PickLabel text={`${ry}년 ${rm}월`} type="month" value={ref.slice(0, 7)} label="월 선택" onChange={(v) => setAnchor(`${v}-01`)} />}
          <IconButton icon="right" label={period === 'week' ? '다음 주' : '다음달'} onClick={() => shift(1)} />
          {!isCurrent && <button type="button" className="back-now" onClick={() => setAnchor(undefined)}>{period === 'week' ? '이번 주' : '이번 달'}로</button>}
        </div>
        <div className="chips scroll" role="group" aria-label="카테고리 필터">
          <button type="button" className={'chip lg' + (catFilter === 'all' ? ' on' : '')} aria-pressed={catFilter === 'all'}
            onClick={() => setCatFilter('all')}>전체</button>
          {categories.map((c) => (
            <button key={c.id} type="button" className={'chip lg' + (catFilter === c.id ? ' on' : '')} aria-pressed={catFilter === c.id}
              onClick={() => setCatFilter(c.id)}>{c.name}</button>
          ))}
        </div>

        {jobs.length > 0 && (
          <>
            <section className="hero" aria-label={heroLabel}>
              <span className="hero-label">{heroLabel}</span>
              <strong className="hero-value">{won(earnedTotal)}</strong>
              {isCurrent && <span className="hero-label">{jobs.map((j) => `${j.b.name} ${short(j.pay.date)}`).join(' · ')} 지급 예정</span>}
            </section>
            {jobs.map((j) => {
              const c = colorOf(j.b.color);
              return (
                <section key={j.b.id} className="card job" aria-label={`${j.b.name} 수입`}>
                  <div className="job-head">
                    <span className="dot md" style={{ background: c.strong }} />
                    <strong>{j.b.name}</strong>
                    <span className="muted xsmall">{wageLabel(j.b)}</span>
                    <span className="spacer" />
                    <strong className="job-amount">{won(j.earned)}</strong>
                  </div>
                  <span className="muted small">
                    {period === 'week' ? pLabel : '정산'} {short(j.s)} ~ {short(j.e)} · 월급날 {j.b.payday >= LAST_DAY ? `말일(${short(j.pay.date)})` : short(j.pay.date)} · {j.pay.dday === 0 ? 'D-Day' : `D-${j.pay.dday}`}
                  </span>
                  <div className="stack-bar thin" role="img"
                    aria-label={`실제 ${fmtMinutes(j.doneMin)}, 계획 포함 ${fmtMinutes(j.planMin)}`}>
                    <span style={{ width: `${(j.doneMin / planMax) * 100}%`, background: c.dark }} />
                    <span style={{ width: `${((j.planMin - j.doneMin) / planMax) * 100}%`, background: c.light }} />
                  </div>
                  <div className="job-foot muted small">
                    <span>실제 {fmtMinutes(j.doneMin)}</span>
                    <span>계획 포함 {fmtMinutes(j.planMin)}</span>
                  </div>
                </section>
              );
            })}
          </>
        )}

        <section className="card" aria-labelledby="bar-title">
          <div className="card-head">
            <h3 className="card-title small-title" id="bar-title">{period === 'week' ? `${pLabel} 요일별 근무시간` : `${m}월 주별 근무시간`}</h3>
            <span className="muted small">총 {fmtMinutes(barTotal)}</span>
          </div>
          <div className="vbars" role="img" aria-label={bars.map((b) => `${b.label} ${fmtMinutes(b.done)}`).join(', ')}>
            {bars.map((b) => (
              <div key={b.label} className={'vbar' + (b.current ? ' current' : '')}>
                <span className="vbar-value">{b.done ? `${+(b.done / 60).toFixed(1)}h` : ''}</span>
                <div className="vbar-track"><span style={{ height: `${(b.done / maxBar) * 100}%` }} /></div>
                <span className="vbar-label">{b.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card" aria-labelledby="day-title">
          <div className="card-head">
            <h3 className="card-title small-title" id="day-title">{pLabel} 날짜별 기록</h3>
            <span className="muted small">실제(DONE) 기준</span>
          </div>
          {dayRows.length === 0 && <Empty>아직 DONE 기록이 없어요.</Empty>}
          {dayRows.map((r) => (
            <div key={r.date} className="day-row">
              <div className="day-head">
                <strong>{short(r.date)} ({weekday(r.date)})</strong>
                <span className="spacer" />
                <strong>{fmtMinutes(r.total)}</strong>
                {r.money > 0 && <span className="muted small"> · {won(r.money)}</span>}
              </div>
              <div className="muted small">{r.items.map((x) => `${x.b.name} ${fmtMinutes(x.min)}`).join(' · ')}</div>
            </div>
          ))}
          {dayRows.length > 0 && (
            <button type="button" className="btn outline wide" onClick={saveCsv}>엑셀(CSV) 파일로 저장</button>
          )}
        </section>

        <section className="card" aria-labelledby="sum-title">
          <div className="card-head">
            <h3 className="card-title small-title" id="sum-title">{pLabel} 묶음별 시간</h3>
            <span className="muted small">실제 / 계획</span>
          </div>
          {totals.size === 0 && <Empty>아직 기록이 없어요. 시간표에서 DONE을 칠해 보세요.</Empty>}
          {categories.filter((c) => catFilter === 'all' || c.id === catFilter).map((c) => {
            const bs = bundles.filter((b) => b.categoryId === c.id && totals.has(b.id));
            if (!bs.length) return null;
            const catDone = bs.reduce((s, b) => s + totals.get(b.id)!.done, 0);
            return (
              <div key={c.id} className="sum-group">
                <div className="sum-cat"><span>{c.name}</span><span>{fmtMinutes(catDone)}</span></div>
                {bs.map((b) => {
                  const t = totals.get(b.id)!;
                  const col = colorOf(b.color);
                  return (
                    <div key={b.id} className="hbar-row">
                      <span className="hbar-name">{b.name}</span>
                      <div className="stack-bar thin" aria-hidden="true">
                        <span style={{ width: `${(t.done / maxTotal) * 100}%`, background: col.dark }} />
                        <span style={{ width: `${(Math.max(0, t.plan - t.done) / maxTotal) * 100}%`, background: col.light }} />
                      </div>
                      <span className="hbar-val">{fmtMinutes(t.done)}<span className="muted"> / {fmtMinutes(t.plan)}</span></span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

const sum = (list: Block[], kind: Block['kind']) => list.filter((b) => b.kind === kind).reduce((s, b) => s + mins(b), 0);
const short = (s: string) => {
  const d = parseYmd(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

/** 월을 월요일 시작 주로 자른 구간 목록 */
function monthWeeks(from: string, to: string): [string, string][] {
  const out: [string, string][] = [];
  let s = from;
  while (s <= to) {
    const [, we] = weekRange(s);
    const e = we < to ? we : to;
    out.push([s, e]);
    s = addDays(e, 1);
  }
  return out;
}
