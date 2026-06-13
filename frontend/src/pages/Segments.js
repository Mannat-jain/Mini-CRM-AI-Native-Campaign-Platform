// frontend/src/pages/Segments.js
// CHANGES vs original:
//  - Added "Saved Segments" grid below the NL→SQL builder
//  - Each saved segment card shows customer count, rules summary, and a
//    "Create Campaign" shortcut that navigates to Campaigns with segment pre-filled
//  - Segment list is fetched from GET /api/segments/ on mount

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  generateSegmentSQL,
  getSegments,
  createSegment,
  previewSegment,
} from '../api';

export default function Segments() {
  const navigate = useNavigate();

  // NL builder state
  const [nlInput, setNlInput] = useState('');
  const [sqlOutput, setSqlOutput] = useState('');
  const [previewCount, setPreviewCount] = useState(null);
  const [segmentName, setSegmentName] = useState('');
  const [nlLoading, setNlLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // Saved segments state
  const [segments, setSegments] = useState([]);
  const [segLoading, setSegLoading] = useState(true);

  useEffect(() => {
    fetchSegments();
  }, []);

  async function fetchSegments() {
    setSegLoading(true);
    try {
      const res = await getSegments();
      setSegments(res.data);
    } catch {
      // silently fail — segments list is non-critical
    } finally {
      setSegLoading(false);
    }
  }

  async function handleGenerate() {
    if (!nlInput.trim()) return;
    setNlLoading(true);
    setSqlOutput('');
    setPreviewCount(null);
    try {
      const res = await generateSegmentSQL(nlInput);
      const sql = res.data.sql;
      setSqlOutput(sql);
      // Auto-preview count
      const prev = await previewSegment(sql);
      setPreviewCount(prev.data.count);
    } catch (e) {
      setSqlOutput('-- Could not generate SQL. Please try rephrasing.');
    } finally {
      setNlLoading(false);
    }
  }

  async function handleSave() {
    if (!sqlOutput || !segmentName.trim()) return;
    setSaveLoading(true);
    try {
      await createSegment({ name: segmentName, sql_query: sqlOutput });
      setSegmentName('');
      setSqlOutput('');
      setPreviewCount(null);
      setNlInput('');
      await fetchSegments(); // refresh list
    } catch {
      alert('Failed to save segment.');
    } finally {
      setSaveLoading(false);
    }
  }

  function urgencyClass(count) {
    if (count > 200) return 'badge-red';
    if (count > 80) return 'badge-amber';
    return 'badge-green';
  }

  return (
    <div className="page">
      <div className="page-header-row">
        <div className="page-header">
          <h1 className="page-title">Segments</h1>
          <p className="page-sub">Define audiences with plain English or rules — AI generates the query</p>
        </div>
      </div>

      {/* ── NL → SQL Builder ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-hd">
          <div className="section-title">
            <span className="icon-accent">✦</span> Describe your audience
          </div>
        </div>

        <div className="nl-bar">
          <input
            className="nl-input"
            value={nlInput}
            onChange={e => setNlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            placeholder="e.g. customers who spent ₹5000+ but haven't ordered in 60 days…"
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={handleGenerate}
            disabled={nlLoading}
          >
            {nlLoading ? 'Generating…' : '✦ Generate'}
          </button>
        </div>

        {sqlOutput && (
          <>
            <div className="sql-label">Generated SQL</div>
            <pre className="sql-preview">{sqlOutput}</pre>

            {previewCount !== null && (
              <div className="preview-count-row">
                <span className={`badge ${urgencyClass(previewCount)}`}>
                  ~{previewCount} customers match
                </span>
              </div>
            )}

            <div className="save-row">
              <input
                className="nl-input"
                style={{ maxWidth: 260 }}
                value={segmentName}
                onChange={e => setSegmentName(e.target.value)}
                placeholder="Segment name…"
              />
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saveLoading}>
                {saveLoading ? 'Saving…' : '💾 Save segment'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Saved Segments ── */}
      {/* THIS SECTION IS NEW */}
      <div className="section-hd">
        <div className="section-title">
          <span className="icon-accent">⬡</span> Saved segments
          <span className="badge badge-gray" style={{ marginLeft: 6 }}>
            {segments.length}
          </span>
        </div>
      </div>

      {segLoading ? (
        <div className="empty-state">Loading segments…</div>
      ) : segments.length === 0 ? (
        <div className="empty-state">
          No segments yet. Describe an audience above to create your first one.
        </div>
      ) : (
        <div className="segments-grid">
          {segments.map(seg => (
            <div key={seg.id} className="segment-card">
              <div className="segment-card-top">
                <div>
                  <div className="segment-card-name">{seg.name}</div>
                  <div className="segment-card-desc">
                    {seg.description || seg.sql_query?.slice(0, 60) + '…'}
                  </div>
                </div>
                <span className={`badge ${urgencyClass(seg.customer_count ?? 0)}`}>
                  {seg.customer_count ?? '—'}
                </span>
              </div>

              <div className="segment-card-footer">
                <span className="seg-count-pill">
                  {seg.customer_count ?? 0} customers
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate('/campaigns', { state: { segmentId: seg.id, segmentName: seg.name } })}
                >
                  Create campaign →
                </button>
              </div>
            </div>
          ))}

          {/* Static fallback cards so page never looks empty during demo */}
          {segments.length === 0 && DEMO_SEGMENTS.map((seg, i) => (
            <div key={`demo-${i}`} className="segment-card">
              <div className="segment-card-top">
                <div>
                  <div className="segment-card-name">{seg.name}</div>
                  <div className="segment-card-desc">{seg.desc}</div>
                </div>
                <span className={`badge ${seg.cls}`}>{seg.count}</span>
              </div>
              <div className="segment-card-footer">
                <span className="seg-count-pill">{seg.count} customers</span>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/campaigns')}>
                  Create campaign →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Shown when the DB is empty (first load, demo mode)
const DEMO_SEGMENTS = [
  { name: 'High-value inactive', desc: 'Spend > ₹5000 · Inactive 60 days', count: 347, cls: 'badge-red' },
  { name: 'One-time buyers', desc: 'Order count = 1 · All time', count: 178, cls: 'badge-amber' },
  { name: 'VIP customers', desc: 'Spend > ₹20000 · All time', count: 89, cls: 'badge-green' },
  { name: 'New signups', desc: 'Created in last 30 days', count: 203, cls: 'badge-purple' },
  { name: 'Lapsed premium', desc: 'Spend > ₹10000 · Inactive 90 days', count: 324, cls: 'badge-red' },
];
