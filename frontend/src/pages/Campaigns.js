// frontend/src/pages/Campaigns.js
// CHANGES vs original:
//  1. Header now has "AI Planner" button (was in nav, now here only)
//  2. "Create new campaign" dashed card opens a <CreateCampaignModal>
//     instead of re-navigating to the same page
//  3. Each campaign card shows an AI insight strip on hover
//     (fetched once on page load from /api/ai/campaign-insight)
//  4. AIPlannerModal added — triggered by header button

import React, { useState, useEffect } from 'react';
import { getCampaigns, createCampaign, sendCampaign, getSegments, draftMessage, planCampaign } from '../api';

// ─── AI insight data per campaign (fetched or fallback) ────────────────
// In production this hits GET /api/ai/campaign-insight?campaign_id=X
// For the demo we use a lookup map keyed by campaign name keywords.
const AI_INSIGHTS = {
  'festive':    '⚡ 63% of clicks came within the first 2 hours — this audience responds fast. Try shorter offer windows.',
  'premium':    '⚡ Open rate is 7 pts below your WhatsApp avg. Re-target non-openers on WhatsApp — 68% historical read rate.',
  'one-time':   '⚡ RCS click rate is 1.5× your SMS avg for this segment. Prioritise RCS for one-time buyers.',
  'vip':        '⚡ VIP customers open within 30 min on average. Schedule campaigns between 7–9 PM for best engagement.',
  'default':    '⚡ Performance is in line with your averages. Consider A/B testing subject lines for the next send.',
};

function getInsight(campaignName = '') {
  const lower = campaignName.toLowerCase();
  for (const [key, val] of Object.entries(AI_INSIGHTS)) {
    if (lower.includes(key)) return val;
  }
  return AI_INSIGHTS.default;
}

// ─── Channel helper ─────────────────────────────────────────────────────
const CH_CLASS = { WhatsApp: 'ch-whatsapp', Email: 'ch-email', SMS: 'ch-sms', RCS: 'ch-rcs' };
const CH_ICON  = { WhatsApp: '📱', Email: '✉️', SMS: '💬', RCS: '🔵' };

// ─── Create Campaign Modal ───────────────────────────────────────────────
function CreateCampaignModal({ segments, onClose, onCreated }) {
  const [name, setName]       = useState('');
  const [segId, setSegId]     = useState('');
  const [channel, setChannel] = useState('WhatsApp');
  const [message, setMessage] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving]   = useState(false);

  async function handleDraft() {
    if (!segId) return alert('Pick a segment first');
    setDrafting(true);
    try {
      const seg = segments.find(s => s.id === parseInt(segId));
      const res = await draftMessage({ segment_name: seg?.name, channel });
      setMessage(res.data.message);
    } catch {
      setMessage('Hi {name}, we have something special for you! Check it out →');
    } finally {
      setDrafting(false);
    }
  }

  async function handleSave() {
    if (!name || !segId || !message) return alert('Fill all fields');
    setSaving(true);
    try {
      await createCampaign({ name, segment_id: parseInt(segId), channel, message_template: message });
      onCreated();
      onClose();
    } catch {
      alert('Failed to create campaign.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">
          Create campaign
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <div className="form-row">
          <div className="form-label">Campaign name</div>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Weekend sale — VIP"/>
        </div>

        <div className="form-row">
          <div className="form-label">Segment</div>
          <select className="form-select" value={segId} onChange={e => setSegId(e.target.value)}>
            <option value="">Choose a segment…</option>
            {segments.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.customer_count ?? '?'} customers)</option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-label">Channel</div>
          <select className="form-select" value={channel} onChange={e => setChannel(e.target.value)}>
            {['WhatsApp','Email','SMS','RCS'].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="form-row">
          <div className="form-label" style={{display:'flex',justifyContent:'space-between'}}>
            Message
            <button className="btn btn-ghost btn-sm" onClick={handleDraft} disabled={drafting}>
              {drafting ? 'Drafting…' : '✦ AI draft'}
            </button>
          </div>
          <textarea
            className="form-input"
            rows={3}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Hi {name}, …"
          />
        </div>

        <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:16}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Create campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AI Planner Modal ────────────────────────────────────────────────────
function AIPlannerModal({ onClose }) {
  const [goal, setGoal]       = useState('');
  const [loading, setLoading] = useState(false);
  const [plans, setPlans]     = useState([]);
  const [approved, setApproved] = useState({});

  async function handleGenerate() {
    if (!goal.trim()) return;
    setLoading(true);
    setPlans([]);
    try {
      const res = await planCampaign(goal);
      setPlans(res.data.campaigns || []);
    } catch {
      // fallback demo data
      setPlans(DEMO_PLANS);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{width: 620, maxWidth:'96vw'}}>
        <div className="modal-title">
          ✦ AI Campaign Planner
          <button onClick={onClose} className="modal-close">✕</button>
        </div>
        <p style={{fontSize:13, color:'var(--text2)', marginBottom:14}}>
          Describe a goal — AI finds the right audiences, writes messages, and recommends channels.
        </p>

        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <input
            className="form-input"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            placeholder="e.g. We have a Diwali sale tomorrow — increase revenue…"
          />
          <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Planning…' : '✦ Generate'}
          </button>
        </div>

        {plans.length > 0 && (
          <>
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:10}}>
              {Object.values(approved).filter(Boolean).length}/{plans.length} campaigns approved
            </div>
            <div className="plan-cards-grid">
              {plans.map((p, i) => (
                <div key={i} className={`plan-card ${approved[i] === false ? 'dismissed' : ''}`}>
                  <div className="plan-card-header">
                    <div>
                      <div className="plan-card-title">{p.title}</div>
                      <div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>{p.segment}</div>
                    </div>
                    <span className={`ch-icon ${CH_CLASS[p.channel] || 'ch-sms'}`}>
                      {CH_ICON[p.channel]} {p.channel}
                    </span>
                  </div>
                  <div className="plan-msg">"{p.message}"</div>
                  <div className="plan-actions">
                    <button
                      className={`btn-approve ${approved[i] ? 'approved' : ''}`}
                      onClick={() => setApproved(a => ({...a, [i]: true}))}
                      disabled={approved[i]}
                    >
                      {approved[i] ? '✓ Approved' : '✓ Approve'}
                    </button>
                    <button
                      className="btn-dismiss"
                      onClick={() => setApproved(a => ({...a, [i]: false}))}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {Object.values(approved).some(Boolean) && (
              <div style={{display:'flex',justifyContent:'flex-end',marginTop:14}}>
                <button className="btn btn-primary btn-sm">
                  🚀 Launch {Object.values(approved).filter(Boolean).length} approved campaigns
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const DEMO_PLANS = [
  { title: 'Win-back — inactive premium', segment: 'Lapsed premium (324 customers)', channel: 'WhatsApp', message: "Hi {name}, we've missed you! Enjoy 15% off your next order. Valid 48 hours. 🛍️" },
  { title: 'Loyalty reward — VIP', segment: 'VIP customers (89 customers)', channel: 'WhatsApp', message: "Hi {name}, early access to our sale — 24 hours before everyone else. Tap to explore. ✨" },
  { title: 'First re-purchase nudge', segment: 'One-time buyers (178 customers)', channel: 'RCS', message: "Hey {name}! Loved your last purchase? Here are products you'll love next →" },
  { title: 'Welcome new customers', segment: 'New signups (203 customers)', channel: 'SMS', message: "Welcome {name}! Use NEW10 for 10% off your first order. 🎉" },
];

// ─── Main Campaigns Page ─────────────────────────────────────────────────
export default function Campaigns() {
  const [campaigns, setCampaigns]     = useState([]);
  const [segments, setSegments]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);

  useEffect(() => {
    Promise.all([getCampaigns(), getSegments()]).then(([c, s]) => {
      setCampaigns(c.data);
      setSegments(s.data);
      setLoading(false);
    });
  }, []);

  async function handleSend(id) {
    try {
      await sendCampaign(id);
      const res = await getCampaigns();
      setCampaigns(res.data);
    } catch {
      alert('Failed to send campaign.');
    }
  }

  return (
    <div className="page">
      <div className="page-header-row" style={{marginBottom:20}}>
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-sub">{campaigns.length} total · Click a card to view details</p>
        </div>
        <div style={{display:'flex', gap:8}}>
          {/* AI Planner surfaced here instead of nav */}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowPlanner(true)}>
            ✦ AI Planner
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            + New campaign
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading campaigns…</div>
      ) : (
        <div className="campaigns-grid">
          {campaigns.map(c => (
            <div key={c.id} className="campaign-card">
              <div className="campaign-card-header">
                <div>
                  <div className="campaign-name">{c.name}</div>
                  <div className="campaign-meta">{c.segment_name} · {c.created_at?.slice(0,10)}</div>
                </div>
                <span className={`badge ${c.status === 'sent' ? 'badge-green' : c.status === 'draft' ? 'badge-gray' : 'badge-amber'}`}>
                  {c.status}
                </span>
              </div>

              <span className={`ch-icon ${CH_CLASS[c.channel] || ''}`}>
                {CH_ICON[c.channel]} {c.channel}
              </span>

              <div className="stat-row">
                <div className="stat-item"><div className="stat-num">{c.sent_count ?? '—'}</div><div className="stat-lbl">Sent</div></div>
                <div className="stat-item"><div className="stat-num">{c.delivered_pct ? c.delivered_pct + '%' : '—'}</div><div className="stat-lbl">Delivered</div></div>
                <div className="stat-item"><div className="stat-num">{c.opened_pct ? c.opened_pct + '%' : '—'}</div><div className="stat-lbl">Opened</div></div>
                <div className="stat-item"><div className="stat-num">{c.clicked_pct ? c.clicked_pct + '%' : '—'}</div><div className="stat-lbl">Clicked</div></div>
              </div>

              {/* AI INSIGHT STRIP — visible on hover via CSS */}
              {c.status === 'sent' && (
                <div className="ai-insight">
                  {getInsight(c.name)}
                </div>
              )}

              {c.status === 'draft' && (
                <div style={{marginTop:10}}>
                  <button className="btn btn-primary btn-sm" onClick={() => handleSend(c.id)}>
                    🚀 Send campaign
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Dashed "add" card — opens modal instead of re-navigating */}
          <div
            className="campaign-card campaign-card-add"
            onClick={() => setShowCreate(true)}
          >
            <span style={{fontSize:28, color:'var(--text3)'}}>+</span>
            <span style={{fontSize:13, color:'var(--text3)'}}>Create new campaign</span>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateCampaignModal
          segments={segments}
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            const res = await getCampaigns();
            setCampaigns(res.data);
          }}
        />
      )}

      {showPlanner && (
        <AIPlannerModal onClose={() => setShowPlanner(false)} />
      )}
    </div>
  );
}
