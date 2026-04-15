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
import NotesTool       from "./tools/NotesTool";
import Magic8BallTool  from "./tools/Magic8BallTool";
import CalculatorTool  from "./tools/CalculatorTool";

const ALL_TOOLS = [
  { id:"magic",  label:"ORACLE",     component: Magic8BallTool     },
  { id:"notes",  label:"NOTES",      component: NotesTool          },
  { id:"json",   label:"JSON",       component: JsonTool           },
  { id:"html",   label:"HTML",       component: HtmlPreviewerTool  },
  { id:"code",   label:"CODE",       component: CodeRunnerTool     },
  { id:"http",   label:"HTTP",       component: HttpTool           },
  { id:"regex",  label:"REGEX",      component: RegexTool          },
  { id:"base64", label:"BASE64",     component: Base64Tool         },
  { id:"hash",   label:"HASH",       component: HashTool           },
  { id:"color",  label:"COLOR",      component: ColorTool          },
  { id:"diff",   label:"DIFF",       component: DiffTool           },
  { id:"word",   label:"WORD COUNT", component: WordTool           },
  { id:"calc",   label:"CALCULATOR", component: CalculatorTool     },
];

const DEFAULT_MAIN_TOOLS = [
  { id:"magic",  label:"ORACLE",     component: Magic8BallTool     },
  { id:"notes",  label:"NOTES",      component: NotesTool          },
  { id:"json",   label:"JSON",       component: JsonTool           },
  { id:"html",   label:"HTML",       component: HtmlPreviewerTool  },
  { id:"code",   label:"CODE",       component: CodeRunnerTool     },
  { id:"http",   label:"HTTP",       component: HttpTool           },
  { id:"calc",   label:"CALCULATOR", component: CalculatorTool     },
];

const TOOLS = ALL_TOOLS;

const WhiteboardIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <path d="M8 21h8M12 17v4"/>
    <path d="M6 8l3 4 3-3 3 3 3-4"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m2.98 2.98l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m2.98-2.98l4.24-4.24M19.78 19.78l-4.24-4.24m-2.98-2.98l-4.24-4.24"/>
  </svg>
);

function SettingsModal({ mainToolIds, setMainToolIds, onClose }) {
  const handleToggle = (toolId) => {
    setMainToolIds(prev => 
      prev.includes(toolId)
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
  };

  const pinnedTools = ALL_TOOLS.filter(t => mainToolIds.includes(t.id));
  const unpinnedTools = ALL_TOOLS.filter(t => !mainToolIds.includes(t.id));

  const ToolSection = ({ title, tools }) => (
    <div className="tk-settings-section">
      <h3>{title}</h3>
      <div className="tk-settings-list">
        {tools.map(tool => (
          <div key={tool.id} className="tk-settings-item">
            <label>
              <input
                type="checkbox"
                checked={mainToolIds.includes(tool.id)}
                onChange={() => handleToggle(tool.id)}
              />
              <span className="tk-radio-label">{tool.label}</span>
            </label>
            <span className="tk-radio-state">
              {mainToolIds.includes(tool.id) ? "⭐ PINNED" : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="tk-modal-overlay" onClick={onClose}>
      <div className="tk-modal-content" onClick={e => e.stopPropagation()}>
        <h2>Configure Tools</h2>
        <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1.5rem" }}>
          Pin tools to the main navigation or move them to the dropdown
        </p>

        {pinnedTools.length > 0 && <ToolSection title="Pinned" tools={pinnedTools} />}
        {unpinnedTools.length > 0 && <ToolSection title="Available" tools={unpinnedTools} />}

        <button className="tk-modal-close" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function ToolNav({ active, setActive, sticky, mainTools, otherTools, onSettingsClick }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <nav className="tk-tool-nav" style={sticky ? { top:0, position:"sticky" } : {}}>
      {mainTools.map(t => (
        <button
          key={t.id}
          className={`tk-nav-btn${active === t.id ? " tk-active" : ""}`}
          onClick={() => setActive(t.id)}
        >
          {t.label}
        </button>
      ))}
      
      {otherTools.length > 0 && (
        <div className="tk-dropdown-wrap">
          <button
            className="tk-nav-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <span className="tk-dropdown-toggle">
              MORE
              <span className={`tk-dropdown-arrow ${dropdownOpen ? "open" : ""}`}>▼</span>
            </span>
          </button>

          {dropdownOpen && (
            <div className="tk-dropdown-menu">
              {otherTools.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setActive(t.id);
                    setDropdownOpen(false);
                  }}
                  className={`tk-dropdown-item ${active === t.id ? "tk-active" : ""}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        className="tk-nav-btn tk-settings-btn"
        onClick={onSettingsClick}
        title="Configure tools"
      >
        <SettingsIcon />
      </button>
    </nav>
  );
}

const Toolz = ({ embedded = false }) => {
  const [active, setActive] = useState("magic");
  const [clock,  setClock]  = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [mainToolIds, setMainToolIds] = useState(() => {
    const saved = localStorage.getItem("toolz-main-tools");
    return saved ? JSON.parse(saved) : DEFAULT_MAIN_TOOLS.map(t => t.id);
  });
  const navigate = useNavigate();

  useEffect(() => {
    const tick = () => setClock(new Date().toTimeString().slice(0, 8));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    localStorage.setItem("toolz-main-tools", JSON.stringify(mainToolIds));
  }, [mainToolIds]);

  const mainTools = ALL_TOOLS.filter(t => mainToolIds.includes(t.id));
  const otherTools = ALL_TOOLS.filter(t => !mainToolIds.includes(t.id));

  const ActiveTool = TOOLS.find(t => t.id === active)?.component;

  if (embedded) {
    return (
      <div className="tk-root" style={{ minHeight:"unset", height:"100%" }}>
        <ToolNav 
          active={active} 
          setActive={setActive} 
          sticky 
          mainTools={mainTools}
          otherTools={otherTools}
          onSettingsClick={() => setShowSettings(true)}
        />
        <main className="tk-main">
          <div className="tk-tool-section">
            {ActiveTool && <ActiveTool />}
          </div>
        </main>
        <div style={{ padding:"0.8rem 2rem 1rem", fontSize:"0.6rem", letterSpacing:"0.07em", color:"#3a3a3a", fontFamily:"'Space Mono',monospace", borderTop:"1px solid #1e1e1e" }}>
          all processing is local — no data leaves your browser
        </div>
        {showSettings && (
          <SettingsModal 
            mainToolIds={mainToolIds} 
            setMainToolIds={setMainToolIds}
            onClose={() => setShowSettings(false)}
          />
        )}
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
          className="tk-whiteboard-btn"
        >
          <WhiteboardIcon />
          WHITEBOARD
        </button>

        <div className="tk-clock">{clock}</div>
      </header>

      <ToolNav 
        active={active} 
        setActive={setActive} 
        mainTools={mainTools}
        otherTools={otherTools}
        onSettingsClick={() => setShowSettings(true)}
      />

      <main className="tk-main">
        <div className="tk-tool-section">
          {ActiveTool && <ActiveTool />}
        </div>
      </main>

      {showSettings && (
        <SettingsModal 
          mainToolIds={mainToolIds} 
          setMainToolIds={setMainToolIds}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

export default Toolz;
