// frontend/src/pages/Dashboard.js  ── BAR CHART PATCH
// =====================================================================
// ONLY THESE TWO THINGS CHANGED vs your original Dashboard.js:
//
//  1. The activityData array now has { sent, opened } per day
//  2. The bar chart JSX renders TWO bars per day (sent + opened)
//     with a legend above: "■ Sent  □ Opened"
//
// Everything else (seed button, funnel, AI recs, etc.) stays the same.
// Find your existing bar chart section and replace it with this block.
// =====================================================================

/*
──────────────────────────────────────────────────────
STEP 1 — Replace your activityData array (wherever it is)
──────────────────────────────────────────────────────
*/
const activityData = [
  { day: 'Mon', sent: 820,  opened: 340 },
  { day: 'Tue', sent: 1240, opened: 510 },
  { day: 'Wed', sent: 960,  opened: 390 },
  { day: 'Thu', sent: 1680, opened: 740 },
  { day: 'Fri', sent: 2100, opened: 860 },
  { day: 'Sat', sent: 1320, opened: 490 },
  { day: 'Sun', sent: 1580, opened: 620 },
];
const maxSent = Math.max(...activityData.map(d => d.sent));

/*
──────────────────────────────────────────────────────
STEP 2 — Replace the bar chart JSX block in your render
         (the <div className="card"> that contains the chart)
──────────────────────────────────────────────────────
*/
const BarChartBlock = () => (
  <div className="card">
    {/* Header with legend */}
    <div className="section-hd">
      <div className="section-title">
        <BarChart2 size={16} /> Activity — last 7 days
      </div>
      <div className="chart-legend">
        <span className="legend-sent">■ Sent</span>
        <span className="legend-opened">□ Opened</span>
      </div>
    </div>

    {/* Dual-bar chart */}
    <div className="dual-bar-chart">
      {activityData.map((d, i) => (
        <div key={i} className="bar-group">
          {/* Sent bar */}
          <div
            className="bar-sent"
            style={{ height: `${(d.sent / maxSent) * 100}%` }}
            title={`${d.day}: ${d.sent} sent`}
          />
          {/* Opened bar */}
          <div
            className="bar-opened"
            style={{ height: `${(d.opened / maxSent) * 100}%` }}
            title={`${d.day}: ${d.opened} opened`}
          />
        </div>
      ))}
    </div>

    {/* Day labels */}
    <div className="bar-day-labels">
      {activityData.map(d => (
        <span key={d.day}>{d.day}</span>
      ))}
    </div>
  </div>
);

export { BarChartBlock, activityData };

/*
──────────────────────────────────────────────────────
HOW TO USE:
In your existing Dashboard.js render, find the block that
renders the 7 single-color bars and replace it with:

  <BarChartBlock />

Or inline the JSX directly — whatever fits your existing structure.
──────────────────────────────────────────────────────
*/
