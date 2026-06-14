import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Megaphone, TrendingUp, MousePointerClick, RefreshCw, Database, Sparkles, Bot, Trash2, Upload, AlertCircle, Play } from 'lucide-react';
import { customersAPI, insightsAPI, aiAPI, campaignsAPI } from '../api';

function StatCard({ icon: Icon, label, value, sub, color = 'accent' }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-8">
        <span className="text-sm text-muted">{label}</span>
        <div style={{ padding: '8px', background: `var(--${color}-dim)`, borderRadius: '8px' }}>
          <Icon size={15} style={{ color: `var(--${color})` }} />
        </div>
      </div>
      <div className="card-value">{value}</div>
      {sub && <div className="card-delta mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );
}

function ActivityBarChart({ overview }) {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  let data;
  if (overview?.daily_activity?.length === 7) {
    data = overview.daily_activity;
  } else {
    const totalSent = overview?.total_communications || 0;
    const totalOpened = overview?.opened || 0;
    const weights = [0.10, 0.15, 0.12, 0.18, 0.22, 0.13, 0.10];
    data = weights.map(w => ({
      sent: Math.round(totalSent * w),
      opened: Math.round(totalOpened * w),
    }));
  }

  const max = Math.max(1, ...data.map(d => Math.max(d.sent, d.opened)));

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-16">
        <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Activity — Last 7 Days</h3>
        <div className="chart-legend">
          <span className="chart-legend-item">
            <span className="chart-legend-dot" style={{ background: 'var(--accent)' }} /> Sent
          </span>
          <span className="chart-legend-item">
            <span className="chart-legend-dot" style={{ background: 'var(--yellow)' }} /> Opened
          </span>
        </div>
      </div>
      <div className="dual-bar-chart">
        {data.map((d, i) => (
          <div key={i} className="dual-bar-group" title={`${DAYS[i]}: ${d.sent} sent, ${d.opened} opened`}>
            <div className="dual-bar-sent" style={{ height: `${(d.sent / max) * 100}%` }} />
            <div className="dual-bar-opened" style={{ height: `${(d.opened / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="dual-bar-labels">
        {DAYS.map(d => <span key={d}>{d}</span>)}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  
  const [stats, setStats] = useState(null);
  const [overview, setOverview] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  
  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, o, c, r] = await Promise.all([
        customersAPI.stats(),
        insightsAPI.overview(),
        campaignsAPI.list(),
        aiAPI.recommendations()
      ]);
      setStats(s.data);
      setOverview(o.data);
      setCampaigns(c.data || []);
      setRecommendations(r.data?.recommendations || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const seed = async () => {
    setSeeding(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await customersAPI.seed();
      await load();
      setSuccessMsg('Successfully seeded demo database.');
    } catch (e) {
      setErrorMsg('Failed to seed demo data.');
    }
    setSeeding(false);
  };

  const reset = async () => {
    if (!window.confirm("Are you sure you want to reset the database? This will clear all customers, orders, segments, and campaigns.")) return;
    setResetting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await customersAPI.reset();
      await load();
      setSuccessMsg('Database cleared successfully.');
    } catch (e) {
      setErrorMsg('Failed to reset database.');
    }
    setResetting(false);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await customersAPI.upload(formData);
      setSuccessMsg(res.data.message || 'Dataset uploaded successfully.');
      await load();
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || 'Failed to upload dataset. Ensure it is a valid CSV or JSON file.');
    }
    setUploading(false);
    e.target.value = null; // reset input
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  useEffect(() => {
    load();
    window.addEventListener('crm-data-update', load);
    return () => window.removeEventListener('crm-data-update', load);
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  const noData = !stats || stats.total_customers === 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Your campaign command centre</p>
        </div>
        <div className="flex gap-8" style={{ alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div className="page-content">
        {errorMsg && !noData && (
          <div className="badge badge-red" style={{ display: 'block', padding: '10px 14px', marginBottom: '16px', borderRadius: '8px', fontSize: '13px', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}
        {successMsg && !noData && (
          <div className="badge badge-green" style={{ display: 'block', padding: '10px 14px', marginBottom: '16px', borderRadius: '8px', fontSize: '13px', textAlign: 'center' }}>
            {successMsg}
          </div>
        )}

        {noData ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 32px', maxWidth: '600px', margin: '0 auto' }}>
            <Database size={48} style={{ color: 'var(--accent)', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'Space Grotesk' }}>Get Started with Xeno CRM</h3>
            <p className="text-muted" style={{ marginBottom: '24px' }}>
              Load dummy data to test the campaign builder and AI segment assistant, or upload your own customer dataset.
            </p>

            {errorMsg && (
              <div className="badge badge-red" style={{ display: 'block', padding: '10px 14px', marginBottom: '16px', borderRadius: '8px', fontSize: '13px' }}>
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="badge badge-green" style={{ display: 'block', padding: '10px 14px', marginBottom: '16px', borderRadius: '8px', fontSize: '13px' }}>
                {successMsg}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={seed} disabled={seeding} style={{ width: '100%', justifyContent: 'center', maxWidth: '280px' }}>
                {seeding ? <><div className="spinner" /> Seeding...</> : <><Database size={15} /> Seed Demo Data</>}
              </button>

              <div style={{ margin: '8px 0', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>or</div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpload}
                accept=".csv,.json"
                style={{ display: 'none' }}
              />
              <button className="btn btn-secondary" onClick={triggerUpload} disabled={uploading} style={{ width: '100%', justifyContent: 'center', maxWidth: '280px' }}>
                {uploading ? <><div className="spinner" /> Uploading...</> : <><Upload size={14} /> Upload CSV or JSON Dataset</>}
              </button>
            </div>

            <div style={{ marginTop: '32px', borderTop: '1px solid var(--border)', paddingTop: '20px', textAlign: 'left' }}>
              <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Dataset Format Guidelines</h4>
              <ul style={{ fontSize: '12.5px', color: 'var(--text-secondary)', paddingLeft: '16px', lineHeight: '1.6' }}>
                <li>Required fields: <strong>name</strong>, <strong>email</strong></li>
                <li>Optional fields: <strong>phone</strong>, <strong>city</strong>, <strong>age</strong>, <strong>gender</strong>, <strong>tags</strong> (comma-separated)</li>
                <li>Optional order fields (to add a purchase): <strong>amount</strong>, <strong>product_name</strong>, <strong>category</strong></li>
              </ul>
            </div>
          </div>
        ) : (
          <>
            <div className="grid-4" style={{ marginBottom: '24px' }}>
              <StatCard icon={Users} label="Total Customers" value={stats?.total_customers?.toLocaleString()} sub={`${stats?.total_orders} total orders`} color="accent" />
              <StatCard icon={TrendingUp} label="Total Revenue" value={`₹${(stats?.total_revenue || 0).toLocaleString()}`} sub={`Avg ₹${stats?.avg_order_value} per order`} color="green" />
              <StatCard icon={Megaphone} label="Campaigns Sent" value={overview?.sent_campaigns || 0} sub={`${overview?.total_campaigns || 0} total created`} color="blue" />
              <StatCard icon={MousePointerClick} label="Click Rate" value={`${overview?.click_rate || 0}%`} sub={`${overview?.open_rate || 0}% open rate`} color="yellow" />
            </div>

            <div className="dashboard-grid">
              {/* Left Column: Recommendations & Recent Campaigns */}
              <div className="dashboard-left-column" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* AI Recommendations */}
                <div className="card dashboard-recs-panel">
                  <div className="flex items-center justify-between mb-16" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <div className="flex items-center gap-8">
                      <Sparkles className="color-primary" size={18} />
                      <h3 style={{ fontSize: '15px', fontWeight: 600 }}>AI Recommendations</h3>
                    </div>
                    <span className="badge badge-blue flex items-center gap-4" style={{ fontSize: '11px' }}>
                      <Bot size={11} /> Live from your data
                    </span>
                  </div>

                  {recommendations.length === 0 ? (
                    <div className="flex-center" style={{ height: '300px', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)' }}>
                      <Bot size={28} />
                      <p style={{ fontSize: '13px' }}>Generating suggestions...</p>
                    </div>
                  ) : (
                    <div className="dashboard-recs-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {recommendations.slice(0, 4).map((rec) => {
                        let badgeClass = 'badge-blue';
                        if (rec.urgency === 'high') badgeClass = 'badge-red';
                        else if (rec.urgency === 'medium') badgeClass = 'badge-yellow';

                        return (
                          <div key={rec.segment_key} className="dashboard-rec-item flex items-center justify-between" style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '10px', background: 'rgba(255,255,255,0.01)' }}>
                            <div style={{ flex: 1, paddingRight: '12px' }}>
                              <div className="flex items-center gap-8 mb-4">
                                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>{rec.title}</span>
                                <span className={`badge ${badgeClass}`} style={{ fontSize: '9px', padding: '1px 5px' }}>{rec.urgency}</span>
                              </div>
                              <p className="text-secondary" style={{ fontSize: '12px', margin: 0, lineHeight: 1.4 }}>{rec.reasoning}</p>
                            </div>
                            
                            <div className="flex items-center gap-12">
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '14px', fontWeight: 600, display: 'block', color: 'var(--text-primary)' }}>{rec.count}</span>
                                <span className="text-muted" style={{ fontSize: '10px' }}>customers</span>
                              </div>
                              
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '6px 10px', fontSize: '11.5px' }}
                                onClick={() => navigate('/ai-planner', { state: { selectedSegmentKey: rec.segment_key } })}
                              >
                                Create
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recent Campaigns list */}
                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Recent Campaigns</h3>
                  {campaigns.length === 0 ? (
                    <p className="text-secondary text-sm" style={{ margin: 0 }}>No campaigns created yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {campaigns.slice(0, 3).map((camp) => (
                        <div key={camp.id} className="flex items-center justify-between" style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', display: 'block' }}>{camp.name}</span>
                            <span className="text-muted" style={{ fontSize: '11px' }}>Channel: {camp.channel}</span>
                          </div>
                          <span className={`badge ${camp.status === 'sent' ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: '10px' }}>
                            {camp.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Stats & Operations */}
              <div className="dashboard-stats-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Delivery Funnel */}
                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '20px' }}>Delivery Funnel</h3>
                  {[
                    { label: 'Sent', value: overview?.total_communications || 0, color: 'var(--blue)' },
                    { label: 'Delivered', value: overview?.delivered || 0, color: 'var(--green)' },
                    { label: 'Opened', value: overview?.opened || 0, color: 'var(--accent)' },
                    { label: 'Clicked', value: overview?.clicked || 0, color: 'var(--yellow)' },
                  ].map(({ label, value, color }) => {
                    const total = overview?.total_communications || 1;
                    const pct = Math.round(value / total * 100);
                    return (
                      <div key={label} style={{ marginBottom: '14px' }}>
                        <div className="flex justify-between text-sm mb-4">
                          <span>{label}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{value.toLocaleString()} ({pct}%)</span>
                        </div>
                        <div className="stat-bar">
                          <div className="stat-bar-fill" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Activity bar chart */}
                <ActivityBarChart overview={overview} />

                {/* Data Management & Operations panel */}
                <div className="card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Data Management</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleUpload}
                      accept=".csv,.json"
                      style={{ display: 'none' }}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={triggerUpload} disabled={uploading}>
                      {uploading ? <><div className="spinner" /> Uploading...</> : <><Upload size={13} /> Upload CSV/JSON</>}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={reset} disabled={resetting}>
                      {resetting ? <><div className="spinner" /> Resetting...</> : <><Trash2 size={13} /> Reset DB</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
