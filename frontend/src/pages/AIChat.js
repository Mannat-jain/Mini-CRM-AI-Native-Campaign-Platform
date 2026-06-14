import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader } from 'lucide-react';
import { aiAPI } from '../api';

const SUGGESTIONS = [
  'Which customers should I target for a flash sale?',
  'Suggest a segment for re-engagement campaigns',
  'What channel works best for high-value buyers?',
  'How do I improve my open rates?',
  'Create a segment for customers who spent over ₹3000',
];

export default function AIChat() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your AI marketing assistant. I can help you identify audience segments, suggest campaign strategies, draft messages, and interpret performance data.\n\nTry asking me something like \"Which customers should I re-engage?\" or \"Suggest a high-value segment for a loyalty campaign.\""
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (msg) => {
    const text = msg || input.trim();
    if (!text || loading) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    const newMsg = { role: 'user', content: text };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setLoading(true);
    try {
      const historyPayload = updatedMessages.map(m => ({
        role: m.role,
        content: m.content
      }));
      const res = await aiAPI.chat({ message: text, history: historyPayload });
      setMessages(m => [...m, { role: 'assistant', content: res.data.response, actions: res.data.actions }]);
      
      // Dispatch update event if any action was successfully executed
      if (res.data.actions && res.data.actions.length > 0) {
        const hasSuccess = res.data.actions.some(act => !act.error);
        if (hasSuccess) {
          window.dispatchEvent(new CustomEvent('crm-data-update'));
        }
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: 'Sorry, I encountered an error. Please check that GROQ_API_KEY is configured in the backend.' }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="page-header" style={{ paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bot size={22} style={{ color: 'var(--accent)' }} /> AI Assistant
          </h1>
          <p className="page-subtitle">Powered by Groq · Ask about segments, campaigns, and performance</p>
        </div>
        <div className="ai-badge"><Sparkles size={9} /> llama-3.3</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: m.role === 'assistant' ? 'var(--accent-dim)' : 'var(--bg-elevated)',
              border: '1px solid ' + (m.role === 'assistant' ? 'rgba(124,92,252,0.3)' : 'var(--border)')
            }}>
              {m.role === 'assistant' ? <Bot size={15} style={{ color: 'var(--accent)' }} /> : <User size={15} style={{ color: 'var(--text-secondary)' }} />}
            </div>
            <div style={{
              maxWidth: '75%', padding: '14px 16px',
              background: m.role === 'user' ? 'var(--accent-dim)' : 'var(--bg-card)',
              border: '1px solid ' + (m.role === 'user' ? 'rgba(124,92,252,0.3)' : 'var(--border)'),
              borderRadius: '12px',
              fontSize: '13.5px', lineHeight: '1.6',
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap'
            }}>
              <div>{m.content}</div>
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
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-dim)', border: '1px solid rgba(124,92,252,0.3)' }}>
              <Bot size={15} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
              <Loader size={16} style={{ color: 'var(--accent)' }} className="pulse" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '0 32px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)} className="btn btn-ghost"
              style={{ fontSize: '11.5px', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '999px' }}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '10px 14px', alignItems: 'flex-end' }}>
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
              maxHeight: '120px',
              fontFamily: 'inherit',
              lineHeight: '1.4'
            }}
            placeholder="Ask about segments, campaigns, performance..."
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
          <button className="btn btn-primary btn-sm" onClick={() => send()} disabled={loading || !input.trim()} style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
