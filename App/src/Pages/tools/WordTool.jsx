import { useState, useEffect, useRef, useCallback } from "react";
import { CopyBtn, ActionBtn } from "./tk-shared";
import words from "an-array-of-english-words";

const ENGLISH_WORDS = words;
const FILLERS = ["the","a","an","in","on","of","with","and","but","that","which","while","from","into","through","between","among","during","along","under"];
const STOP = new Set(["the","and","for","that","this","with","are","was","have","has","not","but","from","they","been","were"]);

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ─── Text generator ───────────────────────────────────────────────────────────
function generateText(mode, count) {
  // mode: 'words' | 'sentences' | 'paragraphs'
  const allWords = [...ENGLISH_WORDS, ...FILLERS];

  function makeWord() { return pick(ENGLISH_WORDS); }

  function makeSentence(len = null) {
    const n = len ?? (5 + Math.floor(Math.random() * 12));
    const words = Array.from({ length: n }, makeWord);
    words[0] = cap(words[0]);
    return words.join(" ") + pick([".", ".", ".", "!", "?"]);
  }

  function makeParagraph() {
    const sentCount = 3 + Math.floor(Math.random() * 4);
    return Array.from({ length: sentCount }, () => makeSentence()).join(" ");
  }

  if (mode === "words") {
    return Array.from({ length: count }, makeWord).join(" ");
  }
  if (mode === "sentences") {
    return Array.from({ length: count }, () => makeSentence()).join(" ");
  }
  if (mode === "paragraphs") {
    return Array.from({ length: count }, makeParagraph).join("\n\n");
  }
  return "";
}

// ─── Word Lookup Modal ────────────────────────────────────────────────────────
function WordLookupModal({ word, onClose }) {
  const [definition, setDefinition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`);
        if (!res.ok) { if (!cancelled) setError("Word not found in dictionary."); return; }
        const data = await res.json();
        if (!cancelled) setDefinition(data[0]);
      } catch (err) {
        if (!cancelled) setError("Failed to fetch: " + err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [word]);

  return (
    <div onClick={onClose} style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",
      alignItems:"center",justifyContent:"center",zIndex:9999,backdropFilter:"blur(4px)",
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"var(--tk-bg)",border:"1px solid var(--tk-border)",
        borderRadius:"var(--tk-radius)",padding:"1.5rem",maxWidth:"680px",
        width:"92%",maxHeight:"80vh",overflowY:"auto",
        boxShadow:"0 24px 80px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1.25rem"}}>
          <div>
            <h3 style={{fontSize:"1.6rem",color:"var(--tk-text)",margin:"0 0 0.3rem"}}>{word}</h3>
            {definition?.phonetics?.find(p=>p.text)?.text && (
              <span style={{fontSize:"0.85rem",color:"var(--tk-accent)",fontFamily:"var(--tk-mono)"}}>
                {definition.phonetics.find(p=>p.text).text}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--tk-text-dim)",fontSize:"1.5rem",cursor:"pointer",lineHeight:1,padding:"0 0.25rem"}}>×</button>
        </div>

        {loading && (
          <div style={{textAlign:"center",color:"var(--tk-text-dim)",padding:"2rem"}}>
            <div style={{fontSize:"1.2rem",marginBottom:"0.4rem"}}>◌</div>
            <div style={{fontSize:"0.85rem"}}>Looking up definition…</div>
          </div>
        )}
        {error && (
          <div style={{padding:"1rem",background:"rgba(255,80,80,0.08)",border:"1px solid rgba(255,80,80,0.25)",borderRadius:"var(--tk-radius)",fontSize:"0.85rem",color:"#f66"}}>
            {error}
          </div>
        )}

        {definition && !loading && (
          <div style={{display:"flex",flexDirection:"column",gap:"1.5rem"}}>
            {definition.meanings?.map((meaning, idx) => (
              <div key={idx}>
                <div style={{fontSize:"0.8rem",color:"var(--tk-accent3)",fontStyle:"italic",letterSpacing:"0.05em",marginBottom:"0.6rem",fontFamily:"var(--tk-mono)"}}>
                  {meaning.partOfSpeech}
                </div>
                {meaning.definitions?.slice(0,5).map((def,i) => (
                  <div key={i} style={{display:"flex",gap:"0.6rem",marginBottom:"0.5rem",fontSize:"0.875rem"}}>
                    <span style={{color:"var(--tk-accent)",flexShrink:0}}>›</span>
                    <div>
                      <div style={{color:"var(--tk-text)"}}>{def.definition}</div>
                      {def.example && (
                        <div style={{color:"var(--tk-text-dim)",fontSize:"0.8rem",marginTop:"0.2rem",fontStyle:"italic"}}>
                          "{def.example}"
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {meaning.synonyms?.length > 0 && (
                  <div style={{display:"flex",flexWrap:"wrap",gap:"0.4rem",marginTop:"0.5rem"}}>
                    <span style={{fontSize:"0.7rem",color:"var(--tk-text-dim)",letterSpacing:"0.1em",flexBasis:"100%"}}>SYNONYMS</span>
                    {meaning.synonyms.slice(0,8).map(syn => (
                      <span key={syn} onClick={()=>{}} style={{
                        background:"var(--tk-surface2)",border:"1px solid var(--tk-border)",
                        borderRadius:"var(--tk-radius)",padding:"0.3rem 0.65rem",
                        fontSize:"0.8rem",color:"var(--tk-accent)",cursor:"default",
                      }}>{syn}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {definition.phonetics?.some(p=>p.audio) && (
              <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                {definition.phonetics.filter(p=>p.audio).map((p,i) => (
                  <button key={i} onClick={()=>new Audio(p.audio).play()} style={{
                    background:"var(--tk-accent)",border:"none",color:"var(--tk-bg)",
                    padding:"0.5rem 1rem",borderRadius:"var(--tk-radius)",cursor:"pointer",
                    fontSize:"0.85rem",fontWeight:600,
                  }}>▶ Listen</button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Generate Text Panel ──────────────────────────────────────────────────────
function GeneratePanel({ onInsert }) {
  const [genMode, setGenMode] = useState("sentences");
  const [genCount, setGenCount] = useState(3);
  const [preview, setPreview] = useState("");

  const generate = () => {
    const text = generateText(genMode, genCount);
    setPreview(text);
  };

  const modeOptions = [
    { id: "words", label: "Words" },
    { id: "sentences", label: "Sentences" },
    { id: "paragraphs", label: "Paragraphs" },
  ];

  const countOptions = {
    words: [10, 25, 50, 100, 200],
    sentences: [1, 3, 5, 10, 15],
    paragraphs: [1, 2, 3, 5, 8],
  };

  return (
    <div style={{
      background:"var(--tk-surface2)",border:"1px solid var(--tk-border)",
      borderRadius:"var(--tk-radius)",padding:"1rem",marginBottom:"1rem",
    }}>
      <div style={{fontSize:"0.7rem",color:"var(--tk-text-dim)",letterSpacing:"0.1em",marginBottom:"0.75rem"}}>GENERATE DUMMY TEXT</div>

      {/* Mode selector */}
      <div style={{display:"flex",gap:"0.35rem",marginBottom:"0.75rem"}}>
        {modeOptions.map(({ id, label }) => (
          <button key={id} onClick={() => { setGenMode(id); setPreview(""); }} style={{
            flex:1, padding:"0.35rem 0", fontSize:"0.75rem", cursor:"pointer",
            borderRadius:"var(--tk-radius)",
            background: genMode === id ? "var(--tk-accent)" : "var(--tk-surface)",
            border: `1px solid ${genMode === id ? "var(--tk-accent)" : "var(--tk-border)"}`,
            color: genMode === id ? "var(--tk-bg)" : "var(--tk-text-dim)",
            fontWeight: genMode === id ? 700 : 400, transition:"all 0.15s",
          }}>{label}</button>
        ))}
      </div>

      {/* Count selector */}
      <div style={{display:"flex",gap:"0.35rem",marginBottom:"0.75rem",flexWrap:"wrap"}}>
        {countOptions[genMode].map(n => (
          <button key={n} onClick={() => setGenCount(n)} style={{
            padding:"0.3rem 0.65rem", fontSize:"0.75rem", cursor:"pointer",
            borderRadius:"var(--tk-radius)",
            background: genCount === n ? "var(--tk-surface)" : "transparent",
            border: `1px solid ${genCount === n ? "var(--tk-border-bright)" : "var(--tk-border)"}`,
            color: genCount === n ? "var(--tk-text)" : "var(--tk-text-dim)",
            transition:"all 0.15s",
          }}>{n}</button>
        ))}
      </div>

      {/* Action row */}
      <div style={{display:"flex",gap:"0.5rem",marginBottom: preview ? "0.75rem" : 0}}>
        <button onClick={generate} style={{
          flex:1, padding:"0.45rem", fontSize:"0.8rem", cursor:"pointer",
          borderRadius:"var(--tk-radius)", border:"1px solid var(--tk-border)",
          background:"var(--tk-surface)", color:"var(--tk-text)", fontWeight:600,
          transition:"all 0.15s",
        }}>⚡ Generate</button>
        {preview && (
          <>
            <button onClick={() => onInsert(preview, false)} style={{
              flex:1, padding:"0.45rem", fontSize:"0.8rem", cursor:"pointer",
              borderRadius:"var(--tk-radius)", border:"1px solid var(--tk-accent)",
              background:"var(--tk-accent)", color:"var(--tk-bg)", fontWeight:600,
            }}>↩ Insert</button>
            <button onClick={() => onInsert(preview, true)} style={{
              padding:"0.45rem 0.75rem", fontSize:"0.8rem", cursor:"pointer",
              borderRadius:"var(--tk-radius)", border:"1px solid var(--tk-border)",
              background:"transparent", color:"var(--tk-text-dim)", fontSize:"0.75rem",
            }}>+ Append</button>
          </>
        )}
      </div>

      {preview && (
        <div style={{
          maxHeight:"120px", overflowY:"auto", fontSize:"0.78rem",
          color:"var(--tk-text-dim)", lineHeight:1.6,
          background:"var(--tk-surface)", borderRadius:"var(--tk-radius)",
          padding:"0.6rem 0.75rem", border:"1px solid var(--tk-border)",
          fontFamily:"var(--tk-mono)",
        }}>
          {preview}
        </div>
      )}
    </div>
  );
}

// ─── Random Word Card ─────────────────────────────────────────────────────────
function RandomWordCard({ onLookup }) {
  const [word, setWord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [def, setDef] = useState(null);
  const [error, setError] = useState(null);

  const fetchRandom = useCallback(async () => {
    // Pick a random word from our English list (common readable words)
    const candidate = pick(ENGLISH_WORDS);
    setWord(candidate);
    setDef(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${candidate}`);
      if (!res.ok) { setError("No definition found"); return; }
      const data = await res.json();
      const firstMeaning = data[0]?.meanings?.[0];
      setDef({
        pos: firstMeaning?.partOfSpeech,
        definition: firstMeaning?.definitions?.[0]?.definition,
        phonetic: data[0]?.phonetics?.find(p => p.text)?.text,
      });
    } catch {
      setError("Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div style={{
      background:"var(--tk-surface2)",border:"1px solid var(--tk-border)",
      borderRadius:"var(--tk-radius)",padding:"1rem",marginBottom:"1rem",
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
        <span style={{fontSize:"0.7rem",color:"var(--tk-text-dim)",letterSpacing:"0.1em"}}>WORD OF THE MOMENT</span>
        <button onClick={fetchRandom} disabled={loading} style={{
          background:"transparent",border:"1px solid var(--tk-border)",
          borderRadius:"var(--tk-radius)",padding:"0.25rem 0.65rem",
          fontSize:"0.75rem",cursor:"pointer",color:"var(--tk-text-dim)",
          transition:"all 0.15s", opacity: loading ? 0.5 : 1,
        }}>
          {loading ? "…" : "🎲 Random"}
        </button>
      </div>

      {!word && !loading && (
        <p style={{fontSize:"0.8rem",color:"var(--tk-text-dim)",margin:0,textAlign:"center",padding:"0.5rem 0"}}>
          Hit <strong>Random</strong> to learn a new word
        </p>
      )}

      {word && (
        <div>
          <div style={{display:"flex",alignItems:"baseline",gap:"0.75rem",marginBottom:"0.5rem"}}>
            <span style={{fontSize:"1.2rem",color:"var(--tk-text)",fontWeight:700}}>{word}</span>
            {def?.phonetic && <span style={{fontSize:"0.8rem",color:"var(--tk-accent)",fontFamily:"var(--tk-mono)"}}>{def.phonetic}</span>}
            {def?.pos && <span style={{fontSize:"0.7rem",color:"var(--tk-accent3)",fontStyle:"italic"}}>{def.pos}</span>}
          </div>

          {loading && <p style={{fontSize:"0.8rem",color:"var(--tk-text-dim)",margin:0}}>Fetching definition…</p>}
          {error && <p style={{fontSize:"0.8rem",color:"#f66",margin:0}}>{error}</p>}
          {def?.definition && (
            <p style={{fontSize:"0.83rem",color:"var(--tk-text)",margin:"0 0 0.75rem",lineHeight:1.55}}>{def.definition}</p>
          )}

          <button onClick={() => onLookup(word)} style={{
            background:"transparent",border:"1px solid var(--tk-accent)",
            borderRadius:"var(--tk-radius)",padding:"0.3rem 0.75rem",
            fontSize:"0.75rem",cursor:"pointer",color:"var(--tk-accent)",
            transition:"all 0.15s",
          }}>Full definition →</button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WordTool() {
  const [text, setText] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);
  const [lookupWord, setLookupWord] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [activeTab, setActiveTab] = useState("stats"); // 'stats' | 'generate'
  const textareaRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isMaximized) setIsMaximized(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaximized]);

  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const sentences = text.trim() ? text.split(/[.!?]+/).filter(s => s.trim()) : [];
  const paragraphs = text.trim() ? text.split(/\n\s*\n/).filter(p => p.trim()) : [];
  const unique = new Set(words.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, ""))).size;
  const rs = Math.max(1, Math.round((words.length / 200) * 60));
  const readTime = words.length === 0 ? "0s" : rs < 60 ? rs + "s" : Math.round(rs / 60) + "m " + (rs % 60) + "s";

  const freq = {};
  words.forEach(w => {
    const c = w.toLowerCase().replace(/[^a-z]/g, "");
    if (c.length > 2 && !STOP.has(c)) freq[c] = (freq[c] || 0) + 1;
  });
  const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12);

  const stats = [
    { val: words.length.toLocaleString(), lbl: "Words" },
    { val: text.length.toLocaleString(),  lbl: "Characters" },
    { val: text.replace(/\s/g,"").length.toLocaleString(), lbl: "No Spaces" },
    { val: text ? text.split("\n").length : 0, lbl: "Lines" },
    { val: sentences.length, lbl: "Sentences" },
    { val: readTime, lbl: "Read Time" },
    { val: paragraphs.length, lbl: "Paragraphs" },
    { val: unique, lbl: "Unique Words" },
  ];

  const handleInsert = (generated, append) => {
    if (append) {
      setText(prev => prev ? prev + "\n\n" + generated : generated);
    } else {
      setText(generated);
    }
  };

  const TAB_STYLE = (active) => ({
    flex: 1, padding: "0.4rem", fontSize: "0.75rem", cursor: "pointer",
    borderRadius: "var(--tk-radius)",
    background: active ? "var(--tk-surface)" : "transparent",
    border: `1px solid ${active ? "var(--tk-border-bright)" : "transparent"}`,
    color: active ? "var(--tk-text)" : "var(--tk-text-dim)",
    fontWeight: active ? 700 : 400, transition: "all 0.15s",
  });

  return (
    <div className={`tk-editor-container ${isMaximized ? "tk-editor-maximized" : ""}`}>
      {/* Header */}
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Word Counter &amp; Text Stats</h2>
        <div className="tk-tool-actions">
          <CopyBtn getText={() => text} />
          <ActionBtn danger onClick={() => setText("")}>Clear</ActionBtn>
          <button onClick={() => setIsMaximized(!isMaximized)} className="tk-editor-max-btn"
            title={isMaximized ? "Exit fullscreen" : "Fullscreen"}>
            {isMaximized ? "✕" : "⊞"}
          </button>
        </div>
      </div>

      {/* Two-column layout when not maximized */}
      <div style={{ display: isMaximized ? "block" : "flex", gap: "1rem" }}>

        {/* LEFT: Textarea */}
        <div style={{ flex: "1 1 55%", minWidth: 0 }}>
          <textarea
            ref={textareaRef}
            className={`tk-textarea ${isMaximized ? "tk-textarea-maximized" : ""}`}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste or type your text here…"
            style={{ minHeight: isMaximized ? undefined : "320px" }}
          />
        </div>

        {/* RIGHT: Panels (hidden when maximized) */}
        {!isMaximized && (
          <div style={{ flex: "0 0 280px", display: "flex", flexDirection: "column", gap: 0 }}>

            {/* Tab bar */}
            <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1rem" }}>
              <button style={TAB_STYLE(activeTab === "stats")} onClick={() => setActiveTab("stats")}>📊 Stats</button>
              <button style={TAB_STYLE(activeTab === "generate")} onClick={() => setActiveTab("generate")}>✨ Generate</button>
              <button style={TAB_STYLE(activeTab === "learn")} onClick={() => setActiveTab("learn")}>📚 Learn</button>
            </div>

            {/* Stats tab */}
            {activeTab === "stats" && (
              <>
                {/* Word lookup search */}
                <div style={{ display: "flex", marginBottom: "1rem" }}>
                  <input
                    type="text" value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && searchInput.trim() && setLookupWord(searchInput.trim())}
                    placeholder="Look up a word…"
                    style={{
                      flex:1, background:"var(--tk-surface)", border:"1px solid var(--tk-border)",
                      borderRight:"none", color:"var(--tk-text)", fontFamily:"var(--tk-mono)",
                      fontSize:"0.8rem", padding:"0.4rem 0.7rem",
                      borderRadius:"var(--tk-radius) 0 0 var(--tk-radius)", outline:"none",
                    }}
                    onFocus={e => e.target.style.borderColor = "var(--tk-accent)"}
                    onBlur={e => e.target.style.borderColor = "var(--tk-border)"}
                  />
                  <button onClick={() => searchInput.trim() && setLookupWord(searchInput.trim())} style={{
                    background:"var(--tk-accent)", border:"none", color:"var(--tk-bg)",
                    padding:"0.4rem 0.9rem", fontSize:"0.75rem", fontWeight:700, cursor:"pointer",
                    borderRadius:"0 var(--tk-radius) var(--tk-radius) 0",
                  }}>↵</button>
                </div>

                {/* Stats grid */}
                <div className="tk-stats-grid" style={{ marginBottom: "1rem" }}>
                  {stats.map(({ val, lbl }) => (
                    <div key={lbl} className="tk-stat-card">
                      <div className="tk-stat-val">{val}</div>
                      <div className="tk-stat-lbl">{lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Top words */}
                {topWords.length > 0 && (
                  <>
                    <div style={{ fontSize: "0.7rem", color: "var(--tk-text-dim)", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>TOP WORDS (click to define)</div>
                    <div className="tk-top-words">
                      {topWords.map(([w, c]) => (
                        <div key={w} className="tk-word-chip" onClick={() => setLookupWord(w)}
                          style={{ cursor: "pointer", transition: "all 0.15s" }}
                          title="Click to see definition"
                          onMouseEnter={e => { e.currentTarget.style.background = "var(--tk-accent)"; e.currentTarget.style.color = "var(--tk-bg)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "var(--tk-surface2)"; e.currentTarget.style.color = "var(--tk-accent)"; }}
                        >
                          {w}<span>{c}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* Generate tab */}
            {activeTab === "generate" && (
              <GeneratePanel onInsert={handleInsert} />
            )}

            {/* Learn tab */}
            {activeTab === "learn" && (
              <RandomWordCard onLookup={setLookupWord} />
            )}
          </div>
        )}
      </div>

      {/* Lookup modal */}
      {lookupWord && <WordLookupModal word={lookupWord} onClose={() => setLookupWord(null)} />}
    </div>
  );
}
