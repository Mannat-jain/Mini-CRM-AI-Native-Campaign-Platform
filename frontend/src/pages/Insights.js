import React, { useEffect, useState } from 'react';
import { insightsAPI, aiAPI } from '../api';
import { Sparkles, RefreshCw, Search, MessageSquare, Info, AlertCircle, CheckCircle, Mail, Phone, MessageCircle } from 'lucide-react';

const CHANNEL_BADGES = {
  email: { label: 'Email', icon: Mail, color: 'var(--blue)', bg: 'var(--blue-dim)' },
  sms: { label: 'SMS', icon: MessageSquare, color: 'var(--green)', bg: 'var(--green-dim)' },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: 'var(--accent)', bg: 'var(--accent-dim)' },
  rcs: { label: 'RCS', icon: MessageSquare, color: 'var(--yellow)', bg: 'var(--yellow-dim)' },
};

const STATUS_BADGES = {
  delivered: 'badge-green',
  opened: 'badge-purple',
  read: 'badge-purple',
  clicked: 'badge-blue',
  failed: 'badge-red',
  sent: 'badge-gray',
  queued: 'badge-gray',
};

const mockComms = [
  { id: 'm1', customer_name: 'Priya Sharma', campaign_name: 'Festive sale blast', channel: 'whatsapp', status: 'delivered', time: '2m ago' },
  { id: 'm2', customer_name: 'Arjun Mehta', campaign_name: 'Premium re-engagement', channel: 'email', status: 'opened', time: '5m ago' },
  { id: 'm3', customer_name: 'Sneha Patel', campaign_name: 'One-time buyer nudge', channel: 'sms', status: 'clicked', time: '8m ago' },
  { id: 'm4', customer_name: 'Rohan Singh', campaign_name: 'VIP loyalty reward', channel: 'rcs', status: 'failed', time: '15m ago' },
  { id: 'm5', customer_name: 'Kavya Nair', campaign_name: 'Festive sale blast', channel: 'whatsapp', status: 'sent', time: '22m ago' },
  { id: 'm6', customer_name: 'Aditya Joshi', campaign_name: 'Premium re-engagement', channel: 'email', status: 'read', time: '31m ago' },
  { id: 'm7', customer_name: 'Meera Iyer', campaign_name: 'One-time buyer nudge', channel: 'sms', status: 'delivered', time: '44m ago' },
  { id: 'm8', customer_name: 'Vikram Rao', campaign_name: 'VIP loyalty reward', channel: 'rcs', status: 'opened', time: '58m ago' },
  { id: 'm9', customer_name: 'Ananya Gupta', campaign_name: 'Festive sale blast', channel: 'whatsapp', status: 'clicked', time: '72m ago' },
  { id: 'm10', customer_name: 'Riya Kapoor', campaign_name: 'Premium re-engagement', channel: 'email', status: 'failed', time: '90m ago' },
  { id: 'm11', customer_name: 'Priya Sharma', campaign_name: 'One-time buyer nudge', channel: 'sms', status: 'sent', time: '110m ago' }
];

export default function Insights() {
  const [performance, setPerformance] = useState([]);
  const [overview, setOverview] = useState(null);
  const [commsLog, setCommsLog] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [p, o, c] = await Promise.all([
        insightsAPI.performance(),
        insightsAPI.overview(),
        insightsAPI.communications()
      ]);
      setPerformance(p.data || []);
      setOverview(o.data || null);
      setCommsLog(c.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const getAIInsight = async () => {
    if (!overview) return;
    setAiLoading(true);
    setShowAiSummary(true);
    try {
      const res = await aiAPI.insights({
        stats: overview,
        campaign_name: 'Overall Campaign Performance'
      });
      setAiInsight(res.data.insight);
    } catch (e) {
      setAiInsight('AI performance analysis is temporarily unavailable. Verify your Groq API configuration.');
    }
    setAiLoading(false);
  };

  // 1. Stat Cards Metrics
  const totalSent = overview?.total_communications ?? 0;
  const delivered = overview?.delivered ?? 0;
  const opened = overview?.opened ?? 0;
  const clicked = overview?.clicked ?? 0;

  const deliveryRate = overview?.total_communications ? overview.delivery_rate : 0;
  const openRate = overview?.delivered ? overview.open_rate : 0;
  const clickRate = overview?.opened ? overview.click_rate : 0;

  // 2. Sent by Channel progress bars data
  const getChannelStats = () => {
    const channelTotals = { whatsapp: 0, email: 0, sms: 0, rcs: 0 };
    if (performance && performance.length > 0) {
      performance.forEach(c => {
        const ch = (c.channel || '').toLowerCase();
        if (channelTotals.hasOwnProperty(ch)) {
          channelTotals[ch] += c.total || 0;
        }
      });
    }

    return [
      { label: 'WhatsApp', value: channelTotals.whatsapp, color: 'var(--accent)' },
      { label: 'Email', value: channelTotals.email, color: 'var(--yellow)' },
      { label: 'SMS', value: channelTotals.sms, color: 'var(--green)' },
      { label: 'RCS', value: channelTotals.rcs, color: 'var(--blue)' }
    ];
  };

  const channelStats = getChannelStats();
  const maxChannelVal = Math.max(1, ...channelStats.map(c => c.value));

  // 3. Activity (last 7 days) data
  const activityData = overview?.daily_activity || [
    { day: 'Mon', val: 0, active: false },
    { day: 'Tue', val: 0, active: false },
    { day: 'Wed', val: 0, active: false },
    { day: 'Thu', val: 0, active: false },
    { day: 'Fri', val: 0, active: false },
    { day: 'Sat', val: 0, active: false },
    { day: 'Sun', val: 0, active: false }
  ];

  // 4. Communication Log list
  const getLogData = () => {
    if (commsLog && commsLog.length > 0) {
      return commsLog.map(c => {
        // Formulate relative time or format date
        const date = new Date(c.sent_at);
        const diffMs = new Date() - date;
        const diffMins = Math.max(1, Math.floor(diffMs / 60000));
        let timeStr = `${diffMins}m ago`;
        if (diffMins >= 60) {
          const hrs = Math.floor(diffMins / 60);
          timeStr = hrs === 1 ? '1h ago' : `${hrs}h ago`;
          if (hrs >= 24) timeStr = date.toLocaleDateString();
        }
        return {
          id: c.id,
          customer_name: c.customer_name,
          campaign_name: c.campaign_name,
          channel: c.channel,
          status: c.status,
          time: timeStr
        };
      });
    }
    return [];
  };

  const logData = getLogData();

  // Filter logs based on search query
  const filteredLogs = logData.filter(log => {
    const query = searchQuery.toLowerCase();
    return (
      log.customer_name.toLowerCase().includes(query) ||
      log.campaign_name.toLowerCase().includes(query) ||
      log.channel.toLowerCase().includes(query) ||
      log.status.toLowerCase().includes(query)
    );
  });

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Insights</h1>
          <p className="page-subtitle">Communication events and engagement tracking</p>
        </div>
        <div className="flex gap-8" style={{ alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm flex items-center gap-4"
            onClick={getAIInsight}
            disabled={aiLoading}
          >
            <Sparkles size={13} className="color-primary" />
            AI summary
          </button>
          <button className="btn btn-secondary btn-sm" onClick={load}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* AI Performance summary expansion */}
        {showAiSummary && (
          <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, var(--bg-card), var(--bg-elevated))', borderColor: 'rgba(124,92,252,0.3)' }}>
            <div className="flex justify-between items-center mb-12">
              <div className="ai-badge"><Sparkles size={9} /> AI Performance Summary</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAiSummary(false)} style={{ fontSize: '11px' }}>Hide</button>
            </div>
            {aiLoading ? (
              <div className="flex items-center gap-8 py-8">
                <div className="spinner" style={{ width: 14, height: 14 }} />
                <span className="text-secondary text-sm">Analyzing campaign statistics...</span>
              </div>
            ) : (
              <p style={{ color: 'var(--text-primary)', lineHeight: '1.7', fontSize: '13.5px', margin: 0 }}>{aiInsight}</p>
            )}
          </div>
        )}

        {/* Row 1: 4 Stat Cards */}
        <div className="grid-4" style={{ marginBottom: '24px' }}>
          <div className="card">
            <span className="text-sm text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>TOTAL SENT</span>
            <div className="card-value" style={{ fontSize: '26px', margin: '8px 0 4px', fontWeight: 700 }}>{totalSent.toLocaleString()}</div>
            <div className="text-sm text-muted">All time</div>
          </div>

          <div className="card">
            <span className="text-sm text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>DELIVERED</span>
            <div className="card-value" style={{ fontSize: '26px', margin: '8px 0 4px', fontWeight: 700 }}>{delivered.toLocaleString()}</div>
            <div className="text-sm" style={{ color: 'var(--green)', fontWeight: 500 }}>{deliveryRate}% delivery rate</div>
          </div>

          <div className="card">
            <span className="text-sm text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>OPENED</span>
            <div className="card-value" style={{ fontSize: '26px', margin: '8px 0 4px', fontWeight: 700 }}>{opened.toLocaleString()}</div>
            <div className="text-sm" style={{ color: 'var(--accent)', fontWeight: 500 }}>{openRate}% open rate</div>
          </div>

          <div className="card">
            <span className="text-sm text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>CLICKED</span>
            <div className="card-value" style={{ fontSize: '26px', margin: '8px 0 4px', fontWeight: 700 }}>{clicked.toLocaleString()}</div>
            <div className="text-sm" style={{ color: 'var(--yellow)', fontWeight: 500 }}>{clickRate}% click rate</div>
          </div>
        </div>

        {/* Row 2: Channel Breakdown and 7-day Activity */}
        <div className="grid-2" style={{ marginBottom: '24px' }}>
          {/* Channel Breakdown */}
          <div className="card">
            <div className="flex items-center gap-8 mb-16">
              <Sparkles size={16} className="color-primary" />
              <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Sent by channel</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {channelStats.map(c => {
                const pct = Math.round((c.value / maxChannelVal) * 100);
                return (
                  <div key={c.label}>
                    <div className="flex justify-between text-sm mb-4">
                      <span style={{ fontWeight: 500 }}>{c.label}</span>
                      <span style={{ fontWeight: 600 }}>{c.value.toLocaleString()}</span>
                    </div>
                    <div className="stat-bar" style={{ height: '8px', margin: 0 }}>
                      <div className="stat-bar-fill" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity last 7 days */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between mb-16">
              <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Activity (last 7 days)</h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '110px', padding: '0 10px', flex: 1 }}>
              {activityData.map(d => (
                <div key={d.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '28px', marginBottom: '8px' }}>
                    <div style={{
                      width: '100%',
                      height: `${d.val}%`,
                      background: d.active ? 'var(--accent)' : 'rgba(124, 92, 252, 0.15)',
                      borderRadius: '6px',
                      transition: 'all 0.2s'
                    }} title={`${d.day}: ${d.val}% activity`} />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{d.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Communication Log Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="flex items-center justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-8">
              <MessageSquare size={16} className="color-primary" />
              <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Communication log</h3>
            </div>
            
            <div style={{ position: 'relative', width: '240px' }}>
              <Search size={14} className="text-muted" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search events..."
                className="input"
                style={{ paddingLeft: '32px', height: '32px', fontSize: '13px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>CUSTOMER</th>
                  <th>CAMPAIGN</th>
                  <th>CHANNEL</th>
                  <th>STATUS</th>
                  <th>TIME</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => {
                  const chInfo = CHANNEL_BADGES[log.channel] || { label: log.channel, icon: MessageSquare, color: 'var(--text-secondary)', bg: 'var(--bg-elevated)' };
                  const ChIcon = chInfo.icon;
                  const statusClass = STATUS_BADGES[log.status] || 'badge-gray';

                  return (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600 }}>{log.customer_name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{log.campaign_name}</td>
                      <td>
                        <span className="badge flex items-center gap-4" style={{ background: chInfo.bg, color: chInfo.color, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', border: `1px solid rgba(${chInfo.color === 'var(--accent)' ? '124,92,252' : chInfo.color === 'var(--green)' ? '34,197,94' : chInfo.color === 'var(--blue)' ? '59,130,246' : '245,158,11'}, 0.2)` }}>
                          <ChIcon size={11} /> {chInfo.label}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${statusClass}`} style={{ fontSize: '11px' }}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>{log.time}</td>
                    </tr>
                  );
                })}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                      {searchQuery ? "No communications match your search" : "No communication log events found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
