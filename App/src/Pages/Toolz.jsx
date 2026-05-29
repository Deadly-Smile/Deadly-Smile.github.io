import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import JWTTool         from "./tools/JWTTool";
import PdfReaderTool   from "./tools/PdfReaderTool";
import CronExpressionParser from "./tools/CronExpressionParser";
import TimestampConverter from "./tools/TimestampConverter";
import QRCodeGenerator from "./tools/QRCodeGenerator";
import CSVTSVConverter from "./tools/CSVTSVConverter";
import PasswordGenerator from "./tools/PasswordGenerator";
import Footer from "./components/Footer";
import ToolGroupSettings, { DEFAULT_GROUPS, DEFAULT_ASSIGNMENTS } from "./components/ToolGroupSettings";

const ALL_TOOLS = [
  { id: "magic",  label: "Oracle",      component: Magic8BallTool     },
  { id: "notes",  label: "Notes",       component: NotesTool          },
  { id: "calc",   label: "Calculator",  component: CalculatorTool     },
  { id: "word",   label: "Word Count",  component: WordTool           },
  { id: "json",   label: "JSON",        component: JsonTool           },
  { id: "regex",  label: "Regex",       component: RegexTool          },
  { id: "base64", label: "Base64",      component: Base64Tool         },
  { id: "jwt",    label: "JWT",         component: JWTTool            },
  { id: "hash",   label: "Hash",        component: HashTool           },
  { id: "http",   label: "HTTP",        component: HttpTool           },
  { id: "cron",   label: "Cron",        component: CronExpressionParser },
  { id: "html",   label: "HTML",        component: HtmlPreviewerTool  },
  { id: "code",   label: "Code Runner", component: CodeRunnerTool     },
  { id: "color",  label: "Color",       component: ColorTool          },
  { id: "diff",   label: "Diff",        component: DiffTool           },
  { id: "time",   label: "Timestamp",   component: TimestampConverter },
  { id: "qr",     label: "QR Code",     component: QRCodeGenerator    },
  { id: "csv",    label: "CSV / TSV",   component: CSVTSVConverter    },
  { id: "pass",   label: "Password",    component: PasswordGenerator  },
  { id: "pdf",    label: "PDF Reader",  component: PdfReaderTool      },
];

// ─── Config persistence ───────────────────────────────────────────────────────

function loadConfig() {
  try {
    const raw = localStorage.getItem("toolz-group-config");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { groups: DEFAULT_GROUPS, assignments: DEFAULT_ASSIGNMENTS };
}

function saveConfig(config) {
  localStorage.setItem("toolz-group-config", JSON.stringify(config));
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const WhiteboardIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <path d="M8 21h8M12 17v4"/>
    <path d="M6 8l3 4 3-3 3 3 3-4"/>
  </svg>
);

const SearchIcon = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9 2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9 2.83-2.83"/>
  </svg>
);

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function ToolItem({ tool, active, setActive }) {
  return (
    <button
      className={`tk-sidebar-item${active === tool.id ? " tk-sidebar-item--active" : ""}`}
      onClick={() => setActive(tool.id)}
    >
      {tool.label}
    </button>
  );
}

function Sidebar({ active, setActive, config, onSettingsClick }) {
  const [query, setQuery] = useState("");
  const { groups, assignments } = config;

  const filtered = query.trim()
    ? ALL_TOOLS.filter(t => t.label.toLowerCase().includes(query.toLowerCase()))
    : null;

  const groupedTools = groups
    .map(g => ({ label: g, tools: ALL_TOOLS.filter(t => assignments[t.id] === g) }))
    .filter(g => g.tools.length > 0);

  return (
    <aside className="tk-sidebar">
      <div className="tk-sidebar-search">
        <SearchIcon />
        <input
          type="text"
          placeholder="Search tools…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="tk-sidebar-search-input"
        />
      </div>

      <nav className="tk-sidebar-nav">
        {filtered ? (
          filtered.length > 0
            ? filtered.map(t => <ToolItem key={t.id} tool={t} active={active} setActive={setActive} />)
            : <p className="tk-sidebar-empty">No tools found</p>
        ) : (
          groupedTools.map(group => (
            <div key={group.label} className="tk-sidebar-group">
              <span className="tk-sidebar-group-label">{group.label}</span>
              {group.tools.map(t => <ToolItem key={t.id} tool={t} active={active} setActive={setActive} />)}
            </div>
          ))
        )}
      </nav>

      <div className="tk-sidebar-footer">
        <button className="tk-sidebar-item tk-sidebar-settings" onClick={onSettingsClick}>
          <SettingsIcon /> Settings
        </button>
      </div>
    </aside>
  );
}

// ─── Toolz ────────────────────────────────────────────────────────────────────

const Toolz = ({ embedded = false }) => {
  const [active,       setActive]       = useState("word");
  const [clock,        setClock]        = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [config,       setConfig]       = useState(loadConfig);
  const navigate = useNavigate();

  useEffect(() => {
    const tick = () => setClock(new Date().toTimeString().slice(0, 8));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  function handleSaveConfig(newConfig) {
    setConfig(newConfig);
    saveConfig(newConfig);
    // Reset active tool if it was removed from all groups
    if (!newConfig.assignments[active] || !newConfig.groups.includes(newConfig.assignments[active])) {
      const first = ALL_TOOLS.find(t => newConfig.assignments[t.id]);
      if (first) setActive(first.id);
    }
  }

  const ActiveTool = ALL_TOOLS.find(t => t.id === active)?.component;

  // Strip components from tool list — ToolGroupSettings doesn't need them
  const toolMeta = ALL_TOOLS.map(({ id, label }) => ({ id, label }));

  const sidebar = (
    <Sidebar
      active={active}
      setActive={setActive}
      config={config}
      onSettingsClick={() => setShowSettings(true)}
    />
  );

  const toolArea = (
    <main className="tk-main">
      <div className="tk-tool-section">
        {ActiveTool && <ActiveTool />}
      </div>
    </main>
  );

  const settingsModal = showSettings && (
    <ToolGroupSettings
      allTools={toolMeta}
      config={config}
      onSave={handleSaveConfig}
      onClose={() => setShowSettings(false)}
    />
  );

  if (embedded) {
    return (
      <div className="tk-root tk-root--embedded">
        <div className="tk-layout">
          {sidebar}
          {toolArea}
        </div>
        <div className="tk-local-notice">
          all processing is local — no data leaves your browser
        </div>
        {settingsModal}
      </div>
    );
  }

  return (
    <>
      <div className="tk-root">
        <div className="tk-scanline" />
        <div className="tk-noise" />

        <header className="tk-header">
          <Link to="/" className="tk-logo" title="Go to Home"
                style={{ textDecoration: "none", cursor: "pointer", color: "inherit" }}>
            ANIK<span> SAHA</span>
          </Link>
          <button onClick={() => navigate("/white-board")} title="Go to Whiteboard"
                  className="tk-whiteboard-btn">
            <WhiteboardIcon /> WHITEBOARD
          </button>
          <div className="tk-clock">{clock}</div>
        </header>

        <div className="tk-layout">
          {sidebar}
          {toolArea}
        </div>

        {settingsModal}
      </div>
      <Footer />
    </>
  );
};

export default Toolz;