import { useState, useRef, useCallback } from "react";
import { CopyBtn, CopySmall, ActionBtn } from "./tk-shared";

// ── Style helpers ────────────────────────────────────────────────────────
const S = {
  row:    { display:"flex", alignItems:"center", gap:8 },
  label:  { fontSize:"0.6rem", letterSpacing:"0.12em", color:"var(--tk-text-dim)", marginBottom:4, display:"block" },
  input:  { background:"var(--tk-surface)", border:"1px solid var(--tk-border)", color:"var(--tk-text)", fontFamily:"var(--tk-mono)", fontSize:"0.8rem", padding:"0.45rem 0.75rem", borderRadius:"var(--tk-radius)", outline:"none", width:"100%", boxSizing:"border-box", transition:"border-color 0.15s" },
  select: { background:"var(--tk-surface2)", border:"1px solid var(--tk-border-bright)", color:"var(--tk-text)", fontFamily:"var(--tk-mono)", fontSize:"0.75rem", padding:"0.45rem 0.6rem", borderRadius:"var(--tk-radius)", outline:"none", cursor:"pointer" },
  tab:    (active) => ({ background:active?"var(--tk-surface2)":"transparent", border:"none", borderBottom:`2px solid ${active?"var(--tk-accent)":"transparent"}`, color:active?"var(--tk-accent)":"var(--tk-text-dim)", fontFamily:"var(--tk-mono)", fontSize:"0.65rem", letterSpacing:"0.1em", padding:"0.6rem 1rem", cursor:"pointer", transition:"all 0.15s" }),
  addBtn: { background:"none", border:"1px dashed var(--tk-border-bright)", color:"var(--tk-text-dim)", fontFamily:"var(--tk-mono)", fontSize:"0.6rem", letterSpacing:"0.1em", padding:"0.3rem 0.8rem", cursor:"pointer", borderRadius:"var(--tk-radius)", transition:"all 0.15s" },
  delBtn: { background:"none", border:"none", color:"var(--tk-accent2)", fontSize:"0.85rem", cursor:"pointer", lineHeight:1, padding:"0 4px", opacity:0.6 },
  badge:  (color) => ({ display:"inline-block", padding:"2px 8px", borderRadius:100, fontSize:"0.6rem", letterSpacing:"0.1em", fontFamily:"var(--tk-mono)", background:`${color}22`, color, border:`1px solid ${color}44`, marginRight:6 }),
  mono:   { fontFamily:"var(--tk-mono)", fontSize:"0.78rem", background:"var(--tk-surface)", border:"1px solid var(--tk-border)", borderRadius:"var(--tk-radius)", padding:"0.8rem 1rem", color:"var(--tk-text)", resize:"vertical", outline:"none", width:"100%", boxSizing:"border-box", lineHeight:1.6 },
  section:{ marginBottom:"1rem" },
  th:     { fontSize:"0.6rem", letterSpacing:"0.1em", color:"var(--tk-text-dim)", padding:"0.5rem 0.75rem", textAlign:"left", borderBottom:"1px solid var(--tk-border)", background:"var(--tk-surface)" },
  td:     { padding:"0.4rem 0.5rem", borderBottom:"1px solid var(--tk-border)" },
};

const METHODS = ["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"];
const METHOD_COLORS = { GET:"#00ff88", POST:"#4a90e2", PUT:"#ffcc00", PATCH:"#ff9a3c", DELETE:"#ff3366", HEAD:"#888", OPTIONS:"#b388ff" };

const mkRow  = () => ({ id:Date.now()+Math.random(), key:"", value:"", enabled:true });
const mkKV   = (k="",v="") => ({ id:Date.now()+Math.random(), key:k, value:v, enabled:true });

// ── Sub-components ────────────────────────────────────────────────────────────

function KVTable({ rows, onChange, keyPlaceholder="Key", valPlaceholder="Value", extraCol }) {
  const update  = (id, field, val) => onChange(rows.map(r => r.id===id ? {...r,[field]:val} : r));
  const remove  = (id) => onChange(rows.filter(r => r.id!==id));
  const addRow  = () => onChange([...rows, mkRow()]);
  const toggle  = (id) => update(id, "enabled", !rows.find(r=>r.id===id).enabled);

  return (
    <div>
      <table style={{width:"100%",borderCollapse:"collapse",background:"var(--tk-surface)",border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)",overflow:"hidden"}}>
        <thead>
          <tr>
            <th style={{...S.th,width:28}}></th>
            <th style={S.th}>Key</th>
            <th style={S.th}>Value</th>
            {extraCol && <th style={S.th}>{extraCol.label}</th>}
            <th style={{...S.th,width:32}}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{opacity:r.enabled?1:0.4}}>
              <td style={S.td}>
                <input type="checkbox" checked={r.enabled} onChange={()=>toggle(r.id)} style={{accentColor:"var(--tk-accent)"}}/>
              </td>
              <td style={S.td}>
                <input style={{...S.input,border:"none",background:"transparent",padding:"0.2rem 0.4rem"}} value={r.key} onChange={e=>update(r.id,"key",e.target.value)} placeholder={keyPlaceholder}/>
              </td>
              <td style={S.td}>
                <input style={{...S.input,border:"none",background:"transparent",padding:"0.2rem 0.4rem"}} value={r.value} onChange={e=>update(r.id,"value",e.target.value)} placeholder={valPlaceholder}/>
              </td>
              {extraCol && (
                <td style={S.td}>
                  <input style={{...S.input,border:"none",background:"transparent",padding:"0.2rem 0.4rem"}} value={r[extraCol.field]||""} onChange={e=>update(r.id,extraCol.field,e.target.value)} placeholder={extraCol.placeholder||""}/>
                </td>
              )}
              <td style={S.td}><button style={S.delBtn} onClick={()=>remove(r.id)}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button style={{...S.addBtn,marginTop:6}} onClick={addRow}
        onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--tk-accent)";e.currentTarget.style.color="var(--tk-accent)";}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--tk-border-bright)";e.currentTarget.style.color="var(--tk-text-dim)";}}>
        + Add row
      </button>
    </div>
  );
}

function BodyEditor({ body, setBody, bodyType, setBodyType }) {
  const types = ["none","json","text","form-data","x-www-form-urlencoded","binary-url"];
  return (
    <div>
      <div style={{display:"flex",gap:4,marginBottom:"0.8rem",flexWrap:"wrap"}}>
        {types.map(t=>(
          <button key={t} onClick={()=>setBodyType(t)} style={{...S.tab(bodyType===t),padding:"0.4rem 0.8rem",fontSize:"0.6rem"}}>
            {t}
          </button>
        ))}
      </div>
      {bodyType==="none" && <div style={{color:"var(--tk-text-dim)",fontSize:"0.72rem",padding:"1rem 0"}}>No body for this request.</div>}
      {(bodyType==="json"||bodyType==="text") && (
        <textarea style={{...S.mono,minHeight:180}} value={body.raw||""} onChange={e=>setBody({...body,raw:e.target.value})}
          placeholder={bodyType==="json"?`{\n  "key": "value"\n}`:"Plain text body..."}/>
      )}
      {bodyType==="form-data" && <KVTable rows={body.formData||[]} onChange={v=>setBody({...body,formData:v})} keyPlaceholder="Field" valPlaceholder="Value"/>}
      {bodyType==="x-www-form-urlencoded" && <KVTable rows={body.urlEncoded||[]} onChange={v=>setBody({...body,urlEncoded:v})} keyPlaceholder="Key" valPlaceholder="Value"/>}
      {bodyType==="binary-url" && (
        <div>
          <label style={S.label}>File / Binary URL</label>
          <input style={S.input} value={body.binaryUrl||""} onChange={e=>setBody({...body,binaryUrl:e.target.value})} placeholder="https://... or leave empty to upload file"/>
        </div>
      )}
    </div>
  );
}

function AuthEditor({ auth, setAuth }) {
  const types = ["none","basic","bearer","api-key","oauth2-hint"];
  return (
    <div>
      <div style={{display:"flex",gap:4,marginBottom:"1rem",flexWrap:"wrap"}}>
        {types.map(t=>(
          <button key={t} onClick={()=>setAuth({...auth,type:t})} style={{...S.tab(auth.type===t),padding:"0.4rem 0.8rem",fontSize:"0.6rem"}}>
            {t==="oauth2-hint"?"oauth2 ⓘ":t}
          </button>
        ))}
      </div>
      {auth.type==="none"&&<div style={{color:"var(--tk-text-dim)",fontSize:"0.72rem"}}>No auth. Add manually in Headers if needed.</div>}
      {auth.type==="basic"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={S.label}>Username</label><input style={S.input} value={auth.username||""} onChange={e=>setAuth({...auth,username:e.target.value})} placeholder="username"/></div>
          <div><label style={S.label}>Password</label><input type="password" style={S.input} value={auth.password||""} onChange={e=>setAuth({...auth,password:e.target.value})} placeholder="••••••••"/></div>
        </div>
      )}
      {auth.type==="bearer"&&(
        <div><label style={S.label}>Token</label><input style={S.input} value={auth.token||""} onChange={e=>setAuth({...auth,token:e.target.value})} placeholder="eyJhbGciOiJIUzI1NiIs..."/></div>
      )}
      {auth.type==="api-key"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 120px",gap:12}}>
          <div><label style={S.label}>Key name</label><input style={S.input} value={auth.keyName||""} onChange={e=>setAuth({...auth,keyName:e.target.value})} placeholder="X-API-Key"/></div>
          <div><label style={S.label}>Key value</label><input style={S.input} value={auth.keyValue||""} onChange={e=>setAuth({...auth,keyValue:e.target.value})} placeholder="abc123..."/></div>
          <div><label style={S.label}>Add to</label>
            <select style={S.select} value={auth.addTo||"header"} onChange={e=>setAuth({...auth,addTo:e.target.value})}>
              <option value="header">Header</option>
              <option value="query">Query</option>
            </select>
          </div>
        </div>
      )}
      {auth.type==="oauth2-hint"&&(
        <div style={{background:"var(--tk-surface)",border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)",padding:"1rem",fontSize:"0.72rem",color:"var(--tk-text-dim)",lineHeight:1.8}}>
          <div style={{color:"var(--tk-accent3)",marginBottom:"0.5rem"}}>// OAuth2 flow</div>
          <div>1. Get a token from your auth server.</div>
          <div>2. Switch to <span style={{color:"var(--tk-accent)"}}>bearer</span> tab and paste the access token.</div>
          <div>3. Or add <code style={{color:"var(--tk-accent3)"}}>Authorization: Bearer {"<token>"}</code> manually in Headers.</div>
        </div>
      )}
    </div>
  );
}

function CookieEditor({ cookies, setCookies }) {
  return (
    <div>
      <div style={{color:"var(--tk-text-dim)",fontSize:"0.65rem",marginBottom:"0.75rem",letterSpacing:"0.06em"}}>
        // Cookies are sent as the <span style={{color:"var(--tk-accent3)"}}>Cookie</span> header. The browser may restrict cross-origin cookies.
      </div>
      <KVTable rows={cookies} onChange={setCookies} keyPlaceholder="cookie_name" valPlaceholder="cookie_value"/>
    </div>
  );
}

function TestEditor({ tests, setTests, lastResult }) {
  const SNIPPETS_TEST = [
    { label:"Status 200", code:`pm.test("Status is 200", ()=>{\n  pm.expect(pm.response.status).to.equal(200);\n});` },
    { label:"Has JSON body", code:`pm.test("Response is JSON", ()=>{\n  pm.expect(pm.response.body).to.be.an("object");\n});` },
    { label:"Response time < 500ms", code:`pm.test("Fast response", ()=>{\n  pm.expect(pm.response.time).to.be.below(500);\n});` },
    { label:"Header exists", code:`pm.test("Content-Type header", ()=>{\n  pm.expect(pm.response.headers["content-type"]).to.include("application/json");\n});` },
    { label:"Body property", code:`pm.test("Has id field", ()=>{\n  pm.expect(pm.response.body.id).to.exist;\n});` },
  ];
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:"0.75rem"}}>
        <div style={{fontSize:"0.65rem",color:"var(--tk-text-dim)",lineHeight:1.8}}>
          Write tests using <code style={{color:"var(--tk-accent)"}}>pm.test(name, fn)</code> and <code style={{color:"var(--tk-accent)"}}>pm.expect(value)</code>.
          Access response via <code style={{color:"var(--tk-accent3)"}}>pm.response.{"{status,body,headers,time}"}</code>.
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap",flexShrink:0}}>
          {SNIPPETS_TEST.map(s=>(
            <button key={s.label} onClick={()=>setTests(prev=>prev+(prev?"\n\n":"")+s.code)}
              style={{...S.addBtn,fontSize:"0.55rem",padding:"2px 7px",whiteSpace:"nowrap"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--tk-accent)";e.currentTarget.style.color="var(--tk-accent)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--tk-border-bright)";e.currentTarget.style.color="var(--tk-text-dim)";}}>
              + {s.label}
            </button>
          ))}
        </div>
      </div>
      <textarea style={{...S.mono,minHeight:160}} value={tests} onChange={e=>setTests(e.target.value)} placeholder={`pm.test("Status is 200", () => {\n  pm.expect(pm.response.status).to.equal(200);\n});`}/>
      {lastResult?.testResults?.length>0 && (
        <div style={{marginTop:"0.75rem"}}>
          {lastResult.testResults.map((t,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"0.35rem 0",borderBottom:"1px solid var(--tk-border)",fontSize:"0.72rem"}}>
              <span style={{color:t.passed?"var(--tk-accent)":"var(--tk-accent2)",fontSize:"0.9rem"}}>{t.passed?"✓":"✗"}</span>
              <span style={{color:t.passed?"var(--tk-text)":"var(--tk-accent2)"}}>{t.name}</span>
              {t.error&&<span style={{color:"var(--tk-accent2)",opacity:0.7,marginLeft:"auto",fontSize:"0.65rem"}}>{t.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Response Panel ────────────────────────────────────────────────────────────
function ResponsePanel({ response, loading }) {
  const [tab, setTab] = useState("body");
  const tabs = ["body","headers","cookies","tests"];

  if (loading) return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",minHeight:300,background:"var(--tk-surface)",border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)"}}>
      <div style={{textAlign:"center",color:"var(--tk-text-dim)"}}>
        <div style={{fontSize:"1.5rem",marginBottom:8,animation:"tk-pulse 1s infinite"}}>●</div>
        <div style={{fontSize:"0.72rem",letterSpacing:"0.1em"}}>Sending request…</div>
      </div>
    </div>
  );

  if (!response) return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",minHeight:300,background:"var(--tk-surface)",border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)"}}>
      <div style={{textAlign:"center",color:"#333",userSelect:"none"}}>
        <div style={{fontSize:"2rem",marginBottom:8,opacity:0.4}}>↗</div>
        <div style={{fontSize:"0.72rem",letterSpacing:"0.08em"}}>Hit Send to see the response</div>
      </div>
    </div>
  );

  const sc = response.status;
  const statusColor = sc>=500?"#ff3366":sc>=400?"#ffcc00":sc>=300?"#4a90e2":sc>=200?"#00ff88":"#888";
  const prettyBody = (() => {
    try { return JSON.stringify(JSON.parse(response.rawBody), null, 2); }
    catch { return response.rawBody || ""; }
  })();

  const passed = response.testResults?.filter(t=>t.passed).length||0;
  const total  = response.testResults?.length||0;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
      {/* Status bar */}
      <div style={{display:"flex",alignItems:"center",gap:16,padding:"0.6rem 1rem",background:"var(--tk-surface)",border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)"}}>
        <span style={{...S.badge(statusColor)}}>{sc} {response.statusText}</span>
        <span style={{fontSize:"0.65rem",color:"var(--tk-text-dim)"}}>{response.time}ms</span>
        <span style={{fontSize:"0.65rem",color:"var(--tk-text-dim)"}}>{response.size}</span>
        {total>0&&<span style={{fontSize:"0.65rem",color:passed===total?"var(--tk-accent)":"var(--tk-accent2)",marginLeft:"auto"}}>{passed}/{total} tests passed</span>}
        <div style={{marginLeft:total>0?"0":"auto"}}>
          <CopySmall getText={()=>prettyBody}/>
        </div>
      </div>

      {/* Response tabs */}
      <div style={{borderBottom:"1px solid var(--tk-border)",display:"flex"}}>
        {tabs.map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={S.tab(tab===t)}>
            {t.toUpperCase()}
            {t==="tests"&&total>0&&<span style={{marginLeft:5,color:passed===total?"var(--tk-accent)":"var(--tk-accent2)"}}>[{passed}/{total}]</span>}
          </button>
        ))}
      </div>

      {tab==="body"&&(
        <pre style={{...S.mono,minHeight:240,maxHeight:480,overflowY:"auto",margin:0,whiteSpace:"pre-wrap",wordBreak:"break-all",fontSize:"0.78rem"}}>
          {prettyBody||<span style={{color:"var(--tk-text-dim)"}}>// empty body</span>}
        </pre>
      )}
      {tab==="headers"&&(
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.75rem"}}>
          <thead><tr><th style={S.th}>Header</th><th style={S.th}>Value</th></tr></thead>
          <tbody>
            {Object.entries(response.headers||{}).map(([k,v])=>(
              <tr key={k}><td style={{...S.td,color:"var(--tk-accent3)",width:"40%"}}>{k}</td><td style={{...S.td,wordBreak:"break-all"}}>{v}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {tab==="cookies"&&(
        <div>
          {response.resCookies?.length>0
            ?<table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.75rem"}}>
               <thead><tr><th style={S.th}>Name</th><th style={S.th}>Value</th><th style={S.th}>Info</th></tr></thead>
               <tbody>{response.resCookies.map((c,i)=><tr key={i}><td style={{...S.td,color:"var(--tk-accent3)"}}>{c.name}</td><td style={S.td}>{c.value}</td><td style={{...S.td,color:"var(--tk-text-dim)",fontSize:"0.65rem"}}>{c.extra||""}</td></tr>)}</tbody>
             </table>
            :<div style={{color:"var(--tk-text-dim)",fontSize:"0.72rem",padding:"1rem 0"}}>No Set-Cookie headers in response.</div>
          }
        </div>
      )}
      {tab==="tests"&&(
        <div>
          {total===0
            ?<div style={{color:"var(--tk-text-dim)",fontSize:"0.72rem",padding:"1rem 0"}}>No tests were run. Write tests in the Tests tab.</div>
            :response.testResults.map((t,i)=>(
               <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"0.5rem 0.75rem",borderBottom:"1px solid var(--tk-border)",fontSize:"0.75rem",background:i%2===0?"var(--tk-surface)":"transparent"}}>
                 <span style={{color:t.passed?"var(--tk-accent)":"var(--tk-accent2)",fontSize:"1rem",flexShrink:0}}>{t.passed?"✓":"✗"}</span>
                 <span style={{flex:1,color:t.passed?"var(--tk-text)":"var(--tk-accent2)"}}>{t.name}</span>
                 {t.error&&<span style={{color:"var(--tk-accent2)",opacity:0.7,fontSize:"0.65rem"}}>{t.error}</span>}
               </div>
             ))
          }
        </div>
      )}
    </div>
  );
}

// ── Variable resolution ───────────────────────────────────────────────────────
function resolveVars(str, vars) {
  if (!str) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const v = vars.find(v=>v.key===name&&v.enabled);
    return v ? v.value : `{{${name}}}`;
  });
}

// ── cURL parser ────────────────────────────────────────────────────────────────
function parseCurl(curlStr) {
  const result = {
    method: "GET",
    url: "",
    headers: [],
    params: [],
    body: { raw: "", formData: [], urlEncoded: [] },
    bodyType: "none",
    auth: { type: "none" },
    cookies: [],
  };

  if (!curlStr.trim()) return result;

  // Remove 'curl' from the start and handle line continuations
  curlStr = curlStr.replace(/^\s*curl\s+/, "").replace(/\\\n\s*/g, " ");

  // Extract URL (quoted or unquoted)
  const urlMatch = curlStr.match(/^(['"])(.*?)\1|^(\S+)/);
  if (urlMatch) {
    result.url = urlMatch[2] || urlMatch[3];
    curlStr = curlStr.substring(urlMatch[0].length).trim();
  }

  // Parse flags
  const flagRegex = /(?:^|\s)(-[a-zA-Z]|--[a-z-]+)(?:\s+(['"])(.*?)\2|(\S+))?/g;
  let match;
  const flags = {};

  while ((match = flagRegex.exec(curlStr)) !== null) {
    const flag = match[1];
    const value = match[3] || match[4] || true;
    if (!flags[flag]) flags[flag] = [];
    flags[flag].push(value);
  }

  // Process method
  if (flags["-X"] || flags["--request"]) {
    result.method = (flags["-X"] || flags["--request"])[0].toUpperCase();
  }

  // Process headers
  if (flags["-H"] || flags["--header"]) {
    const headerLines = flags["-H"] || flags["--header"];
    headerLines.forEach(h => {
      const [key, ...valParts] = h.split(":").map(s => s.trim());
      const val = valParts.join(":").trim();
      if (key && key.toLowerCase() !== "cookie") {
        result.headers.push(mkKV(key, val));
      }
    });
  }

  // Process cookies from header or --cookie flag
  if (flags["-b"] || flags["--cookie"]) {
    const cookieLines = flags["-b"] || flags["--cookie"];
    cookieLines.forEach(c => {
      const cookies = c.split(";").map(s => s.trim());
      cookies.forEach(cookie => {
        if (cookie) {
          const [k, v] = cookie.split("=");
          result.cookies.push(mkKV(k.trim(), v?.trim() || ""));
        }
      });
    });
  }

  // Check for Authorization header with basic/bearer
  const authHeader = result.headers.find(h => h.key.toLowerCase() === "authorization");
  if (authHeader) {
    if (authHeader.value.toLowerCase().startsWith("basic ")) {
      result.auth.type = "basic";
      try {
        const decoded = atob(authHeader.value.substring(6));
        const [username, password] = decoded.split(":");
        result.auth.username = username;
        result.auth.password = password;
      } catch (e) {}
    } else if (authHeader.value.toLowerCase().startsWith("bearer ")) {
      result.auth.type = "bearer";
      result.auth.token = authHeader.value.substring(7);
    }
  }

  // Process basic auth from --user
  if (flags["-u"] || flags["--user"]) {
    const userpass = (flags["-u"] || flags["--user"])[0];
    const [username, password] = userpass.split(":");
    result.auth = { type: "basic", username, password };
  }

  // Process body
  if (flags["-d"] || flags["--data"] || flags["--data-raw"]) {
    const bodyData = flags["-d"] || flags["--data"] || flags["--data-raw"];
    const bodyStr = bodyData.join("\n");
    
    // Try to detect body type
    if (bodyStr.trim().startsWith("{") || bodyStr.trim().startsWith("[")) {
      result.bodyType = "json";
      result.body.raw = bodyStr;
    } else if (bodyStr.includes("=")) {
      result.bodyType = "x-www-form-urlencoded";
      const pairs = bodyStr.split("&");
      result.body.urlEncoded = pairs.map(p => {
        const [k, v] = p.split("=");
        return mkKV(decodeURIComponent(k), decodeURIComponent(v || ""));
      });
    } else {
      result.bodyType = "text";
      result.body.raw = bodyStr;
    }
  }

  // Process form data
  if (flags["-F"] || flags["--form"]) {
    const formLines = flags["-F"] || flags["--form"];
    result.bodyType = "form-data";
    result.body.formData = formLines.map(f => {
      const [k, v] = f.split("=", 2);
      return mkKV(k.trim(), v?.trim() || "");
    });
  }

  // Extract query params from URL
  try {
    const urlObj = new URL(result.url);
    urlObj.searchParams.forEach((v, k) => {
      result.params.push(mkKV(k, v));
    });
    // Remove query string from URL
    result.url = urlObj.origin + urlObj.pathname;
  } catch (e) {}

  return result;
}

// ── cURL Import Modal ──────────────────────────────────────────────────────────
function CurlImportModal({ onImport, onClose }) {
  const [curlInput, setCurlInput] = useState("");

  const handleImport = () => {
    const parsed = parseCurl(curlInput);
    onImport(parsed);
    onClose();
    setCurlInput("");
  };

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
        maxWidth: "600px",
        width: "90%",
        maxHeight: "80vh",
        overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ fontSize: "1rem", color: "var(--tk-text)", margin: 0 }}>Import cURL Request</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--tk-text-dim)", fontSize: "1.5rem", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={S.label}>Paste your cURL command:</label>
          <textarea
            style={{ ...S.mono, minHeight: 200 }}
            value={curlInput}
            onChange={e => setCurlInput(e.target.value)}
            placeholder={`curl 'https://api.example.com/endpoint' \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -d '{"key":"value"}'`}
          />
        </div>

        <div style={{ fontSize: "0.7rem", color: "var(--tk-text-dim)", marginBottom: "1rem", lineHeight: 1.6 }}>
          <div>✓ Supports: URL, method, headers, body, form-data, basic auth, bearer token, cookies, query params</div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              ...S.select,
              color: "var(--tk-text-dim)",
              border: "1px solid var(--tk-border-bright)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            style={{
              ...S.select,
              background: "var(--tk-accent)",
              color: "var(--tk-bg)",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Run tests against response ────────────────────────────────────────────────
function runTests(testCode, response) {
  const results = [];
  const pm = {
    response: {
      status:  response.status,
      body:    (() => { try { return JSON.parse(response.rawBody); } catch { return response.rawBody; } })(),
      headers: response.headers,
      time:    response.time,
    },
    test: (name, fn) => {
      try { fn(); results.push({ name, passed:true }); }
      catch (e) { results.push({ name, passed:false, error:e.message }); }
    },
    expect: (val) => ({
      to: {
        equal: (expected) => { if (val!==expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`); },
        be: {
          an: (type) => { if (typeof val!==type&&!(type==="object"&&val!==null&&typeof val==="object")) throw new Error(`Expected ${type}, got ${typeof val}`); },
          below: (n) => { if (val>=n) throw new Error(`Expected < ${n}, got ${val}`); },
          above: (n) => { if (val<=n) throw new Error(`Expected > ${n}, got ${val}`); },
        },
        include: (sub) => { if (!String(val).includes(sub)) throw new Error(`Expected to include "${sub}"`); },
        exist: (() => { if(val===undefined||val===null) throw new Error("Expected to exist"); }),
      },
      // Shorthand
      equal: (expected) => { if (val!==expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`); },
    }),
  };
  try { new Function("pm", testCode)(pm); } catch(e) { results.push({ name:"Script error", passed:false, error:e.message }); }
  return results;
}

// ── Parse Set-Cookie headers ──────────────────────────────────────────────────
function parseSetCookie(raw) {
  if (!raw) return [];
  const cookies = Array.isArray(raw) ? raw : [raw];
  return cookies.map(c => {
    const parts = c.split(";").map(p=>p.trim());
    const [name,value] = parts[0].split("=");
    const extra = parts.slice(1).join("; ");
    return { name:name?.trim(), value:value?.trim(), extra };
  });
}

// ── Main HttpTool ─────────────────────────────────────────────────────────────
export default function HttpTool() {
  // ── Request state ──
  const [method,   setMethod]   = useState("GET");
  const [url,      setUrl]      = useState("https://jsonplaceholder.typicode.com/posts/1");
  const [reqTab,   setReqTab]   = useState("params");
  const [params,   setParams]   = useState([mkKV()]);
  const [headers,  setHeaders]  = useState([mkKV("Accept","application/json")]);
  const [cookies,  setCookies]  = useState([mkRow()]);
  const [auth,     setAuth]     = useState({ type:"none" });
  const [bodyType, setBodyType] = useState("none");
  const [body,     setBody]     = useState({ raw:"", formData:[mkRow()], urlEncoded:[mkRow()], binaryUrl:"" });
  const [tests,    setTests]    = useState("");

  // ── Global variables ──
  const [vars,     setVars]     = useState([
    mkKV("baseUrl","https://jsonplaceholder.typicode.com"),
    mkKV("token",""),
  ]);
  const [varTab,   setVarTab]   = useState(false);

  // ── cURL Import ──
  const [showCurlModal, setShowCurlModal] = useState(false);

  // ── Response state ──
  const [response, setResponse] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const abortRef = useRef(null);

  const REQ_TABS = ["params","headers","body","auth","cookies","tests"];

  // ── Build & send ──────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    setLoading(true); setError(null); setResponse(null);

    // Resolve variable placeholders in URL
    let resolvedUrl = resolveVars(url, vars);

    // Append enabled query params
    const activeParams = params.filter(p=>p.enabled&&p.key);
    if (activeParams.length) {
      const q = new URLSearchParams(activeParams.map(p=>[resolveVars(p.key,vars), resolveVars(p.value,vars)]));
      resolvedUrl += (resolvedUrl.includes("?")?"&":"?") + q.toString();
    }

    // Build headers object
    const hdrs = {};
    headers.filter(h=>h.enabled&&h.key).forEach(h=>{ hdrs[resolveVars(h.key,vars)]=resolveVars(h.value,vars); });

    // Auth
    if (auth.type==="basic") {
      hdrs["Authorization"] = "Basic " + btoa(`${auth.username||""}:${auth.password||""}`);
    } else if (auth.type==="bearer") {
      hdrs["Authorization"] = `Bearer ${resolveVars(auth.token||"",vars)}`;
    } else if (auth.type==="api-key" && auth.keyName && auth.addTo==="header") {
      hdrs[auth.keyName] = resolveVars(auth.keyValue||"",vars);
    }

    // API-key as query
    if (auth.type==="api-key" && auth.keyName && auth.addTo==="query") {
      resolvedUrl += (resolvedUrl.includes("?")?"&":"?") + encodeURIComponent(auth.keyName)+"="+encodeURIComponent(resolveVars(auth.keyValue||"",vars));
    }

    // Cookies → Cookie header
    const activeCookies = cookies.filter(c=>c.enabled&&c.key);
    if (activeCookies.length) {
      hdrs["Cookie"] = activeCookies.map(c=>`${c.key}=${c.value}`).join("; ");
    }

    // Body
    let fetchBody = undefined;
    if (method!=="GET"&&method!=="HEAD") {
      if (bodyType==="json") {
        hdrs["Content-Type"] = hdrs["Content-Type"]||"application/json";
        fetchBody = resolveVars(body.raw, vars);
      } else if (bodyType==="text") {
        hdrs["Content-Type"] = hdrs["Content-Type"]||"text/plain";
        fetchBody = resolveVars(body.raw, vars);
      } else if (bodyType==="x-www-form-urlencoded") {
        hdrs["Content-Type"] = "application/x-www-form-urlencoded";
        fetchBody = new URLSearchParams(body.urlEncoded.filter(r=>r.enabled&&r.key).map(r=>[r.key,r.value])).toString();
      } else if (bodyType==="form-data") {
        const fd = new FormData();
        body.formData.filter(r=>r.enabled&&r.key).forEach(r=>fd.append(r.key,r.value));
        fetchBody = fd;
      }
    }

    const t0 = performance.now();
    abortRef.current = new AbortController();

    try {
      const res = await fetch(resolvedUrl, {
        method,
        headers: hdrs,
        body: fetchBody,
        signal: abortRef.current.signal,
        credentials: "include",
      });

      const elapsed = Math.round(performance.now() - t0);
      const rawBody = await res.text();

      // Parse response headers
      const resHeaders = {};
      res.headers.forEach((v,k) => { resHeaders[k]=v; });

      // Parse cookies from Set-Cookie
      const resCookies = parseSetCookie(resHeaders["set-cookie"]);

      // Size estimate
      const size = rawBody.length > 1024
        ? (rawBody.length/1024).toFixed(1)+" KB"
        : rawBody.length+" B";

      const baseResponse = { status:res.status, statusText:res.statusText, time:elapsed, rawBody, headers:resHeaders, resCookies, size, testResults:[] };

      // Run tests
      let testResults = [];
      if (tests.trim()) {
        testResults = runTests(tests, baseResponse);
      }

      setResponse({ ...baseResponse, testResults });
    } catch (e) {
      if (e.name === "AbortError") {
        setError("Request cancelled.");
      } else {
        setError(`${e.name}: ${e.message}. (Check CORS — some servers block browser requests.)`);
      }
    } finally {
      setLoading(false);
    }
  }, [method, url, params, headers, cookies, auth, bodyType, body, tests, vars]);

  const cancel = () => { abortRef.current?.abort(); };

  // ── Import from cURL ──────────────────────────────────────────────────────
  const importFromCurl = useCallback((parsed) => {
    setMethod(parsed.method);
    setUrl(parsed.url);
    setParams(parsed.params.length > 0 ? parsed.params : [mkKV()]);
    setHeaders(parsed.headers.length > 0 ? parsed.headers : [mkKV("Accept", "application/json")]);
    setAuth(parsed.auth);
    setCookies(parsed.cookies.length > 0 ? parsed.cookies : [mkRow()]);
    setBodyType(parsed.bodyType);
    setBody({
      raw: parsed.body.raw,
      formData: parsed.body.formData.length > 0 ? parsed.body.formData : [mkRow()],
      urlEncoded: parsed.body.urlEncoded.length > 0 ? parsed.body.urlEncoded : [mkRow()],
      binaryUrl: "",
    });
  }, []);

  // ── Export to cURL ───────────────────────────────────────────────────────
  const generateCurl = useCallback(() => {
    let curlCmd = "curl ";

    // Build URL with query params
    let finalUrl = url;
    const activeParams = params.filter(p => p.enabled && p.key);
    if (activeParams.length) {
      const q = new URLSearchParams(activeParams.map(p => [p.key, p.value]));
      finalUrl += (finalUrl.includes("?") ? "&" : "?") + q.toString();
    }
    curlCmd += `'${finalUrl}'`;

    // Add method if not GET
    if (method !== "GET") {
      curlCmd += ` \\\n  -X ${method}`;
    }

    // Add headers
    const activeHeaders = headers.filter(h => h.enabled && h.key);
    activeHeaders.forEach(h => {
      curlCmd += ` \\\n  -H '${h.key}: ${h.value}'`;
    });

    // Add auth
    if (auth.type === "basic") {
      curlCmd += ` \\\n  --user '${auth.username || ""}:${auth.password || ""}'`;
    } else if (auth.type === "bearer") {
      curlCmd += ` \\\n  -H 'Authorization: Bearer ${auth.token || ""}'`;
    } else if (auth.type === "api-key") {
      if (auth.addTo === "header") {
        curlCmd += ` \\\n  -H '${auth.keyName || ""}: ${auth.keyValue || ""}'`;
      } else if (auth.addTo === "query") {
        finalUrl += (finalUrl.includes("?") ? "&" : "?") + encodeURIComponent(auth.keyName || "") + "=" + encodeURIComponent(auth.keyValue || "");
      }
    }

    // Add cookies
    const activeCookies = cookies.filter(c => c.enabled && c.key);
    if (activeCookies.length) {
      const cookieStr = activeCookies.map(c => `${c.key}=${c.value}`).join("; ");
      curlCmd += ` \\\n  -b '${cookieStr}'`;
    }

    // Add body
    if (method !== "GET" && method !== "HEAD") {
      if (bodyType === "json" || bodyType === "text") {
        const bodyContent = body.raw;
        if (bodyContent) {
          const escaped = bodyContent.replace(/'/g, "'\"'\"'");
          curlCmd += ` \\\n  -d '${escaped}'`;
        }
      } else if (bodyType === "x-www-form-urlencoded") {
        const urlEncoded = body.urlEncoded.filter(r => r.enabled && r.key);
        if (urlEncoded.length) {
          const bodyStr = new URLSearchParams(urlEncoded.map(r => [r.key, r.value])).toString();
          curlCmd += ` \\\n  -d '${bodyStr}'`;
        }
      } else if (bodyType === "form-data") {
        const formData = body.formData.filter(r => r.enabled && r.key);
        formData.forEach(r => {
          curlCmd += ` \\\n  -F '${r.key}=${r.value}'`;
        });
      }
    }

    return curlCmd;
  }, [method, url, params, headers, auth, cookies, bodyType, body]);

  const copyCurlToClipboard = () => {
    const curlCmd = generateCurl();
    navigator.clipboard.writeText(curlCmd).then(() => {
      alert("cURL command copied to clipboard!");
    }).catch(err => {
      console.error("Failed to copy:", err);
    });
  };

  // ── URL bar with variable highlight ──────────────────────────────────────
  const urlHasVars = /\{\{/.test(url);

  return (
    <div>
      {/* ── Header ── */}
      <div className="tk-tool-header">
        <div style={{display:"flex",alignItems:"center",gap:12,flex:1,flexWrap:"wrap"}}>
          <h2 className="tk-tool-title">HTTP Client</h2>
        </div>
        <div className="tk-tool-actions">
          <button onClick={()=>setShowCurlModal(true)}
            style={{...S.select,fontSize:"0.62rem",letterSpacing:"0.1em",color:"var(--tk-text-dim)",borderColor:"var(--tk-border-bright)",marginRight:6}}>
            Import cURL
          </button>
          <button onClick={copyCurlToClipboard}
            style={{...S.select,fontSize:"0.62rem",letterSpacing:"0.1em",color:"var(--tk-text-dim)",borderColor:"var(--tk-border-bright)",marginRight:6}}>
            Export cURL
          </button>
          <button onClick={()=>setVarTab(v=>!v)}
            style={{...S.select,fontSize:"0.62rem",letterSpacing:"0.1em",color:varTab?"var(--tk-accent)":"var(--tk-text-dim)",borderColor:varTab?"var(--tk-accent)":"var(--tk-border-bright)"}}>
            {"{{}"} Variables
          </button>
        </div>
      </div>

      {/* ── Global Variables panel ── */}
      {varTab && (
        <div style={{background:"var(--tk-surface)",border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)",padding:"1rem",marginBottom:"1rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem"}}>
            <span style={{fontSize:"0.65rem",letterSpacing:"0.12em",color:"var(--tk-accent3)"}}>GLOBAL VARIABLES</span>
            <span style={{fontSize:"0.6rem",color:"var(--tk-text-dim)"}}>Use as <code style={{color:"var(--tk-accent)"}}>{`{{variableName}}`}</code> in URL, headers, body</span>
          </div>
          <KVTable rows={vars} onChange={setVars} keyPlaceholder="variableName" valPlaceholder="value"/>
        </div>
      )}

      {/* ── URL bar ── */}
      <div style={{display:"flex",gap:8,marginBottom:"1rem",alignItems:"stretch"}}>
        <select value={method} onChange={e=>setMethod(e.target.value)}
          style={{...S.select,fontWeight:700,color:METHOD_COLORS[method]||"var(--tk-text)",minWidth:110,fontSize:"0.78rem"}}>
          {METHODS.map(m=><option key={m} value={m} style={{color:METHOD_COLORS[m]}}>{m}</option>)}
        </select>
        <div style={{flex:1,position:"relative"}}>
          <input
            style={{...S.input,paddingRight:urlHasVars?80:12,fontFamily:"var(--tk-mono)",fontSize:"0.82rem"}}
            value={url} onChange={e=>setUrl(e.target.value)}
            placeholder="https://api.example.com/endpoint"
            onFocus={e=>e.target.style.borderColor="var(--tk-accent)"}
            onBlur={e=>e.target.style.borderColor="var(--tk-border)"}
            onKeyDown={e=>{if(e.key==="Enter")send();}}
          />
          {urlHasVars&&<span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:"0.55rem",color:"var(--tk-accent3)",letterSpacing:"0.06em",pointerEvents:"none"}}>vars active</span>}
        </div>
        {loading
          ? <button onClick={cancel} style={{...S.select,background:"var(--tk-accent2)",color:"#fff",border:"none",cursor:"pointer",fontWeight:700,minWidth:90,letterSpacing:"0.1em"}}>✕ Cancel</button>
          : <button onClick={send} style={{...S.select,background:"var(--tk-accent)",color:"var(--tk-bg)",border:"none",cursor:"pointer",fontWeight:700,minWidth:90,letterSpacing:"0.12em",fontSize:"0.78rem"}}>Send ↗</button>
        }
      </div>

      {/* ── Request config tabs ── */}
      <div style={{border:"1px solid var(--tk-border)",borderRadius:"var(--tk-radius)",marginBottom:"1rem",overflow:"hidden"}}>
        <div style={{display:"flex",borderBottom:"1px solid var(--tk-border)",background:"var(--tk-surface)",flexWrap:"wrap"}}>
          {REQ_TABS.map(t=>(
            <button key={t} onClick={()=>setReqTab(t)} style={S.tab(reqTab===t)}>
              {t.toUpperCase()}
              {t==="params"&&params.filter(p=>p.enabled&&p.key).length>0&&<span style={{marginLeft:4,color:"var(--tk-accent3)",fontSize:"0.55rem"}}>{params.filter(p=>p.enabled&&p.key).length}</span>}
              {t==="headers"&&headers.filter(h=>h.enabled&&h.key).length>0&&<span style={{marginLeft:4,color:"var(--tk-accent3)",fontSize:"0.55rem"}}>{headers.filter(h=>h.enabled&&h.key).length}</span>}
              {t==="auth"&&auth.type!=="none"&&<span style={{marginLeft:4,color:"var(--tk-accent)",fontSize:"0.55rem"}}>●</span>}
              {t==="body"&&bodyType!=="none"&&<span style={{marginLeft:4,color:"var(--tk-accent3)",fontSize:"0.55rem"}}>●</span>}
              {t==="tests"&&tests.trim()&&<span style={{marginLeft:4,color:"var(--tk-accent3)",fontSize:"0.55rem"}}>●</span>}
            </button>
          ))}
        </div>
        <div style={{padding:"1rem"}}>
          {reqTab==="params"   && <KVTable rows={params}  onChange={setParams}  keyPlaceholder="param" valPlaceholder="value"/>}
          {reqTab==="headers"  && <KVTable rows={headers} onChange={setHeaders} keyPlaceholder="Header-Name" valPlaceholder="header-value"/>}
          {reqTab==="body"     && <BodyEditor body={body} setBody={setBody} bodyType={bodyType} setBodyType={setBodyType}/>}
          {reqTab==="auth"     && <AuthEditor auth={auth} setAuth={setAuth}/>}
          {reqTab==="cookies"  && <CookieEditor cookies={cookies} setCookies={setCookies}/>}
          {reqTab==="tests"    && <TestEditor tests={tests} setTests={setTests} lastResult={response}/>}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{background:"rgba(255,51,102,0.08)",border:"1px solid rgba(255,51,102,0.3)",borderRadius:"var(--tk-radius)",padding:"0.75rem 1rem",marginBottom:"1rem",fontSize:"0.72rem",color:"var(--tk-accent2)",lineHeight:1.6}}>
          ✗ {error}
        </div>
      )}

      {/* ── Response ── */}
      <ResponsePanel response={response} loading={loading}/>

      {/* ── cURL Import Modal ── */}
      {showCurlModal && (
        <CurlImportModal
          onImport={importFromCurl}
          onClose={() => setShowCurlModal(false)}
        />
      )}

      <style>{`@keyframes tk-pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}
