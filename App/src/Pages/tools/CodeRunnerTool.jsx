import { useState, useEffect, useCallback, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import SNIPPETS from "../../Helper/snippets";
import { Modal, InputModal, useModal, ConfirmModal } from "../../Utils/Modal";
import { Toast, showToast } from "../../Utils/Toast";
import { createFileId } from "../../Helper/generator";
import { getAllTabs, saveAllTabs, getActiveTabId, setActiveTabId, saveFile, fileExists, getSavedFiles, deleteFile } from "../../Helper/storageUtils";

const STORAGE_KEY_PREFIX = "coderunner_";

const LANGUAGES = {
  javascript: {
    label:"JavaScript", abbr:"JS",
    run: async (code, pushLine) => new Promise(resolve => {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      document.body.appendChild(iframe);
      const timeout = setTimeout(()=>{ resolve({error:"⏱ Timed out after 5s"}); try{document.body.removeChild(iframe);}catch{} }, 5000);
      ["log","error","warn","info","debug"].forEach(m=>{
        iframe.contentWindow.console[m]=(...args)=>{
          const text=args.map(a=>{try{return typeof a==="object"?JSON.stringify(a,null,2):String(a);}catch{return String(a);}}).join(" ");
          pushLine({type:m,text});
        };
      });
      iframe.contentWindow.onerror=(msg,_,line,col)=>{pushLine({type:"error",text:`Uncaught: ${msg} (line ${line}:${col})`});return true;};
      iframe.contentWindow.onunhandledrejection=e=>pushLine({type:"error",text:`Unhandled: ${e.reason}`});
      try {
        const fn=iframe.contentWindow.Function("return (async()=>{\n"+code+"\n})()");
        const r=fn();
        if(r&&typeof r.then==="function"){
          r.then(v=>{if(v!==undefined)pushLine({type:"return",text:String(v)});resolve({});})
           .catch(e=>{pushLine({type:"error",text:String(e)});resolve({});})
           .finally(()=>{clearTimeout(timeout);try{document.body.removeChild(iframe);}catch{}});
        } else {
          clearTimeout(timeout);if(r!==undefined)pushLine({type:"return",text:String(r)});
          resolve({});try{document.body.removeChild(iframe);}catch{}
        }
      } catch(e){clearTimeout(timeout);resolve({error:String(e)});try{document.body.removeChild(iframe);}catch{}}
    }),
  },
  cpp: {
    label:"C++", abbr:"C++",
    run: async (code, pushLine) => new Promise(async resolve => {
      try {
        const response = await fetch("https://wandbox.org/api/compile.json", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            compiler: "clang-head",
            code: code,
            options: "-std=c++20"
          })
        });
        const result = await response.json();
        let hasOutput = false;
        if (result.compiler_error && result.compiler_error.trim()) { pushLine({type:"error",text:result.compiler_error}); hasOutput = true; }
        if (result.compiler_message && result.compiler_message.trim()) { pushLine({type:"warn",text:result.compiler_message}); hasOutput = true; }
        if (result.program_output && result.program_output.trim()) { result.program_output.split("\n").filter(l=>l.trim()).forEach(line=>pushLine({type:"log",text:line})); hasOutput = true; }
        if (result.program_error && result.program_error.trim()) { pushLine({type:"error",text:result.program_error}); hasOutput = true; }
        if (!hasOutput && result.status === "0") { pushLine({type:"log",text:"(Program executed successfully with no output)"}); }
        resolve({});
      } catch(e) {
        resolve({error:`Error: ${e.message}`});
      }
    }),
  },
};

const LS={log:{color:"#e8e8e8",prefix:""},info:{color:"#4a90e2",prefix:"ℹ "},warn:{color:"#ffcc00",prefix:"⚠ "},error:{color:"#ff3366",prefix:"✗ "},debug:{color:"#888",prefix:"● "},return:{color:"#00ff88",prefix:"← "},system:{color:"#555",prefix:"// "}};
const µBtn={background:"none",border:"1px solid var(--tk-border-bright)",color:"var(--tk-text-dim)",fontFamily:"var(--tk-mono)",fontSize:"0.7rem",padding:"2px 6px",cursor:"pointer",borderRadius:"var(--tk-radius)",transition:"all 0.12s",lineHeight:1.4};

export default function CodeRunnerTool() {
  const [tabs, setTabs] = useState(() => {
    const saved = getAllTabs();
    if (saved.length > 0) return saved;
    return [
      { id: createFileId(), name: "untitled.js", language: "javascript", code: SNIPPETS.javascript[0].code, isPersisted: false },
    ];
  });

  const [activeTabId, setActiveTabIdState] = useState(() => {
    const saved = getActiveTabId();
    const allTabs = getAllTabs();
    if (saved && allTabs.find(t => t.id === saved)) return saved;
    return allTabs[0]?.id;
  });

  const [lines, setLines] = useState([]);
  const [running, setRunning] = useState(false);
  const [execTime, setExecTime] = useState(null);
  const [showSnippets, setShowSnippets] = useState(false);
  const [showNewTabMenu, setShowNewTabMenu] = useState(false);
  const [fontSize, setFontSize] = useState(13);
  const [wordWrap, setWordWrap] = useState(true);
  const [inputOpen, setInputOpen] = useState(true);
  const [outputOpen, setOutputOpen] = useState(true);
  const [showSavedFiles, setShowSavedFiles] = useState(false);
  const [savedFilesCache, setSavedFilesCache] = useState({});

  const saveModal = useModal();
  const renameModal = useModal();
  const deleteModal = useModal();
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const helpModal = useModal();

  const endRef = useRef(null);
  const editorRef = useRef(null);
  const editorViewRef = useRef(null);
  const activeTabIdRef = useRef(activeTabId);

  const currentTab = tabs.find(t => t.id === activeTabId);
  const code = currentTab?.code || "";
  const currentLanguage = currentTab?.language || "javascript";
  const lang = LANGUAGES[currentLanguage];

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    if (tabs.length > 0) saveAllTabs(tabs);
  }, [tabs]);

  useEffect(() => {
    if (activeTabId) setActiveTabId(activeTabId);
  }, [activeTabId]);

  useEffect(() => {
    if (!editorRef.current || !currentTab) return;

    editorRef.current.style.setProperty('--cm-fontSize', `${fontSize}px`);
    const language = currentLanguage === "cpp" ? cpp() : javascript();
    const state = EditorState.create({
      doc: currentTab.code,
      extensions: [basicSetup, language, oneDark],
    });

    if (editorViewRef.current) {
      editorViewRef.current.destroy();
      editorViewRef.current = null;
    }

    const view = new EditorView({
      state,
      parent: editorRef.current,
      dispatch: (tr) => {
        view.update([tr]);
        if (tr.docChanged) {
          const newCode = view.state.doc.toString();
          setTabs(prev =>
            prev.map(t => t.id === activeTabIdRef.current ? { ...t, code: newCode } : t)
          );
        }
      },
    });

    editorViewRef.current = view;

    return () => {
      if (editorViewRef.current) {
        editorViewRef.current.destroy();
        editorViewRef.current = null;
      }
    };
  }, [currentLanguage, activeTabId]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.style.setProperty('--cm-fontSize', `${fontSize}px`);
    }
  }, [fontSize]);

  useEffect(() => {
    if (!editorViewRef.current || !currentTab) return;
    const editorCode = editorViewRef.current.state.doc.toString();
    if (editorCode !== currentTab.code) {
      editorViewRef.current.dispatch({
        changes: { from: 0, to: editorCode.length, insert: currentTab.code },
      });
    }
  }, [activeTabId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const pushLine = useCallback(line => {
    setLines(p => [...p, { ...line, id: Date.now() + Math.random() }]);
  }, []);

  const runCode = useCallback(async () => {
    if (running || !currentTab) return;
    setRunning(true);
    setLines([]);
    const t0 = performance.now();
    const result = await lang.run(code, pushLine);
    const elapsed = (performance.now() - t0).toFixed(1);
    setExecTime(elapsed);
    if (result.error) {
      pushLine({ type: "error", text: result.error });
      showToast(`Error: ${result.error}`, "error");
    }
    setRunning(false);
  }, [running, code, lang, pushLine, currentTab]);

  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runCode();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [runCode]);

  const openSaveModal = useCallback(() => {
    if (!currentTab) return;
    const extension = currentLanguage === "cpp" ? ".cpp" : ".js";
    saveModal.openModal({ isNewFile: true });
  }, [currentTab, currentLanguage, saveModal]);

  const createNewTab = useCallback((language = "javascript") => {
    const newTab = {
      id: createFileId(),
      name: language === "cpp" ? "untitled.cpp" : "untitled.js",
      language,
      code: SNIPPETS[language][0].code,
      isPersisted: false
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabIdState(newTab.id);
    showToast(`New ${language === "cpp" ? "C++" : "JavaScript"} tab created`, "success");
  }, []);

  const openSavedFile = useCallback((fileName, language) => {
    const files = getSavedFiles(language);
    const fileData = files[fileName];
    if (!fileData) { showToast(`File not found: ${fileName}`, "error"); return; }
    const newTab = {
      id: createFileId(),
      name: fileName,
      language,
      code: fileData.code,
      isPersisted: true
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabIdState(newTab.id);
    setShowSavedFiles(false);
    showToast(`Opened: ${fileName}`, "success");
  }, []);

  const refreshSavedFiles = useCallback(() => {
    const jsFiles = getSavedFiles("javascript");
    const cppFiles = getSavedFiles("cpp");
    setSavedFilesCache({
      javascript: Object.entries(jsFiles).map(([name, data]) => ({ name, ...data })),
      cpp: Object.entries(cppFiles).map(([name, data]) => ({ name, ...data }))
    });
  }, []);

  const handleOpenSavedFilesPanel = useCallback(() => {
    refreshSavedFiles();
    setShowSavedFiles(true);
  }, [refreshSavedFiles]);

  const handleDeleteSavedFile = useCallback((fileName, language) => {
    const files = getSavedFiles(language);
    delete files[fileName];
    const key = `${STORAGE_KEY_PREFIX}${language}`;
    try {
      localStorage.setItem(key, JSON.stringify(files));
      refreshSavedFiles();
      showToast(`Deleted: ${fileName}`, "success");
    } catch (e) {
      showToast("Failed to delete file", "error");
    }
  }, [refreshSavedFiles]);

  const handleSaveFile = useCallback((fileName) => {
    if (!fileName.trim() || !currentTab) { showToast("File name cannot be empty", "warning"); return; }
    const extension = currentLanguage === "cpp" ? ".cpp" : ".js";
    const fullName = fileName.includes(".") ? fileName : fileName + extension;
    if (fileExists(currentLanguage, fullName) && currentTab.name !== fullName) { showToast("File already exists", "warning"); return; }
    const success = saveFile(currentLanguage, fullName, code);
    if (success) {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, name: fullName, isPersisted: true } : t));
      showToast(`File saved: ${fullName}`, "success");
    } else {
      showToast("Failed to save file", "error");
    }
  }, [currentLanguage, code, activeTabId, currentTab]);

  const handleDeleteTab = useCallback(() => {
    closeTab(activeTabId);
    deleteModal.closeModal();
    showToast("Tab deleted", "info");
  }, [activeTabId, deleteModal]);

  const openDeleteModal = useCallback(() => {
    setDeleteTarget(activeTabId);
    deleteModal.openModal({ tabName: currentTab?.name });
  }, [activeTabId, currentTab, deleteModal]);

  const closeTab = useCallback((idToClose) => {
    setTabs(prev => {
      const updated = prev.filter(t => t.id !== idToClose);
      if (updated.length === 0) {
        const newTab = {
          id: createFileId(),
          name: "untitled.js",
          language: "javascript",
          code: SNIPPETS.javascript[0].code,
          isPersisted: false
        };
        return [newTab];
      }
      return updated;
    });
    if (idToClose === activeTabId) {
      const remaining = tabs.filter(t => t.id !== idToClose);
      setActiveTabIdState(remaining[0]?.id);
    }
  }, [activeTabId, tabs]);

  const newTab = useCallback((language = "javascript") => {
    const newFile = {
      id: createFileId(),
      name: "untitled." + (language === "cpp" ? "cpp" : "js"),
      language,
      code: SNIPPETS[language][0].code,
      isPersisted: false
    };
    setTabs(prev => [...prev, newFile]);
    setActiveTabIdState(newFile.id);
  }, []);

  const copyOutput = useCallback(() => {
    const outputText = lines.filter(l => l.type !== "system").map(l => l.text).join("\n");
    navigator.clipboard.writeText(outputText)
      .then(() => showToast("Output copied!", "success"))
      .catch(() => showToast("Failed to copy", "error"));
  }, [lines]);

  const languageColor = (lang) => lang === "cpp" ? "#ff3366" : "#00ff88";

  return (
    <>
      <Toast />
      <div>
        <div className="tk-tool-header">
          <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
            <h2 className="tk-tool-title">Code Runner</h2>
            <div style={{display:"flex",gap:"0.4rem",padding:"0.4rem",background:"var(--tk-surface2)",borderRadius:"var(--tk-radius)"}}>
              {["javascript", "cpp"].map(l => (
                <button
                  key={l}
                  onClick={() => newTab(l)}
                  style={{background:"none",border:`2px solid ${languageColor(l)}`,color:languageColor(l),fontFamily:"var(--tk-mono)",fontSize:"0.7rem",padding:"0.4rem 0.8rem",cursor:"pointer",borderRadius:"var(--tk-radius)",transition:"all 0.2s",letterSpacing:"0.08em",fontWeight:600}}
                  onMouseEnter={e => e.target.style.opacity = "0.8"}
                  onMouseLeave={e => e.target.style.opacity = "1"}
                >
                  +{LANGUAGES[l].abbr}
                </button>
              ))}
            </div>
          </div>
          <div className="tk-tool-actions">
            <div style={{position:"relative"}}>
              <button className="tk-action-btn" onClick={()=>setShowSnippets(v=>!v)}
                style={{color:showSnippets?"var(--tk-bg)":undefined,background:showSnippets?"var(--tk-accent)":undefined}}>
                Snippets ▾
              </button>
              {showSnippets && currentTab && (
                <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"var(--tk-surface)",border:"1px solid var(--tk-border-bright)",borderRadius:"var(--tk-radius)",zIndex:200,minWidth:180,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}}>
                  {(SNIPPETS[currentLanguage]||[]).map(s=>(
                    <button key={s.label} onClick={()=>{
                      setTabs(prev => prev.map(t => t.id === activeTabId ? {...t, code: s.code} : t));
                      if (editorViewRef.current) {
                        const len = editorViewRef.current.state.doc.length;
                        editorViewRef.current.dispatch({ changes: { from: 0, to: len, insert: s.code } });
                      }
                      setShowSnippets(false);
                      setLines([]);
                    }}
                      style={{display:"block",width:"100%",textAlign:"left",background:"none",border:"none",borderBottom:"1px solid var(--tk-border)",color:"var(--tk-text)",fontFamily:"var(--tk-mono)",fontSize:"0.65rem",letterSpacing:"0.06em",padding:"0.7rem 1rem",cursor:"pointer",transition:"all 0.12s"}}
                      onMouseEnter={e=>{e.currentTarget.style.background="var(--tk-surface2)";e.currentTarget.style.color="var(--tk-accent)";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="var(--tk-text)";}}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{position:"relative"}}>
              <button className="tk-action-btn" onClick={()=>setShowNewTabMenu(v=>!v)} style={{minWidth:80,letterSpacing:"0.12em"}}>
                ➕ Add
              </button>
              {showNewTabMenu && (
                <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"var(--tk-surface)",border:"1px solid var(--tk-border-bright)",borderRadius:"var(--tk-radius)",zIndex:200,minWidth:160,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}}>
                  <button onClick={()=>{createNewTab("javascript");setShowNewTabMenu(false);}}
                    style={{display:"block",width:"100%",textAlign:"left",background:"none",border:"none",borderBottom:"1px solid var(--tk-border)",color:"var(--tk-text)",fontFamily:"var(--tk-mono)",fontSize:"0.75rem",letterSpacing:"0.06em",padding:"0.7rem 1rem",cursor:"pointer",transition:"all 0.12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="var(--tk-surface2)";e.currentTarget.style.color="var(--tk-accent)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="var(--tk-text)";}}>
                    JavaScript
                  </button>
                  <button onClick={()=>{createNewTab("cpp");setShowNewTabMenu(false);}}
                    style={{display:"block",width:"100%",textAlign:"left",background:"none",border:"none",color:"var(--tk-text)",fontFamily:"var(--tk-mono)",fontSize:"0.75rem",letterSpacing:"0.06em",padding:"0.7rem 1rem",cursor:"pointer",transition:"all 0.12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="var(--tk-surface2)";e.currentTarget.style.color="var(--tk-accent2)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="var(--tk-text)";}}>
                    C++
                  </button>
                </div>
              )}
            </div>
            <button className="tk-action-btn" onClick={openSaveModal} style={{background:"var(--tk-surface2)",color:"var(--tk-accent)",borderColor:"var(--tk-border-bright)",minWidth:70,letterSpacing:"0.1em"}}>
              💾 Save
            </button>
            <button className="tk-action-btn" onClick={runCode} disabled={running} style={{background:running?"var(--tk-surface2)":"var(--tk-accent)",color:running?"var(--tk-text-dim)":"var(--tk-bg)",borderColor:running?"var(--tk-border)":"var(--tk-accent)",fontWeight:700,minWidth:90,opacity:running?0.6:1,letterSpacing:"0.12em"}}>
              {running?"▶ Running…":"▶ Run"}
            </button>
            <button className="tk-action-btn" onClick={handleOpenSavedFilesPanel} style={{background:"var(--tk-surface2)",color:"var(--tk-accent3,#a9f5a0)",borderColor:"var(--tk-border-bright)",minWidth:55,letterSpacing:"0.08em"}}>
              📂 Files
            </button>
            <button className="tk-action-btn" onClick={()=>helpModal.openModal({})} style={{background:"var(--tk-surface2)",color:"var(--tk-accent2)",borderColor:"var(--tk-border-bright)",minWidth:40,letterSpacing:"0.08em"}}>
              ❓
            </button>
          </div>
        </div>

        <div style={{display:"flex",borderBottom:"1px solid var(--tk-border)",background:"var(--tk-surface)",overflowX:"auto",gap:"4px",padding:"0.4rem 0.8rem"}}>
          {tabs.map((tab) => (
            <div key={tab.id} style={{display:"flex",alignItems:"center",background:tab.id===activeTabId?"var(--tk-surface2)":"var(--tk-surface)",border:`1px solid ${languageColor(tab.language)}`,borderRadius:"var(--tk-radius)",cursor:"pointer",transition:"all 0.2s"}}>
              <button onClick={()=>setActiveTabIdState(tab.id)} style={{background:"none",border:"none",color:tab.id===activeTabId?languageColor(tab.language):"var(--tk-text-dim)",fontFamily:"var(--tk-mono)",fontSize:"0.7rem",padding:"0.4rem 0.8rem",cursor:"pointer",transition:"all 0.2s",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"0.4rem"}}>
                <span>{tab.isPersisted?"📁":"◎"}</span>
                <span>{tab.name}</span>
              </button>
              <button onClick={()=>closeTab(tab.id)} style={{background:"none",border:"none",color:"var(--tk-text-dim)",cursor:"pointer",padding:"0.2rem 0.4rem",fontSize:"0.8rem",transition:"all 0.2s"}}
                onMouseEnter={e=>e.target.style.color="var(--tk-accent2)"}
                onMouseLeave={e=>e.target.style.color="var(--tk-text-dim)"}>
                ✕
              </button>
            </div>
          ))}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:"1rem",padding:"1rem"}}>
          <div style={{border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)",overflow:"hidden",background:"var(--tk-surface)"}}>
            <button
              onClick={()=>setInputOpen(!inputOpen)}
              style={{width:"100%",padding:"0.8rem 1rem",display:"flex",alignItems:"center",justifyContent:"space-between",background:inputOpen?"var(--tk-surface2)":"var(--tk-surface)",border:"none",borderBottom:inputOpen?"1px solid var(--tk-border)":"none",cursor:"pointer",transition:"all 0.2s"}}
            >
              <div style={{display:"flex",alignItems:"center",gap:"0.8rem"}}>
                <span style={{display:"inline-block",transition:"transform 0.2s",transform:inputOpen?"rotate(90deg)":"rotate(0deg)",color:"var(--tk-accent)"}}>▶</span>
                <span style={{fontSize:"0.6rem",letterSpacing:"0.15em",color:"var(--tk-text-dim)",fontWeight:600}}>{currentLanguage.toUpperCase()} CODE</span>
              </div>
              <span style={{fontSize:"0.55rem",color:"var(--tk-text-dim)"}}>{code.split("\n").length} lines</span>
            </button>

            {inputOpen && (
              <div style={{padding:"0.8rem",display:"flex",flexDirection:"column",gap:"0.4rem"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:"0.4rem",borderBottom:"1px solid var(--tk-border)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.6rem"}}>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <button onClick={()=>setFontSize(f=>Math.max(10,f-1))} style={µBtn}>−</button>
                      <span style={{fontSize:"0.6rem",color:"var(--tk-text-dim)",minWidth:24,textAlign:"center"}}>{fontSize}px</span>
                      <button onClick={()=>setFontSize(f=>Math.min(20,f+1))} style={µBtn}>+</button>
                    </div>
                    <button onClick={()=>setWordWrap(v=>!v)} style={{...µBtn,color:wordWrap?"var(--tk-accent)":"var(--tk-text-dim)",padding:"2px 8px",fontSize:"0.55rem"}}>WRAP</button>
                    <button onClick={()=>{
                      setTabs(prev => prev.map(t => t.id === activeTabId ? {...t, code: ""} : t));
                      if (editorViewRef.current) {
                        const len = editorViewRef.current.state.doc.length;
                        editorViewRef.current.dispatch({ changes: { from: 0, to: len, insert: "" } });
                      }
                    }} style={{...µBtn,color:"var(--tk-accent2)",padding:"2px 8px",fontSize:"0.55rem"}}>CLEAR</button>
                  </div>
                </div>

                <div style={{position:"relative",background:"var(--tk-surface)",border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)",overflow:"hidden",display:"flex",transition:"border-color 0.15s",flexDirection:"column"}}
                  onFocusCapture={e=>e.currentTarget.style.borderColor="var(--tk-accent)"}
                  onBlurCapture={e=>e.currentTarget.style.borderColor="var(--tk-border)"}>
                  <div
                    ref={editorRef}
                    style={{flex:1,fontSize:`${fontSize}px`,minHeight:"300px",overflow:"auto",borderRadius:"4px"}}
                    className="cm-editor-container"
                  />
                </div>

                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:"0.58rem",color:"var(--tk-text-dim)",letterSpacing:"0.06em"}}>
                  <span>{code.length} characters</span>
                  <span>Ctrl+Enter to run</span>
                </div>
              </div>
            )}
          </div>

          <div style={{border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)",overflow:"hidden",background:"var(--tk-surface)"}}>
            <button
              onClick={()=>setOutputOpen(!outputOpen)}
              style={{width:"100%",padding:"0.8rem 1rem",display:"flex",alignItems:"center",justifyContent:"space-between",background:outputOpen?"var(--tk-surface2)":"var(--tk-surface)",border:"none",borderBottom:outputOpen?"1px solid var(--tk-border)":"none",cursor:"pointer",transition:"all 0.2s"}}
            >
              <div style={{display:"flex",alignItems:"center",gap:"0.8rem"}}>
                <span style={{display:"inline-block",transition:"transform 0.2s",transform:outputOpen?"rotate(90deg)":"rotate(0deg)",color:"var(--tk-accent)"}}>▶</span>
                <span style={{fontSize:"0.6rem",letterSpacing:"0.15em",color:"var(--tk-text-dim)",fontWeight:600}}>OUTPUT</span>
              </div>
              <span style={{fontSize:"0.55rem",color:"var(--tk-text-dim)"}}>{lines.filter(l=>l.type!=="system").length} items</span>
            </button>

            {outputOpen && (
              <div style={{padding:"0.8rem",display:"flex",flexDirection:"column",gap:"0.4rem"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:"0.4rem",borderBottom:"1px solid var(--tk-border)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.6rem"}}>
                    {running&&<span style={{display:"flex",alignItems:"center",gap:4,fontSize:"0.58rem",color:"var(--tk-accent)"}}><span style={{animation:"tk-pulse 1s infinite"}}>●</span> running</span>}
                    {execTime&&<span style={{fontSize:"0.58rem",color:"var(--tk-accent3)"}}>last: {execTime}ms</span>}
                  </div>
                  <div style={{display:"flex",gap:"0.4rem"}}>
                    <button onClick={copyOutput} disabled={lines.length===0} style={{...µBtn,padding:"2px 8px",fontSize:"0.55rem"}}>COPY</button>
                    <button onClick={()=>setLines([])} style={{...µBtn,padding:"2px 8px",fontSize:"0.55rem"}}>CLEAR</button>
                  </div>
                </div>

                <div style={{background:"#080808",border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)",padding:"0.8rem 1rem",minHeight:200,maxHeight:400,overflowY:"auto",fontFamily:"var(--tk-mono)",fontSize:12,lineHeight:1.7}}>
                  {lines.length===0
                    ?<div style={{color:"#333",fontSize:"0.72rem",userSelect:"none"}}><div>// Run code to see output here</div></div>
                    :lines.filter(l=>l.type!=="system").map(line=>{
                      const st=LS[line.type]||LS.log;
                      return<div key={line.id} style={{color:st.color,fontSize:12,borderBottom:"1px solid rgba(255,255,255,0.03)",paddingBottom:"0.2rem",marginBottom:"0.2rem",whiteSpace:"pre-wrap",wordBreak:"break-all",display:"flex",gap:4}}>
                        {st.prefix&&<span style={{opacity:0.6,flexShrink:0}}>{st.prefix}</span>}<span>{line.text}</span>
                      </div>;
                    })
                  }
                  <div ref={endRef}/>
                </div>

                <div style={{display:"flex",gap:"0.8rem",flexWrap:"wrap"}}>
                  {["log","warn","error","info","return"].map(t=>(
                    <span key={t} style={{fontSize:"0.55rem",letterSpacing:"0.08em",color:LS[t].color,opacity:0.6,display:"flex",alignItems:"center",gap:3}}>
                      <span>{LS[t].prefix||"○"}</span>{t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <InputModal
          isOpen={saveModal.isOpen}
          title="Save File"
          placeholder="Enter filename..."
          onClose={saveModal.closeModal}
          onSubmit={handleSaveFile}
        />
        <ConfirmModal
          isOpen={deleteModal.isOpen}
          title="Delete Tab"
          message={`Are you sure you want to delete "${currentTab?.name}"?`}
          onConfirm={handleDeleteTab}
          onCancel={deleteModal.closeModal}
        />

        <Modal isOpen={helpModal.isOpen} title="Keyboard Shortcuts & Help" onClose={helpModal.closeModal}>
          <div style={{fontSize:"0.85rem",color:"var(--tk-text)",lineHeight:"1.6"}}>
            <div style={{marginBottom:"1.2rem"}}>
              <div style={{fontWeight:600,color:"var(--tk-accent)",marginBottom:"0.4rem"}}>⌨️ Keyboard Shortcuts</div>
              <div style={{fontSize:"0.75rem",fontFamily:"var(--tk-mono)",color:"var(--tk-text-dim)"}}>
                <div>• <strong>Tab</strong> - Indent code (inside editor)</div>
                <div>• <strong>Shift+Tab</strong> - Outdent code</div>
                <div>• <strong>Ctrl/Cmd+/</strong> - Toggle comment</div>
              </div>
            </div>
            <div style={{marginBottom:"1.2rem"}}>
              <div style={{fontWeight:600,color:"var(--tk-accent2)",marginBottom:"0.4rem"}}>📝 Features</div>
              <div style={{fontSize:"0.75rem",color:"var(--tk-text-dim)"}}>
                <div>• ➕ Create new tabs for JavaScript & C++</div>
                <div>• 💾 Save files with persistent storage</div>
                <div>• 📁 Restore all tabs on page reload</div>
                <div>• ▶ Run code with execution output</div>
                <div>• 📋 Copy output to clipboard</div>
              </div>
            </div>
            <div>
              <div style={{fontWeight:600,color:"var(--tk-accent3,#a9f5a0)",marginBottom:"0.4rem"}}>ℹ️ Tips</div>
              <div style={{fontSize:"0.75rem",color:"var(--tk-text-dim)"}}>
                <div>• Unnamed tabs are auto-saved on refresh</div>
                <div>• Use Snippets for quick code templates</div>
                <div>• Tab names show 📁 when persisted</div>
              </div>
            </div>
          </div>
        </Modal>

        {showSavedFiles && (
          <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(2px)"}}>
            <div style={{background:"var(--tk-surface)",border:"1px solid var(--tk-border-bright)",borderRadius:"var(--tk-radius)",padding:"1.5rem",maxWidth:600,maxHeight:600,overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.8)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem",borderBottom:"1px solid var(--tk-border)",paddingBottom:"0.8rem"}}>
                <h2 style={{margin:0,fontSize:"1.1rem",color:"var(--tk-accent)",letterSpacing:"0.08em"}}>📂 SAVED FILES</h2>
                <button onClick={()=>setShowSavedFiles(false)} style={{background:"none",border:"none",color:"var(--tk-text-dim)",cursor:"pointer",fontSize:"1.2rem"}}>✕</button>
              </div>

              {(savedFilesCache.javascript?.length === 0 && savedFilesCache.cpp?.length === 0) ? (
                <div style={{color:"var(--tk-text-dim)",fontSize:"0.9rem",textAlign:"center",padding:"2rem"}}>No saved files yet. Save your code to see it here.</div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
                  {savedFilesCache.javascript && savedFilesCache.javascript.length > 0 && (
                    <div>
                      <h3 style={{margin:"0 0 0.5rem 0",fontSize:"0.85rem",color:"var(--tk-accent)",letterSpacing:"0.1em",textTransform:"uppercase"}}>JavaScript</h3>
                      <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
                        {savedFilesCache.javascript.map(file => (
                          <div key={file.name} style={{display:"flex",flexDirection:"column",background:"var(--tk-surface2)",border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)",overflow:"hidden"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0.7rem 0.9rem",gap:"0.5rem"}}>
                              <button onClick={()=>openSavedFile(file.name, "javascript")} style={{background:"none",border:"none",color:"var(--tk-text)",cursor:"pointer",textAlign:"left",flex:1,fontSize:"0.8rem",fontFamily:"var(--tk-mono)"}}
                                onMouseEnter={e=>e.target.style.color="var(--tk-accent)"}
                                onMouseLeave={e=>e.target.style.color="var(--tk-text)"}>
                                📄 {file.name}
                              </button>
                              <button onClick={()=>handleDeleteSavedFile(file.name, "javascript")} style={{background:"none",border:"none",color:"var(--tk-text-dim)",cursor:"pointer",fontSize:"0.85rem",padding:"0.3rem 0.5rem"}}
                                onMouseEnter={e=>e.target.style.color="var(--tk-error,#ff6b6b)"}
                                onMouseLeave={e=>e.target.style.color="var(--tk-text-dim)"}>
                                🗑
                              </button>
                            </div>
                            <div style={{fontSize:"0.65rem",color:"var(--tk-text-dim)",padding:"0 0.9rem 0.5rem",borderTop:"1px solid var(--tk-border)"}}>
                              {new Date(file.timestamp).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {savedFilesCache.cpp && savedFilesCache.cpp.length > 0 && (
                    <div>
                      <h3 style={{margin:"0 0 0.5rem 0",fontSize:"0.85rem",color:"var(--tk-accent2)",letterSpacing:"0.1em",textTransform:"uppercase"}}>C++</h3>
                      <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
                        {savedFilesCache.cpp.map(file => (
                          <div key={file.name} style={{display:"flex",flexDirection:"column",background:"var(--tk-surface2)",border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)",overflow:"hidden"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0.7rem 0.9rem",gap:"0.5rem"}}>
                              <button onClick={()=>openSavedFile(file.name, "cpp")} style={{background:"none",border:"none",color:"var(--tk-text)",cursor:"pointer",textAlign:"left",flex:1,fontSize:"0.8rem",fontFamily:"var(--tk-mono)"}}
                                onMouseEnter={e=>e.target.style.color="var(--tk-accent2)"}
                                onMouseLeave={e=>e.target.style.color="var(--tk-text)"}>
                                📄 {file.name}
                              </button>
                              <button onClick={()=>{}} style={{background:"none",border:"none",color:"var(--tk-text-dim)",cursor:"pointer",fontSize:"0.85rem",padding:"0.3rem 0.5rem"}}
                                onMouseEnter={e=>e.target.style.color="var(--tk-accent2)"}
                                onMouseLeave={e=>e.target.style.color="var(--tk-text-dim)"}>
                                ✎
                              </button>
                              <button onClick={()=>handleDeleteSavedFile(file.name, "cpp")} style={{background:"none",border:"none",color:"var(--tk-text-dim)",cursor:"pointer",fontSize:"0.85rem",padding:"0.3rem 0.5rem"}}
                                onMouseEnter={e=>e.target.style.color="var(--tk-error,#ff6b6b)"}
                                onMouseLeave={e=>e.target.style.color="var(--tk-text-dim)"}>
                                🗑
                              </button>
                            </div>
                            <div style={{fontSize:"0.65rem",color:"var(--tk-text-dim)",padding:"0 0.9rem 0.5rem",borderTop:"1px solid var(--tk-border)"}}>
                              {new Date(file.timestamp).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <style>{`
          @keyframes tk-pulse{0%,100%{opacity:1}50%{opacity:0.3}}
          .cm-editor-container { font-family: 'Space Mono', monospace !important; --cm-fontSize: 13px; }
          .cm-editor-container .cm-editor { height: 100% !important; background: transparent !important; font-size: var(--cm-fontSize) !important; }
          .cm-editor-container .cm-gutters { background: rgba(0,0,0,0.2) !important; border-right: 1px solid var(--tk-border) !important; font-size: var(--cm-fontSize) !important; }
          .cm-editor-container .cm-lineNumbers { color: var(--tk-text-dim) !important; padding: 1rem 0.6rem 1rem 0.8rem !important; min-width: 36px !important; }
          .cm-editor-container .cm-content { padding: 1rem !important; font-family: 'Space Mono', monospace !important; }
          .cm-editor-container .cm-line { padding: 0 !important; }
          .cm-editor-container .cm-cursor { border-left-color: var(--tk-accent) !important; border-left-width: 2px !important; }
          .cm-editor-container .cm-selection { background: rgba(102, 126, 234, 0.2) !important; }
          .cm-editor-container .cm-activeLineGutter { background: rgba(102, 126, 234, 0.1) !important; }
          .cm-editor-container .cm-activeLine { background: rgba(102, 126, 234, 0.05) !important; }
          .cm-editor-container .cm-matchingBracket { background-color: rgba(102, 126, 234, 0.3) !important; outline: 1px solid rgba(102, 126, 234, 0.5) !important; }
          .cm-editor-container .cm-searchMatch { background-color: rgba(255, 200, 0, 0.3) !important; }
          .cm-editor-container .cm-searchMatch.cm-searchMatch-selected { background-color: rgba(255, 200, 0, 0.5) !important; }
        `}</style>
      </div>
    </>
  );
}