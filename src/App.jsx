import { useState, useEffect, useRef, useCallback } from "react";

const T = {
  bg: "#0b0c11", surface: "#111318", card: "#181a24", cardHover: "#1e2030",
  border: "#23263a", borderLight: "#2e3348", accent: "#f5c518", accentHover: "#ffd740",
  accentDim: "rgba(245,197,24,0.13)", teal: "#4ecdc4", tealDim: "rgba(78,205,196,0.12)",
  green: "#52c97a", greenDim: "rgba(82,201,122,0.12)", red: "#e05252", redDim: "rgba(224,82,82,0.12)",
  text: "#e8e4de", muted: "#5e6480", mid: "#9298b0", white: "#fff",
};

const injectStyles = (() => {
  let done = false;
  return () => {
    if (done) return; done = true;
    const s = document.createElement("style");
    s.textContent = [
      "@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,400&family=Outfit:wght@300;400;500;600&display=swap');",
      "@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}",
      "@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}",
      "@keyframes dot{0%,80%,100%{transform:scale(0.6)}40%{transform:scale(1)}}",
      "@keyframes spin{to{transform:rotate(360deg)}}",
      "::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#2a2d3e;border-radius:4px}",
      "*{box-sizing:border-box;margin:0;padding:0}",
    ].join("");
    document.head.appendChild(s);
  };
})();

async function callAI(key, messages, model, onChunk) {
  const stream = !!onChunk;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "HTTP-Referer": "https://learnai.io", "X-Title": "LearnAI" },
    body: JSON.stringify({ model, messages, stream, max_tokens: 4096 }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `API Error ${res.status}`); }
  if (stream) {
    const reader = res.body.getReader(); const dec = new TextDecoder(); let full = "";
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      for (const line of dec.decode(value).split("\n")) {
        if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
        try { const d = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content || ""; if (d) { full += d; onChunk(full); } } catch {}
      }
    }
    return full;
  } else {
    const data = await res.json(); return data.choices[0].message.content;
  }
}

const Store = {
  set: async (k, v) => { try { await window.storage.set(k, JSON.stringify(v)); } catch {} },
  get: async (k) => { try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; } },
};

const uid = () => Math.random().toString(36).slice(2, 9);
const fmtDate = (ts) => new Date(ts).toLocaleDateString("en", { month: "short", day: "numeric" });
const fmtFull = (ts) => new Date(ts).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const SYS_EXPLAIN = `You are LearnAI — an outstanding educational tutor. A student just shared their lecture/study material.

Your response:
1. Warmly acknowledge the topic (1 line)
2. Re-explain it more clearly: simple language, vivid analogies, real examples, logical structure
3. Bold or highlight the 3–5 most important concepts
4. End with: offer to clarify anything OR let them know they can click "Generate Quiz" to test themselves

Be encouraging. Always respond in the student's language (Romanian → Romanian, Spanish → Spanish, etc.).`;

const SYS_CHAT = `You are LearnAI — an outstanding educational tutor continuing a tutoring session.

You've already explained the lecture. Now:
- Answer questions clearly with examples and analogies
- Break down confusing parts in new ways
- Encourage deeper thinking
- Occasionally remind them they can generate a quiz from the header button

Always respond in the student's language.`;

const SYS_QUIZ = `You are an educational quiz generator. Generate questions from lecture content.

CRITICAL: Respond ONLY with a valid JSON array. No markdown, no text before/after, just raw JSON.

MCQ format: {"id":N,"type":"mcq","question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"correctIndex":0,"explanation":"..."}
Written format: {"id":N,"type":"written","question":"...","sampleAnswer":"...","keyPoints":["..."]}

Respond in the language of the lecture content.`;

function buildQuizPrompt({ type, mcqPercent, count }, lecture) {
  const n = count;
  let instr = type === "mcq" ? `Generate ${n} multiple choice (MCQ) questions only.`
    : type === "written" ? `Generate ${n} written/open-ended questions only.`
    : type === "mixed" ? `Generate ${n} questions: roughly ${Math.ceil(n/2)} MCQ and ${Math.floor(n/2)} written.`
    : (() => { const m = Math.round(n * mcqPercent / 100); return `Generate exactly ${m} MCQ and ${n - m} written questions (${n} total).`; })();
  return `${instr}\n\nLecture content:\n${lecture}`;
}

const FOLDER_EMOJIS = ["📚","🔬","🧮","🌍","🎨","⚗️","🧬","📐","🏛️","🎵","💻","📝","🌱","🔭","⚽","🎭"];
const FOLDER_COLORS = ["#f5c518","#4ecdc4","#ff6b6b","#a78bfa","#34d399","#f97316","#60a5fa","#f472b6","#94a3b8"];
const MODELS = [
  { id: "google/gemma-3-27b-it:free", label: "Gemma 3 27B · Free · Recommended" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B · Free" },
  { id: "deepseek/deepseek-r1:free", label: "DeepSeek R1 · Free · Reasoning" },
  { id: "mistralai/mistral-nemo:free", label: "Mistral Nemo · Free" },
  { id: "anthropic/claude-3-haiku", label: "Claude 3 Haiku · Paid" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini · Paid" },
];

function Btn({ children, variant = "sec", disabled, onClick, style: s = {}, title }) {
  const v = {
    pri: { background: T.accent, color: "#0b0c11", border: "none" },
    sec: { background: T.card, color: T.text, border: `1px solid ${T.border}` },
    ghost: { background: "transparent", color: T.mid, border: "none" },
    teal: { background: T.teal, color: "#0b0c11", border: "none" },
    danger: { background: "transparent", color: T.red, border: "none" },
  };
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 500, fontSize: 13, borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "all 0.15s",
        display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", ...v[variant], ...s }}>
      {children}
    </button>
  );
}

function Modal({ children, onClose, title, width = 480 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(6px)" }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16,
        width, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto", animation: "fadeUp 0.2s ease" }}>
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 500 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "0 2px" }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function FolderModal({ onClose, onCreate }) {
  const [name, setName] = useState(""); const [emoji, setEmoji] = useState("📚"); const [color, setColor] = useState("#f5c518");
  return (
    <Modal title="Create Folder" onClose={onClose} width={400}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: 0.8, display: "block", marginBottom: 7 }}>FOLDER NAME</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Biology, History, Math..."
            onKeyDown={e => e.key === "Enter" && name.trim() && onCreate(name.trim(), emoji, color)}
            style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 13px", color: T.text, fontFamily: "'Outfit', sans-serif", fontSize: 14, outline: "none" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: 0.8, display: "block", marginBottom: 8 }}>ICON</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {FOLDER_EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)} style={{ fontSize: 18, padding: "6px 7px", background: emoji === e ? T.accentDim : T.surface, border: `1px solid ${emoji === e ? T.accent : T.border}`, borderRadius: 8, cursor: "pointer" }}>{e}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: 0.8, display: "block", marginBottom: 8 }}>COLOR</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FOLDER_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: color === c ? "3px solid #fff" : "2px solid transparent", cursor: "pointer", flexShrink: 0 }} />
            ))}
          </div>
        </div>
        <Btn variant="pri" onClick={() => name.trim() && onCreate(name.trim(), emoji, color)} style={{ justifyContent: "center", marginTop: 4 }}>Create Folder</Btn>
      </div>
    </Modal>
  );
}

function QuizSettingsModal({ settings, onChange, onClose, onGenerate, isGenerating }) {
  const { type, mcqPercent, count } = settings;
  const opts = [
    { val: "mcq", label: "Multiple Choice", icon: "⬡", desc: "A, B, C, D options" },
    { val: "written", label: "Written Answer", icon: "✎", desc: "Type your own answer" },
    { val: "mixed", label: "Mixed 50/50", icon: "⇄", desc: "Half MCQ, half written" },
    { val: "custom", label: "Custom Split", icon: "⚙", desc: "Your own percentage" },
  ];
  return (
    <Modal title="Quiz Settings" onClose={onClose} width={450}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: 0.8, display: "block", marginBottom: 10 }}>QUESTION FORMAT</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {opts.map(o => (
              <button key={o.val} onClick={() => onChange({ ...settings, type: o.val })}
                style={{ padding: "12px 14px", background: type === o.val ? T.accentDim : T.surface, border: `1px solid ${type === o.val ? T.accent : T.border}`, borderRadius: 10, cursor: "pointer", color: type === o.val ? T.accent : T.text, fontFamily: "'Outfit', sans-serif", textAlign: "left", transition: "all 0.15s" }}>
                <div style={{ fontSize: 16, marginBottom: 5 }}>{o.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{o.label}</div>
                <div style={{ fontSize: 11, color: type === o.val ? T.accent : T.muted, marginTop: 2 }}>{o.desc}</div>
              </button>
            ))}
          </div>
        </div>
        {type === "custom" && (
          <div>
            <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: 0.8, display: "block", marginBottom: 8 }}>
              SPLIT: {mcqPercent}% MCQ · {100 - mcqPercent}% Written
            </label>
            <input type="range" min="0" max="100" step="10" value={mcqPercent}
              onChange={e => onChange({ ...settings, mcqPercent: +e.target.value })}
              style={{ width: "100%", accentColor: T.accent }} />
          </div>
        )}
        <div>
          <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: 0.8, display: "block", marginBottom: 8 }}>
            NUMBER OF QUESTIONS: {count}
          </label>
          <input type="range" min="3" max="20" step="1" value={count}
            onChange={e => onChange({ ...settings, count: +e.target.value })}
            style={{ width: "100%", accentColor: T.accent }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, marginTop: 4 }}>
            <span>3</span><span>20</span>
          </div>
        </div>
        <Btn variant="pri" onClick={onGenerate} disabled={isGenerating} style={{ justifyContent: "center", padding: "11px" }}>
          {isGenerating ? "Generating quiz…" : `Generate ${count} Questions`}
        </Btn>
      </div>
    </Modal>
  );
}

function QuizHistoryModal({ quizzes, onClose, onView }) {
  return (
    <Modal title="Quiz History" onClose={onClose} width={440}>
      {quizzes.length === 0 ? (
        <p style={{ color: T.muted, textAlign: "center", padding: "24px 0", fontSize: 14 }}>No quizzes generated yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...quizzes].reverse().map((q, i) => (
            <div key={q.id} onClick={() => onView(q.id)}
              style={{ padding: "14px 16px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.borderLight}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>
                  Quiz #{quizzes.length - i} · {q.questions?.length || 0} questions · {q.settings.type.toUpperCase()}
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>
                  {fmtFull(q.generatedAt)}
                  {q.attempt && q.attempt.percentage !== null && (
                    <span style={{ marginLeft: 8, color: q.attempt.percentage >= 70 ? T.green : q.attempt.percentage >= 40 ? T.accent : T.red, fontWeight: 500 }}>
                      · {q.attempt.percentage}% score
                    </span>
                  )}
                  {q.attempt && q.attempt.percentage === null && <span style={{ marginLeft: 8, color: T.teal }}>· completed</span>}
                </div>
              </div>
              <span style={{ color: T.accent, fontSize: 12 }}>View →</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function Sidebar({ folders, sessions, allSessions, activeFolderId, activeSessionId, onFolderSelect, onSessionSelect, onNew, onNewFolder, onDeleteSession, onDeleteFolder, onClose }) {
  const [hoverSess, setHoverSess] = useState(null); const [hoverFolder, setHoverFolder] = useState(null);
  return (
    <div style={{ width: 255, minWidth: 255, background: T.surface, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <div style={{ padding: "15px 14px 12px", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🎓</span>
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 17, color: T.accent, letterSpacing: -0.3 }}>LearnAI</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 15, padding: "2px 6px" }}>‹</button>
        </div>
        <Btn variant="pri" onClick={() => onNew(activeFolderId || folders[0]?.id)} style={{ width: "100%", justifyContent: "center" }}>+ New Session</Btn>
      </div>
      <div style={{ padding: "12px 8px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 8px", marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: T.muted, fontWeight: 600, letterSpacing: 1 }}>FOLDERS</span>
          <button onClick={onNewFolder} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 17, lineHeight: 1 }}>+</button>
        </div>
        <div onClick={() => onFolderSelect(null)}
          style={{ padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8, background: !activeFolderId ? T.accentDim : "transparent", color: !activeFolderId ? T.accent : T.text, marginBottom: 2 }}>
          <span style={{ fontSize: 14 }}>📂</span> All Sessions
          <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>{allSessions.length}</span>
        </div>
        {folders.map(f => (
          <div key={f.id} style={{ position: "relative" }}
            onMouseEnter={() => setHoverFolder(f.id)} onMouseLeave={() => setHoverFolder(null)}>
            <div onClick={() => onFolderSelect(f.id)}
              style={{ padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 7, background: activeFolderId === f.id ? T.accentDim : "transparent", color: activeFolderId === f.id ? T.accent : T.text, borderLeft: `3px solid ${activeFolderId === f.id ? f.color : "transparent"}`, marginBottom: 2 }}>
              <span style={{ fontSize: 14 }}>{f.emoji}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              <span style={{ fontSize: 11, color: T.muted }}>{allSessions.filter(s => s.folderId === f.id).length}</span>
              {hoverFolder === f.id && (
                <button onClick={e => { e.stopPropagation(); onDeleteFolder(f.id); }}
                  style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 12, padding: "1px 3px", marginLeft: 2 }}>✕</button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 16px" }}>
        <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, letterSpacing: 1, padding: "4px 10px", marginBottom: 4 }}>SESSIONS</div>
        {sessions.length === 0 ? (
          <p style={{ fontSize: 12, color: T.muted, padding: "6px 10px" }}>No sessions yet</p>
        ) : sessions.map(s => {
          const folder = folders.find(f => f.id === s.folderId);
          const active = activeSessionId === s.id;
          return (
            <div key={s.id} style={{ position: "relative" }}
              onMouseEnter={() => setHoverSess(s.id)} onMouseLeave={() => setHoverSess(null)}>
              <div onClick={() => onSessionSelect(s.id)}
                style={{ padding: "9px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 2, background: active ? T.card : "transparent", borderLeft: `3px solid ${active ? (folder?.color || T.accent) : "transparent"}`, transition: "all 0.1s" }}>
                <div style={{ fontSize: 13, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: hoverSess === s.id ? 22 : 0 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2, display: "flex", gap: 5 }}>
                  <span>{folder?.emoji}</span><span>{fmtDate(s.createdAt)}</span>
                  {s.quizzes?.length > 0 && <span>· {s.quizzes.length}q</span>}
                </div>
              </div>
              {hoverSess === s.id && (
                <button onClick={e => { e.stopPropagation(); onDeleteSession(s.id); }}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 14 }}>✕</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MsgBubble({ msg, streaming }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ marginBottom: 18, display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", animation: "fadeUp 0.22s ease" }}>
      {!isUser && (
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.accentDim, border: `1px solid ${T.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginRight: 10, marginTop: 2 }}>🎓</div>
      )}
      <div style={{ maxWidth: "76%", padding: "11px 15px", borderRadius: isUser ? "14px 14px 3px 14px" : "14px 14px 14px 3px", background: isUser ? T.accent : T.card, color: isUser ? "#0b0c11" : T.text, fontSize: 14, lineHeight: 1.75, fontWeight: isUser ? 500 : 400, border: isUser ? "none" : `1px solid ${T.border}`, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {msg.content}
        {streaming && <span style={{ display: "inline-block", width: 2, height: 13, background: T.accent, marginLeft: 2, animation: "blink 0.9s infinite", verticalAlign: "text-bottom" }} />}
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0", animation: "fadeUp 0.2s ease" }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.accentDim, border: `1px solid ${T.accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🎓</div>
      <div style={{ display: "flex", gap: 5, padding: "10px 14px", background: T.card, border: `1px solid ${T.border}`, borderRadius: "14px 14px 14px 3px" }}>
        {[0, 0.2, 0.4].map((d, i) => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: T.accent, animation: `dot 1.2s ${d}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

function ChatView({ session, streaming, isGenerating, input, onInput, onSend, endRef }) {
  const taRef = useRef(null);
  const handleKey = e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSend(); };
  useEffect(() => {
    const el = taRef.current; if (!el) return;
    el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);
  const isEmpty = session.messages.length === 0;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 22px" }}>
        {isEmpty ? (
          <div style={{ textAlign: "center", padding: "64px 20px", animation: "fadeUp 0.4s ease" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📖</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 500, marginBottom: 10, color: T.text }}>Drop your lecture here</h2>
            <p style={{ color: T.muted, fontSize: 14, maxWidth: 380, margin: "0 auto", lineHeight: 1.7 }}>
              Paste any lecture, textbook chapter, or study notes below. The AI will explain it clearly, answer your questions, then help you quiz yourself.
            </p>
            <div style={{ marginTop: 24, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {["📖 Paste lecture", "💬 Chat to understand", "🧠 Generate quiz"].map(t => (
                <span key={t} style={{ padding: "6px 12px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, fontSize: 12, color: T.mid }}>{t}</span>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 740, margin: "0 auto" }}>
            {session.messages.map((m, i) => <MsgBubble key={m.id} msg={m} streaming={streaming && i === session.messages.length - 1 && m.role === "assistant"} />)}
            {streaming && !session.messages.find(m => m.role === "assistant" && m.content === streaming) && (
              <MsgBubble msg={{ role: "assistant", content: streaming }} streaming />
            )}
            {isGenerating && !streaming && <ThinkingDots />}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div style={{ borderTop: `1px solid ${T.border}`, padding: "14px 22px", background: T.surface }}>
        <div style={{ maxWidth: 740, margin: "0 auto", position: "relative" }}>
          <textarea ref={taRef} value={input} onChange={e => onInput(e.target.value)} onKeyDown={handleKey}
            placeholder={isEmpty ? "Paste your lecture or study notes here…" : "Ask a question about the lecture… (Ctrl+Enter to send)"}
            style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 52px 12px 15px", color: T.text, fontFamily: "'Outfit', sans-serif", fontSize: 14, resize: "none", outline: "none", minHeight: 48, lineHeight: 1.65, transition: "border-color 0.15s" }}
            onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border} />
          <button onClick={onSend} disabled={!input.trim() || isGenerating}
            style={{ position: "absolute", right: 8, bottom: 8, width: 36, height: 36, background: input.trim() && !isGenerating ? T.accent : T.border, border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>↑</button>
        </div>
        <div style={{ maxWidth: 740, margin: "5px auto 0", fontSize: 11, color: T.muted }}>Ctrl+Enter · Any language supported · OpenRouter</div>
      </div>
    </div>
  );
}

function QuizView({ quiz, answers, submitted, onAnswer, onSubmit, onRegen }) {
  const { questions = [], attempt, settings } = quiz;
  const mcqQs = questions.filter(q => q.type === "mcq");
  const answered = Object.keys(answers).length;
  const score = attempt;
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 22px" }}>
      <div style={{ maxWidth: 740, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Quiz</h2>
            <p style={{ color: T.muted, fontSize: 13 }}>
              {questions.length} questions · {settings?.type?.toUpperCase()}
              {submitted && score?.percentage !== null && score?.percentage !== undefined && (
                <span style={{ marginLeft: 10, fontWeight: 600, color: score.percentage >= 70 ? T.green : score.percentage >= 40 ? T.accent : T.red }}>
                  · Score: {score.percentage}% ({score.mcqScore}/{score.mcqTotal})
                </span>
              )}
            </p>
          </div>
          {submitted && <Btn variant="sec" onClick={onRegen}>↻ New Quiz</Btn>}
        </div>
        {submitted && score?.percentage !== null && score?.percentage !== undefined && (
          <div style={{ marginBottom: 22, padding: "18px 22px", borderRadius: 12, background: score.percentage >= 70 ? T.greenDim : score.percentage >= 40 ? T.accentDim : T.redDim, border: `1px solid ${score.percentage >= 70 ? T.green : score.percentage >= 40 ? T.accent : T.red}`, animation: "fadeUp 0.3s ease" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{score.percentage >= 70 ? "🏆" : score.percentage >= 40 ? "📈" : "💪"}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 500, marginBottom: 4 }}>
              {score.percentage >= 70 ? "Great work!" : score.percentage >= 40 ? "Good progress!" : "Keep practicing!"}
            </div>
            <div style={{ color: T.mid, fontSize: 13 }}>
              {score.mcqTotal > 0 ? `${score.mcqScore} of ${score.mcqTotal} MCQ correct (${score.percentage}%)` : "Written quiz completed."}
              {questions.some(q => q.type === "written") && " Review your written answers and compare with sample answers below."}
            </div>
          </div>
        )}
        {!submitted && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ height: 3, background: T.border, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ height: "100%", background: T.accent, width: `${questions.length ? (answered / questions.length) * 100 : 0}%`, transition: "width 0.3s", borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 11, color: T.muted }}>{answered} / {questions.length} answered</div>
          </div>
        )}
        {questions.map((q, i) => <QuestionCard key={q.id} q={q} i={i} answer={answers[q.id]} submitted={submitted} onAnswer={v => onAnswer(q.id, v)} />)}
        {!submitted && (
          <div style={{ marginTop: 20, paddingBottom: 40 }}>
            <Btn variant="pri" onClick={onSubmit} style={{ justifyContent: "center", padding: "11px 24px", fontSize: 14, width: "100%" }}>
              Submit Quiz {answered < questions.length ? `(${answered}/${questions.length})` : "✓"}
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({ q, i, answer, submitted, onAnswer }) {
  const [showSample, setShowSample] = useState(false);
  const correct = q.type === "mcq" && answer === q.correctIndex;
  const wrong = q.type === "mcq" && submitted && answer !== undefined && !correct;
  return (
    <div style={{ marginBottom: 16, padding: "18px 20px", background: T.card, border: `1px solid ${submitted && q.type === "mcq" ? (correct ? T.green : wrong ? T.red : T.border) : T.border}`, borderRadius: 12, animation: "fadeUp 0.25s ease" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "flex-start" }}>
        <span style={{ background: T.accentDim, color: T.accent, borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
        <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.65, flex: 1 }}>{q.question}</span>
        {submitted && q.type === "mcq" && <span style={{ fontSize: 17, flexShrink: 0 }}>{correct ? "✅" : "❌"}</span>}
      </div>
      {q.type === "mcq" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {(q.options || []).map((opt, oi) => {
            const sel = answer === oi; const isCorr = oi === q.correctIndex;
            let bg = T.surface, bdr = T.border, col = T.text;
            if (submitted) { if (isCorr) { bg = T.greenDim; bdr = T.green; col = T.green; } else if (sel) { bg = T.redDim; bdr = T.red; col = T.red; } }
            else if (sel) { bg = T.accentDim; bdr = T.accent; col = T.accent; }
            return (
              <button key={oi} onClick={() => !submitted && onAnswer(oi)}
                style={{ padding: "9px 13px", background: bg, border: `1px solid ${bdr}`, borderRadius: 8, color: col, textAlign: "left", cursor: submitted ? "default" : "pointer", fontFamily: "'Outfit', sans-serif", fontSize: 13, transition: "all 0.15s" }}>{opt}</button>
            );
          })}
          {submitted && q.explanation && (
            <div style={{ marginTop: 8, padding: "9px 12px", background: T.greenDim, borderRadius: 8, fontSize: 12, color: T.mid, lineHeight: 1.65 }}>
              💡 {q.explanation}
            </div>
          )}
        </div>
      ) : (
        <div>
          <textarea value={answer || ""} onChange={e => !submitted && onAnswer(e.target.value)} disabled={submitted}
            placeholder="Write your answer here…"
            style={{ width: "100%", minHeight: 90, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 12px", color: T.text, fontFamily: "'Outfit', sans-serif", fontSize: 13, resize: "vertical", outline: "none", lineHeight: 1.65, opacity: submitted ? 0.75 : 1 }} />
          {(submitted || showSample) ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: 0.8, marginBottom: 6 }}>SAMPLE ANSWER</div>
              <div style={{ padding: "10px 13px", background: T.tealDim, border: `1px solid ${T.teal}30`, borderRadius: 8, fontSize: 13, color: T.mid, lineHeight: 1.7 }}>{q.sampleAnswer}</div>
              {q.keyPoints?.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {q.keyPoints.map((kp, ki) => <span key={ki} style={{ padding: "3px 9px", background: T.tealDim, color: T.teal, borderRadius: 20, fontSize: 11 }}>{kp}</span>)}
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setShowSample(true)} style={{ marginTop: 6, background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 12, padding: "2px 0" }}>
              👁 Show sample answer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ folders, onNew, onNewFolder }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ textAlign: "center", maxWidth: 420, animation: "fadeUp 0.4s ease" }}>
        <div style={{ fontSize: 60, marginBottom: 18 }}>🎓</div>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 500, marginBottom: 12, color: T.text }}>Welcome to LearnAI</h2>
        <p style={{ color: T.muted, lineHeight: 1.75, marginBottom: 30, fontSize: 14 }}>
          Paste your lecture, get a clearer explanation, chat until everything clicks, then test yourself with an AI-powered quiz. All saved, organized, and ready to review.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {folders.length === 0
            ? <Btn variant="pri" onClick={onNewFolder}>Create your first folder →</Btn>
            : <Btn variant="pri" onClick={onNew}>+ Start a new session</Btn>}
        </div>
      </div>
    </div>
  );
}

function ApiSetup({ onSetup }) {
  const [key, setKey] = useState(""); const [model, setModel] = useState(MODELS[0].id);
  const [err, setErr] = useState(""); const [testing, setTesting] = useState(false);
  const go = async () => {
    if (!key.trim()) { setErr("Please enter your API key."); return; }
    setTesting(true); setErr("");
    try {
      await callAI(key.trim(), [{ role: "user", content: "Hi" }], model, null);
      onSetup(key.trim(), model);
    } catch (e) { setErr(e.message || "Invalid key or model. Try another model."); }
    setTesting(false);
  };
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ maxWidth: 460, width: "100%", animation: "fadeUp 0.4s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <div style={{ fontSize: 54, marginBottom: 12 }}>🎓</div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 34, fontWeight: 500, color: T.text, marginBottom: 8, letterSpacing: -0.5 }}>LearnAI</h1>
          <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.7 }}>Your AI study companion.<br />Paste lectures · Understand better · Ace quizzes.</p>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28 }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: 0.8, display: "block", marginBottom: 7 }}>OPENROUTER API KEY</label>
            <input type="password" value={key} onChange={e => { setKey(e.target.value); setErr(""); }} placeholder="sk-or-v1-…"
              onKeyDown={e => e.key === "Enter" && go()}
              style={{ width: "100%", background: T.surface, border: `1px solid ${err ? T.red : T.border}`, borderRadius: 8, padding: "11px 14px", color: T.text, fontFamily: "'Outfit', sans-serif", fontSize: 14, outline: "none" }} />
            <p style={{ fontSize: 12, color: T.muted, marginTop: 7, lineHeight: 1.5 }}>
              Free key at{" "}<a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: T.accent, textDecoration: "none" }}>openrouter.ai/keys</a>
              {" "}— many free models available.
            </p>
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: 0.8, display: "block", marginBottom: 7 }}>AI MODEL</label>
            <select value={model} onChange={e => setModel(e.target.value)}
              style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "11px 14px", color: T.text, fontFamily: "'Outfit', sans-serif", fontSize: 13, outline: "none", cursor: "pointer" }}>
              {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          {err && <div style={{ marginBottom: 16, padding: "10px 13px", background: T.redDim, border: `1px solid ${T.red}`, borderRadius: 8, color: T.red, fontSize: 13 }}>{err}</div>}
          <Btn variant="pri" onClick={go} disabled={testing} style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: 14 }}>
            {testing ? "Connecting…" : "Start Learning →"}
          </Btn>
        </div>
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {["📖 Paste lectures", "💬 Chat to clarify", "🧠 Quiz yourself"].map(f => (
            <div key={f} style={{ padding: "11px 8px", background: T.surface, borderRadius: 10, fontSize: 12, color: T.mid, textAlign: "center", lineHeight: 1.5 }}>{f}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  injectStyles();
  const [apiKey, setApiKey] = useState(""); const [model, setModel] = useState(MODELS[0].id); const [ready, setReady] = useState(false);
  const [folders, setFolders] = useState([]); const [sessions, setSessions] = useState([]);
  const [activeSessId, setActiveSessId] = useState(null); const [activeFolderId, setActiveFolderId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false); const [streaming, setStreaming] = useState("");
  const [showFolderModal, setShowFolderModal] = useState(false); const [showQuizSettings, setShowQuizSettings] = useState(false);
  const [activeQuizId, setActiveQuizId] = useState(null); const [showQuizHistory, setShowQuizHistory] = useState(false);
  const [input, setInput] = useState(""); const [sidebarOpen, setSidebarOpen] = useState(true);
  const [quizSettings, setQuizSettings] = useState({ type: "mcq", mcqPercent: 60, count: 8 });
  const [quizAnswers, setQuizAnswers] = useState({}); const [quizSubmitted, setQuizSubmitted] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    (async () => {
      const k = await Store.get("apiKey"); const m = await Store.get("model");
      const f = await Store.get("folders"); const s = await Store.get("sessions");
      if (k) { setApiKey(k); setReady(true); }
      if (m) setModel(m); if (f) setFolders(f); if (s) setSessions(s);
    })();
  }, []);

  useEffect(() => { if (folders.length) Store.set("folders", folders); }, [folders]);
  useEffect(() => { if (sessions.length) Store.set("sessions", sessions); }, [sessions]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [sessions, streaming]);

  const activeSess = sessions.find(s => s.id === activeSessId);
  const activeQuiz = activeSess?.quizzes?.find(q => q.id === activeQuizId);

  const handleSetup = async (k, m) => { await Store.set("apiKey", k); await Store.set("model", m); setApiKey(k); setModel(m); setReady(true); };

  const upd = useCallback((sid, fn) => {
    setSessions(prev => { const n = prev.map(s => s.id === sid ? fn(s) : s); Store.set("sessions", n); return n; });
  }, []);

  const createFolder = (name, emoji, color) => {
    const f = { id: uid(), name, emoji, color, createdAt: Date.now() };
    setFolders(p => { const n = [...p, f]; Store.set("folders", n); return n; });
    setActiveFolderId(f.id); setShowFolderModal(false);
  };

  const createSession = (folderId) => {
    const fid = folderId || folders[0]?.id;
    if (!fid) { setShowFolderModal(true); return; }
    const s = { id: uid(), folderId: fid, title: "New Session", createdAt: Date.now(), messages: [], lectureContent: "", quizzes: [] };
    setSessions(p => { const n = [s, ...p]; Store.set("sessions", n); return n; });
    setActiveSessId(s.id); setActiveFolderId(fid); setActiveQuizId(null); setQuizSubmitted(false); setQuizAnswers({});
  };

  const sendMessage = async () => {
    if (!input.trim() || isGenerating || !activeSessId) return;
    const content = input.trim(); setInput(""); setIsGenerating(true);
    const isFirst = activeSess.messages.length === 0;
    const userMsg = { id: uid(), role: "user", content, timestamp: Date.now() };
    upd(activeSessId, s => ({
      ...s,
      title: isFirst ? (content.slice(0, 52) + (content.length > 52 ? "…" : "")) : s.title,
      lectureContent: isFirst ? content : s.lectureContent,
      messages: [...s.messages, userMsg],
    }));
    const sysPrompt = isFirst ? SYS_EXPLAIN : (SYS_CHAT + `\n\nOriginal lecture:\n${activeSess.lectureContent}`);
    const hist = [...(activeSess.messages || []), userMsg].map(m => ({ role: m.role, content: m.content }));
    try {
      let full = ""; setStreaming("▌");
      full = await callAI(apiKey, [{ role: "system", content: sysPrompt }, ...hist], model, p => { setStreaming(p); });
      setStreaming("");
      const ai = { id: uid(), role: "assistant", content: full, timestamp: Date.now() };
      upd(activeSessId, s => ({ ...s, messages: [...s.messages, ai] }));
    } catch (e) {
      setStreaming("");
      upd(activeSessId, s => ({ ...s, messages: [...s.messages, { id: uid(), role: "assistant", content: `⚠️ ${e.message}`, timestamp: Date.now() }] }));
    }
    setIsGenerating(false);
  };

  const generateQuiz = async () => {
    if (!activeSess?.lectureContent || isGenerating) return;
    setIsGenerating(true); setShowQuizSettings(false);
    try {
      const prompt = buildQuizPrompt(quizSettings, activeSess.lectureContent);
      const resp = await callAI(apiKey, [{ role: "system", content: SYS_QUIZ }, { role: "user", content: prompt }], model);
      let questions;
      try {
        const arr = resp.match(/\[[\s\S]*\]/);
        questions = JSON.parse(arr ? arr[0] : resp.replace(/```json\n?|```\n?/g, "").trim());
      } catch { throw new Error("Could not parse quiz JSON. Try again."); }
      const quiz = { id: uid(), generatedAt: Date.now(), settings: { ...quizSettings }, questions, attempt: null };
      upd(activeSessId, s => ({ ...s, quizzes: [...(s.quizzes || []), quiz] }));
      setActiveQuizId(quiz.id); setQuizAnswers({}); setQuizSubmitted(false);
    } catch (e) {
      upd(activeSessId, s => ({ ...s, messages: [...s.messages, { id: uid(), role: "assistant", content: `⚠️ Quiz error: ${e.message}`, timestamp: Date.now() }] }));
    }
    setIsGenerating(false);
  };

  const submitQuiz = () => {
    if (!activeQuiz) return;
    let score = 0; let total = 0;
    activeQuiz.questions.forEach(q => { if (q.type === "mcq") { total++; if (quizAnswers[q.id] === q.correctIndex) score++; } });
    const pct = total > 0 ? Math.round((score / total) * 100) : null;
    const attempt = { answers: quizAnswers, mcqScore: score, mcqTotal: total, percentage: pct, completedAt: Date.now() };
    upd(activeSessId, s => ({ ...s, quizzes: s.quizzes.map(q => q.id === activeQuizId ? { ...q, attempt } : q) }));
    setQuizSubmitted(true);
  };

  const delSession = (id) => {
    setSessions(p => { const n = p.filter(s => s.id !== id); Store.set("sessions", n); return n; });
    if (activeSessId === id) { setActiveSessId(null); setActiveQuizId(null); }
  };

  const delFolder = (id) => {
    setFolders(p => { const n = p.filter(f => f.id !== id); Store.set("folders", n); return n; });
    setSessions(p => { const n = p.filter(s => s.folderId !== id); Store.set("sessions", n); return n; });
    if (activeFolderId === id) setActiveFolderId(null);
  };

  const openSession = (id) => {
    setActiveSessId(id); setActiveQuizId(null); setQuizSubmitted(false); setQuizAnswers({});
    const s = sessions.find(x => x.id === id);
    if (s?.folderId) setActiveFolderId(s.folderId);
  };

  if (!ready) return <ApiSetup onSetup={handleSetup} />;

  const visibleSessions = activeFolderId ? sessions.filter(s => s.folderId === activeFolderId) : sessions;

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, fontFamily: "'Outfit', sans-serif", color: T.text, overflow: "hidden" }}>
      {sidebarOpen && (
        <Sidebar folders={folders} sessions={visibleSessions} allSessions={sessions}
          activeFolderId={activeFolderId} activeSessionId={activeSessId}
          onFolderSelect={setActiveFolderId} onSessionSelect={openSession}
          onNew={createSession} onNewFolder={() => setShowFolderModal(true)}
          onDeleteSession={delSession} onDeleteFolder={delFolder} onClose={() => setSidebarOpen(false)} />
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <div style={{ padding: "11px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, background: T.surface, flexShrink: 0 }}>
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 18, padding: "2px 6px" }}>☰</button>
          )}
          <div style={{ flex: 1, overflow: "hidden" }}>
            {activeSess
              ? <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 500, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeSess.title}</span>
              : <span style={{ color: T.muted, fontSize: 13 }}>Select or create a session</span>}
          </div>
          {activeSess && (
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {activeQuizId ? (
                <Btn variant="sec" onClick={() => { setActiveQuizId(null); setQuizSubmitted(false); setQuizAnswers({}); }}>← Chat</Btn>
              ) : (
                <>
                  <Btn variant="sec" onClick={() => setShowQuizHistory(true)} disabled={!activeSess.quizzes?.length} title="View past quizzes">
                    📋 {activeSess.quizzes?.length || 0}
                  </Btn>
                  <Btn variant="pri" onClick={() => setShowQuizSettings(true)} disabled={!activeSess.lectureContent || isGenerating}>
                    {isGenerating ? "⏳" : "⚡"} {isGenerating ? "Generating…" : "Generate Quiz"}
                  </Btn>
                </>
              )}
            </div>
          )}
        </div>
        {!activeSess ? (
          <EmptyState folders={folders} onNew={() => createSession(activeFolderId || folders[0]?.id)} onNewFolder={() => setShowFolderModal(true)} />
        ) : activeQuizId ? (
          <QuizView quiz={activeQuiz} answers={quizAnswers} submitted={quizSubmitted}
            onAnswer={(qid, v) => setQuizAnswers(p => ({ ...p, [qid]: v }))}
            onSubmit={submitQuiz} onRegen={() => setShowQuizSettings(true)} />
        ) : (
          <ChatView session={activeSess} streaming={streaming} isGenerating={isGenerating}
            input={input} onInput={setInput} onSend={sendMessage} endRef={endRef} />
        )}
      </div>
      {showFolderModal && <FolderModal onClose={() => setShowFolderModal(false)} onCreate={createFolder} />}
      {showQuizSettings && <QuizSettingsModal settings={quizSettings} onChange={setQuizSettings} onClose={() => setShowQuizSettings(false)} onGenerate={generateQuiz} isGenerating={isGenerating} />}
      {showQuizHistory && activeSess && (
        <QuizHistoryModal quizzes={activeSess.quizzes || []} onClose={() => setShowQuizHistory(false)}
          onView={id => { const q = activeSess.quizzes.find(x => x.id === id); setActiveQuizId(id); setQuizSubmitted(!!q?.attempt); setQuizAnswers(q?.attempt?.answers || {}); setShowQuizHistory(false); }} />
      )}
    </div>
  );
}
