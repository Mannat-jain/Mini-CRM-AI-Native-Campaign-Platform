import React, { useEffect, useState } from 'react';
import { Plus, Sparkles, Eye, Trash2, Filter, Loader, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { segmentsAPI, aiAPI } from '../api';

function sizeBadgeClass(count) {
  if (count > 200) return 'badge-red';
  if (count > 80) return 'badge-yellow';
  return 'badge-green';
}

export default function Segments() {
  const navigate = useNavigate();
  const [segments, setSegments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [nlQuery, setNlQuery] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [segName, setSegName] = useState('');
  const [preview, setPreview] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const res = await segmentsAPI.list();
    setSegments(res.data);
  };

  useEffect(() => { load(); }, []);

  const handleAI = async () => {
    if (!nlQuery.trim()) return;
    setAiLoading(true);
    setError('');
    try {
      const res = await aiAPI.segment(nlQuery);
      setSqlQuery(res.data.sql_query);
      setPreview(res.data);
      if (!segName) setSegName(nlQuery.slice(0, 50));
    } catch (e) {
      setError(e.response?.data?.detail || 'AI failed. Check your API key.');
    }
    setAiLoading(false);
  };

  const handlePreview = async () => {
    if (!sqlQuery.trim()) return;
    setPreviewLoading(true);
    setError('');
    try {
      const res = await segmentsAPI.preview(sqlQuery);
      setPreview(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'SQL error');
    }
    setPreviewLoading(false);
  };

  const handleSave = async () => {
    if (!segName || !sqlQuery) return;
    setSaving(true);
    try {
      await segmentsAPI.create({ name: segName, nl_query: nlQuery, sql_query: sqlQuery });
      setShowModal(false);
      setNlQuery(''); setSqlQuery(''); setSegName(''); setPreview(null); setError('');
      load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Save failed');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this segment?')) return;
    await segmentsAPI.delete(id);
    load();
  };

  // NEW: navigate to Campaigns with this segment pre-selected
  const handleCreateCampaign = (segmentId) => {
    navigate('/campaigns', { state: { segmentId } });
  };

  const examples = [
    'Customers who spent over ₹5000 total',
    'High-value buyers from Mumbai or Delhi',
    'Customers who haven\'t ordered in 90 days',
    'Fashion buyers who ordered 3+ times',
    'Customers aged 25-35 who are at risk',
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Segments</h1>
          <p className="page-subtitle">AI-powered audience builder</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={14} /> New Segment
        </button>
      </div>

      <div className="page-content">
        {segments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎯</div>
            <h3>No segments yet</h3>
            <p style={{ marginBottom: '20px' }}>Create your first audience using natural language or SQL.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Sparkles size={14} /> Create First Segment
            </button>
          </div>
        ) : (
          <>
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '24px' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Segment</th>
                    <th>Audience Size</th>
                    <th>AI Query</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {segments.map(s => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{s.name}</div>
                        {s.description && <div className="text-xs text-muted mt-4">{s.description}</div>}
                      </td>
                      <td>
                        <span className="badge badge-purple">{s.customer_count.toLocaleString()} customers</span>
                      </td>
                      <td>
                        {s.nl_query
                          ? <span style={{ color: 'var(--accent)', fontSize: '12px', fontStyle: 'italic' }}>"{s.nl_query}"</span>
                          : <span className="text-muted text-xs">Manual SQL</span>}
                      </td>
                      <td className="text-muted text-sm">{new Date(s.created_at).toLocaleDateString('en-IN')}</td>
                      <td>
                        <div className="flex gap-8">
                          <button className="btn btn-ghost btn-sm" title="View customers"><Eye size={13} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* NEW SECTION: Saved Segments grid — gives the Segments page
                the same "card-driven" feel as Dashboard / Campaigns,
                with a one-click path into campaign creation per segment */}
            <div className="section-label" style={{ marginTop: 0 }}>
              Saved segments — quick launch
            </div>
            <div className="segments-grid">
              {segments.map(s => (
                <div key={`card-${s.id}`} className="segment-card">
                  <div className="segment-card-top">
                    <div>
                      <div className="segment-card-name">{s.name}</div>
                      <div className="segment-card-desc">
                        {s.nl_query ? `"${s.nl_query}"` : (s.description || 'Manual SQL segment')}
                      </div>
                    </div>
                    <span className={`badge ${sizeBadgeClass(s.customer_count)}`}>
                      {s.customer_count.toLocaleString()}
                    </span>
                  </div>
                  <div className="segment-card-footer">
                    <span className="text-xs text-muted">{s.customer_count.toLocaleString()} customers</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleCreateCampaign(s.id)}>
                      <Megaphone size={12} /> Create Campaign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '680px' }}>
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} style={{ color: 'var(--accent)' }} /> Build Audience Segment
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <div className="ai-badge" style={{ marginBottom: '12px' }}>
                <Sparkles size={9} /> Describe in plain English
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="input" placeholder="e.g. Customers who bought twice in the last 3 months but not recently..."
                  value={nlQuery} onChange={e => setNlQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAI()}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={handleAI} disabled={aiLoading || !nlQuery.trim()}>
                  {aiLoading ? <Loader size={14} className="pulse" /> : <Sparkles size={14} />}
                  {aiLoading ? 'Thinking...' : 'Generate SQL'}
                </button>
              </div>
              <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {examples.map(ex => (
                  <button key={ex} className="btn btn-ghost" style={{ fontSize: '11px', padding: '3px 8px', border: '1px solid var(--border)' }}
                    onClick={() => setNlQuery(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <label className="label">SQL Query</label>
              <textarea className="textarea" rows={4} value={sqlQuery} onChange={e => setSqlQuery(e.target.value)}
                placeholder="SELECT DISTINCT c.id FROM customers c ..." style={{ fontFamily: 'monospace', fontSize: '12.5px' }} />
              <button className="btn btn-secondary btn-sm" style={{ marginTop: '8px' }} onClick={handlePreview} disabled={previewLoading || !sqlQuery.trim()}>
                {previewLoading ? <><Loader size={12} /> Querying...</> : <><Eye size={12} /> Preview Audience</>}
              </button>
            </div>

            {preview && (
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px' }}>
                  <span style={{ color: 'var(--accent)', fontSize: '20px' }}>{preview.count}</span>
                  <span className="text-muted" style={{ marginLeft: '8px' }}>customers matched</span>
                </div>
                {preview.sample?.map(c => (
                  <div key={c.id} style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '3px 0' }}>
                    {c.name} · {c.email} · {c.city}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: 'var(--red)' }}>
                {error}
              </div>
            )}

            <div className="form-row">
              <label className="label">Segment Name</label>
              <input className="input" placeholder="Give this segment a name..." value={segName} onChange={e => setSegName(e.target.value)} />
            </div>

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !segName || !sqlQuery}>
                {saving ? <><div className="spinner" /> Saving...</> : <><Filter size={14} /> Save Segment</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
