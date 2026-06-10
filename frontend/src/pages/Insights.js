import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { insightsAPI, aiAPI } from '../api';
import { Sparkles, RefreshCw } from 'lucide-react';

const CHANNEL_COLORS = { email: '#3b82f6', sms: '#22c55e', whatsapp: '#7c5cfc', rcs: '#f59e0b' };

export default function Insights() {
  const [performance, setPerformance] = useState([]);
  const [overview, setOverview] = useState(null);
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [p, o] = await Promise.all([insightsAPI.performance(), insightsAPI.overview()]);
      setPerformance(p.data);
      setOverview(o.data);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getAIInsight = async () => {
    if (!overview) return;
    setAiLoading(true);
    try {
      const res = await aiAPI.insights({
        stats: overview,
        campaign_name: 'Overall Campaign Performance'
      });
      setAiInsight(res.data.insight);
    } catch (e) {
      setAiInsight('AI insight unavailable — check API key configuration.');
    }
    setAiLoading(false);
  };

  const chartData = performance.map(c => ({
    name: c.name.length > 14 ? c.name.slice(0, 14) + '…' : c.name,
    delivered: c.delivered,
    opened: c.opened,
    clicked: c.clicked,
    failed: c.failed,
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Insights</h1>
          <p className="page-subtitle">Campaign performance analytics</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="page-content">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" style={{ margin: 'auto', width: 32, height: 32 }} /></div>
        ) : (
          <>
            <div className="grid-4" style={{ marginBottom: '24px' }}>
              {[
                { label: 'Delivery Rate', value: `${overview?.delivery_rate || 0}%`, color: 'var(--green)' },
                { label: 'Open Rate', value: `${overview?.open_rate || 0}%`, color: 'var(--accent)' },
                { label: 'Click Rate', value: `${overview?.click_rate || 0}%`, color: 'var(--yellow)' },
                { label: 'Total Sent', value: (overview?.total_communications || 0).toLocaleString(), color: 'var(--blue)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="card" style={{ textAlign: 'center' }}>
                  <div className="text-muted text-sm mb-8">{label}</div>
                  <div style={{ fontSize: '32px', fontWeight: 700, color, fontFamily: 'Space Grotesk' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* AI Insight */}
            <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, var(--bg-card), var(--bg-elevated))', borderColor: 'rgba(124,92,252,0.3)' }}>
              <div className="flex justify-between items-center mb-12">
                <div className="ai-badge"><Sparkles size={9} /> AI Performance Summary</div>
                <button className="btn btn-secondary btn-sm" onClick={getAIInsight} disabled={aiLoading}>
                  {aiLoading ? <><div className="spinner" /> Analysing...</> : <><Sparkles size={12} /> Generate Insight</>}
                </button>
              </div>
              {aiInsight ? (
                <p style={{ color: 'var(--text-primary)', lineHeight: '1.7', fontSize: '14px' }}>{aiInsight}</p>
              ) : (
                <p className="text-muted" style={{ fontStyle: 'italic' }}>Click "Generate Insight" for an AI-powered analysis of your campaign performance.</p>
              )}
            </div>

            {performance.length > 0 && (
              <div className="card" style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '20px' }}>Campaign Performance</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} barGap={2}>
                    <XAxis dataKey="name" tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: '8px', color: '#f0f0ff' }} />
                    <Bar dataKey="delivered" fill="#22c55e" radius={[4,4,0,0]} name="Delivered" />
                    <Bar dataKey="opened" fill="#7c5cfc" radius={[4,4,0,0]} name="Opened" />
                    <Bar dataKey="clicked" fill="#f59e0b" radius={[4,4,0,0]} name="Clicked" />
                    <Bar dataKey="failed" fill="#ef4444" radius={[4,4,0,0]} name="Failed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '14px' }}>Campaign Breakdown</h3>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Channel</th>
                    <th>Sent</th>
                    <th>Delivered</th>
                    <th>Opened</th>
                    <th>Clicked</th>
                    <th>Delivery Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td>
                        <span className="badge" style={{ background: `${CHANNEL_COLORS[c.channel]}22`, color: CHANNEL_COLORS[c.channel] }}>
                          {c.channel}
                        </span>
                      </td>
                      <td>{c.total}</td>
                      <td style={{ color: 'var(--green)' }}>{c.delivered}</td>
                      <td style={{ color: 'var(--accent)' }}>{c.opened}</td>
                      <td style={{ color: 'var(--yellow)' }}>{c.clicked}</td>
                      <td>
                        <div className="flex items-center gap-8">
                          <span>{c.delivery_rate}%</span>
                          <div className="stat-bar" style={{ width: '60px', margin: 0 }}>
                            <div className="stat-bar-fill" style={{ width: `${c.delivery_rate}%`, background: c.delivery_rate > 70 ? 'var(--green)' : 'var(--yellow)' }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {performance.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No campaign data yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
