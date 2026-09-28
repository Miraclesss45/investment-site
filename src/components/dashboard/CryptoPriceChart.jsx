import { useMemo, useState } from "react";
import { formatMoney } from "../../lib/financial";

const PLOT_TOP = 8;
const PLOT_BOTTOM = 92;
const Y_TICK_COUNT = 4;
const X_TICK_COUNT = 4;

function formatAxisPrice(value) {
  const absoluteValue = Math.abs(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: absoluteValue >= 10000 ? "compact" : "standard",
    maximumFractionDigits: absoluteValue >= 10000 ? 1 : absoluteValue < 1 ? 4 : 2,
  }).format(value);
}

function formatPointTime(timestamp, rangeLabel) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  if (rangeLabel === "1W" || rangeLabel === "1M") {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatUpdatedTime(timestamp) {
  if (!timestamp) return "Waiting for market data";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "Waiting for market data";
  return `Updated ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function CryptoPriceChart({
  symbol,
  name,
  points,
  currentPrice,
  ranges,
  selectedRange,
  onRangeChange,
  updatedAt,
  loading,
  error,
}) {
  const [activeIndex, setActiveIndex] = useState(null);
  const chartPoints = useMemo(
    () => points
      .map((point) => ({ timestamp: Number(point.timestamp), price: Number(point.price) }))
      .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.price) && point.price > 0),
    [points],
  );
  const firstPrice = chartPoints[0]?.price;
  const lastPoint = chartPoints.at(-1);
  const displayedPrice = Number(currentPrice) > 0 ? Number(currentPrice) : lastPoint?.price;
  const periodChange = firstPrice > 0 && lastPoint
    ? ((lastPoint.price - firstPrice) / firstPrice) * 100
    : null;
  const chartIsPositive = periodChange == null || periodChange >= 0;
  const chartColor = chartIsPositive ? "#34d399" : "#fb7185";
  const gradientId = `price-chart-fill-${symbol.toLowerCase()}`;
  const minPrice = chartPoints.length ? Math.min(...chartPoints.map((point) => point.price)) : 0;
  const maxPrice = chartPoints.length ? Math.max(...chartPoints.map((point) => point.price)) : 0;
  const rawSpread = maxPrice - minPrice;
  const padding = rawSpread > 0 ? rawSpread * 0.08 : Math.max(maxPrice * 0.005, 0.01);
  const axisMin = Math.max(minPrice - padding, 0);
  const axisMax = maxPrice + padding || 1;
  const axisRange = axisMax - axisMin || 1;
  const axisPrices = Array.from({ length: Y_TICK_COUNT + 1 }, (_, index) => (
    axisMax - (axisRange * index) / Y_TICK_COUNT
  ));
  const getY = (price) => {
    const ratio = (price - axisMin) / axisRange;
    return PLOT_TOP + (1 - ratio) * (PLOT_BOTTOM - PLOT_TOP);
  };
  const svgPoints = chartPoints.map((point, index) => {
    const x = (index / Math.max(chartPoints.length - 1, 1)) * 1000;
    return { ...point, x, y: getY(point.price) };
  });
  const linePath = svgPoints
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath = svgPoints.length
    ? `${linePath} L1000,100 L0,100 Z`
    : "";
  const activePoint = Number.isInteger(activeIndex) ? svgPoints[activeIndex] : null;
  const activeLeft = activePoint
    ? Math.min(Math.max((activePoint.x / 1000) * 100, 14), 86)
    : 50;

  function handlePointerMove(event) {
    if (!svgPoints.length) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    const ratio = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1);
    setActiveIndex(Math.round(ratio * (svgPoints.length - 1)));
  }

  function handleChartKeyDown(event) {
    if (!svgPoints.length) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex((current) => {
        if (event.key === "Home") return 0;
        if (event.key === "End") return svgPoints.length - 1;
        if (event.key === "ArrowLeft") return Math.max((current ?? svgPoints.length) - 1, 0);
        return Math.min((current ?? -1) + 1, svgPoints.length - 1);
      });
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-white/10 bg-gradient-to-br from-[#0e1a2c] to-[#0a1422] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.18)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-white/10 bg-white/[0.045] px-2 py-1 text-[10px] font-extrabold tracking-[0.12em] text-slate-200">
              {symbol}/USD
            </span>
            <span className="text-xs text-slate-400">{name}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="font-['Inter'] text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
              {displayedPrice ? formatMoney(displayedPrice) : "—"}
            </p>
            {periodChange != null && (
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${chartIsPositive ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>
                {periodChange >= 0 ? "+" : ""}{periodChange.toFixed(2)}%
                <span className="ml-1 font-medium opacity-70">{selectedRange}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
          <span className={`h-1.5 w-1.5 rounded-full ${loading ? "animate-pulse bg-amber-300" : "bg-emerald-300"}`} />
          {formatUpdatedTime(updatedAt)}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
          Price history
        </p>
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-[#081321]/80 p-1" aria-label={`${symbol} chart range`}>
          {ranges.map((range) => (
            <button
              key={range.key}
              type="button"
              aria-pressed={selectedRange === range.label}
              onClick={() => onRangeChange(range.key)}
              className={`min-w-9 rounded-md px-2.5 py-1.5 text-[10px] font-bold transition ${selectedRange === range.label ? "bg-white/10 text-white shadow-sm" : "text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"}`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2 text-xs text-amber-200" role="status">
          {error}
        </p>
      )}

      {loading && chartPoints.length === 0 ? (
        <div className="mt-3 flex h-[220px] items-end gap-2 overflow-hidden rounded-xl border border-white/[0.04] bg-[#081321]/70 px-4 pb-7 pt-8 sm:h-[260px]" role="status" aria-label="Loading price chart">
          {[34, 45, 39, 54, 47, 62, 57, 72, 64, 79, 70, 88, 76, 92, 83, 100, 92, 106, 98, 116, 104, 122, 112, 130].map((height, index) => (
            <span key={index} className="h-full flex-1 rounded-t-sm bg-gradient-to-t from-sky-400/[0.03] to-sky-300/[0.14] motion-safe:animate-pulse" style={{ maxHeight: `${height}px` }} />
          ))}
        </div>
      ) : chartPoints.length > 0 ? (
        <div className="relative mt-3 h-[220px] sm:h-[260px]">
          <div className="pointer-events-none absolute bottom-7 left-0 right-0 top-2">
            {axisPrices.map((price, index) => {
              const top = PLOT_TOP + ((PLOT_BOTTOM - PLOT_TOP) * index) / Y_TICK_COUNT;
              return (
                <span
                  key={index}
                  className="absolute left-0 -translate-y-1/2 pr-2 text-[9px] tabular-nums text-slate-500 sm:text-[10px]"
                  style={{ top: `${top}%` }}
                >
                  {formatAxisPrice(price)}
                </span>
              );
            })}
          </div>
          <div
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setActiveIndex(null)}
            onKeyDown={handleChartKeyDown}
            tabIndex={0}
            role="group"
            className="absolute bottom-7 left-[4.5rem] right-0 top-2 touch-pan-y cursor-crosshair rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300"
            aria-label={`${symbol} price chart. ${lastPoint ? `Latest price ${formatMoney(lastPoint.price)}.` : ""}${periodChange != null ? ` ${periodChange >= 0 ? "Up" : "Down"} ${Math.abs(periodChange).toFixed(2)} percent over ${selectedRange}.` : ""} Move pointer over the chart to inspect prices.`}
          >
            <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity="0.23" />
                  <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
                </linearGradient>
              </defs>
              {Array.from({ length: Y_TICK_COUNT + 1 }, (_, index) => {
                const y = PLOT_TOP + ((PLOT_BOTTOM - PLOT_TOP) * index) / Y_TICK_COUNT;
                return <line key={`horizontal-${index}`} x1="0" x2="1000" y1={y} y2={y} stroke="rgba(148,163,184,0.12)" strokeDasharray="3 8" vectorEffect="non-scaling-stroke" />;
              })}
              {Array.from({ length: X_TICK_COUNT + 1 }, (_, index) => {
                const x = (1000 * index) / X_TICK_COUNT;
                return <line key={`vertical-${index}`} x1={x} x2={x} y1={PLOT_TOP} y2={PLOT_BOTTOM} stroke="rgba(148,163,184,0.08)" strokeDasharray="3 8" vectorEffect="non-scaling-stroke" />;
              })}
              <path d={areaPath} fill={`url(#${gradientId})`} />
              <path d={linePath} fill="none" stroke={chartColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              {activePoint && (
                <>
                  <line x1={activePoint.x} x2={activePoint.x} y1={PLOT_TOP} y2={PLOT_BOTTOM} stroke="rgba(226,232,240,0.45)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
                  <circle cx={activePoint.x} cy={activePoint.y} r="6" fill={chartColor} fillOpacity="0.16" />
                  <circle cx={activePoint.x} cy={activePoint.y} r="3" fill={chartColor} stroke="#081321" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                </>
              )}
            </svg>
            {activePoint && (
              <div className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg border border-white/10 bg-[#111e30]/95 px-3 py-2 shadow-xl shadow-black/30 backdrop-blur-sm" style={{ left: `${activeLeft}%` }}>
                <p className="text-xs font-bold tabular-nums text-white">{formatMoney(activePoint.price)}</p>
                <p className="mt-1 whitespace-nowrap text-[10px] text-slate-400">{formatPointTime(activePoint.timestamp, selectedRange)}</p>
              </div>
            )}
          </div>
          <div className="absolute bottom-0 left-[4.5rem] right-0 flex justify-between text-[9px] tabular-nums text-slate-500 sm:text-[10px]" aria-hidden="true">
            {Array.from({ length: X_TICK_COUNT + 1 }, (_, index) => {
              const pointIndex = Math.round(((chartPoints.length - 1) * index) / X_TICK_COUNT);
              return (
                <span key={index} className={index === 0 ? "-translate-x-1" : index === X_TICK_COUNT ? "translate-x-1" : "-translate-x-1/2"}>
                  {formatPointTime(chartPoints[pointIndex]?.timestamp, selectedRange)}
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex h-[220px] items-center justify-center rounded-xl border border-white/[0.05] bg-[#081321]/70 px-5 text-center text-sm text-slate-400 sm:h-[260px]">
          No market chart data is available right now.
        </div>
      )}
      <p className="mt-2 text-right text-[10px] text-slate-600">Market data for display only</p>
    </section>
  );
}
