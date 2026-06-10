import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, Filter, Megaphone, BarChart3, Bot, Sun, Moon, Menu, X } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Segments from './pages/Segments';
import Campaigns from './pages/Campaigns';
import Insights from './pages/Insights';
import AIChat from './pages/AIChat';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/segments', icon: Filter, label: 'Segments' },
  { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
  { to: '/insights', icon: BarChart3, label: 'Insights' },
  { to: '/ai', icon: Bot, label: 'AI Assistant' },
];

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
            <Route path="/ai" element={<AIChat />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
