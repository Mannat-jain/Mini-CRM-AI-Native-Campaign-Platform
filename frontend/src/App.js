import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, Filter, Megaphone, BarChart3, Bot, Sun, Moon, Menu, X, Sparkles, Send } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Segments from './pages/Segments';
import Campaigns from './pages/Campaigns';
import Insights from './pages/Insights';
import AIPlanner from './pages/AIPlanner';
import { aiAPI } from './api';

// CHANGE: 'AI Assistant' nav item removed — AI is now a floating
// drawer accessible from every page (see AIChatDrawer below)
const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/segments', icon: Filter, label: 'Segments' },
  { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
  { to: '/insights', icon: BarChart3, label: 'Insights' },
  { to: '/ai-planner', icon: Sparkles, label: 'AI Planner' },
];

// NEW: Floating AI Chat drawer — replaces the old /ai page
function AIChatDrawer({ open, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hi! I have live access to your CRM data. Ask me about customers, segments, or campaigns." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const val = input.trim();
    if (!val || loading) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    const newMsg = { role: 'user', text: val };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setLoading(true);
    try {
      const historyPayload = updatedMessages.map(m => ({
        role: m.role,
        content: m.text
      }));
      const res = await aiAPI.chat({ message: val, history: historyPayload });
      setMessages(m => [...m, { role: 'ai', text: res.data.response, actions: res.data.actions }]);
      
      // Dispatch update event if any action was successfully executed
      if (res.data.actions && res.data.actions.length > 0) {
        const hasSuccess = res.data.actions.some(act => !act.error);
        if (hasSuccess) {
          window.dispatchEvent(new CustomEvent('crm-data-update'));
        }
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'ai', text: 'AI is unavailable right now. Check API key configuration.' }]);
    }
    setLoading(false);
  };

  return (
    <div className={`chat-drawer ${open ? 'open' : ''}`}>
      <div className="chat-drawer-header">
        <div className="flex items-center gap-8">
          <div className="ai-badge"><Bot size={10} /> AI Assistant</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="chat-drawer-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-msg-${m.role}`}>
            <div className="chat-msg-bubble">
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
              {m.actions && m.actions.length > 0 && (
                <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {m.actions.map((act, ai) => (
                    <div key={ai} style={{ fontSize: '11px', color: act.error ? '#ff6b6b' : '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{act.error ? '❌' : '✅'}</span>
                      <span>
                        {act.type === 'create_segment' && `Created segment "${act.name}" (${act.count} customers)`}
                        {act.type === 'create_campaign' && `Created campaign "${act.name}"`}
                        {act.type === 'send_campaign' && `Sent campaign "${act.name}" to ${act.count} customers`}
                        {act.error && ` Error: ${act.error}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-msg chat-msg-ai">
            <div className="chat-msg-bubble"><div className="spinner" style={{ width: 14, height: 14 }} /></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-drawer-input" style={{ alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          className="input"
          style={{ 
            border: 'none', 
            background: 'transparent', 
            padding: '4px 0', 
            fontSize: '14px',
            resize: 'none',
            outline: 'none',
            flex: 1,
            height: 'auto',
            maxHeight: '100px',
            fontFamily: 'inherit',
            lineHeight: '1.4'
          }}
          placeholder="Ask anything about your CRM..."
          value={input}
          onChange={e => {
            setInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
        />
        <button className="btn btn-primary btn-sm" onClick={send} disabled={loading || !input.trim()} style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false); // NEW

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(t => t === 'light' ? 'dark' : 'light');
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <BrowserRouter>
      <div className="app">
        {/* Mobile Fixed Header */}
        <header className="mobile-header">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="sidebar-logo" style={{ marginBottom: 0, padding: 0 }}>
            <div className="logo-mark">X</div>
            <span className="logo-text">Xeno CRM</span>
          </div>
          <button className="btn btn-ghost" onClick={toggleTheme} style={{ padding: '8px' }}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </header>

        {/* Sidebar Backdrop on Mobile */}
        {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-logo">
            <div className="logo-mark">X</div>
            <span className="logo-text">Xeno CRM</span>
          </div>
          <nav className="sidebar-nav">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink 
                key={to} 
                to={to} 
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={closeSidebar}
              >
                <Icon />{label}
              </NavLink>
            ))}
          </nav>
          
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
            <button className="btn btn-secondary" onClick={toggleTheme} style={{ width: '100%', justifyContent: 'center' }}>
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </button>
            <div className="ai-badge" style={{ width: '100%', justifyContent: 'center' }}>
              <Bot size={10} /> AI-Native
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/segments" element={<Segments />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/ai-planner" element={<AIPlanner />} />
            {/* /ai route removed — AI is the floating drawer below */}
          </Routes>
        </main>

        {/* NEW: Floating AI chat button + drawer, available on every page */}
        <button className="ai-fab" onClick={() => setChatOpen(o => !o)} title="Ask AI">
          {chatOpen ? <X size={20} /> : <Sparkles size={20} />}
        </button>
        <AIChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
      </div>
    </BrowserRouter>
  );
}
