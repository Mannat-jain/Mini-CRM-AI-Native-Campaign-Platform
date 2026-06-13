// frontend/src/components/AIChatDrawer.js
// NEW FILE — replaces the full AIChat page.
// Rendered in App.js as a floating drawer over all pages.

import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../api';   // existing API call

export default function AIChatDrawer({ open, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: "Hi! I have live access to your CRM data. Ask me anything about your customers, segments, or campaigns.",
    },
    {
      role: 'ai',
      text: "Try:\n• \"Who are my top customers?\"\n• \"Which campaign performed best?\"\n• \"Draft a win-back message for inactive premium users\"\n• \"What should I target for a weekend sale?\"",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const val = input.trim();
    if (!val || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: val }]);
    setLoading(true);
    try {
      const res = await sendChatMessage(val);
      setMessages(m => [...m, { role: 'ai', text: res.data.response }]);
    } catch {
      setMessages(m => [...m, { role: 'ai', text: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`chat-drawer ${open ? 'open' : ''}`}>
      {/* Header */}
      <div className="chat-drawer-header">
        <div className="chat-drawer-title">
          <div className="chat-drawer-avatar">✦</div>
          <div>
            <div className="chat-drawer-name">AI Assistant</div>
            <div className="chat-drawer-status">
              <span className="status-dot" /> Live data
            </div>
          </div>
        </div>
        <button className="drawer-close" onClick={onClose}>✕</button>
      </div>

      {/* Messages */}
      <div className="drawer-messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === 'ai' && <div className="msg-avatar">✦</div>}
            <div className="msg-bubble">
              {m.text.split('\n').map((line, j) => (
                <span key={j}>{line}<br/></span>
              ))}
            </div>
            {m.role === 'user' && <div className="msg-avatar user-av">U</div>}
          </div>
        ))}
        {loading && (
          <div className="msg ai">
            <div className="msg-avatar">✦</div>
            <div className="msg-bubble typing">
              <span/><span/><span/>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div className="chat-input-bar">
        <input
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask anything about your data…"
        />
        <button
          className="btn btn-primary"
          onClick={handleSend}
          disabled={loading}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
