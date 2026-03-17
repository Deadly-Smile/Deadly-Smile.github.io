import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../toolkit.css";

import JsonTool        from "./tools/JsonTool";
import RegexTool       from "./tools/RegexTool";
import Base64Tool      from "./tools/Base64Tool";
import HashTool        from "./tools/HashTool";
import ColorTool       from "./tools/ColorTool";
import DiffTool        from "./tools/DiffTool";
import WordTool        from "./tools/WordTool";
import HtmlPreviewerTool from "./tools/HtmlPreviewerTool";
import CodeRunnerTool  from "./tools/CodeRunnerTool";
import HttpTool        from "./tools/HttpTool";

const TOOLS = [
  { id:"json",   label:"JSON",       component: JsonTool           },
  { id:"regex",  label:"REGEX",      component: RegexTool          },
  { id:"base64", label:"BASE64",     component: Base64Tool         },
  { id:"hash",   label:"HASH",       component: HashTool           },
  { id:"color",  label:"COLOR",      component: ColorTool          },
  { id:"diff",   label:"DIFF",       component: DiffTool           },
  { id:"word",   label:"WORD COUNT", component: WordTool           },
  { id:"html",   label:"HTML",       component: HtmlPreviewerTool  },
  { id:"code",   label:"CODE",       component: CodeRunnerTool     },
  { id:"http",   label:"HTTP",       component: HttpTool           },
];

const WhiteboardIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <path d="M8 21h8M12 17v4"/>
    <path d="M6 8l3 4 3-3 3 3 3-4"/>
  </svg>
);

function ToolNav({ active, setActive, sticky }) {
  return (
    <nav className="tk-tool-nav" style={sticky ? { top:0, position:"sticky" } : {}}>
      {TOOLS.map(t => (
        <button
          key={t.id}
          className={`tk-nav-btn${active === t.id ? " tk-active" : ""}`}
          onClick={() => setActive(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

const Toolz = ({ embedded = false }) => {
  const [active, setActive] = useState("json");
  const [clock,  setClock]  = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const tick = () => setClock(new Date().toTimeString().slice(0, 8));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const ActiveTool = TOOLS.find(t => t.id === active)?.component;

  if (embedded) {
    return (
      <div className="tk-root" style={{ minHeight:"unset", height:"100%" }}>
        <ToolNav active={active} setActive={setActive} sticky />
        <main className="tk-main">
          <div className="tk-tool-section">
            {ActiveTool && <ActiveTool />}
          </div>
        </main>
        <div style={{ padding:"0.8rem 2rem 1rem", fontSize:"0.6rem", letterSpacing:"0.07em", color:"#3a3a3a", fontFamily:"'Space Mono',monospace", borderTop:"1px solid #1e1e1e" }}>
          all processing is local — no data leaves your browser
        </div>
      </div>
    );
  }

  return (
    <div className="tk-root">
      <div className="tk-scanline" />
      <div className="tk-noise" />

      <header className="tk-header">
        <div className="tk-logo">TOOL<span>Z</span></div>

        <button
          onClick={() => navigate("/white-board")}
          title="Go to Whiteboard"
          style={{
            marginLeft:"auto", display:"flex", alignItems:"center", gap:8,
            background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)",
            color:"#aaa", cursor:"pointer", padding:"7px 14px", borderRadius:100,
            fontFamily:"'Space Mono',monospace", fontSize:"0.65rem",
            letterSpacing:"0.1em", transition:"all 0.18s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background   = "rgba(0,255,136,0.1)";
            e.currentTarget.style.borderColor  = "rgba(0,255,136,0.4)";
            e.currentTarget.style.color        = "#00ff88";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background   = "rgba(255,255,255,0.05)";
            e.currentTarget.style.borderColor  = "rgba(255,255,255,0.12)";
            e.currentTarget.style.color        = "#aaa";
          }}
        >
          <WhiteboardIcon />
          WHITEBOARD
        </button>

        <div className="tk-clock">{clock}</div>
      </header>

      <ToolNav active={active} setActive={setActive} />

      <main className="tk-main">
        <div className="tk-tool-section">
          {ActiveTool && <ActiveTool />}
        </div>
      </main>
    </div>
  );
};

export default Toolz;
