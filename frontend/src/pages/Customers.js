import React, { useEffect, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { customersAPI } from '../api';

function channelBadge(channel) {
  const map = { email: '📧', sms: '💬', whatsapp: '📱', rcs: '🔷' };
  return map[channel] || channel;
}

export default function Customers() {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (s = '') => {
    setLoading(true);
    try {
      const res = await customersAPI.list({ search: s, limit: 50 });
      setData(res.data);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    const v = e.target.value;
    setSearch(v);
    const timer = setTimeout(() => load(v), 350);
    return () => clearTimeout(timer);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{data?.total || 0} shoppers in your database</p>
        </div>
      </div>
      <div className="page-content">
        <div className="card" style={{ marginBottom: '16px', padding: '12px 16px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input" style={{ paddingLeft: '34px' }} placeholder="Search by name or email..." value={search} onChange={handleSearch} />
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" style={{ margin: 'auto' }} /></div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>City</th>
                  <th>Age</th>
                  <th>Orders</th>
                  <th>Total Spend</th>
                  <th>Last Order</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {data?.customers?.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      <div className="text-xs text-muted mt-4">{c.email}</div>
                    </td>
                    <td className="text-muted">{c.city || '—'}</td>
                    <td className="text-muted">{c.age || '—'}</td>
                    <td><span className="badge badge-blue">{c.order_count}</span></td>
                    <td style={{ fontWeight: 500 }}>₹{c.total_spend?.toLocaleString()}</td>
                    <td className="text-muted text-sm">
                      {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td>
                      {(c.tags || []).map(t => (
                        <span key={t} className="tag">{t}</span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
