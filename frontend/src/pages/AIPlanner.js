import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { aiAPI, segmentsAPI, campaignsAPI } from '../api';
import { Sparkles, Send, Bot, AlertCircle, CheckCircle, Info } from 'lucide-react';

const SEGMENT_SQLS = {
  inactive_high_value: `SELECT DISTINCT c.id FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id HAVING SUM(o.amount) > 5000 AND c.id NOT IN (SELECT DISTINCT customer_id FROM orders WHERE ordered_at > date('now', '-60 days'))`,
  one_time_buyers: `SELECT DISTINCT c.id FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id HAVING COUNT(o.id) = 1 AND MAX(o.ordered_at) < date('now', '-30 days')`,
  vip_customers: `SELECT DISTINCT c.id FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id HAVING SUM(o.amount) > 20000`,
  new_customers: `SELECT DISTINCT id FROM customers WHERE created_at > date('now', '-30 days')`,
  quiet_repeat_buyers: `SELECT DISTINCT c.id FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id HAVING COUNT(o.id) >= 2 AND MAX(o.ordered_at) BETWEEN date('now', '-90 days') AND date('now', '-30 days')`,
  churn_risk_medium: `SELECT DISTINCT c.id FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id HAVING SUM(o.amount) BETWEEN 1000 AND 5000 AND c.id NOT IN (SELECT DISTINCT customer_id FROM orders WHERE ordered_at > date('now', '-30 days'))`,
  recent_high_spenders: `SELECT DISTINCT c.id FROM customers c JOIN orders o ON o.customer_id = c.id WHERE o.ordered_at > date('now', '-30 days') GROUP BY c.id HAVING SUM(o.amount) > 3000`,
  quiet_vips: `SELECT DISTINCT c.id FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id HAVING SUM(o.amount) > 10000 AND c.id NOT IN (SELECT DISTINCT customer_id FROM orders WHERE ordered_at > date('now', '-45 days'))`,
  inactive_new_signups: `SELECT DISTINCT id FROM customers WHERE created_at > date('now', '-60 days') AND id NOT IN (SELECT DISTINCT customer_id FROM orders)`
};

export default function AIPlanner() {
  const location = useLocation();
  const navigate = useNavigate();

  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRec, setSelectedRec] = useState(null);

  // Campaign Form State
  const [campaignName, setCampaignName] = useState('');
  const [channel, setChannel] = useState('email');
  const [goal, setGoal] = useState('');
  const [message, setMessage] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [launching, setLaunching] = useState(false);
  
  // Feedback messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch recommendations on mount
  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await aiAPI.recommendations();
      const recs = res.data.recommendations || [];
      setRecommendations(recs);

      // Handle selection (either from location state or default to first item)
      const stateKey = location.state?.selectedSegmentKey;
      let selection = recs[0] || null;
      if (stateKey) {
        const found = recs.find(r => r.segment_key === stateKey);
        if (found) selection = found;
      }
      handleSelectRecommendation(selection);
    } catch (e) {
      setError('Failed to fetch recommendations. Ensure the backend is running and Groq API key is set.');
    }
    setLoading(false);
  };

  const handleSelectRecommendation = (rec) => {
    setSelectedRec(rec);
    if (rec) {
      setCampaignName(`${rec.title} - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
      setChannel(rec.suggested_channel || 'email');
      setGoal(`Promote relevant offers to this audience to increase repeat purchases.`);
      setMessage('');
      setError('');
      setSuccess('');
    }
  };

  // Call the AI message drafting endpoint
  const handleDraftMessage = async () => {
    if (!selectedRec) return;
    setDrafting(true);
    setError('');
    try {
      const res = await aiAPI.message({
        segment_description: selectedRec.reasoning,
        campaign_goal: goal || 'Increase orders and reward customer loyalty.',
        channel: channel
      });
      setMessage(res.data.message);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to draft AI message. Check your Groq API key.');
    }
    setDrafting(false);
  };

  // Launch the campaign (registers segment + creates campaign)
  const handleLaunchCampaign = async () => {
    if (!selectedRec || !campaignName.trim() || !message.trim()) {
      setError('Please provide a campaign name and message copy.');
      return;
    }

    setLaunching(true);
    setError('');
    try {
      // 1. Fetch current segments to see if we already have one with the matching query
      const segmentsRes = await segmentsAPI.list();
      const segments = segmentsRes.data || [];
      const queryToFind = SEGMENT_SQLS[selectedRec.segment_key];
      
      let targetSegment = segments.find(s => s.sql_query === queryToFind);

      // 2. Create segment if it doesn't exist yet
      if (!targetSegment) {
        const segmentName = `AI Segment: ${selectedRec.title}`;
        const newSegRes = await segmentsAPI.create({
          name: segmentName,
          description: selectedRec.reasoning,
          sql_query: queryToFind
        });
        targetSegment = newSegRes.data;
      }

      // 3. Create the campaign
      await campaignsAPI.create({
        name: campaignName,
        segment_id: targetSegment.id,
        message_template: message,
        channel: channel
      });

      setSuccess('Campaign created successfully! Redirecting...');
      setTimeout(() => {
        navigate('/campaigns');
      }, 1500);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to launch campaign. Verify SQL validity.');
    }
    setLaunching(false);
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '15px' }}>
        <div className="spinner" />
        <p className="text-secondary">Analyzing database metrics and preparing suggestions...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="page-title flex items-center gap-8">
            <Sparkles className="color-primary" size={24} /> AI Planner
          </h1>
          <p className="page-subtitle">AI analysis of live CRM database suggesting optimized customer campaigns.</p>
        </div>
      </div>

      <div className="page-content">
        {recommendations.length === 0 ? (
          <div className="card text-center" style={{ padding: '48px 24px' }}>
            <AlertCircle size={40} className="color-warning" style={{ margin: '0 auto 16px' }} />
            <h3>No recommendations available</h3>
            <p className="text-secondary" style={{ maxWidth: '400px', margin: '0 auto 16px' }}>
              We couldn't generate recommendations. Ensure you have seeded customers and orders in the database.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Go to Dashboard to Seed Data
            </button>
          </div>
        ) : (
          <div className="planner-grid">
            {/* Left Panel: Recommendations List */}
            <div className="planner-list-panel">
              <div className="panel-title flex items-center gap-8" style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                <Bot size={16} /> CAMPAIGN OPPORTUNITIES ({recommendations.length})
              </div>
              
              <div className="planner-cards-stack">
                {recommendations.map((rec) => {
                  const isSelected = selectedRec?.segment_key === rec.segment_key;
                  let badgeClass = 'badge-blue';
                  if (rec.urgency === 'high') badgeClass = 'badge-red';
                  else if (rec.urgency === 'medium') badgeClass = 'badge-yellow';

                  return (
                    <div
                      key={rec.segment_key}
                      className={`planner-rec-card ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectRecommendation(rec)}
                    >
                      <div className="planner-rec-card-header">
                        <span className={`badge ${badgeClass}`}>{rec.urgency.toUpperCase()}</span>
                        <span className="planner-rec-count">{rec.count} customers</span>
                      </div>
                      <h3 className="planner-rec-title">{rec.title}</h3>
                      <p className="planner-rec-reasoning">{rec.reasoning}</p>
                      <div className="planner-rec-channel">
                        Suggested channel: <span className="channel-highlight">{rec.suggested_channel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Panel: Campaign Sandbox */}
            <div className="planner-sandbox-panel">
              {selectedRec ? (
                <div className="card" style={{ height: '100%', border: 'none', background: 'transparent', padding: 0 }}>
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                      <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Configure Campaign</h2>
                      <span className="text-secondary flex items-center gap-4" style={{ fontSize: '12px' }}>
                        <Info size={14} /> Target: <strong>{selectedRec.count} customers</strong>
                      </span>
                    </div>
                    <p className="text-secondary" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                      This will create a segment named <strong>"AI Segment: {selectedRec.title}"</strong> and construct the following campaign.
                    </p>
                  </div>

                  {error && (
                    <div className="alert alert-danger flex items-center gap-8" style={{ marginBottom: '20px' }}>
                      <AlertCircle size={16} />
                      <span>{error}</span>
                    </div>
                  )}

                  {success && (
                    <div className="alert alert-success flex items-center gap-8" style={{ marginBottom: '20px' }}>
                      <CheckCircle size={16} />
                      <span>{success}</span>
                    </div>
                  )}

                  <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="label">Campaign Name</label>
                      <input
                        type="text"
                        className="input"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        placeholder="Enter a descriptive campaign name"
                      />
                    </div>

                    <div className="form-group">
                      <label className="label">Suggested Channel</label>
                      <select
                        className="select"
                        value={channel}
                        onChange={(e) => setChannel(e.target.value)}
                      >
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="rcs">RCS</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="label">Campaign Goal</label>
                      <input
                        type="text"
                        className="input"
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        placeholder="e.g. Reward loyal users, win-back"
                      />
                    </div>
                  </div>

                  {/* AI copywriting draft card */}
                  <div className="ai-copywriter-sandbox" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', padding: '16px', marginBottom: '24px' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                      <span className="flex items-center gap-6" style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                        <Bot size={16} className="color-primary" /> AI Copywriter
                      </span>
                      <button
                        className="btn btn-secondary btn-sm flex items-center gap-6"
                        onClick={handleDraftMessage}
                        disabled={drafting}
                      >
                        <Sparkles size={12} />
                        {drafting ? 'Drafting...' : 'Generate Copy'}
                      </button>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="label" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Campaign Copy Template (Supports {"{{name}}"} placeholder)</label>
                      <textarea
                        className="textarea"
                        rows={5}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Write your campaign message template here, or click 'Generate Copy' to draft it with AI..."
                        style={{ fontSize: '13px', lineHeight: 1.6 }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-12" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <button
                      className="btn btn-ghost"
                      onClick={() => handleSelectRecommendation(selectedRec)}
                    >
                      Reset Form
                    </button>
                    <button
                      className="btn btn-primary flex items-center gap-8"
                      onClick={handleLaunchCampaign}
                      disabled={launching || !campaignName.trim() || !message.trim()}
                    >
                      <Send size={14} />
                      {launching ? 'Creating...' : 'Approve & Create'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-center" style={{ height: '400px', flexDirection: 'column', gap: '8px' }}>
                  <Info size={32} className="text-secondary" />
                  <p className="text-secondary">Select a recommendation from the left to start planning.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
