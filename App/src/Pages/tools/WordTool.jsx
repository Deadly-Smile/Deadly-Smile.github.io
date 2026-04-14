import { useState, useEffect } from "react";
import { CopyBtn, ActionBtn } from "./tk-shared";

const STOP=new Set(["the","and","for","that","this","with","are","was","have","has","not","but","from","they","been","were"]);

// ── Word Lookup Modal ─────────────────────────────────────────────────────
function WordLookupModal({ word, onClose }) {
  const [definition, setDefinition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDefinition = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`);
        
        if (!res.ok) {
          setError(`Word not found in dictionary`);
          setDefinition(null);
          return;
        }

        const data = await res.json();
        setDefinition(data[0]);
      } catch (err) {
        setError(`Error fetching definition: ${err.message}`);
        setDefinition(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDefinition();
  }, [word]);

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}>
      <div style={{
        background: "var(--tk-bg)",
        border: "1px solid var(--tk-border)",
        borderRadius: "var(--tk-radius)",
        padding: "1.5rem",
        maxWidth: "700px",
        width: "90%",
        maxHeight: "80vh",
        overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div>
            <h3 style={{ fontSize: "1.5rem", color: "var(--tk-text)", margin: "0 0 0.5rem 0" }}>{word}</h3>
            {definition?.phonetics?.[0]?.text && (
              <span style={{ fontSize: "0.85rem", color: "var(--tk-accent)" }}>{definition.phonetics[0].text}</span>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--tk-text-dim)", fontSize: "1.5rem", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {loading && (
          <div style={{ textAlign: "center", color: "var(--tk-text-dim)", padding: "2rem" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem", animation: "tk-pulse 1s infinite" }}>●</div>
            <div style={{ fontSize: "0.9rem" }}>Loading definition...</div>
          </div>
        )}

        {error && (
          <div style={{
            background: "rgba(255, 51, 102, 0.08)",
            border: "1px solid rgba(255, 51, 102, 0.3)",
            borderRadius: "var(--tk-radius)",
            padding: "1rem",
            color: "var(--tk-accent2)",
            fontSize: "0.9rem",
          }}>
            {error}
          </div>
        )}

        {definition && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Part of Speech & Definitions */}
            {definition.meanings?.map((meaning, idx) => (
              <div key={idx}>
                <div style={{
                  fontSize: "1rem",
                  color: "var(--tk-accent3)",
                  fontStyle: "italic",
                  marginBottom: "0.75rem",
                  fontFamily: "var(--tk-mono)",
                }}>
                  {meaning.partOfSpeech}
                </div>

                {meaning.definitions?.length > 0 && (
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{
                      fontSize: "0.75rem",
                      color: "var(--tk-text-dim)",
                      letterSpacing: "0.1em",
                      marginBottom: "0.5rem",
                    }}>DEFINITIONS</div>
                    {meaning.definitions.slice(0, 5).map((def, i) => (
                      <div key={i} style={{
                        display: "flex",
                        gap: "0.75rem",
                        marginBottom: "0.5rem",
                        fontSize: "0.9rem",
                      }}>
                        <span style={{ color: "var(--tk-accent)", flexShrink: 0 }}>•</span>
                        <div>
                          <div style={{ color: "var(--tk-text)" }}>{def.definition}</div>
                          {def.example && (
                            <div style={{ color: "var(--tk-text-dim)", fontSize: "0.85rem", marginTop: "0.25rem", fontStyle: "italic" }}>
                              example: "{def.example}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {meaning.synonyms?.length > 0 && (
                  <div style={{
                    display: "flex",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--tk-text-dim)", flexBasis: "100%", letterSpacing: "0.1em" }}>SYNONYMS</span>
                    {meaning.synonyms.slice(0, 8).map((syn) => (
                      <span
                        key={syn}
                        style={{
                          background: "var(--tk-surface2)",
                          border: "1px solid var(--tk-border)",
                          borderRadius: "var(--tk-radius)",
                          padding: "0.4rem 0.8rem",
                          fontSize: "0.85rem",
                          color: "var(--tk-accent)",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--tk-accent)";
                          e.currentTarget.style.color = "var(--tk-bg)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "var(--tk-surface2)";
                          e.currentTarget.style.color = "var(--tk-accent)";
                        }}
                      >
                        {syn}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Pronunciation Audio */}
            {definition.phonetics?.some(p => p.audio) && (
              <div>
                <div style={{
                  fontSize: "0.75rem",
                  color: "var(--tk-text-dim)",
                  letterSpacing: "0.1em",
                  marginBottom: "0.5rem",
                }}>AUDIO</div>
                {definition.phonetics.map((p, idx) => p.audio && (
                  <button
                    key={idx}
                    onClick={() => new Audio(p.audio).play()}
                    style={{
                      background: "var(--tk-accent)",
                      border: "none",
                      color: "var(--tk-bg)",
                      padding: "0.6rem 1rem",
                      borderRadius: "var(--tk-radius)",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    ▶ Listen
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WordTool() {
  const [text,setText]=useState("");
  const [isMaximized, setIsMaximized] = useState(false);
  const [lookupWord, setLookupWord] = useState(null);
  const [searchInput, setSearchInput] = useState("");

  // Handle Escape key to exit maximize
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isMaximized) {
        setIsMaximized(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaximized]);

  const words=text.trim()?text.trim().split(/\s+/):[];
  const sentences=text.trim()?text.split(/[.!?]+/).filter(s=>s.trim()):[];
  const paragraphs=text.trim()?text.split(/\n\s*\n/).filter(p=>p.trim()):[];
  const unique=new Set(words.map(w=>w.toLowerCase().replace(/[^a-z0-9]/g,""))).size;
  const rs=Math.max(1,Math.round((words.length/200)*60));
  const readTime=words.length===0?"0s":rs<60?rs+"s":Math.round(rs/60)+"m "+(rs%60)+"s";
  const freq={};
  words.forEach(w=>{const c=w.toLowerCase().replace(/[^a-z0-9]/g,"");if(c.length>2&&!STOP.has(c))freq[c]=(freq[c]||0)+1;});
  const topWords=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const stats=[
    {val:words.length.toLocaleString(),lbl:"Words"},
    {val:text.length.toLocaleString(),lbl:"Characters"},
    {val:text.replace(/\s/g,"").length.toLocaleString(),lbl:"Chars (no spaces)"},
    {val:text?text.split("\n").length:0,lbl:"Lines"},
    {val:sentences.length,lbl:"Sentences"},
    {val:readTime,lbl:"Read time"},
    {val:paragraphs.length,lbl:"Paragraphs"},
    {val:unique,lbl:"Unique Words"},
  ];

  const handleLookup = (word) => {
    setLookupWord(word);
  };

  return(
    <div className={`tk-editor-container ${isMaximized ? "tk-editor-maximized" : ""}`}>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Word Counter &amp; Text Stats</h2>
        <div className="tk-tool-actions">
          <CopyBtn getText={()=>text}/>
          <ActionBtn danger onClick={()=>setText("")}>Clear</ActionBtn>
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="tk-editor-max-btn"
            title={isMaximized ? "Exit fullscreen" : "Fullscreen editor"}
          >
            {isMaximized ? "✕" : "⊞"}
          </button>
        </div>
      </div>
      <textarea className={`tk-textarea ${isMaximized ? "tk-textarea-maximized" : ""}`} value={text} onChange={e=>setText(e.target.value)} placeholder="Paste your text here..."/>
      
      {!isMaximized && (
        <>
          {/* ── Word Lookup Search ── */}
          <div style={{
            display: "flex",
            gap: "0",
            marginBottom: "1rem",
            alignItems: "center",
          }}>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchInput.trim() && handleLookup(searchInput.trim())}
              placeholder="Search word meaning..."
              style={{
                flex: 1,
                background: "var(--tk-surface)",
                border: "1px solid var(--tk-border)",
                color: "var(--tk-text)",
                fontFamily: "var(--tk-mono)",
                fontSize: "0.8rem",
                padding: "0.45rem 0.75rem",
                borderRadius: "var(--tk-radius) 0 0 var(--tk-radius)",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => e.target.style.borderColor = "var(--tk-accent)"}
              onBlur={(e) => e.target.style.borderColor = "var(--tk-border)"}
            />
            <button
              onClick={() => searchInput.trim() && handleLookup(searchInput.trim())}
              style={{
                background: "var(--tk-accent)",
                border: "none",
                color: "var(--tk-bg)",
                fontFamily: "var(--tk-mono)",
                fontSize: "0.75rem",
                padding: "0.45rem 1rem",
                borderRadius: "0 var(--tk-radius) var(--tk-radius) 0",
                cursor: "pointer",
                fontWeight: 600,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              Look up
            </button>
          </div>

          <div className="tk-stats-grid">
            {stats.map(({val,lbl})=>(
              <div key={lbl} className="tk-stat-card">
                <div className="tk-stat-val">{val}</div>
                <div className="tk-stat-lbl">{lbl}</div>
              </div>
            ))}
          </div>
          
          {topWords.length>0&&(
            <div className="tk-top-words">
              {topWords.map(([w,c])=>(
                <div
                  key={w}
                  className="tk-word-chip"
                  onClick={() => handleLookup(w)}
                  style={{ cursor: "pointer", transition: "all 0.15s" }}
                  title="Click to see definition"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--tk-accent)";
                    e.currentTarget.style.color = "var(--tk-bg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--tk-surface2)";
                    e.currentTarget.style.color = "var(--tk-accent)";
                  }}
                >
                  {w}<span>{c}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Word Lookup Modal ── */}
      {lookupWord && <WordLookupModal word={lookupWord} onClose={() => setLookupWord(null)} />}
    </div>
  );
}
