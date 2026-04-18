import { useState, useEffect, useRef, useCallback } from "react";

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg: "#0b0c11", surface: "#111318", card: "#181a24", cardHover: "#1e2030",
  border: "#23263a", borderLight: "#2e3348",
  accent: "#f5c518", accentHover: "#ffd740", accentDim: "rgba(245,197,24,0.13)",
  teal: "#4ecdc4", tealDim: "rgba(78,205,196,0.12)",
  green: "#52c97a", greenDim: "rgba(82,201,122,0.12)",
  red: "#e05252", redDim: "rgba(224,82,82,0.12)",
  purple: "#a78bfa", purpleDim: "rgba(167,139,250,0.14)",
  orange: "#f97316", orangeDim: "rgba(249,115,22,0.12)",
  text: "#e8e4de", muted: "#5e6480", mid: "#9298b0", white: "#fff",
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const injectStyles = (() => {
  let done = false;
  return () => {
    if (done) return; done = true;
    const s = document.createElement("style");
    s.textContent = [
      "@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,400&family=Outfit:wght@300;400;500;600&display=swap');",
      // Animations
      "@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}",
      "@keyframes fadeIn{from{opacity:0}to{opacity:1}}",
      "@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}",
      "@keyframes dot{0%,80%,100%{transform:scale(0.6)}40%{transform:scale(1)}}",
      "@keyframes spin{to{transform:rotate(360deg)}}",
      "@keyframes float{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-10px) rotate(2deg)}}",
      "@keyframes pulseGlow{0%,100%{box-shadow:0 0 0 0 rgba(245,197,24,0.5)}50%{box-shadow:0 0 0 10px rgba(245,197,24,0)}}",
      "@keyframes slideInLeft{from{transform:translateX(-260px);opacity:0}to{transform:translateX(0);opacity:1}}",
      "@keyframes popIn{0%{transform:scale(0.82) translateY(8px);opacity:0}60%{transform:scale(1.03)}100%{transform:scale(1);opacity:1}}",
      "@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}",
      "@keyframes celebrate{0%{transform:scale(1)}30%{transform:scale(1.18) rotate(-3deg)}70%{transform:scale(1.12) rotate(3deg)}100%{transform:scale(1)}}",
      "@keyframes confettiFall{0%{transform:translateY(-20px) rotate(0deg) scale(1);opacity:1}100%{transform:translateY(350px) rotate(720deg) scale(0.5);opacity:0}}",
      "@keyframes toastIn{from{transform:translateY(16px) translateX(-50%);opacity:0}to{transform:translateY(0) translateX(-50%);opacity:1}}",
      "@keyframes cardReveal{from{opacity:0;transform:translateY(20px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}",
      "@keyframes progressFill{from{width:0}to{width:var(--w)}}",
      "@keyframes streakPop{0%{transform:scale(1)}50%{transform:scale(1.4)}100%{transform:scale(1)}}",
      "@keyframes scanline{0%{background-position:0 0}100%{background-position:0 100%}}",
      "@keyframes dragPulse{0%,100%{border-color:rgba(245,197,24,0.4)}50%{border-color:rgba(245,197,24,0.9)}}",
      // Flip card
      ".flip-inner{transition:transform 0.6s cubic-bezier(.4,0,.2,1);transform-style:preserve-3d}",
      ".flip-inner.flipped{transform:rotateY(180deg)}",
      ".flip-face{backface-visibility:hidden;-webkit-backface-visibility:hidden;position:absolute;inset:0;border-radius:16px}",
      ".flip-back{transform:rotateY(180deg)}",
      // Hover helpers
      ".hvr{transition:all 0.18s!important}.hvr:hover{transform:translateY(-2px)!important;filter:brightness(1.08)!important}",
      ".hvr:active{transform:translateY(0)!important}",
      ".link-hvr{color:#f5c518;text-decoration:none;border-bottom:1px solid transparent;transition:border-color 0.15s}",
      ".link-hvr:hover{border-bottom-color:#f5c518}",
      // Scrollbar
      "::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#2a2d3e;border-radius:4px}",
      "*{box-sizing:border-box;margin:0;padding:0}",
    ].join("");
    document.head.appendChild(s);
  };
})();

// ─── API ──────────────────────────────────────────────────────────────────────
async function callAI(key, messages, model, onChunk) {
  const stream = !!onChunk;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://learnai.app",
      "X-Title": "LearnAI",
    },
    body: JSON.stringify({ model, messages, stream, max_tokens: 4096 }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error?.message || `API Error ${res.status}`);
  }
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

// ─── STORAGE (localStorage – works with Vite/GitHub Pages) ───────────────────
const Store = {
  set: (k, v) => { try { localStorage.setItem(`learnai:${k}`, JSON.stringify(v)); } catch {} },
  get: (k) => { try { const r = localStorage.getItem(`learnai:${k}`); return r ? JSON.parse(r) : null; } catch { return null; } },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtDate = (ts) => new Date(ts).toLocaleDateString("en", { month: "short", day: "numeric" });
const fmtFull = (ts) => new Date(ts).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

async function loadMammoth() {
  if (window.mammoth) return window.mammoth;
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
    s.onload = () => res(window.mammoth);
    s.onerror = () => rej(new Error("Could not load .docx parser"));
    document.head.appendChild(s);
  });
}

async function parseFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  const textExts = ["txt", "md", "markdown", "csv", "json", "js", "ts", "py", "html", "css", "xml", "rtf"];
  if (textExts.includes(ext)) return await file.text();
  if (ext === "docx" || ext === "doc") {
    const mammoth = await loadMammoth();
    const ab = await file.arrayBuffer();
    const result = await mammoth.extractRawValue({ arrayBuffer: ab });
    if (!result.value?.trim()) throw new Error("Empty document or could not extract text.");
    return result.value;
  }
  throw new Error(`Unsupported: .${ext} — try .txt, .md, .docx, or .csv`);
}

// ─── SYSTEM PROMPTS ───────────────────────────────────────────────────────────
const SYS_EXPLAIN = `You are LearnAI — an outstanding educational tutor. A student just shared their lecture/study material.

Your response:
1. Warmly acknowledge the topic (1 line)
2. Re-explain it more clearly: simple language, vivid analogies, real examples, logical structure
3. **Bold** the 3–5 most important concepts
4. End with: offer to clarify anything OR let them know they can click "Generate Quiz" to test themselves

Be encouraging. Always respond in the student's language.`;

const SYS_CHAT_DOC = (doc) => `You are LearnAI — a helpful AI tutor. The student has loaded a document for reference.

Document content:
${doc}

Use this document as context. Answer questions clearly with examples and analogies. Always respond in the student's language.`;

const SYS_CHAT = (doc) => `You are LearnAI — an outstanding educational tutor.
${doc ? `\nOriginal lecture:\n${doc}\n` : ""}
Answer questions clearly with examples and analogies. Encourage deeper thinking. Remind them about "Generate Quiz" occasionally. Always respond in the student's language.`;

const SYS_QUIZ = `You are an educational quiz generator. Generate questions from lecture content.
CRITICAL: Respond ONLY with a valid JSON array. No markdown, no text before/after, just raw JSON.
MCQ format: {"id":N,"type":"mcq","question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"correctIndex":0,"explanation":"..."}
Written format: {"id":N,"type":"written","question":"...","sampleAnswer":"...","keyPoints":["..."]}
Respond in the language of the lecture content.`;

const SYS_FLASHCARDS = `You are an educational flashcard generator.
CRITICAL: Respond ONLY with a valid JSON array. No markdown, no text before/after, just raw JSON.
Format: [{"id":N,"front":"question or term","back":"answer or definition","tag":"concept|formula|fact|date"}]
Generate 12–16 cards covering key concepts. Respond in the language of the content.`;

function buildQuizPrompt({ type, mcqPercent, count }, lecture) {
  const n = count;
  const instr =
    type === "mcq" ? `Generate ${n} multiple choice (MCQ) questions only.` :
    type === "written" ? `Generate ${n} written/open-ended questions only.` :
    type === "mixed" ? `Generate ${n} questions: roughly ${Math.ceil(n / 2)} MCQ and ${Math.floor(n / 2)} written.` :
    (() => { const m = Math.round(n * mcqPercent / 100); return `Generate exactly ${m} MCQ and ${n - m} written (${n} total).`; })();
  return `${instr}\n\nLecture content:\n${lecture}`;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const FOLDER_EMOJIS = ["📚", "🔬", "🧮", "🌍", "🎨", "⚗️", "🧬", "📐", "🏛️", "🎵", "💻", "📝", "🌱", "🔭", "⚽", "🎭"];
const FOLDER_COLORS = ["#f5c518", "#4ecdc4", "#ff6b6b", "#a78bfa", "#34d399", "#f97316", "#60a5fa", "#f472b6", "#94a3b8"];
const MODELS = [
  { id: "google/gemma-3-27b-it:free", label: "Gemma 3 27B · Free · Recommended" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B · Free" },
  { id: "deepseek/deepseek-r1:free", label: "DeepSeek R1 · Free · Reasoning" },
  { id: "mistralai/mistral-nemo:free", label: "Mistral Nemo · Free" },
  { id: "anthropic/claude-3-haiku", label: "Claude 3 Haiku · Paid" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini · Paid" },
  { id: "custom", label: "➕ Custom Model (OpenRouter)" },
];
const ACCEPTED_FILES = ".txt,.md,.markdown,.csv,.json,.js,.ts,.py,.html,.css,.xml,.docx,.doc";

// ─── Btn ──────────────────────────────────────────────────────────────────────
function Btn({ children, variant = "sec", disabled, onClick, style: s = {}, title }) {
  const variants = {
    pri: { background: T.accent, color: "#0b0c11", border: "none" },
    sec: { background: T.card, color: T.text, border: `1px solid ${T.border}` },
    ghost: { background: "transparent", color: T.mid, border: "none" },
    teal: { background: T.teal, color: "#0b0c11", border: "none" },
    purple: { background: T.purple, color: "#0b0c11", border: "none" },
    danger: { background: "transparent", color: T.red, border: "none" },
    orange: { background: T.orange, color: "#0b0c11", border: "none" },
  };
  return (
    <button onClick={onClick} disabled={disabled} title={title} className="hvr"
      style={{
        fontFamily: "'Outfit', sans-serif", fontWeight: 500, fontSize: 13, borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
        ...variants[variant], ...s,
      }}>
      {children}
    </button>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ children, onClose, title, width = 480 }) {
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(8px)" }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18,
        width, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto", animation: "popIn 0.28s ease" }}>
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${T.border}`, display: "flex",
          alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: T.card, zIndex: 2, borderRadius: "18px 18px 0 0" }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 500 }}>{title}</span>
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "0 4px", transition: "color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.color = T.text}
            onMouseLeave={e => e.currentTarget.style.color = T.muted}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type = "success", onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, []);
  const map = {
    success: { bg: T.greenDim, border: T.green, icon: "✓" },
    error: { bg: T.redDim, border: T.red, icon: "✕" },
    info: { bg: T.tealDim, border: T.teal, icon: "ℹ" },
    file: { bg: T.purpleDim, border: T.purple, icon: "📄" },
  };
  const c = map[type] || map.info;
  return (
    <div style={{
      position: "fixed", bottom: 28, left: "50%",
      padding: "12px 22px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12,
      display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.text,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)", animation: "toastIn 0.3s ease forwards",
      fontFamily: "'Outfit', sans-serif", zIndex: 9999, maxWidth: "80vw",
    }}>
      <span style={{ color: c.border, fontSize: 15 }}>{c.icon}</span>
      <span>{message}</span>
    </div>
  );
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function Confetti() {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 1.8,
    dur: 1.4 + Math.random() * 1.2,
    color: [T.accent, T.teal, T.green, T.purple, "#ff6b6b", T.orange][i % 6],
    size: 6 + Math.random() * 9,
    shape: Math.random() > 0.5 ? "50%" : "2px",
  }));
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9998, overflow: "hidden" }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position: "absolute", left: `${p.x}%`, top: -20,
          width: p.size, height: p.size, background: p.color, borderRadius: p.shape,
          animation: `confettiFall ${p.dur}s ${p.delay}s ease-in forwards`,
        }} />
      ))}
    </div>
  );
}

// ─── Label (reusable form label) ──────────────────────────────────────────────
const Lbl = ({ children }) => (
  <label style={{ fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: 0.9, display: "block", marginBottom: 7, textTransform: "uppercase" }}>{children}</label>
);

// ─── Input ────────────────────────────────────────────────────────────────────
const Inp = ({ style: s = {}, ...props }) => (
  <input {...props}
    style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
      padding: "10px 13px", color: T.text, fontFamily: "'Outfit', sans-serif", fontSize: 14, outline: "none",
      transition: "border-color 0.15s", ...s }}
    onFocus={e => { e.target.style.borderColor = T.accent; if (props.onFocus) props.onFocus(e); }}
    onBlur={e => { e.target.style.borderColor = T.border; if (props.onBlur) props.onBlur(e); }} />
);

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, label, desc }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px",
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10 }}>
      <div>
        <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{desc}</div>}
      </div>
      <button onClick={() => onChange(!value)}
        style={{
          width: 42, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
          background: value ? T.accent : T.border, position: "relative", transition: "background 0.25s", flexShrink: 0,
        }}>
        <div style={{
          width: 18, height: 18, borderRadius: "50%", background: "#fff",
          position: "absolute", top: 3, left: value ? 21 : 3, transition: "left 0.25s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        }} />
      </button>
    </div>
  );
}

// ─── FolderModal ──────────────────────────────────────────────────────────────
function FolderModal({ onClose, onCreate }) {
  const [name, setName] = useState(""); const [emoji, setEmoji] = useState("📚"); const [color, setColor] = useState("#f5c518");
  return (
    <Modal title="📁 Create Folder" onClose={onClose} width={400}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <Lbl>Folder Name</Lbl>
          <Inp autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Biology, History, Math…"
            onKeyDown={e => e.key === "Enter" && name.trim() && onCreate(name.trim(), emoji, color)} />
        </div>
        <div>
          <Lbl>Icon</Lbl>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {FOLDER_EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)} className="hvr"
                style={{ fontSize: 18, padding: "6px 7px", background: emoji === e ? T.accentDim : T.surface,
                  border: `1px solid ${emoji === e ? T.accent : T.border}`, borderRadius: 8, cursor: "pointer" }}>{e}</button>
            ))}
          </div>
        </div>
        <div>
          <Lbl>Color</Lbl>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FOLDER_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} className="hvr"
                style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: color === c ? `3px solid ${T.white}` : "2px solid transparent", cursor: "pointer" }} />
            ))}
          </div>
        </div>
        <Btn variant="pri" onClick={() => name.trim() && onCreate(name.trim(), emoji, color)} style={{ justifyContent: "center", marginTop: 4 }}>
          Create Folder
        </Btn>
      </div>
    </Modal>
  );
}

// ─── QuizSettingsModal ────────────────────────────────────────────────────────
function QuizSettingsModal({ settings, onChange, onClose, onGenerate, isGenerating }) {
  const { type, mcqPercent, count } = settings;
  const opts = [
    { val: "mcq", icon: "⬡", label: "Multiple Choice", desc: "A / B / C / D" },
    { val: "written", icon: "✎", label: "Written Answer", desc: "Type your own" },
    { val: "mixed", icon: "⇄", label: "Mixed 50/50", desc: "Half & half" },
    { val: "custom", icon: "⚙", label: "Custom Split", desc: "Your ratio" },
  ];
  return (
    <Modal title="⚡ Quiz Settings" onClose={onClose} width={450}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <Lbl>Question Format</Lbl>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {opts.map(o => (
              <button key={o.val} onClick={() => onChange({ ...settings, type: o.val })} className="hvr"
                style={{ padding: "12px 14px", background: type === o.val ? T.accentDim : T.surface,
                  border: `1px solid ${type === o.val ? T.accent : T.border}`, borderRadius: 10,
                  cursor: "pointer", color: type === o.val ? T.accent : T.text,
                  fontFamily: "'Outfit', sans-serif", textAlign: "left", transition: "all 0.18s" }}>
                <div style={{ fontSize: 16, marginBottom: 5 }}>{o.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{o.label}</div>
                <div style={{ fontSize: 11, color: type === o.val ? T.accent : T.muted, marginTop: 2 }}>{o.desc}</div>
              </button>
            ))}
          </div>
        </div>
        {type === "custom" && (
          <div style={{ animation: "fadeUp 0.2s ease" }}>
            <Lbl>Split: {mcqPercent}% MCQ · {100 - mcqPercent}% Written</Lbl>
            <input type="range" min="0" max="100" step="10" value={mcqPercent}
              onChange={e => onChange({ ...settings, mcqPercent: +e.target.value })}
              style={{ width: "100%", accentColor: T.accent }} />
          </div>
        )}
        <div>
          <Lbl>Number of Questions: {count}</Lbl>
          <input type="range" min="3" max="20" step="1" value={count}
            onChange={e => onChange({ ...settings, count: +e.target.value })}
            style={{ width: "100%", accentColor: T.accent }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, marginTop: 4 }}>
            <span>3</span><span>20</span>
          </div>
        </div>
        <Btn variant="pri" onClick={onGenerate} disabled={isGenerating} style={{ justifyContent: "center", padding: "12px", animation: !isGenerating ? "pulseGlow 2s infinite" : "none" }}>
          {isGenerating ? "⏳ Generating…" : `⚡ Generate ${count} Questions`}
        </Btn>
      </div>
    </Modal>
  );
}

// ─── QuizHistoryModal ─────────────────────────────────────────────────────────
function QuizHistoryModal({ quizzes, onClose, onView }) {
  return (
    <Modal title="📋 Quiz History" onClose={onClose} width={440}>
      {quizzes.length === 0
        ? <p style={{ color: T.muted, textAlign: "center", padding: "24px 0", fontSize: 14 }}>No quizzes yet.</p>
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...quizzes].reverse().map((q, i) => (
              <div key={q.id} onClick={() => onView(q.id)} className="hvr"
                style={{ padding: "14px 16px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between", transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = T.borderLight}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>
                    Quiz #{quizzes.length - i} · {q.questions?.length || 0} questions · {q.settings.type.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 12, color: T.muted }}>
                    {fmtFull(q.generatedAt)}
                    {q.attempt?.percentage != null && (
                      <span style={{ marginLeft: 8, color: q.attempt.percentage >= 70 ? T.green : q.attempt.percentage >= 40 ? T.accent : T.red, fontWeight: 600 }}>
                        · {q.attempt.percentage}%
                      </span>
                    )}
                    {q.attempt && q.attempt.percentage === null && <span style={{ marginLeft: 8, color: T.teal }}>· done</span>}
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

// ─── SettingsModal ────────────────────────────────────────────────────────────
function SettingsModal({ apiKey, model, customModel, onSave, onClose }) {
  const [key, setKey] = useState(apiKey);
  const [mdl, setMdl] = useState(model);
  const [custom, setCustom] = useState(customModel || "");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  const effectiveModel = mdl === "custom" ? custom.trim() : mdl;

  const save = async () => {
    if (!key.trim()) { setErr("API key cannot be empty."); return; }
    if (mdl === "custom" && !custom.trim()) { setErr("Enter a custom model ID."); return; }
    setTesting(true); setErr("");
    try {
      await callAI(key.trim(), [{ role: "user", content: "Hi" }], effectiveModel);
      onSave(key.trim(), mdl, custom.trim());
      setOk(true);
      setTimeout(onClose, 1200);
    } catch (e) { setErr(e.message || "Connection failed. Check key and model."); }
    setTesting(false);
  };

  return (
    <Modal title="⚙️ Settings" onClose={onClose} width={520}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

        {/* ── API Key ── */}
        <div>
          <Lbl>OpenRouter API Key</Lbl>
          <div style={{ position: "relative" }}>
            <Inp type={showKey ? "text" : "password"} value={key}
              onChange={e => { setKey(e.target.value); setErr(""); setOk(false); }}
              placeholder="sk-or-v1-…" style={{ paddingRight: 44 }} />
            <button onClick={() => setShowKey(x => !x)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 16, transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = T.text}
              onMouseLeave={e => e.currentTarget.style.color = T.muted}>
              {showKey ? "🙈" : "👁"}
            </button>
          </div>
          <p style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>
            Free key at{" "}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="link-hvr">openrouter.ai/keys</a>
          </p>
        </div>

        {/* ── Model ── */}
        <div>
          <Lbl>AI Model</Lbl>
          <select value={mdl} onChange={e => { setMdl(e.target.value); setErr(""); setOk(false); }}
            style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: "10px 13px", color: T.text, fontFamily: "'Outfit', sans-serif", fontSize: 13, outline: "none", cursor: "pointer" }}>
            {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>

        {/* ── Custom model ── */}
        {mdl === "custom" && (
          <div style={{ padding: 16, background: T.surface, border: `1px solid ${T.purple}50`, borderRadius: 12, animation: "fadeUp 0.22s ease" }}>
            <Lbl>Custom Model ID</Lbl>
            <Inp value={custom} onChange={e => setCustom(e.target.value)} placeholder="e.g. meta-llama/llama-4-scout:free" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 12, color: T.mid, lineHeight: 1.8 }}>
              <span style={{ color: T.text, fontWeight: 600 }}>How to find a model ID:</span><br />
              1. Go to{" "}
              <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer" className="link-hvr">openrouter.ai/models</a><br />
              2. Click any model → copy its <strong>Model ID</strong> (shown at the top)<br />
              3. Paste it above — models ending in{" "}
              <code style={{ color: T.accent, background: T.accentDim, padding: "1px 5px", borderRadius: 4 }}>:free</code>{" "}
              are free<br />
              4. If a model is rate-limited, try a different <code style={{ color: T.teal, background: T.tealDim, padding: "1px 5px", borderRadius: 4 }}>:free</code> one
            </div>
          </div>
        )}

        {err && (
          <div style={{ padding: "10px 13px", background: T.redDim, border: `1px solid ${T.red}`, borderRadius: 8, color: T.red, fontSize: 13, animation: "shake 0.4s ease" }}>
            {err}
          </div>
        )}
        {ok && (
          <div style={{ padding: "10px 13px", background: T.greenDim, border: `1px solid ${T.green}`, borderRadius: 8, color: T.green, fontSize: 13, animation: "fadeUp 0.2s ease" }}>
            ✓ Settings saved and connection verified!
          </div>
        )}

        <Btn variant="pri" onClick={save} disabled={testing} style={{ justifyContent: "center", padding: "12px" }}>
          {testing ? "⏳ Testing connection…" : "Save & Verify Settings"}
        </Btn>

        <p style={{ fontSize: 12, color: T.muted, textAlign: "center", lineHeight: 1.6 }}>
          Your key is saved locally in your browser — never sent anywhere except OpenRouter.
        </p>
      </div>
    </Modal>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ folders, sessions, allSessions, activeFolderId, activeSessionId, onFolderSelect, onSessionSelect, onNew, onNewFolder, onDeleteSession, onDeleteFolder, onClose, onSettings }) {
  const [hoverSess, setHoverSess] = useState(null);
  const [hoverFolder, setHoverFolder] = useState(null);
  return (
    <div style={{ width: 258, minWidth: 258, background: T.surface, borderRight: `1px solid ${T.border}`,
      display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden",
      animation: "slideInLeft 0.3s cubic-bezier(.4,0,.2,1)", position: "relative" }}>

      {/* Header */}
      <div style={{ padding: "15px 14px 12px", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20, animation: "float 3s ease-in-out infinite" }}>🎓</span>
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 17, color: T.accent, letterSpacing: -0.3 }}>LearnAI</span>
          </div>
          <button onClick={onClose} className="hvr"
            style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 15, padding: "2px 6px" }}>‹</button>
        </div>
        <Btn variant="pri" onClick={() => onNew(activeFolderId || folders[0]?.id)} style={{ width: "100%", justifyContent: "center" }}>
          + New Session
        </Btn>
      </div>

      {/* Folders */}
      <div style={{ padding: "12px 8px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 8px", marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: T.muted, fontWeight: 600, letterSpacing: 1 }}>FOLDERS</span>
          <button onClick={onNewFolder} className="hvr"
            style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 17, lineHeight: 1 }}>+</button>
        </div>
        <div onClick={() => onFolderSelect(null)} className="hvr"
          style={{ padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8,
            background: !activeFolderId ? T.accentDim : "transparent", color: !activeFolderId ? T.accent : T.text, marginBottom: 2 }}>
          <span>📂</span> All Sessions
          <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>{allSessions.length}</span>
        </div>
        {folders.map(f => (
          <div key={f.id} style={{ position: "relative" }}
            onMouseEnter={() => setHoverFolder(f.id)} onMouseLeave={() => setHoverFolder(null)}>
            <div onClick={() => onFolderSelect(f.id)} className="hvr"
              style={{ padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 7,
                background: activeFolderId === f.id ? T.accentDim : "transparent", color: activeFolderId === f.id ? T.accent : T.text,
                borderLeft: `3px solid ${activeFolderId === f.id ? f.color : "transparent"}`, marginBottom: 2 }}>
              <span style={{ fontSize: 14 }}>{f.emoji}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              <span style={{ fontSize: 11, color: T.muted }}>{allSessions.filter(s => s.folderId === f.id).length}</span>
              {hoverFolder === f.id && (
                <button onClick={e => { e.stopPropagation(); onDeleteFolder(f.id); }}
                  style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 12, padding: "1px 3px" }}>✕</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Sessions */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 16px" }}>
        <div style={{ fontSize: 10, color: T.muted, fontWeight: 600, letterSpacing: 1, padding: "4px 10px", marginBottom: 4 }}>SESSIONS</div>
        {sessions.length === 0
          ? <p style={{ fontSize: 12, color: T.muted, padding: "6px 10px" }}>No sessions yet</p>
          : sessions.map(s => {
            const folder = folders.find(f => f.id === s.folderId);
            const active = activeSessionId === s.id;
            return (
              <div key={s.id} style={{ position: "relative" }}
                onMouseEnter={() => setHoverSess(s.id)} onMouseLeave={() => setHoverSess(null)}>
                <div onClick={() => onSessionSelect(s.id)}
                  style={{ padding: "9px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 2,
                    background: active ? T.card : "transparent", borderLeft: `3px solid ${active ? (folder?.color || T.accent) : "transparent"}`,
                    transition: "all 0.12s" }}>
                  <div style={{ fontSize: 13, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: hoverSess === s.id ? 22 : 0 }}>
                    {s.fileLoaded && <span title="File session" style={{ marginRight: 4, fontSize: 11 }}>📄</span>}
                    {s.title}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2, display: "flex", gap: 5 }}>
                    <span>{folder?.emoji}</span><span>{fmtDate(s.createdAt)}</span>
                    {s.quizzes?.length > 0 && <span>· {s.quizzes.length} quiz</span>}
                    {s.flashcards?.length > 0 && <span>· {s.flashcards.length} cards</span>}
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

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: T.muted }}>LearnAI</span>
        <button onClick={onSettings} className="hvr"
          title="Settings"
          style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 18, padding: "2px 4px", transition: "color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.color = T.accent}
          onMouseLeave={e => e.currentTarget.style.color = T.muted}>⚙️</button>
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MsgBubble({ msg, isStreaming }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ marginBottom: 18, display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", animation: "fadeUp 0.22s ease" }}>
      {!isUser && (
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.accentDim, border: `1px solid ${T.accent}40`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginRight: 10, marginTop: 2 }}>🎓</div>
      )}
      <div style={{ maxWidth: "76%", padding: "11px 15px",
        borderRadius: isUser ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
        background: isUser ? T.accent : T.card, color: isUser ? "#0b0c11" : T.text,
        fontSize: 14, lineHeight: 1.78, fontWeight: isUser ? 500 : 400,
        border: isUser ? "none" : `1px solid ${T.border}`, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {msg.content}
        {isStreaming && (
          <span style={{ display: "inline-block", width: 2, height: 13, background: T.accent, marginLeft: 2,
            animation: "blink 0.9s infinite", verticalAlign: "text-bottom" }} />
        )}
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0", animation: "fadeUp 0.2s ease" }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: T.accentDim, border: `1px solid ${T.accent}40`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🎓</div>
      <div style={{ display: "flex", gap: 5, padding: "10px 14px", background: T.card, border: `1px solid ${T.border}`, borderRadius: "14px 14px 14px 3px" }}>
        {[0, 0.2, 0.4].map((d, i) => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: T.accent, animation: `dot 1.2s ${d}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ─── ChatView ─────────────────────────────────────────────────────────────────
function ChatView({ session, streaming, isGenerating, input, onInput, onSend, onFileLoad, endRef }) {
  const taRef = useRef(null);
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);

  const handleKey = e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSend(); };

  useEffect(() => {
    const el = taRef.current; if (!el) return;
    el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  const processFile = async (file) => {
    setFileLoading(true);
    try {
      const text = await parseFile(file);
      onFileLoad(text, file.name);
    } catch (e) {
      onFileLoad(null, null, e.message);
    }
    setFileLoading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const isEmpty = session.messages.length === 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}>

      {/* Drag overlay */}
      {dragging && (
        <div style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(11,12,17,0.85)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", border: `2px dashed ${T.accent}`,
          animation: "dragPulse 0.8s infinite", pointerEvents: "none" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 50, marginBottom: 12, animation: "float 1.5s ease-in-out infinite" }}>📂</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: T.accent }}>Drop to Load</div>
            <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Supports .txt .md .docx .csv and more</div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 22px" }}>
        {isEmpty ? (
          <div style={{ textAlign: "center", padding: "50px 20px", animation: "fadeUp 0.4s ease" }}>
            <div style={{ fontSize: 54, marginBottom: 16, animation: "float 3s ease-in-out infinite", display: "inline-block" }}>📖</div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 500, marginBottom: 10 }}>Drop your lecture here</h2>
            <p style={{ color: T.muted, fontSize: 14, maxWidth: 380, margin: "0 auto 24px", lineHeight: 1.7 }}>
              Paste text, upload a file, or drag & drop. The AI will explain it clearly, answer your questions, then quiz you.
            </p>

            {/* Auto-explain toggle */}
            <div style={{ maxWidth: 340, margin: "0 auto 20px", textAlign: "left" }}>
              <Toggle
                value={session.autoExplain !== false}
                onChange={(v) => session._setAutoExplain && session._setAutoExplain(v)}
                label="✨ Auto-explain content"
                desc="AI rewrites & explains on first message. Turn off to just ask questions directly."
              />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {["📋 Paste lecture", "📂 Upload file", "💬 Chat to understand", "🧠 Generate quiz"].map(t => (
                <span key={t} style={{ padding: "6px 12px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 20, fontSize: 12, color: T.mid }}>{t}</span>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 740, margin: "0 auto" }}>
            {session.fileLoaded && (
              <div style={{ marginBottom: 18, padding: "10px 16px", background: T.purpleDim, border: `1px solid ${T.purple}40`, borderRadius: 10, fontSize: 12, color: T.purple, display: "flex", alignItems: "center", gap: 8, animation: "fadeUp 0.3s ease" }}>
                <span>📄</span>
                <span><strong>{session.fileName || "Uploaded file"}</strong> · Content loaded as context</span>
              </div>
            )}
            {session.messages.map((m, i) => (
              <MsgBubble key={m.id} msg={m}
                isStreaming={streaming && i === session.messages.length - 1 && m.role === "assistant"} />
            ))}
            {streaming && !session.messages.find(m => m.role === "assistant" && m.content === streaming) && (
              <MsgBubble msg={{ role: "assistant", content: streaming }} isStreaming />
            )}
            {isGenerating && !streaming && <ThinkingDots />}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input area */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: "14px 22px", background: T.surface }}>
        <div style={{ maxWidth: 740, margin: "0 auto", position: "relative" }}>

          {/* File upload button */}
          <button onClick={() => fileRef.current?.click()} disabled={isGenerating || fileLoading}
            title="Upload a file (.txt, .md, .docx, .csv…)"
            style={{ position: "absolute", left: 10, bottom: 10, width: 30, height: 30, background: "none", border: "none",
              cursor: "pointer", fontSize: 16, color: T.muted, display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 6, transition: "color 0.15s, background 0.15s", zIndex: 2 }}
            onMouseEnter={e => { e.currentTarget.style.color = T.accent; e.currentTarget.style.background = T.accentDim; }}
            onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.background = "none"; }}>
            {fileLoading ? <div style={{ width: 14, height: 14, border: `2px solid ${T.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : "📎"}
          </button>
          <input ref={fileRef} type="file" accept={ACCEPTED_FILES} style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }} />

          <textarea ref={taRef} value={input} onChange={e => onInput(e.target.value)} onKeyDown={handleKey}
            placeholder={isEmpty ? "Paste your lecture here… or click 📎 to upload a file" : "Ask a question… (Ctrl+Enter to send)"}
            style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
              padding: "12px 52px 12px 46px", color: T.text, fontFamily: "'Outfit', sans-serif",
              fontSize: 14, resize: "none", outline: "none", minHeight: 48, lineHeight: 1.65, transition: "border-color 0.15s" }}
            onFocus={e => e.target.style.borderColor = T.accent}
            onBlur={e => e.target.style.borderColor = T.border} />

          <button onClick={onSend} disabled={!input.trim() || isGenerating}
            style={{ position: "absolute", right: 8, bottom: 8, width: 36, height: 36,
              background: input.trim() && !isGenerating ? T.accent : T.border, border: "none",
              borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.18s", animation: input.trim() && !isGenerating ? "pulseGlow 2s infinite" : "none" }}>↑</button>
        </div>
        <div style={{ maxWidth: 740, margin: "5px auto 0", fontSize: 11, color: T.muted, paddingLeft: 4 }}>
          Ctrl+Enter to send · drag & drop files · any language
        </div>
      </div>
    </div>
  );
}

// ─── QuizView ─────────────────────────────────────────────────────────────────
function QuizView({ quiz, answers, submitted, onAnswer, onSubmit, onRegen, showConfetti }) {
  const { questions = [], attempt, settings } = quiz;
  const answered = Object.keys(answers).length;
  const score = attempt;
  const big = submitted && score?.percentage >= 70;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 22px", position: "relative" }}>
      {big && <Confetti />}
      <div style={{ maxWidth: 740, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 500, marginBottom: 4 }}>Quiz</h2>
            <p style={{ color: T.muted, fontSize: 13 }}>
              {questions.length} questions · {settings?.type?.toUpperCase()}
              {submitted && score?.percentage != null && (
                <span style={{ marginLeft: 10, fontWeight: 600, color: score.percentage >= 70 ? T.green : score.percentage >= 40 ? T.accent : T.red }}>
                  · {score.percentage}% ({score.mcqScore}/{score.mcqTotal})
                </span>
              )}
            </p>
          </div>
          {submitted && <Btn variant="sec" onClick={onRegen}>↻ New Quiz</Btn>}
        </div>

        {submitted && score?.percentage != null && (
          <div style={{ marginBottom: 22, padding: "18px 22px", borderRadius: 14,
            background: score.percentage >= 70 ? T.greenDim : score.percentage >= 40 ? T.accentDim : T.redDim,
            border: `1px solid ${score.percentage >= 70 ? T.green : score.percentage >= 40 ? T.accent : T.red}`,
            animation: "celebrate 0.6s ease" }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>{score.percentage >= 70 ? "🏆" : score.percentage >= 40 ? "📈" : "💪"}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 500, marginBottom: 4 }}>
              {score.percentage >= 70 ? "Excellent work!" : score.percentage >= 40 ? "Good progress!" : "Keep practicing!"}
            </div>
            <div style={{ color: T.mid, fontSize: 13 }}>
              {score.mcqTotal > 0 ? `${score.mcqScore} of ${score.mcqTotal} MCQ correct (${score.percentage}%)` : "Written quiz completed."}
              {questions.some(q => q.type === "written") && " Review your written answers below."}
            </div>
          </div>
        )}

        {!submitted && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ height: 4, background: T.border, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ height: "100%", background: T.accent, width: `${questions.length ? (answered / questions.length) * 100 : 0}%`, transition: "width 0.4s ease", borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 11, color: T.muted }}>{answered} / {questions.length} answered</div>
          </div>
        )}

        {questions.map((q, i) => <QuestionCard key={q.id} q={q} i={i} answer={answers[q.id]} submitted={submitted} onAnswer={v => onAnswer(q.id, v)} />)}

        {!submitted && (
          <div style={{ marginTop: 20, paddingBottom: 40 }}>
            <Btn variant="pri" onClick={onSubmit} style={{ justifyContent: "center", padding: "12px 24px", fontSize: 14, width: "100%" }}>
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
    <div style={{ marginBottom: 16, padding: "18px 20px", background: T.card,
      border: `1px solid ${submitted && q.type === "mcq" ? (correct ? T.green : wrong ? T.red : T.border) : T.border}`,
      borderRadius: 13, animation: "cardReveal 0.28s ease" }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "flex-start" }}>
        <span style={{ background: T.accentDim, color: T.accent, borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600, flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
        <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.65, flex: 1 }}>{q.question}</span>
        {submitted && q.type === "mcq" && <span style={{ fontSize: 17, flexShrink: 0, animation: "popIn 0.3s ease" }}>{correct ? "✅" : "❌"}</span>}
      </div>
      {q.type === "mcq" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {(q.options || []).map((opt, oi) => {
            const sel = answer === oi; const isCorr = oi === q.correctIndex;
            let bg = T.surface, bdr = T.border, col = T.text;
            if (submitted) { if (isCorr) { bg = T.greenDim; bdr = T.green; col = T.green; } else if (sel) { bg = T.redDim; bdr = T.red; col = T.red; } }
            else if (sel) { bg = T.accentDim; bdr = T.accent; col = T.accent; }
            return (
              <button key={oi} onClick={() => !submitted && onAnswer(oi)} className={!submitted ? "hvr" : ""}
                style={{ padding: "9px 13px", background: bg, border: `1px solid ${bdr}`, borderRadius: 8, color: col,
                  textAlign: "left", cursor: submitted ? "default" : "pointer", fontFamily: "'Outfit', sans-serif",
                  fontSize: 13, transition: "all 0.15s" }}>{opt}</button>
            );
          })}
          {submitted && q.explanation && (
            <div style={{ marginTop: 8, padding: "9px 12px", background: T.tealDim, borderRadius: 8, fontSize: 12, color: T.mid, lineHeight: 1.65, animation: "fadeUp 0.3s ease" }}>
              💡 {q.explanation}
            </div>
          )}
        </div>
      ) : (
        <div>
          <textarea value={answer || ""} onChange={e => !submitted && onAnswer(e.target.value)} disabled={submitted}
            placeholder="Write your answer here…"
            style={{ width: "100%", minHeight: 90, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
              padding: "10px 12px", color: T.text, fontFamily: "'Outfit', sans-serif", fontSize: 13,
              resize: "vertical", outline: "none", lineHeight: 1.65, opacity: submitted ? 0.75 : 1 }} />
          {(submitted || showSample) ? (
            <div style={{ marginTop: 10, animation: "fadeUp 0.25s ease" }}>
              <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: 0.8, marginBottom: 6 }}>SAMPLE ANSWER</div>
              <div style={{ padding: "10px 13px", background: T.tealDim, border: `1px solid ${T.teal}30`, borderRadius: 8, fontSize: 13, color: T.mid, lineHeight: 1.7 }}>{q.sampleAnswer}</div>
              {q.keyPoints?.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {q.keyPoints.map((kp, ki) => <span key={ki} style={{ padding: "3px 9px", background: T.tealDim, color: T.teal, borderRadius: 20, fontSize: 11 }}>{kp}</span>)}
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setShowSample(true)}
              style={{ marginTop: 6, background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 12, padding: "2px 0" }}>
              👁 Show sample answer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── FlashcardView (Minigame) ─────────────────────────────────────────────────
function FlashcardView({ cards, onClose, onRegenerate, isLoading }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(new Set());
  const [reviewing, setReviewing] = useState([]);
  const [streak, setStreak] = useState(0);
  const [showStreak, setShowStreak] = useState(false);
  const [done, setDone] = useState(false);

  const card = cards[idx];
  const progress = known.size / cards.length;

  const TAG_COLORS = { concept: T.tealDim, formula: T.purpleDim, fact: T.accentDim, date: T.orangeDim };
  const TAG_TEXT = { concept: T.teal, formula: T.purple, fact: T.accent, date: T.orange };

  const markKnown = () => {
    const newKnown = new Set(known); newKnown.add(card.id); setKnown(newKnown);
    const newStreak = streak + 1; setStreak(newStreak);
    if (newStreak % 3 === 0) { setShowStreak(true); setTimeout(() => setShowStreak(false), 1500); }
    advance(newKnown);
  };

  const markReview = () => {
    setReviewing(r => [...r, card]); setStreak(0);
    advance(known);
  };

  const advance = (currentKnown) => {
    setFlipped(false);
    setTimeout(() => {
      if (idx < cards.length - 1) { setIdx(i => i + 1); }
      else if (currentKnown.size === cards.length) { setDone(true); }
      else {
        // Start review round
        const reviewCards = cards.filter(c => !currentKnown.has(c.id));
        setIdx(0); // reset but only show review cards – for simplicity just restart
        setDone(true); // show done screen with stats
      }
    }, 200);
  };

  if (isLoading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${T.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <div style={{ color: T.muted, fontSize: 14 }}>Generating flashcards…</div>
      </div>
    );
  }

  if (done) {
    const pct = Math.round((known.size / cards.length) * 100);
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        {pct >= 80 && <Confetti />}
        <div style={{ textAlign: "center", maxWidth: 400, animation: "celebrate 0.6s ease" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{pct >= 80 ? "🏆" : pct >= 50 ? "📈" : "💪"}</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 500, marginBottom: 10 }}>
            {pct >= 80 ? "Excellent!" : pct >= 50 ? "Good effort!" : "Keep going!"}
          </h2>
          <p style={{ color: T.mid, fontSize: 15, marginBottom: 8 }}>
            You knew <strong style={{ color: T.accent }}>{known.size}</strong> of <strong>{cards.length}</strong> cards ({pct}%)
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24 }}>
            <Btn variant="sec" onClick={onClose}>← Back to Chat</Btn>
            <Btn variant="pri" onClick={() => { setIdx(0); setFlipped(false); setKnown(new Set()); setReviewing([]); setStreak(0); setDone(false); }}>
              ↻ Retry All
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 22px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: T.surface }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 500 }}>🃏 Flashcards</span>
          <span style={{ fontSize: 12, color: T.muted, background: T.card, border: `1px solid ${T.border}`, padding: "3px 10px", borderRadius: 20 }}>
            {idx + 1} / {cards.length}
          </span>
          {streak >= 2 && (
            <span style={{ fontSize: 12, color: T.orange, background: T.orangeDim, border: `1px solid ${T.orange}50`, padding: "3px 10px", borderRadius: 20, animation: showStreak ? "streakPop 0.4s ease" : "none" }}>
              🔥 {streak} streak
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: T.green }}>{known.size} known</span>
          <Btn variant="ghost" onClick={onClose} style={{ fontSize: 12, padding: "6px 12px" }}>← Chat</Btn>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: T.border }}>
        <div style={{ height: "100%", background: T.green, width: `${progress * 100}%`, transition: "width 0.5s ease" }} />
      </div>

      {/* Card area */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 22px" }}>
        <div style={{ width: "100%", maxWidth: 560 }}>

          {/* 3D Flip Card */}
          <div style={{ perspective: "1200px", marginBottom: 20 }}
            onClick={() => setFlipped(f => !f)}>
            <div style={{ position: "relative", height: 260, cursor: "pointer" }}>
              <div className={`flip-inner${flipped ? " flipped" : ""}`} style={{ width: "100%", height: "100%" }}>
                {/* Front */}
                <div className="flip-face"
                  style={{ background: T.card, border: `1px solid ${T.border}`, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
                  {card?.tag && (
                    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, marginBottom: 16,
                      background: TAG_COLORS[card.tag] || T.accentDim, color: TAG_TEXT[card.tag] || T.accent, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>
                      {card.tag}
                    </span>
                  )}
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 500, lineHeight: 1.55, color: T.text }}>
                    {card?.front}
                  </div>
                  <div style={{ position: "absolute", bottom: 16, fontSize: 11, color: T.muted }}>tap to reveal →</div>
                </div>
                {/* Back */}
                <div className="flip-face flip-back"
                  style={{ background: T.accentDim, border: `1px solid ${T.accent}40`, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
                  <div style={{ fontSize: 14, lineHeight: 1.75, color: T.text, maxWidth: 400 }}>
                    {card?.back}
                  </div>
                  <div style={{ position: "absolute", bottom: 16, fontSize: 11, color: T.muted }}>tap to flip back</div>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons (only shown after flip) */}
          {flipped ? (
            <div style={{ display: "flex", gap: 12, animation: "fadeUp 0.22s ease" }}>
              <button onClick={markReview} className="hvr"
                style={{ flex: 1, padding: "13px", background: T.redDim, border: `1px solid ${T.red}50`,
                  borderRadius: 10, color: T.red, fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                ↩ Still Learning
              </button>
              <button onClick={markKnown} className="hvr"
                style={{ flex: 1, padding: "13px", background: T.greenDim, border: `1px solid ${T.green}50`,
                  borderRadius: 10, color: T.green, fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                ✓ Got It!
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <Btn variant="sec" onClick={() => { setIdx(i => Math.max(0, i - 1)); setFlipped(false); }} disabled={idx === 0} style={{ fontSize: 13 }}>← Prev</Btn>
              <Btn variant="pri" onClick={() => setFlipped(true)} style={{ padding: "9px 28px" }}>Flip Card ✦</Btn>
              <Btn variant="sec" onClick={() => { setIdx(i => Math.min(cards.length - 1, i + 1)); setFlipped(false); }} disabled={idx === cards.length - 1} style={{ fontSize: 13 }}>Next →</Btn>
            </div>
          )}

          {/* Mini progress */}
          <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
            {cards.map((c, ci) => (
              <div key={c.id} style={{ width: 8, height: 8, borderRadius: "50%", cursor: "pointer",
                background: known.has(c.id) ? T.green : ci === idx ? T.accent : T.border,
                transition: "background 0.3s", transform: ci === idx ? "scale(1.4)" : "scale(1)" }}
                onClick={() => { setIdx(ci); setFlipped(false); }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState({ folders, onNew, onNewFolder }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ textAlign: "center", maxWidth: 440, animation: "fadeUp 0.4s ease" }}>
        <div style={{ fontSize: 64, marginBottom: 18, animation: "float 3s ease-in-out infinite", display: "inline-block" }}>🎓</div>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 30, fontWeight: 500, marginBottom: 12, color: T.text, letterSpacing: -0.5 }}>Welcome to LearnAI</h2>
        <p style={{ color: T.muted, lineHeight: 1.75, marginBottom: 30, fontSize: 14 }}>
          Paste lectures, upload files, get clear explanations, chat until everything clicks, then test yourself with AI quizzes. Organized, saved, and ready to review.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {folders.length === 0
            ? <Btn variant="pri" onClick={onNewFolder} style={{ animation: "pulseGlow 2s infinite" }}>Create your first folder →</Btn>
            : <Btn variant="pri" onClick={onNew} style={{ animation: "pulseGlow 2s infinite" }}>+ Start a new session</Btn>}
        </div>
        <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, maxWidth: 320, margin: "28px auto 0" }}>
          {[
            ["📎", "Upload .txt .md .docx .csv"],
            ["💬", "Chat & ask questions"],
            ["🧠", "AI quizzes from content"],
            ["🃏", "Flashcard minigame"],
          ].map(([icon, txt]) => (
            <div key={txt} style={{ padding: "12px 10px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12, color: T.mid, textAlign: "center", lineHeight: 1.55 }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>{txt}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ApiSetup ─────────────────────────────────────────────────────────────────
function ApiSetup({ onSetup }) {
  const [key, setKey] = useState(""); const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(MODELS[0].id); const [custom, setCustom] = useState("");
  const [err, setErr] = useState(""); const [testing, setTesting] = useState(false);

  const effectiveModel = model === "custom" ? custom.trim() : model;

  const go = async () => {
    if (!key.trim()) { setErr("Please enter your API key."); return; }
    if (model === "custom" && !custom.trim()) { setErr("Enter a custom model ID."); return; }
    setTesting(true); setErr("");
    try {
      await callAI(key.trim(), [{ role: "user", content: "Hi" }], effectiveModel);
      onSetup(key.trim(), model, custom.trim());
    } catch (e) { setErr(e.message || "Invalid key or model. Try another."); }
    setTesting(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ maxWidth: 480, width: "100%", animation: "fadeUp 0.45s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <div style={{ fontSize: 58, marginBottom: 14, animation: "float 3s ease-in-out infinite", display: "inline-block" }}>🎓</div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 36, fontWeight: 500, color: T.text, marginBottom: 8, letterSpacing: -0.5 }}>LearnAI</h1>
          <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.7 }}>Your AI study companion.<br />Upload lectures · Understand better · Ace quizzes.</p>
        </div>

        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 28 }}>

          {/* API Key */}
          <div style={{ marginBottom: 20 }}>
            <Lbl>OpenRouter API Key</Lbl>
            <div style={{ position: "relative" }}>
              <Inp type={showKey ? "text" : "password"} value={key}
                onChange={e => { setKey(e.target.value); setErr(""); }} placeholder="sk-or-v1-…"
                onKeyDown={e => e.key === "Enter" && go()} style={{ paddingRight: 44 }} />
              <button onClick={() => setShowKey(x => !x)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 16 }}>
                {showKey ? "🙈" : "👁"}
              </button>
            </div>
            <p style={{ fontSize: 12, color: T.muted, marginTop: 7, lineHeight: 1.55 }}>
              Free key at{" "}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="link-hvr">openrouter.ai/keys</a>
              {" "}— many free models available.
            </p>
          </div>

          {/* Model */}
          <div style={{ marginBottom: model === "custom" ? 16 : 24 }}>
            <Lbl>AI Model</Lbl>
            <select value={model} onChange={e => setModel(e.target.value)}
              style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
                padding: "11px 14px", color: T.text, fontFamily: "'Outfit', sans-serif", fontSize: 13, outline: "none", cursor: "pointer" }}>
              {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>

          {/* Custom model panel */}
          {model === "custom" && (
            <div style={{ marginBottom: 24, padding: 16, background: T.surface, border: `1px solid ${T.purple}50`, borderRadius: 12, animation: "fadeUp 0.22s ease" }}>
              <Lbl>Custom Model ID</Lbl>
              <Inp value={custom} onChange={e => setCustom(e.target.value)} placeholder="e.g. google/gemma-3-27b-it:free" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 12, color: T.mid, lineHeight: 1.8 }}>
                <strong style={{ color: T.text }}>Finding model IDs:</strong><br />
                1. Visit{" "}<a href="https://openrouter.ai/models" target="_blank" rel="noreferrer" className="link-hvr">openrouter.ai/models</a><br />
                2. Click a model → copy its ID at the top of the page<br />
                3. Models with <code style={{ color: T.accent, background: T.accentDim, padding: "1px 5px", borderRadius: 4 }}>:free</code> suffix = free to use<br />
                4. If rate-limited, simply try a different model
              </div>
            </div>
          )}

          {err && (
            <div style={{ marginBottom: 16, padding: "10px 13px", background: T.redDim, border: `1px solid ${T.red}`, borderRadius: 8, color: T.red, fontSize: 13, animation: "shake 0.4s ease" }}>
              {err}
            </div>
          )}

          <Btn variant="pri" onClick={go} disabled={testing} style={{ width: "100%", justifyContent: "center", padding: "13px", fontSize: 14, animation: !testing ? "pulseGlow 2s infinite" : "none" }}>
            {testing ? "⏳ Connecting…" : "Start Learning →"}
          </Btn>
        </div>

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[["📎", "Upload files"], ["💬", "Chat to clarify"], ["🧠", "AI quizzes"], ["🃏", "Flashcards"]].map(([i, t]) => (
            <div key={t} style={{ padding: "10px 6px", background: T.surface, borderRadius: 10, fontSize: 11, color: T.mid, textAlign: "center", lineHeight: 1.5 }}>
              <div style={{ fontSize: 16, marginBottom: 3 }}>{i}</div>{t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── App (Main) ───────────────────────────────────────────────────────────────
export default function App() {
  injectStyles();

  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [customModel, setCustomModel] = useState("");
  const [ready, setReady] = useState(false);
  const [folders, setFolders] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSessId, setActiveSessId] = useState(null);
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showQuizSettings, setShowQuizSettings] = useState(false);
  const [showQuizHistory, setShowQuizHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [quizSettings, setQuizSettings] = useState({ type: "mcq", mcqPercent: 60, count: 8 });
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [toast, setToast] = useState(null);
  const endRef = useRef(null);

  const effectiveModel = model === "custom" ? customModel : model;

  // Load from localStorage on mount
  useEffect(() => {
    const k = Store.get("apiKey");
    const m = Store.get("model");
    const cm = Store.get("customModel");
    const f = Store.get("folders");
    const s = Store.get("sessions");
    if (k) { setApiKey(k); setReady(true); }
    if (m) setModel(m);
    if (cm) setCustomModel(cm || "");
    if (f) setFolders(f);
    if (s) setSessions(s);
  }, []);

  // Persist on changes
  useEffect(() => { if (folders.length) Store.set("folders", folders); }, [folders]);
  useEffect(() => { Store.set("sessions", sessions); }, [sessions]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [sessions, streaming]);

  const activeSess = sessions.find(s => s.id === activeSessId);
  const activeQuiz = activeSess?.quizzes?.find(q => q.id === activeQuizId);

  const showToast = (message, type = "success") => {
    setToast({ message, type, id: uid() });
  };

  const handleSetup = (k, m, cm) => {
    Store.set("apiKey", k); Store.set("model", m); Store.set("customModel", cm);
    setApiKey(k); setModel(m); setCustomModel(cm); setReady(true);
  };

  const handleSaveSettings = (k, m, cm) => {
    Store.set("apiKey", k); Store.set("model", m); Store.set("customModel", cm);
    setApiKey(k); setModel(m); setCustomModel(cm);
    showToast("Settings saved!", "success");
  };

  const upd = useCallback((sid, fn) => {
    setSessions(prev => {
      const n = prev.map(s => s.id === sid ? fn(s) : s);
      Store.set("sessions", n);
      return n;
    });
  }, []);

  const createFolder = (name, emoji, color) => {
    const f = { id: uid(), name, emoji, color, createdAt: Date.now() };
    setFolders(p => { const n = [...p, f]; Store.set("folders", n); return n; });
    setActiveFolderId(f.id); setShowFolderModal(false);
  };

  const createSession = (folderId) => {
    const fid = folderId || folders[0]?.id;
    if (!fid) { setShowFolderModal(true); return; }
    const s = { id: uid(), folderId: fid, title: "New Session", createdAt: Date.now(), messages: [], lectureContent: "", quizzes: [], flashcards: [], autoExplain: true };
    setSessions(p => { const n = [s, ...p]; Store.set("sessions", n); return n; });
    setActiveSessId(s.id); setActiveFolderId(fid); setActiveQuizId(null); setQuizSubmitted(false); setQuizAnswers({}); setShowFlashcards(false);
  };

  // Set auto-explain toggle for active session
  const setAutoExplain = (val) => {
    if (!activeSessId) return;
    upd(activeSessId, s => ({ ...s, autoExplain: val }));
  };

  // Handle file upload
  const handleFileLoad = (text, fileName, err) => {
    if (err || !text) { showToast(err || "Could not read file", "error"); return; }
    if (!activeSessId) { showToast("Create a session first", "error"); return; }
    upd(activeSessId, s => ({
      ...s,
      lectureContent: text,
      fileLoaded: true,
      fileName,
      title: fileName || s.title,
      autoExplain: s.autoExplain ?? false, // default OFF for file uploads
    }));
    showToast(`📄 ${fileName} loaded — ask questions or generate a quiz!`, "file");
  };

  const sendMessage = async () => {
    if (!input.trim() || isGenerating || !activeSessId) return;
    const content = input.trim(); setInput(""); setIsGenerating(true);
    const sess = sessions.find(s => s.id === activeSessId);
    const isFirst = sess.messages.length === 0;
    const userMsg = { id: uid(), role: "user", content, timestamp: Date.now() };

    upd(activeSessId, s => ({
      ...s,
      title: isFirst && !s.fileLoaded ? (content.slice(0, 52) + (content.length > 52 ? "…" : "")) : s.title,
      lectureContent: isFirst && !s.fileLoaded && s.autoExplain !== false ? content : s.lectureContent,
      messages: [...s.messages, userMsg],
    }));

    // Pick system prompt
    let sysPrompt;
    if (isFirst && !sess.fileLoaded && sess.autoExplain !== false) {
      sysPrompt = SYS_EXPLAIN; // paste & auto-explain
    } else {
      const doc = sess.lectureContent || (isFirst && !sess.fileLoaded ? content : "");
      sysPrompt = doc ? SYS_CHAT_DOC(doc) : SYS_CHAT("");
    }

    const hist = [...(sess.messages || []), userMsg].map(m => ({ role: m.role, content: m.content }));
    try {
      let full = ""; setStreaming("▌");
      full = await callAI(apiKey, [{ role: "system", content: sysPrompt }, ...hist], effectiveModel, p => { setStreaming(p); });
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
      const resp = await callAI(apiKey, [{ role: "system", content: SYS_QUIZ }, { role: "user", content: prompt }], effectiveModel);
      let questions;
      try { const arr = resp.match(/\[[\s\S]*\]/); questions = JSON.parse(arr ? arr[0] : resp.replace(/```json\n?|```\n?/g, "").trim()); }
      catch { throw new Error("Could not parse quiz. Try again."); }
      const quiz = { id: uid(), generatedAt: Date.now(), settings: { ...quizSettings }, questions, attempt: null };
      upd(activeSessId, s => ({ ...s, quizzes: [...(s.quizzes || []), quiz] }));
      setActiveQuizId(quiz.id); setQuizAnswers({}); setQuizSubmitted(false);
    } catch (e) {
      upd(activeSessId, s => ({ ...s, messages: [...s.messages, { id: uid(), role: "assistant", content: `⚠️ Quiz error: ${e.message}`, timestamp: Date.now() }] }));
    }
    setIsGenerating(false);
  };

  const generateFlashcards = async () => {
    if (!activeSess?.lectureContent || isGenerating) return;
    // Use cached cards if available
    if (activeSess.flashcards?.length > 0) { setShowFlashcards(true); return; }
    setFlashcardsLoading(true); setShowFlashcards(true);
    try {
      const resp = await callAI(apiKey, [
        { role: "system", content: SYS_FLASHCARDS },
        { role: "user", content: `Generate flashcards from:\n${activeSess.lectureContent}` },
      ], effectiveModel);
      let cards;
      try { const arr = resp.match(/\[[\s\S]*\]/); cards = JSON.parse(arr ? arr[0] : resp.replace(/```json\n?|```\n?/g, "").trim()); }
      catch { throw new Error("Could not parse flashcards."); }
      upd(activeSessId, s => ({ ...s, flashcards: cards }));
    } catch (e) {
      showToast(`Flashcard error: ${e.message}`, "error");
      setShowFlashcards(false);
    }
    setFlashcardsLoading(false);
  };

  const submitQuiz = () => {
    if (!activeQuiz) return;
    let score = 0, total = 0;
    activeQuiz.questions.forEach(q => { if (q.type === "mcq") { total++; if (quizAnswers[q.id] === q.correctIndex) score++; } });
    const pct = total > 0 ? Math.round((score / total) * 100) : null;
    const attempt = { answers: quizAnswers, mcqScore: score, mcqTotal: total, percentage: pct, completedAt: Date.now() };
    upd(activeSessId, s => ({ ...s, quizzes: s.quizzes.map(q => q.id === activeQuizId ? { ...q, attempt } : q) }));
    setQuizSubmitted(true);
  };

  const delSession = (id) => {
    setSessions(p => { const n = p.filter(s => s.id !== id); Store.set("sessions", n); return n; });
    if (activeSessId === id) { setActiveSessId(null); setActiveQuizId(null); setShowFlashcards(false); }
  };

  const delFolder = (id) => {
    setFolders(p => { const n = p.filter(f => f.id !== id); Store.set("folders", n); return n; });
    setSessions(p => { const n = p.filter(s => s.folderId !== id); Store.set("sessions", n); return n; });
    if (activeFolderId === id) setActiveFolderId(null);
  };

  const openSession = (id) => {
    setActiveSessId(id); setActiveQuizId(null); setQuizSubmitted(false); setQuizAnswers({}); setShowFlashcards(false);
    const s = sessions.find(x => x.id === id);
    if (s?.folderId) setActiveFolderId(s.folderId);
  };

  if (!ready) return <ApiSetup onSetup={handleSetup} />;

  const visibleSessions = activeFolderId ? sessions.filter(s => s.folderId === activeFolderId) : sessions;
  const inQuiz = !!activeQuizId && !showFlashcards;
  const inFlash = showFlashcards;

  // Inject setAutoExplain into session object for Toggle
  const sessWithToggle = activeSess ? { ...activeSess, _setAutoExplain: setAutoExplain } : null;

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, fontFamily: "'Outfit', sans-serif", color: T.text, overflow: "hidden" }}>

      {sidebarOpen && (
        <Sidebar
          folders={folders} sessions={visibleSessions} allSessions={sessions}
          activeFolderId={activeFolderId} activeSessionId={activeSessId}
          onFolderSelect={setActiveFolderId} onSessionSelect={openSession}
          onNew={createSession} onNewFolder={() => setShowFolderModal(true)}
          onDeleteSession={delSession} onDeleteFolder={delFolder}
          onClose={() => setSidebarOpen(false)}
          onSettings={() => setShowSettings(true)} />
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* ── Header bar ── */}
        <div style={{ padding: "11px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, background: T.surface, flexShrink: 0 }}>
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="hvr"
              style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 18, padding: "2px 6px" }}>☰</button>
          )}
          <div style={{ flex: 1, overflow: "hidden" }}>
            {activeSess
              ? <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 500, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activeSess.fileLoaded && <span style={{ marginRight: 5, fontSize: 13 }}>📄</span>}
                  {activeSess.title}
                </span>
              : <span style={{ color: T.muted, fontSize: 13 }}>Select or create a session</span>}
          </div>

          {/* Model badge */}
          <span style={{ fontSize: 11, color: T.muted, background: T.card, border: `1px solid ${T.border}`, padding: "3px 8px", borderRadius: 20, flexShrink: 0, display: "none", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={effectiveModel}
            ref={el => { if (el) el.style.display = "inline"; }}>
            {effectiveModel.split("/").pop()?.replace(/:free$/, "") || "model"}
          </span>

          {activeSess && (
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {inQuiz ? (
                <Btn variant="sec" onClick={() => { setActiveQuizId(null); setQuizSubmitted(false); setQuizAnswers({}); }}>← Chat</Btn>
              ) : inFlash ? (
                <Btn variant="sec" onClick={() => setShowFlashcards(false)}>← Chat</Btn>
              ) : (
                <>
                  <Btn variant="sec" onClick={() => setShowQuizHistory(true)} disabled={!activeSess.quizzes?.length}
                    title={`${activeSess.quizzes?.length || 0} quiz(zes)`}>
                    📋 {activeSess.quizzes?.length || 0}
                  </Btn>
                  <Btn variant="sec" onClick={generateFlashcards}
                    disabled={!activeSess.lectureContent || isGenerating}
                    title="Flashcard minigame">
                    🃏 {activeSess.flashcards?.length > 0 ? activeSess.flashcards.length : "Cards"}
                  </Btn>
                  <Btn variant="pri" onClick={() => setShowQuizSettings(true)}
                    disabled={!activeSess.lectureContent || isGenerating}
                    style={{ animation: activeSess.lectureContent && !isGenerating ? "pulseGlow 2s infinite" : "none" }}>
                    {isGenerating ? "⏳" : "⚡"} {isGenerating ? "Generating…" : "Quiz"}
                  </Btn>
                </>
              )}
            </div>
          )}

          {!activeSess && (
            <button onClick={() => setShowSettings(true)} className="hvr"
              title="Settings"
              style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 18, padding: "2px 6px" }}>⚙️</button>
          )}
        </div>

        {/* ── Main content ── */}
        {!activeSess ? (
          <EmptyState folders={folders} onNew={() => createSession(activeFolderId || folders[0]?.id)} onNewFolder={() => setShowFolderModal(true)} />
        ) : inFlash ? (
          <FlashcardView
            cards={activeSess.flashcards || []}
            isLoading={flashcardsLoading}
            onClose={() => setShowFlashcards(false)}
            onRegenerate={() => { upd(activeSessId, s => ({ ...s, flashcards: [] })); generateFlashcards(); }} />
        ) : inQuiz ? (
          <QuizView quiz={activeQuiz} answers={quizAnswers} submitted={quizSubmitted}
            onAnswer={(qid, v) => setQuizAnswers(p => ({ ...p, [qid]: v }))}
            onSubmit={submitQuiz}
            onRegen={() => setShowQuizSettings(true)} />
        ) : (
          <ChatView session={sessWithToggle} streaming={streaming} isGenerating={isGenerating}
            input={input} onInput={setInput} onSend={sendMessage}
            onFileLoad={handleFileLoad} endRef={endRef} />
        )}
      </div>

      {/* ── Modals ── */}
      {showFolderModal && <FolderModal onClose={() => setShowFolderModal(false)} onCreate={createFolder} />}
      {showQuizSettings && (
        <QuizSettingsModal settings={quizSettings} onChange={setQuizSettings}
          onClose={() => setShowQuizSettings(false)} onGenerate={generateQuiz} isGenerating={isGenerating} />
      )}
      {showQuizHistory && activeSess && (
        <QuizHistoryModal quizzes={activeSess.quizzes || []} onClose={() => setShowQuizHistory(false)}
          onView={id => {
            const q = activeSess.quizzes.find(x => x.id === id);
            setActiveQuizId(id); setQuizSubmitted(!!q?.attempt); setQuizAnswers(q?.attempt?.answers || {}); setShowQuizHistory(false);
          }} />
      )}
      {showSettings && (
        <SettingsModal apiKey={apiKey} model={model} customModel={customModel}
          onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />
      )}

      {/* ── Toast ── */}
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}