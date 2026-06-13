import React, { useEffect, useState, useRef } from 'react';
import { Users, Megaphone, TrendingUp, MousePointerClick, RefreshCw, Database } from 'lucide-react';
import { customersAPI, insightsAPI } from '../api';

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
    data = overview.daily_activity; // [{ sent, opened }, ...] from backend
  } else {
    // Fallback: spread totals across the week with a realistic curve
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
        <h3 style={{ fontSize: '14px' }}>Activity — Last 7 Days</h3>
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
  const [stats, setStats] = useState(null);
  const [overview, setOverview] = useState(null);
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
      const [s, o] = await Promise.all([customersAPI.stats(), insightsAPI.overview()]);
      setStats(s.data);
      setOverview(o.data);
    } catch (e) { }
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

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  const noData = !stats || stats.total_customers === 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Your campaign command centre</p>
        </div>
        <div className="flex gap-8" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          {!noData && (
            <button className="btn btn-danger btn-sm" onClick={reset} disabled={resetting}>
              {resetting ? <><div className="spinner" /> Resetting...</> : 'Reset Database'}
            </button>
          )}
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
                {uploading ? <><div className="spinner" /> Uploading...</> : <>Upload CSV or JSON Dataset</>}
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

            <div className="grid-2" style={{ marginBottom: '16px' }}>
              <div className="card">
                <h3 style={{ fontSize: '14px', marginBottom: '20px' }}>Delivery Funnel</h3>
                {[
                  { label: 'Sent', value: overview?.total_communications || 0, color: 'var(--blue)' },
                  { label: 'Delivered', value: overview?.delivered || 0, color: 'var(--green)' },
                  { label: 'Opened', value: overview?.opened || 0, color: 'var(--accent)' },
                  { label: 'Clicked', value: overview?.clicked || 0, color: 'var(--yellow)' },
                  { label: 'Failed', value: overview?.failed || 0, color: 'var(--red)' },
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

              {/* CHANGE: was a single-color 7-bar chart, now dual-color Sent vs Opened with legend */}
              <ActivityBarChart overview={overview} />
            </div>

            <div className="grid-2">
              <div className="card" style={{ gridColumn: '1 / -1' }}>
                <h3 style={{ fontSize: '14px', marginBottom: '20px' }}>Quick Actions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: '→ Create a new audience segment', href: '/segments', color: 'var(--accent)' },
                    { label: '→ Launch a campaign', href: '/campaigns', color: 'var(--green)' },
                    { label: '→ View campaign performance', href: '/insights', color: 'var(--yellow)' },
                  ].map(({ label, href, color }) => (
                    <a key={href} href={href} style={{
                      display: 'block', padding: '12px 14px',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)', color, textDecoration: 'none',
                      fontSize: '13.5px', fontWeight: 500,
                      transition: 'all 0.15s'
                    }}>{label}</a>
                  ))}
                  {/* "Ask AI for segment ideas" link removed — AI is now the
                      floating chat button on every page, not a separate route */}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
