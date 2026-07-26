import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
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
import TextExtractor   from "./tools/TextExtractor";
import P2PChat         from "./tools/Chat";
import CronExpressionParser from "./tools/CronExpressionParser";
import TimestampConverter from "./tools/TimestampConverter";
import QRCodeGenerator from "./tools/QRCodeGenerator";
import CSVTSVConverter from "./tools/CSVTSVConverter";
import PasswordGenerator from "./tools/PasswordGenerator";
import ImageEditorTool from "./tools/ImageEditor";
import CSVEditor       from "./tools/CSVEditor/CSVEditor";
import PracticeTool    from "./tools/PracticeTool";
import Footer from "./components/Footer";
import InputDeviceChecker from "./tools/InputDeviceChecker";
import MusicPlayer from "./tools/MusicPlayer";
import ToolGroupSettings, { DEFAULT_GROUPS, DEFAULT_ASSIGNMENTS } from "./components/ToolGroupSettings";

const ALL_TOOLS = [
  { id: "magic",  label: "Oracle",      icon: "🔮", component: Magic8BallTool     },
  { id: "notes",  label: "Notes",       icon: "📝", component: NotesTool          },
  { id: "calc",   label: "Calculator",  icon: "🧮", component: CalculatorTool     },
  { id: "word",   label: "Word Count",  icon: "🔤", component: WordTool           },
  { id: "json",   label: "JSON",        icon: "🧾", component: JsonTool           },
  { id: "regex",  label: "Regex",       icon: "🔎", component: RegexTool          },
  { id: "base64", label: "Base64",      icon: "🔡", component: Base64Tool         },
  { id: "jwt",    label: "JWT",         icon: "🔑", component: JWTTool            },
  { id: "hash",   label: "Hash",        icon: "#️⃣", component: HashTool            },
  { id: "http",   label: "HTTP",        icon: "🌐", component: HttpTool           },
  { id: "cron",   label: "Cron",        icon: "⏰", component: CronExpressionParser },
  { id: "html",   label: "HTML",        icon: "📄", component: HtmlPreviewerTool  },
  { id: "code",   label: "Code Runner", icon: "▶️", component: CodeRunnerTool     },
  { id: "color",  label: "Color",       icon: "🎨", component: ColorTool          },
  { id: "diff",   label: "Diff",        icon: "🔀", component: DiffTool           },
  { id: "time",   label: "Timestamp",   icon: "🕒", component: TimestampConverter },
  { id: "qr",     label: "QR Code",     icon: "🔳", component: QRCodeGenerator    },
  { id: "csv",    label: "CSV / TSV",   icon: "📑", component: CSVTSVConverter    },
  { id: "pass",   label: "Password",    icon: "🔒", component: PasswordGenerator  },
  { id: "text_extractor",    label: "Text Extractor",  icon: "📃", component: TextExtractor },
  { id: "chat",   label: "P2P Chat",    icon: "💬", component: P2PChat            },
  { id: "image",  label: "Image Editor", icon: "🖼️", component: ImageEditorTool   },
  { id: "input_checker", label: "Tester", icon: "🎮", component: InputDeviceChecker },
  { id: "csv_editor", label: "CSV Editor", icon: "📊", component: CSVEditor },
  { id: "practice", label: "Practice", icon: "🧩", component: PracticeTool },
  { id: "music_player", label: "Music Player", icon: "🎵", component: MusicPlayer }
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

// ─── Shared tool search/grouping ────────────────────────────────────────────

function filterTools(query) {
  const q = query.trim().toLowerCase();
  return q ? ALL_TOOLS.filter(t => t.label.toLowerCase().includes(q)) : null;
}

function groupTools(config) {
  const { groups, assignments } = config;
  return groups
    .map(g => ({ label: g, tools: ALL_TOOLS.filter(t => assignments[t.id] === g) }))
    .filter(g => g.tools.length > 0);
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

const MenuIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M3 12h18M3 18h18"/>
  </svg>
);

// ─── Sidebar (drawer) ─────────────────────────────────────────────────────────

function ToolItem({ tool, active, onPick }) {
  return (
    <button
      className={`tk-sidebar-item${active === tool.id ? " tk-sidebar-item--active" : ""}`}
      onClick={() => onPick(tool.id)}
    >
      <span className="tk-tool-icon">{tool.icon}</span> {tool.label}
    </button>
  );
}

function Sidebar({ open, active, onPick, config, onSettingsClick }) {
  const [query, setQuery] = useState("");
  const filtered = filterTools(query);
  const groupedTools = groupTools(config);

  return (
    <aside className={`tk-sidebar${open ? " tk-sidebar--open" : ""}`}>
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
            ? filtered.map(t => <ToolItem key={t.id} tool={t} active={active} onPick={onPick} />)
            : <p className="tk-sidebar-empty">No tools found</p>
        ) : (
          groupedTools.map(group => (
            <div key={group.label} className="tk-sidebar-group">
              <span className="tk-sidebar-group-label">{group.label}</span>
              {group.tools.map(t => <ToolItem key={t.id} tool={t} active={active} onPick={onPick} />)}
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

// ─── Launcher (searchable tool grid) ──────────────────────────────────────────

function ToolLauncher({ config, onPick }) {
  const [query, setQuery] = useState("");
  const filtered = filterTools(query);
  const groupedTools = groupTools(config);

  const grid = tools => (
    <div className="tk-launcher-grid">
      {tools.map(t => (
        <button key={t.id} className="tk-launcher-card" onClick={() => onPick(t.id)}>
          <span className="tk-launcher-card-icon">{t.icon}</span>
          <span className="tk-launcher-card-label">{t.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="tk-launcher">
      <div className="tk-launcher-search">
        <SearchIcon />
        <input
          type="text"
          placeholder="Search tools…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="tk-launcher-search-input"
          autoFocus
        />
      </div>

      {filtered ? (
        filtered.length > 0
          ? grid(filtered)
          : <p className="tk-sidebar-empty">No tools found</p>
      ) : (
        groupedTools.map(group => (
          <div key={group.label} className="tk-launcher-group">
            <span className="tk-launcher-group-label">{group.label}</span>
            {grid(group.tools)}
          </div>
        ))
      )}
    </div>
  );
}

// ─── Toolz ────────────────────────────────────────────────────────────────────

const Toolz = ({ embedded = false }) => {
  const [searchParams] = useSearchParams();
  const [active,       setActive]       = useState(() => {
    const tool = searchParams.get("tool");
    return tool && ALL_TOOLS.some(t => t.id === tool) ? tool : null;
  });
  const [drawerOpen,   setDrawerOpen]   = useState(false);
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

  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape" && drawerOpen) { setDrawerOpen(false); return; }
      if (e.key === "`") {
        const el = document.activeElement;
        const typing = el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);
        if (!typing) { e.preventDefault(); setDrawerOpen(v => !v); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  function pickTool(id) {
    setActive(id);
    setDrawerOpen(false);
  }

  function handleSaveConfig(newConfig) {
    setConfig(newConfig);
    saveConfig(newConfig);
    // Reset active tool if it was removed from all groups
    if (active && (!newConfig.assignments[active] || !newConfig.groups.includes(newConfig.assignments[active]))) {
      const first = ALL_TOOLS.find(t => newConfig.assignments[t.id]);
      setActive(first ? first.id : null);
    }
  }

  const ActiveTool = ALL_TOOLS.find(t => t.id === active)?.component;

  // Strip components from tool list — ToolGroupSettings doesn't need them
  const toolMeta = ALL_TOOLS.map(({ id, label }) => ({ id, label }));

  const sidebar = (
    <Sidebar
      open={drawerOpen}
      active={active}
      onPick={pickTool}
      config={config}
      onSettingsClick={() => { setShowSettings(true); setDrawerOpen(false); }}
    />
  );

  const backdrop = (
    <div
      className={`tk-sidebar-backdrop${drawerOpen ? " tk-sidebar-backdrop--visible" : ""}`}
      onClick={() => setDrawerOpen(false)}
    />
  );

  const menuBtn = (
    <button
      className="tk-menu-btn tk-menu-btn--floating"
      onClick={() => setDrawerOpen(v => !v)}
      title="Browse tools (`)"
      aria-label="Toggle tools menu"
    >
      <MenuIcon />
    </button>
  );

  const toolArea = (
    <main className="tk-main">
      <div className="tk-main-topbar">
        {active && (
          <button className="tk-main-title" onClick={() => setActive(null)}>
            ‹ All Tools
          </button>
        )}
      </div>
      <div className="tk-tool-section">
        {ActiveTool ? <ActiveTool /> : <ToolLauncher config={config} onPick={pickTool} />}
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
          {backdrop}
          {sidebar}
          {menuBtn}
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
          {backdrop}
          {sidebar}
          {menuBtn}
          {toolArea}
        </div>

        {settingsModal}
      </div>
      <Footer />
    </>
  );
};

export default Toolz;
