// frontend/src/App.js
// CHANGES vs original:
//  - Removed "AI" nav section (AI Chat + AI Planner nav items removed)
//  - Added floating AI Chat FAB button (bottom-right)
//  - Added slide-up AI Chat drawer component
//  - AI Planner is now accessible via button on Campaigns page only

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Segments from './pages/Segments';
import Campaigns from './pages/Campaigns';
import Insights from './pages/Insights';
import AIChatDrawer from './components/AIChatDrawer'; // NEW component
import {
  LayoutDashboard, Users, SlidersHorizontal,
  Megaphone, BarChart2, Moon, Sun
} from 'lucide-react';
import './index.css';

export default function App() {
  const [dark, setDark] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className={`app ${dark ? 'dark' : ''}`}>
      <Router>
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-mark">
              <svg width="14" height="14" fill="none" viewBox="0 0 16 16">
                <path d="M8 1L14 5V11L8 15L2 11V5L8 1Z" fill="white"/>
              </svg>
            </div>
            <span className="logo-name">Mini<span>CRM</span></span>
          </div>

          <nav className="nav">
            <span className="nav-section">Overview</span>
            <NavLink className="nav-item" to="/">
              <LayoutDashboard size={17}/> Dashboard
            </NavLink>

            <span className="nav-section">Data</span>
            <NavLink className="nav-item" to="/customers">
              <Users size={17}/> Customers
            </NavLink>
            <NavLink className="nav-item" to="/segments">
              <SlidersHorizontal size={17}/> Segments
            </NavLink>

            <span className="nav-section">Campaigns</span>
            <NavLink className="nav-item" to="/campaigns">
              <Megaphone size={17}/> Campaigns
            </NavLink>
            <NavLink className="nav-item" to="/insights">
              <BarChart2 size={17}/> Insights
            </NavLink>
            {/* NOTE: AI Chat and AI Planner removed from nav.
                AI Chat is the floating button (bottom-right).
                AI Planner is a button on the Campaigns page header. */}
          </nav>

          <div className="sidebar-bottom">
            <button className="theme-btn" onClick={() => setDark(d => !d)}>
              {dark ? <Sun size={17}/> : <Moon size={17}/>}
              <span>{dark ? 'Light mode' : 'Dark mode'}</span>
            </button>
          </div>
        </aside>

        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/segments" element={<Segments />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/insights" element={<Insights />} />
          </Routes>
        </main>

        {/* Floating AI Chat Button + Drawer */}
        <button
          className="ai-fab"
          onClick={() => setChatOpen(o => !o)}
          title="Ask AI"
        >
          {chatOpen ? '✕' : '✦'}
        </button>
        <AIChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
      </Router>
    </div>
  );
}
