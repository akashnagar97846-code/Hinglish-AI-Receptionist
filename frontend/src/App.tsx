import { useEffect, useRef, useState } from 'react';
import type { VoiceSession, VoiceState } from './lib/voice';
import logoUrl from './assets/bti-logo.svg';
import {
  Activity,
  ArrowUpRight,
  AudioLines,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleHelp,
  Headphones,
  Lightbulb,
  Menu,
  Mic,
  MicOff,
  PhoneCall,
  Plus,
  Sparkles,
  Volume2,
  X,
  Zap,
} from 'lucide-react';

type View = 'home' | 'auth' | 'receptionist';
type User = { id: number; name: string; email: string };

const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Something went wrong.');
  return data as T;
}
type Line = { speaker: 'AI' | 'YOU'; text: string; time: string; parts?: { key: string; text: string }[] };

const RECEPTIONIST = 'Nova';

const services = [
  ['AI Receptionist Development', 'From ₹24,999', 'A voice-first front desk that never drops the thread.'],
  ['RAG Knowledge Assistants', 'From ₹49,999', 'Answers grounded in the material your team already trusts.'],
  ['Agentic AI Automation', 'Custom scope', 'Move repetitive workflows from queue to completion.'],
];

const faqs: [string, string][] = [
  ['Is this a phone system?', 'No. This version is browser-first: you talk to it through your microphone right on the website. There is no phone number, SIP or telephone integration.'],
  ['Can it book real appointments?', 'Not yet. Nova can ask about your requirement and contact details during the conversation, but she cannot confirm a booking. For confirmation, contact the team directly.'],
  ['What language does Nova speak?', 'Hinglish by default: natural Hindi mixed with everyday English words. Ask her to switch and she will continue in plain English. Her replies appear in Roman script in the transcript.'],
  ['Are conversations saved?', 'Yes. Once you sign in, your conversation transcript is saved securely to your BTI account in Neon PostgreSQL so the useful context is not lost when the session ends.'],
];

const quickPrompts = ['What services do you offer?', 'How much does an AI receptionist cost?', 'I want to ask about a consultation.'];

const stateLabel: Record<VoiceState, string> = {
  IDLE: 'Ready when you are',
  CONNECTING: `Connecting to ${RECEPTIONIST}`,
  LISTENING: 'Listening',
  THINKING: 'Thinking',
  SPEAKING: `${RECEPTIONIST} is speaking`,
  ENDED: 'Session ended',
};

const now = () => new Date().toLocaleTimeString([], { hour12: false });

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

function getView(): View {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/auth') return 'auth';
  return path === '/receptionist' ? 'receptionist' : 'home';
}

function go(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function App() {
  const [view, setView] = useState<View>(getView());
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Do not make the public landing page wait on the API. Only the protected
    // receptionist route needs the session check.
    if (view !== 'receptionist' || user) return;
    let cancelled = false;
    api<{ user: User | null }>('/api/auth/me')
      .then(result => { if (!cancelled) setUser(result.user); })
      .catch(() => { if (!cancelled) setUser(null); });
    return () => { cancelled = true; };
  }, [view, user]);

  useEffect(() => {
    const handle = () => setView(getView());
    window.addEventListener('popstate', handle);
    return () => window.removeEventListener('popstate', handle);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <>
      {view === 'home' && <Landing onNavigate={path => path === '/receptionist' ? go('/auth?next=/receptionist') : go(path)} />}
      {view === 'auth' && <Auth onNavigate={go} onSuccess={nextUser => { setUser(nextUser); go(new URLSearchParams(window.location.search).get('next') || '/receptionist'); }} />}
      {view === 'receptionist' && (user ? <Receptionist onNavigate={go} notify={setToast} user={user} /> : <Auth onNavigate={go} onSuccess={nextUser => { setUser(nextUser); go('/receptionist'); }} />)}
      {toast && <div className="toast"><Check size={16} />{toast}</div>}
      <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
      {mobileNav && (
        <div className="mobile-drawer">
          <button className="drawer-close" aria-label="Close" onClick={() => setMobileNav(false)}><X size={18} /></button>
          <Brand onNavigate={go} />
          <div className="drawer-links">
            <button onClick={() => { go('/'); setMobileNav(false); }}>Home</button>
            <button onClick={() => { go('/auth?next=/receptionist'); setMobileNav(false); }}>Talk to the receptionist</button>
          </div>
        </div>
      )}
    </>
  );
}

function Auth({ onNavigate, onSuccess }: { onNavigate: (path: string) => void; onSuccess: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api<{ user: User }>(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify({ name, email, password }) });
      onSuccess(result.user);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not continue.'); }
    finally { setBusy(false); }
  };

  return <main className="auth-page">
    <section className="auth-visual"><Brand onNavigate={onNavigate} /><div className="auth-quote"><span className="eyebrow"><span className="live-dot" /> BTI / PRIVATE CONSOLE</span><h1>The first response should feel <em>intentional.</em></h1><p>Sign in to speak with Nova and keep your conversation history in one calm, useful place.</p><div className="auth-metric"><strong>24/7</strong><span>Browser-first voice<br />Hinglish by default</span></div></div><div className="auth-footer"><span>BEYOND TECH INTELLIGENCE</span><span>JAIPUR / INDIA</span></div></section>
    <section className="auth-form-wrap"><button className="back-link" onClick={() => onNavigate('/')}><ChevronRight size={15} style={{ transform: 'rotate(180deg)' }} /> Back to home</button><div className="auth-form"><span className="eyebrow">{mode === 'signup' ? 'CREATE YOUR ACCESS' : 'WELCOME BACK'}</span><h2>{mode === 'signup' ? 'Start a useful conversation.' : 'Good to see you again.'}</h2><p>{mode === 'signup' ? 'Create an account to try the AI receptionist and save your transcript securely.' : 'Sign in to continue to the receptionist workspace.'}</p><form onSubmit={submit}>{mode === 'signup' && <label>Name<input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required /></label>}<label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required /></label>{error && <div className="form-error">{error}</div>}<button className="button button-primary full" disabled={busy}>{busy ? 'Opening your workspace…' : mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowUpRight size={15} /></button></form><div className="auth-switch">{mode === 'signup' ? 'Already have an account?' : 'New to BTI?'} <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</button></div></div></section>
  </main>;
}

function Brand({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <button className="brand" onClick={() => onNavigate('/')} aria-label="Beyond Tech Intelligence home"><img className="brand-logo" src={logoUrl} alt="" aria-hidden="true" /><span className="brand-copy"><strong>BTI</strong><small>Beyond Tech Intelligence</small></span></button>;
}

function Landing({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [faq, setFaq] = useState<number | null>(0);
  return <main className="site-shell">
    <header className="topbar landing-topbar"><Brand onNavigate={onNavigate} /><nav className="topnav"><a href="#how">How it works</a><a href="#services">Services</a><a href="#platform">Platform</a></nav><div className="top-actions"><button className="button button-small" onClick={() => onNavigate('/receptionist')}>Talk now <ArrowUpRight size={15} /></button></div></header>
    <section className="hero section-pad">
      <div className="hero-copy">
        <div className="eyebrow"><span className="live-dot" /> Built for the first response</div>
        <h1>Your business never has to miss a <em>conversation.</em></h1>
        <p className="hero-lede">An AI receptionist that talks with your customers in natural Hinglish, answers questions about your services and pricing, and works out the next useful step. 24/7.</p>
        <div className="hero-actions"><button className="button button-primary" onClick={() => onNavigate('/receptionist')}><Mic size={17} /> Try the AI receptionist</button><a className="button button-quiet" href="#platform">Explore platform <ChevronRight size={16} /></a></div>
        <div className="hero-proof"><span>Talk right in your browser. No app or phone number needed.</span></div>
      </div>
      <div className="hero-visual">
        <div className="signal-card">
          <div className="signal-header"><span className="status-pill"><span className="live-dot" /> Live signal</span><span className="mono">WEBRTC / HINGLISH</span></div>
          <div className="signal-center"><div className="nova-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="nova-core"><Sparkles size={25} /></div></div><span className="signal-label">NOVA / AI RECEPTIONIST</span><strong>Listening for the<br /><em>next useful thing.</em></strong></div>
          <div className="signal-wave">{Array.from({ length: 17 }).map((_, i) => <span key={i} />)}</div>
          <div className="signal-footer"><span><span className="mini-led" /> Ready</span><span className="mono">Namaste sir</span></div>
        </div>
        <div className="floating-note note-top"><span className="note-icon lime"><Zap size={14} /></span><span><strong>Hinglish voice</strong><small>STT · LLM · TTS</small></span></div>
        <div className="floating-note note-bottom"><span className="note-icon blue"><AudioLines size={14} /></span><span><strong>Live transcript</strong><small>Every word on screen</small></span></div>
      </div>
    </section>
    <div className="ticker"><span>AVAILABLE NOW</span><b>Browser voice</b><i /> <b>Hinglish conversation</b><i /> <b>Live transcript</b><i /> <b>Type or speak</b></div>
    <section className="section-pad manifesto" id="how"><div className="section-kicker">01 / The shift</div><div className="manifesto-grid"><h2>Every conversation is a <em>signal.</em><br />Make yours useful.</h2><div><p>Most businesses do not lose customers because they lack a good answer. They lose them in the space between the question and the follow-up.</p><p>Nova gives that space a calm, capable voice that listens, understands and moves the conversation forward.</p><a className="inline-link" href="#platform">See how it works <ArrowUpRight size={15} /></a></div></div><div className="steps"><Step n="01" title="Listen in real time" text="Speak straight into your mic. Interruptions feel natural." icon={<Headphones size={18} />} /><Step n="02" title="Answer from what is known" text="Replies come only from the business information she has been given. If she does not know, she says so." icon={<BrainCircuit size={18} />} /><Step n="03" title="Speak and show" text="Answers arrive as voice and also appear in the transcript." icon={<Activity size={18} />} /></div></section>
    <section className="section-pad dark-band" id="platform"><div className="section-kicker">02 / The platform</div><div className="band-header"><h2>A front desk that <em>speaks.</em></h2><p>Not a chatbot. A business system that happens to speak.</p></div><div className="platform-grid"><div className="console-preview"><div className="console-top"><span><span className="mini-led" /> VOICE PIPELINE</span><span className="mono">EXAMPLE</span></div><div className="console-pipeline"><PipelineRow label="USER_AUDIO" detail="Mic audio over WebRTC" state="done" /><PipelineRow label="TRANSCRIPTION" detail="Cartesia · speech to text" state="done" /><PipelineRow label="LLM" detail="Groq · gpt-oss-120b" state="active" /><PipelineRow label="TTS" detail="Cartesia · Hindi female voice" state="pending" /><PipelineRow label="AI_RESPONSE" detail="Browser speaker" state="pending" /></div><div className="console-footer"><span>TRANSPORT <strong>WEBRTC</strong></span><span>STT <strong>EN</strong></span><span>TTS <strong>HI</strong></span></div></div><div className="platform-copy"><div className="feature-line"><span className="feature-number">A</span><div><h3>Hinglish first</h3><p>Natural Hindi mixed with everyday English, always respectful and always "aap". Plain English on request.</p></div></div><div className="feature-line"><span className="feature-number">B</span><div><h3>Honest answers</h3><p>She never claims to do what she cannot: no bookings, emails or phone calls are faked.</p></div></div><div className="feature-line"><span className="feature-number">C</span><div><h3>Voice and text</h3><p>In a noisy place, just type. The answer still comes back spoken.</p></div></div></div></div></section>
    <section className="section-pad services-section" id="services"><div className="section-kicker">03 / What we build</div><div className="band-header"><h2>Designed for the work <em>behind</em> the words.</h2><p>Start with one conversation. Grow into a system.</p></div><div className="service-list">{services.map(([title, price, text], index) => <div className="service-row" key={title}><span className="mono">0{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div><strong>{price}</strong><ArrowUpRight size={18} /></div>)}</div></section>
    <section className="section-pad faq-section"><div className="section-kicker">04 / Questions, answered</div><div className="faq-grid"><h2>Good systems make space for <em>better questions.</em></h2><div className="faq-list">{faqs.map(([question, answer], index) => <div className={`faq-item ${faq === index ? 'open' : ''}`} key={question}><button onClick={() => setFaq(faq === index ? null : index)}><span>{question}</span>{faq === index ? <X size={17} /> : <Plus size={17} />}</button>{faq === index && <p>{answer}</p>}</div>)}</div></div></section>
    <section className="final-cta section-pad"><div><div className="eyebrow"><span className="live-dot" /> A better first response</div><h2>Let the first response<br /><em>feel human.</em></h2></div><button className="button button-primary" onClick={() => onNavigate('/receptionist')}>Talk to the receptionist <ArrowUpRight size={16} /></button></section>
    <footer className="footer"><Brand onNavigate={onNavigate} /><span>© 2026 Beyond Tech Intelligence</span><span className="footer-note">Built in Jaipur · Designed for useful conversations</span></footer>
  </main>;
}

function Step({ n, title, text, icon }: { n: string; title: string; text: string; icon: React.ReactNode }) { return <div className="step"><span className="step-icon">{icon}</span><span className="mono step-number">{n}</span><h3>{title}</h3><p>{text}</p></div>; }
function PipelineRow({ label, detail, state }: { label: string; detail: string; state: string }) { return <div className={`pipeline-row ${state}`}><span className="pipeline-status" /> <span className="mono">{label}</span><strong>{detail}</strong>{state === 'active' && <span className="pipeline-spinner" />}</div>; }

function Shell({ children, onNavigate, backendOk }: { children: React.ReactNode; onNavigate: (path: string) => void; backendOk: boolean | null }) {
  return <div className="app-shell"><aside className="sidebar"><Brand onNavigate={onNavigate} /><div className="side-label">Menu</div><nav className="side-nav"><button onClick={() => onNavigate('/')}><ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /><span>Home</span></button><button className="active" onClick={() => onNavigate('/receptionist')}><Sparkles size={16} /><span>Receptionist</span><span className="new-dot" /></button></nav><div className="sidebar-bottom"><div className={`status-card ${backendOk === false ? 'bad' : ''}`}><span className="mono">PIPECAT BOT</span>{backendOk === null ? 'Checking…' : backendOk ? <><strong>Connected</strong><br />WebRTC · Hinglish</> : <><strong>Backend is offline</strong><br />Start the bot in the talk folder</>}</div></div></aside><main className="app-main">{children}</main></div>;
}

function Receptionist({ onNavigate, notify, user }: { onNavigate: (path: string) => void; notify: (message: string) => void; user: User }) {
  const [state, setState] = useState<VoiceState>('IDLE');
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [interim, setInterim] = useState('');
  const [input, setInput] = useState('');
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [message, setMessage] = useState<React.ReactNode>('Your microphone is required to talk to the receptionist.');
  const listRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<VoiceSession | null>(null);
  const conversationRef = useRef<number | null>(null);
  // Sentences of the AI turn in progress, by segment key. The server re-sends a sentence as it is spoken, so each is stored once.
  const aiTurnRef = useRef<Map<string, string>>(new Map());
  // Saves run one after another so messages are stored in the order they were spoken.
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingLinesRef = useRef<Array<{ speaker: 'AI' | 'YOU'; text: string }>>([]);

  const live = state === 'LISTENING' || state === 'THINKING' || state === 'SPEAKING';
  const active = live || state === 'CONNECTING';

  useEffect(() => {
    let cancelled = false;
    import('./lib/voice').then(({ checkBackend }) => checkBackend()).then(result => {
      if (!cancelled) setBackendOk(result);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [lines, interim, state]);

  useEffect(() => () => { void sessionRef.current?.stop(); }, []);

  const saveLine = (speaker: 'AI' | 'YOU', text: string) => {
    const id = conversationRef.current;
    if (!id) {
      pendingLinesRef.current.push({ speaker, text });
      return;
    }
    saveChainRef.current = saveChainRef.current.then(() => api(`/api/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ speaker, content: text }) })).catch(() => undefined);
  };
  // Save the finished AI turn exactly once (before the user's next line, or when the session ends).
  const flushAiTurn = () => {
    const text = Array.from(aiTurnRef.current.values()).join(' ').trim();
    aiTurnRef.current = new Map();
    if (text) saveLine('AI', text);
  };
  const addUserLine = (text: string) => { flushAiTurn(); setLines(prev => [...prev, { speaker: 'YOU', text, time: now() }]); saveLine('YOU', text); };

  const start = async () => {
    setState('CONNECTING');
    setLines([]); setInterim(''); setSeconds(0); setMuted(false); aiTurnRef.current = new Map(); pendingLinesRef.current = [];
    setMessage(`Starting a voice session with ${RECEPTIONIST}…`);
    // Start WebRTC immediately; database persistence must not hold the microphone
    // handshake hostage on a cold Render/Neon connection.
    const conversationPromise = api<{ id: number }>('/api/conversations', { method: 'POST', body: JSON.stringify({ duration_seconds: 0, messages: [] }) });
    conversationPromise.then(saved => {
      conversationRef.current = saved.id;
      const pending = pendingLinesRef.current.splice(0);
      pending.forEach(line => saveLine(line.speaker, line.text));
    }).catch(() => { conversationRef.current = null; });
    const { VoiceSession } = await import('./lib/voice');
    const session = new VoiceSession({
      onState: next => {
        setState(next);
        if (next === 'LISTENING') setMessage('Mic is live. Go ahead, Nova is listening.');
        if (next === 'ENDED') setInterim('');
      },
      onUserText: (text, final) => {
        if (!final) { setInterim(text); return; }
        setInterim('');
        if (text.trim()) addUserLine(text.trim());
      },
      // The server re-sends a sentence as it is spoken, so a sentence is stored once by key and updated in place.
      onBotText: (key, text) => {
        const clean = text.trim();
        const known = aiTurnRef.current.get(key);
        if (known === undefined || clean.length >= known.length) aiTurnRef.current.set(key, clean);
        setLines(prev => {
          const last = prev[prev.length - 1];
          if (last && last.speaker === 'AI') {
            const parts = last.parts ?? [];
            const at = parts.findIndex(part => part.key === key);
            const next = at === -1
              ? [...parts, { key, text: clean }]
              : parts.map((part, i) => (i === at && clean.length >= part.text.length ? { key, text: clean } : part));
            return [...prev.slice(0, -1), { ...last, parts: next, text: next.map(part => part.text).join(' ') }];
          }
          return [...prev, { speaker: 'AI', text: clean, time: now(), parts: [{ key, text: clean }] }];
        });
      },
      onNotice: setMessage,
    });
    sessionRef.current = session;
    try {
      await session.start();
    } catch (error) {
      sessionRef.current = null;
      setState('IDLE');
      const denied = error instanceof Error && /permission|denied|NotAllowed/i.test(`${error.name} ${error.message}`);
      const reachable = await import('./lib/voice').then(({ checkBackend }) => checkBackend());
      setBackendOk(reachable);
      setMessage(denied
        ? 'Microphone access was blocked. Allow it in your browser settings and try again.'
        : reachable
          ? 'Could not connect. Please try again.'
          : <>Bot server not found. Run <code>uv run bot1.py -t webrtc</code> in the talk folder and try again.</>);
    }
  };

  const end = async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setState('ENDED');
    setInterim('');
    await session?.stop();
    flushAiTurn();
    const savedId = conversationRef.current;
    conversationRef.current = null;
    if (savedId) void saveChainRef.current.then(() => api(`/api/conversations/${savedId}/end`, { method: 'POST', body: JSON.stringify({ duration_seconds: seconds }) })).catch(() => undefined);
    notify(`Session saved for ${user.name}.`);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sessionRef.current?.setMuted(next);
  };

  const submit = async (text = input) => {
    const value = text.trim();
    if (!value || !live || state === 'THINKING') return;
    setInput('');
    addUserLine(value);
    setState('THINKING');
    try {
      await sessionRef.current?.sendText(value);
    } catch {
      setState('LISTENING');
      notify('Could not send that message.');
    }
  };

  return <Shell onNavigate={onNavigate} backendOk={backendOk}>
    <div className="receptionist-top">
      <div><span className="eyebrow">BROWSER VOICE SESSION</span><h1>AI Receptionist</h1><p>A calm first response for every customer conversation.</p></div>
      <div className="session-meta"><span className={`status-pill backend-pill ${backendOk === false ? 'bad' : ''}`}><span className={active ? 'live-dot' : 'grey-dot'} />{state === 'IDLE' ? 'Not connected' : state === 'ENDED' ? 'Ended' : state === 'CONNECTING' ? 'Connecting' : 'Connected'}</span><span className="mono">{formatTime(seconds)}</span></div>
    </div>
    <div className="receptionist-layout">
      <section className="call-console">
        <div className="console-heading"><span className="eyebrow">NOVA / AI RECEPTIONIST</span></div>
        <div className={`voice-stage ${state.toLowerCase()}`}>
          <div className="stage-grid" />
          <div className="voice-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="nova-core"><Sparkles size={28} /></div></div>
          <div className="voice-name"><strong>{RECEPTIONIST}</strong><span>{stateLabel[state]}</span></div>
          <div className="large-wave">{Array.from({ length: 27 }).map((_, i) => <span key={i} style={{ height: `${15 + ((i * 17) % 40)}px` }} />)}</div>
          <div className="call-timer mono">{formatTime(seconds)}</div>
        </div>
        <div className="mic-message"><CircleHelp size={15} /><span>{message}</span></div>
        <div className="call-controls">
          <button className={`round-control ${muted ? 'selected' : ''}`} onClick={toggleMute} disabled={!live} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}><span>{muted ? <MicOff size={18} /> : <Mic size={18} />}</span><small>{muted ? 'Unmute' : 'Mute'}</small></button>
          {!active ? <button className="start-call" onClick={start}><span><PhoneCall size={22} /></span><small>{state === 'ENDED' ? 'Start again' : 'Start session'}</small></button> : <button className="end-call" onClick={end} aria-label="End session"><span><PhoneCall size={22} /></span><small>End session</small></button>}
          <button className="round-control" onClick={() => notify('Audio plays through your browser speaker.')} aria-label="Speaker"><span><Volume2 size={18} /></span><small>Speaker</small></button>
        </div>
      </section>
      <section className="transcript-panel">
        <div className="panel-header"><div><span className="eyebrow">LIVE TRANSCRIPT</span><h2>Conversation</h2></div><span className="transcript-state"><span className="mini-led" />{live ? 'Live' : 'Paused'}</span></div>
        <div className="transcript-list" ref={listRef}>
          {lines.length === 0 && !interim && <p className="transcript-empty">{active ? 'Waiting for Nova\'s greeting…' : 'Press "Start session". The conversation will appear here.'}</p>}
          {lines.map((line, index) => <div className={`transcript-line ${line.speaker === 'YOU' ? 'you' : ''}`} key={`${line.time}-${index}`}><div className="transcript-meta"><span>{line.speaker === 'AI' ? RECEPTIONIST.toUpperCase() : 'YOU'}</span><span className="mono">{line.time}</span></div><p>{line.text}</p></div>)}
          {interim && <div className="transcript-line you interim"><div className="transcript-meta"><span>YOU</span><span className="mono">…</span></div><p>{interim}</p></div>}
          {state === 'THINKING' && <div className="typing"><span /><span /><span /> {RECEPTIONIST} is thinking</div>}
        </div>
        <div className="quick-prompts"><span className="eyebrow">TRY ASKING</span><div>{quickPrompts.map(prompt => <button key={prompt} onClick={() => submit(prompt)} disabled={!live}>{prompt}<ArrowUpRight size={13} /></button>)}</div></div>
        <div className="message-compose"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder={live ? 'Type a message to Nova…' : 'Start a session first'} disabled={!live} /><button onClick={() => submit()} disabled={!input.trim() || !live} aria-label="Send"><ArrowUpRight size={17} /></button></div>
        <div className="demo-disclaimer"><Lightbulb size={14} /><span><strong>Your conversation is private.</strong> Transcript messages are saved to your BTI account. Nova cannot confirm bookings or send messages on your behalf.</span></div>
      </section>
    </div>
  </Shell>;
}

export default App;