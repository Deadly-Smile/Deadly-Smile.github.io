import { useState, useEffect, useCallback, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import SNIPPETS from "./snippets";

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
        pushLine({type:"system",text:"Compiling and executing..."});
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
        
        if (result.compiler_error && result.compiler_error.trim()) {
          pushLine({type:"error",text:result.compiler_error});
          hasOutput = true;
        }
        
        if (result.compiler_message && result.compiler_message.trim()) {
          pushLine({type:"warn",text:result.compiler_message});
          hasOutput = true;
        }
        
        if (result.program_output && result.program_output.trim()) {
          result.program_output.split("\n").filter(l=>l.trim()).forEach(line=>pushLine({type:"log",text:line}));
          hasOutput = true;
        }
        
        if (result.program_error && result.program_error.trim()) {
          pushLine({type:"error",text:result.program_error});
          hasOutput = true;
        }
        
        if (!hasOutput && result.status === "0") {
          pushLine({type:"log",text:"(Program executed successfully with no output)"});
        }
        
        if (result.status !== "0" && result.status !== "") {
          pushLine({type:"system",text:"Execution failed (status: "+result.status+")"});
        } else {
          pushLine({type:"system",text:"Execution completed"});
        }
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
  const [langKey,setLangKey]=useState("javascript");
  const [code,setCode]=useState(SNIPPETS.javascript[0].code);
  const [lines,setLines]=useState([]);
  const [running,setRunning]=useState(false);
  const [execTime,setExecTime]=useState(null);
  const [showSnippets,setShowSnippets]=useState(false);
  const [fontSize,setFontSize]=useState(13);
  const [wordWrap,setWordWrap]=useState(true);
  const [inputOpen,setInputOpen]=useState(true);
  const [outputOpen,setOutputOpen]=useState(true);
  const endRef=useRef(null);
  const editorRef=useRef(null);
  const editorViewRef=useRef(null);
  const lang=LANGUAGES[langKey];

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }
    editorRef.current.style.setProperty('--cm-fontSize', `${fontSize}px`);
    
    const language=langKey==="cpp"?cpp():javascript();
    const state=EditorState.create({
      doc:code,
      extensions:[basicSetup,language,oneDark],
    });
    if (editorViewRef.current){
      editorViewRef.current.destroy();
    }
    const view=new EditorView({
      state,
      parent:editorRef.current,
      dispatch:(tr)=>{
        view.update([tr]);
        if(tr.docChanged){
          setCode(view.state.doc.toString());
        }
      },
    });
    editorViewRef.current=view;
    return()=>{
      if(editorViewRef.current){
        editorViewRef.current.destroy();
      }
    };
  },[langKey]);

  // Update font size when it changes
  useEffect(()=>{
    if(editorRef.current){
      editorRef.current.style.setProperty('--cm-fontSize', `${fontSize}px`);
    }
  },[fontSize]);

  // Sync CodeMirror when code changes externally (e.g., snippet selection)
  useEffect(()=>{
    if(editorViewRef.current && code !== editorViewRef.current.state.doc.toString()){
      const changes={from:0,to:editorViewRef.current.state.doc.length,insert:code};
      editorViewRef.current.dispatch({changes});
    }
  },[code]);

  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[lines]);

  const pushLine=useCallback(line=>setLines(p=>[...p,{...line,id:Date.now()+Math.random()}]),[]);

  const runCode=useCallback(async()=>{
    if(running)return;
    setRunning(true);setLines([]);
    const t0=performance.now();
    pushLine({type:"system",text:`Running ${lang.label}…`});
    const result=await lang.run(code,pushLine);
    const elapsed=(performance.now()-t0).toFixed(1);
    setExecTime(elapsed);
    if(result.error)pushLine({type:"error",text:result.error});
    pushLine({type:"system",text:`Done in ${elapsed}ms`});
    setRunning(false);
  },[running,code,lang,pushLine]);

  useEffect(()=>{
    const h=e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();runCode();}};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[runCode]);

  const handleTab=e=>{
    if(e.key!=="Tab")return;
    e.preventDefault();
    const el=e.target,s=el.selectionStart,en=el.selectionEnd;
    const next=code.substring(0,s)+"  "+code.substring(en);
    setCode(next);setTimeout(()=>{el.selectionStart=el.selectionEnd=s+2;},0);
  };

  return(
    <div>
      <div className="tk-tool-header">
        <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
          <h2 className="tk-tool-title">Code Runner</h2>
          <div style={{display:"flex",border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)",overflow:"hidden"}}>
            {Object.entries(LANGUAGES).map(([k,l])=>(
              <button key={k} onClick={()=>{setLangKey(k);setCode(SNIPPETS[k]?.[0]?.code||"");setLines([]);}} style={{
                background:langKey===k?"var(--tk-surface2)":"var(--tk-surface)",border:"none",borderRight:"1px solid var(--tk-border)",
                color:langKey===k?"var(--tk-accent)":"var(--tk-text-dim)",fontFamily:"var(--tk-mono)",fontSize:"0.62rem",
                letterSpacing:"0.1em",padding:"0.45rem 0.9rem",cursor:"pointer",transition:"all 0.15s",
              }}>{l.abbr}</button>
            ))}
          </div>
        </div>
        <div className="tk-tool-actions">
          <div style={{position:"relative"}}>
            <button className="tk-action-btn" onClick={()=>setShowSnippets(v=>!v)}
              style={{color:showSnippets?"var(--tk-bg)":undefined,background:showSnippets?"var(--tk-accent)":undefined}}>
              Snippets ▾
            </button>
            {showSnippets&&(
              <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:"var(--tk-surface)",border:"1px solid var(--tk-border-bright)",borderRadius:"var(--tk-radius)",zIndex:200,minWidth:180,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}}>
                {(SNIPPETS[langKey]||[]).map(s=>(
                  <button key={s.label} onClick={()=>{setCode(s.code);setShowSnippets(false);setLines([]);}} style={{display:"block",width:"100%",textAlign:"left",background:"none",border:"none",borderBottom:"1px solid var(--tk-border)",color:"var(--tk-text)",fontFamily:"var(--tk-mono)",fontSize:"0.65rem",letterSpacing:"0.06em",padding:"0.7rem 1rem",cursor:"pointer",transition:"all 0.12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="var(--tk-surface2)";e.currentTarget.style.color="var(--tk-accent)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color="var(--tk-text)";}}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="tk-action-btn" onClick={runCode} disabled={running} style={{background:running?"var(--tk-surface2)":"var(--tk-accent)",color:running?"var(--tk-text-dim)":"var(--tk-bg)",borderColor:running?"var(--tk-border)":"var(--tk-accent)",fontWeight:700,minWidth:90,opacity:running?0.6:1,letterSpacing:"0.12em"}}>
            {running?"▶ Running…":"▶ Run"}
          </button>
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
        {/* CODE SECTION - COLLAPSIBLE */}
        <div style={{border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)",overflow:"hidden",background:"var(--tk-surface)"}}>
          <button
            onClick={()=>setInputOpen(!inputOpen)}
            style={{width:"100%",padding:"0.8rem 1rem",display:"flex",alignItems:"center",justifyContent:"space-between",background:inputOpen?"var(--tk-surface2)":"var(--tk-surface)",border:"none",borderBottom:inputOpen?"1px solid var(--tk-border)":"none",cursor:"pointer",transition:"all 0.2s"}}
          >
            <div style={{display:"flex",alignItems:"center",gap:"0.8rem"}}>
              <span style={{display:"inline-block",transition:"transform 0.2s",transform:inputOpen?"rotate(90deg)":"rotate(0deg)",color:"var(--tk-accent)"}}>▶</span>
              <span style={{fontSize:"0.6rem",letterSpacing:"0.15em",color:"var(--tk-text-dim)",fontWeight:600}}>CODE</span>
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
                  <button onClick={()=>setCode("")} style={{...µBtn,color:"var(--tk-accent2)",padding:"2px 8px",fontSize:"0.55rem"}}>CLEAR</button>
                </div>
              </div>
              
              <div style={{position:"relative",background:"var(--tk-surface)",border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)",overflow:"hidden",display:"flex",transition:"border-color 0.15s",flexDirection:"column"}}
                onFocusCapture={e=>e.currentTarget.style.borderColor="var(--tk-accent)"}
                onBlurCapture={e=>e.currentTarget.style.borderColor="var(--tk-border)"}>
                <div 
                  ref={editorRef}
                  style={{
                    flex:1,
                    fontSize:`${fontSize}px`,
                    minHeight:"300px",
                    overflow:"auto",
                    borderRadius:"4px",
                  }}
                  className="cm-editor-container"
                />
              </div>
              
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:"0.58rem",color:"var(--tk-text-dim)",letterSpacing:"0.06em"}}>
                <span>{code.length} characters</span>
                <span>Ctrl+Enter to run · Tab to indent</span>
              </div>
            </div>
          )}
        </div>

        {/* OUTPUT SECTION - COLLAPSIBLE */}
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
                <button onClick={()=>setLines([])} style={{...µBtn,padding:"2px 8px",fontSize:"0.55rem"}}>CLEAR</button>
              </div>
              
              <div style={{background:"#080808",border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)",padding:"0.8rem 1rem",minHeight:200,maxHeight:400,overflowY:"auto",fontFamily:"var(--tk-mono)",fontSize:12,lineHeight:1.7}}>
                {lines.length===0
                  ?<div style={{color:"#333",fontSize:"0.72rem",userSelect:"none"}}><div>// Output will appear here</div><div style={{marginTop:"0.5rem"}}>// Press ▶ Run or Ctrl+Enter</div></div>
                  :lines.map(line=>{
                    const st=LS[line.type]||LS.log,sys=line.type==="system";
                    return<div key={line.id} style={{color:st.color,opacity:sys?0.45:1,fontSize:sys?11:12,borderBottom:sys?"none":"1px solid rgba(255,255,255,0.03)",paddingBottom:sys?0:"0.2rem",marginBottom:sys?"0.1rem":"0.2rem",whiteSpace:"pre-wrap",wordBreak:"break-all",display:"flex",gap:4}}>
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
      <style>{`
        @keyframes tk-pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        
        .cm-editor-container {
          font-family: 'Space Mono', monospace !important;
          --cm-fontSize: 13px;
        }
        
        .cm-editor-container .cm-editor {
          height: 100% !important;
          background: transparent !important;
          font-size: var(--cm-fontSize) !important;
        }
        
        .cm-editor-container .cm-gutters {
          background: rgba(0,0,0,0.2) !important;
          border-right: 1px solid var(--tk-border) !important;
          font-size: var(--cm-fontSize) !important;
        }
        
        .cm-editor-container .cm-lineNumbers {
          color: var(--tk-text-dim) !important;
          padding: 1rem 0.6rem 1rem 0.8rem !important;
          min-width: 36px !important;
        }
        
        .cm-editor-container .cm-content {
          padding: 1rem !important;
          font-family: 'Space Mono', monospace !important;
        }
        
        .cm-editor-container .cm-line {
          padding: 0 !important;
        }
        
        .cm-editor-container .cm-cursor {
          border-left-color: var(--tk-accent) !important;
          border-left-width: 2px !important;
        }
        
        .cm-editor-container .cm-selection {
          background: rgba(102, 126, 234, 0.2) !important;
        }
        
        .cm-editor-container .cm-activeLineGutter {
          background: rgba(102, 126, 234, 0.1) !important;
        }
        
        .cm-editor-container .cm-activeLine {
          background: rgba(102, 126, 234, 0.05) !important;
        }
        
        .cm-editor-container .cm-matchingBracket {
          background-color: rgba(102, 126, 234, 0.3) !important;
          outline: 1px solid rgba(102, 126, 234, 0.5) !important;
        }
        
        .cm-editor-container .cm-searchMatch {
          background-color: rgba(255, 200, 0, 0.3) !important;
        }
        
        .cm-editor-container .cm-searchMatch.cm-searchMatch-selected {
          background-color: rgba(255, 200, 0, 0.5) !important;
        }
      `}</style>
    </div>
  );
}
