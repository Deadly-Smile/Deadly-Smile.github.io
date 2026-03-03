import { useState, useEffect, useCallback, useRef } from "react";

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
};

const SNIPPETS = {
  javascript:[
    {label:"Hello World",code:`console.log("Hello, World!");`},
    {label:"Array methods",code:`const nums=[1,2,3,4,5];\nconsole.log("doubled:",nums.map(n=>n*2));\nconsole.log("evens:",nums.filter(n=>n%2===0));\nconsole.log("sum:",nums.reduce((a,b)=>a+b,0));`},
    {label:"Async / fetch",code:`const res=await fetch("https://jsonplaceholder.typicode.com/todos/1");\nconst data=await res.json();\nconsole.log(data);`},
    {label:"Classes",code:`class Animal{constructor(name){this.name=name;}speak(){return\`\${this.name} makes a sound.\`;}}\nclass Dog extends Animal{speak(){return\`\${this.name} barks!\`;}}\nconsole.log(new Dog("Rex").speak());`},
    {label:"Timer / perf",code:`const t0=performance.now();\nlet x=0;for(let i=0;i<1_000_000;i++)x+=i;\nconsole.log("Result:",x);\nconsole.log(\`Took \${(performance.now()-t0).toFixed(2)}ms\`);`},
  ],
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
  const endRef=useRef(null);
  const lang=LANGUAGES[langKey];

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

  const lineCount=code.split("\n").length;

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

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem"}}>
        {/* Editor */}
        <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:"0.6rem",letterSpacing:"0.15em",color:"var(--tk-text-dim)"}}>EDITOR</span>
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
          <div style={{position:"relative",background:"var(--tk-surface)",border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)",overflow:"hidden",display:"flex",transition:"border-color 0.15s"}}
            onFocusCapture={e=>e.currentTarget.style.borderColor="var(--tk-accent)"}
            onBlurCapture={e=>e.currentTarget.style.borderColor="var(--tk-border)"}>
            <div style={{padding:"1rem 0.6rem 1rem 0.8rem",background:"rgba(0,0,0,0.2)",borderRight:"1px solid var(--tk-border)",color:"var(--tk-text-dim)",fontFamily:"var(--tk-mono)",fontSize:fontSize,lineHeight:1.6,userSelect:"none",minWidth:36,textAlign:"right",overflow:"hidden"}}>
              {Array.from({length:lineCount},(_,i)=><div key={i}>{i+1}</div>)}
            </div>
            <textarea value={code} onChange={e=>setCode(e.target.value)} onKeyDown={handleTab} spellCheck={false} style={{flex:1,background:"transparent",border:"none",color:"var(--tk-text)",fontFamily:"var(--tk-mono)",fontSize,lineHeight:1.6,padding:"1rem",resize:"none",outline:"none",minHeight:340,whiteSpace:wordWrap?"pre-wrap":"pre",overflowWrap:wordWrap?"break-word":"normal",overflowX:wordWrap?"hidden":"auto"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:"0.58rem",color:"var(--tk-text-dim)",letterSpacing:"0.06em"}}>{lineCount} lines · {code.length} chars{execTime&&<span style={{marginLeft:"1rem",color:"var(--tk-accent3)"}}>last: {execTime}ms</span>}</span>
            <span style={{fontSize:"0.58rem",color:"var(--tk-text-dim)",letterSpacing:"0.06em"}}>Ctrl+Enter to run · Tab to indent</span>
          </div>
        </div>

        {/* Console */}
        <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.6rem"}}>
              <span style={{fontSize:"0.6rem",letterSpacing:"0.15em",color:"var(--tk-text-dim)"}}>CONSOLE</span>
              {lines.length>0&&<span style={{background:"var(--tk-surface2)",border:"1px solid var(--tk-border-bright)",borderRadius:100,padding:"1px 7px",fontSize:"0.55rem",color:"var(--tk-text-dim)"}}>{lines.filter(l=>l.type!=="system").length}</span>}
              {running&&<span style={{display:"flex",alignItems:"center",gap:4,fontSize:"0.58rem",color:"var(--tk-accent)"}}><span style={{animation:"tk-pulse 1s infinite"}}>●</span> running</span>}
            </div>
            <button onClick={()=>setLines([])} style={{...µBtn,padding:"2px 8px",fontSize:"0.55rem"}}>CLEAR</button>
          </div>
          <div style={{background:"#080808",border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)",padding:"0.8rem 1rem",minHeight:340,maxHeight:480,overflowY:"auto",fontFamily:"var(--tk-mono)",fontSize:12,lineHeight:1.7}}>
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
      </div>
      <style>{`@keyframes tk-pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}
