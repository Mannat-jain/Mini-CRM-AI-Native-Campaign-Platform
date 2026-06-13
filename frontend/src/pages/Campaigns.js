import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Send, Sparkles, Trash2, Loader, TrendingUp } from 'lucide-react';
import { campaignsAPI, segmentsAPI, aiAPI } from '../api';

const CHANNEL_LABELS = { email: '📧 Email', sms: '💬 SMS', whatsapp: '📱 WhatsApp', rcs: '🔷 RCS' };

function StatusBadge({ status }) {
  const map = { draft: 'gray', sent: 'green', sending: 'yellow' };
  return <span className={`badge badge-${map[status] || 'gray'}`}>{status}</span>;
}

function CampaignStats({ stats }) {
  if (!stats || stats.total === 0) return <span className="text-muted text-sm">No sends yet</span>;
  const delivered = (stats.delivered || 0) + (stats.opened || 0) + (stats.read || 0) + (stats.clicked || 0);
  return (
    <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{stats.total} sent</span>
      <span style={{ color: 'var(--green)' }}>{delivered} delivered</span>
      <span style={{ color: 'var(--accent)' }}>{stats.opened || 0} opened</span>
      <span style={{ color: 'var(--yellow)' }}>{stats.clicked || 0} clicked</span>
    </div>
  );
}


function getCampaignInsight(c) {
  const stats = c.stats;
  if (!stats || stats.total === 0) return null;

  const total = stats.total;
  const openRate = ((stats.opened || 0) + (stats.read || 0) + (stats.clicked || 0)) / total;
  const clickRate = (stats.clicked || 0) / total;
  const failRate = (stats.failed || 0) / total;

  // Channel-specific framing
  const channelAvg = { email: 0.22, sms: 0.35, whatsapp: 0.45, rcs: 0.40 };
  const avg = channelAvg[c.channel] ?? 0.30;

  if (failRate > 0.15) {
    return `⚠ ${Math.round(failRate * 100)}% of sends failed — check ${c.channel} delivery config for this segment.`;
  }
  if (openRate > avg * 1.3) {
    const mult = (openRate / avg).toFixed(1);
    return `⚡ ${c.channel.toUpperCase()} open rate is ${mult}× your typical average for this channel — this audience is highly engaged.`;
  }
  if (clickRate > 0.1) {
    return `⚡ ${Math.round(clickRate * 100)}% of recipients clicked through — consider a follow-up offer to this segment.`;
  }
  if (openRate < avg * 0.6 && openRate > 0) {
    return `⚡ Open rate is below average for ${c.channel}. Try resending to non-openers on a different channel.`;
  }
  return `⚡ Performance is in line with your ${c.channel} averages for this segment size.`;
}

export default function Campaigns() {
  const location = useLocation();
  const [campaigns, setCampaigns] = useState([]);
  const [segments, setSegments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', segment_id: '', message_template: '', channel: 'email' });
  const [aiMsgLoading, setAiMsgLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([campaignsAPI.list(), segmentsAPI.list()]);
      setCampaigns(c.data);
      setSegments(s.data);
    } catch (e) { }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll for stats updates
  useEffect(() => {
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const segmentId = location.state?.segmentId;
    if (segmentId) {
      setForm(f => ({ ...f, segment_id: segmentId }));
      setShowModal(true);
    }
  }, [location.state]);

  const handleAIMessage = async () => {
    const seg = segments.find(s => s.id === form.segment_id);
    if (!seg) return;
    setAiMsgLoading(true);
    try {
      const res = await aiAPI.message({
        segment_description: seg.nl_query || seg.name,
        campaign_goal: form.name || 'Engage customers',
        channel: form.channel
      });
      setForm(f => ({ ...f, message_template: res.data.message }));
    } catch (e) {
      setError('AI message generation failed. Check API key.');
    }
    setAiMsgLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await campaignsAPI.create(form);
      setShowModal(false);
      setForm({ name: '', segment_id: '', message_template: '', channel: 'email' });
      load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create campaign');
    }
    setSaving(false);
  };

  const handleSend = async (id) => {
    setSending(s => ({ ...s, [id]: true }));
    try {
      const res = await campaignsAPI.send(id);
      alert(`✅ ${res.data.message}`);
      load();
    } catch (e) {
      alert(e.response?.data?.detail || 'Send failed');
    }
    setSending(s => ({ ...s, [id]: false }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this campaign?')) return;
    await campaignsAPI.delete(id);
    load();
  };

  const openNewCampaignModal = () => {
    setForm({ name: '', segment_id: '', message_template: '', channel: 'email' });
    setError('');
    setShowModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">Create and launch targeted campaigns</p>
        </div>
        <button className="btn btn-primary" onClick={openNewCampaignModal} disabled={segments.length === 0}>
          <Plus size={14} /> New Campaign
        </button>
      </div>

      {segments.length === 0 && (
        <div style={{ margin: '0 32px 16px', padding: '14px 16px', background: 'var(--yellow-dim)', border: '1px solid var(--yellow)', borderRadius: 'var(--radius)', fontSize: '13px', color: 'var(--yellow)' }}>
          Create at least one segment before launching a campaign.
        </div>
      )}

      <div className="page-content">
        {campaigns.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📣</div>
            <h3>No campaigns yet</h3>
            <p>Create a segment first, then launch your first campaign.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {campaigns.map(c => {
              const insight = c.status === 'sent' ? getCampaignInsight(c) : null;
              return (
                <div key={c.id} className="card campaign-row-card" style={{ padding: '20px' }}>
                  <div className="flex justify-between items-center">
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-8 mb-8">
                        <span style={{ fontWeight: 600, fontSize: '15px' }}>{c.name}</span>
                        <StatusBadge status={c.status} />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{CHANNEL_LABELS[c.channel]}</span>
                        {c.segment_name && <span className="badge badge-purple" style={{ fontSize: '11px' }}>{c.segment_name}</span>}
                      </div>
                      <CampaignStats stats={c.stats} />
                    </div>
                    <div className="flex gap-8">
                      {c.status === 'draft' && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleSend(c.id)} disabled={sending[c.id]}>
                          {sending[c.id] ? <Loader size={12} className="pulse" /> : <Send size={12} />}
                          {sending[c.id] ? 'Sending...' : 'Send Now'}
                        </button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  {c.stats && c.stats.total > 0 && (
                    <div style={{ marginTop: '14px' }}>
                      <div className="stat-bar" style={{ height: '8px' }}>
                        {[
                          { key: 'delivered', color: 'var(--green)' },
                          { key: 'opened', color: 'var(--accent)' },
                          { key: 'clicked', color: 'var(--yellow)' },
                          { key: 'failed', color: 'var(--red)' },
                        ].map(({ key, color }) => {
                          const val = (c.stats[key] || 0) + (key === 'delivered' ? (c.stats.opened || 0) + (c.stats.read || 0) + (c.stats.clicked || 0) : 0);
                          return (
                            <div key={key} style={{ display: 'inline-block', width: `${val / c.stats.total * 100}%`, height: '100%', background: color }} />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* NEW: AI insight strip — appears on hover for sent campaigns.
                      One-line, auto-derived from this campaign's stats. */}
                  {insight && (
                    <div className="ai-insight-strip">
                      <div className="flex items-center gap-8">
                        <TrendingUp size={12} />
                        <span>{insight}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* NEW: dashed "add campaign" card — opens the New Campaign
                modal directly, instead of being a dead click / re-nav. */}
            <div
              className="card campaign-add-card"
              onClick={openNewCampaignModal}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && openNewCampaignModal()}
            >
              <Plus size={22} />
              <span className="text-sm">Create new campaign</span>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }}>
            <h3 className="modal-title">New Campaign</h3>

            <div className="form-row">
              <label className="label">Campaign Name</label>
              <input className="input" placeholder="e.g. Re-engage lapsed buyers" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="form-grid">
              <div className="form-row">
                <label className="label">Audience Segment</label>
                <select className="select" value={form.segment_id} onChange={e => setForm(f => ({ ...f, segment_id: e.target.value }))}>
                  <option value="">Select segment...</option>
                  {segments.map(s => <option key={s.id} value={s.id}>{s.name} ({s.customer_count})</option>)}
                </select>
              </div>
              <div className="form-row">
                <label className="label">Channel</label>
                <select className="select" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                  {Object.entries(CHANNEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="flex justify-between items-center mb-8">
                <label className="label" style={{ margin: 0 }}>Message Template</label>
                <button className="btn btn-ghost btn-sm" onClick={handleAIMessage} disabled={aiMsgLoading || !form.segment_id}>
                  {aiMsgLoading ? <Loader size={12} className="pulse" /> : <Sparkles size={12} style={{ color: 'var(--accent)' }} />}
                  AI Draft
                </button>
              </div>
              <textarea className="textarea" rows={4} value={form.message_template} onChange={e => setForm(f => ({ ...f, message_template: e.target.value }))}
                placeholder="Hi {{name}}, we have something special for you..." />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>Use {'{{name}}'} for personalization</p>
            </div>

            {error && (
              <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: 'var(--red)' }}>
                {error}
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => { setShowModal(false); setError(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name || !form.segment_id || !form.message_template}>
                {saving ? <><div className="spinner" /> Saving...</> : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
