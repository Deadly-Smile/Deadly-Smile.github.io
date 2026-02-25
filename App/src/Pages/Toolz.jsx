import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../toolkit.css";

// ─── Shared helpers ───────────────────────────────────────────────────────────

// Self-contained copy button — no external state needed, impossible to show both labels
function CopyBtn({ getText }) {
  const [state, setState] = useState("idle"); // "idle" | "copied" | "err"
  const handle = () => {
    const text = typeof getText === "function" ? getText() : getText;
    if (!text || text === "—") return;
    navigator.clipboard.writeText(text)
      .then(() => { setState("copied"); setTimeout(() => setState("idle"), 1500); })
      .catch(() => { setState("err"); setTimeout(() => setState("idle"), 1500); });
  };
  return (
    <button className="tk-action-btn" onClick={handle}>
      {state === "copied" ? "✓ Copied!" : state === "err" ? "✗ Failed" : "Copy"}
    </button>
  );
}

// Small inline copy button (used in hash rows etc.)
function CopySmall({ getText }) {
  const [state, setState] = useState("idle");
  const handle = () => {
    const text = typeof getText === "function" ? getText() : getText;
    if (!text || text === "—") return;
    navigator.clipboard.writeText(text)
      .then(() => { setState("copied"); setTimeout(() => setState("idle"), 1500); })
      .catch(() => { setState("err");   setTimeout(() => setState("idle"), 1500); });
  };
  return (
    <button className="tk-copy-small" onClick={handle}>
      {state === "copied" ? "✓" : state === "err" ? "✗" : "copy"}
    </button>
  );
}

function ActionBtn({ onClick, danger, children }) {
  return (
    <button className={`tk-action-btn${danger ? " tk-danger" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function StatusBar({ msg, type }) {
  return <div className={`tk-status-bar${type ? " tk-" + type : ""}`}>{msg || "Ready."}</div>;
}

function SplitPane({ left, right }) {
  return (
    <div className="tk-split-pane">
      <div className="tk-pane">{left}</div>
      <div className="tk-pane">{right}</div>
    </div>
  );
}

// ─── 1. JSON Formatter ────────────────────────────────────────────────────────
function countKeys(obj, count = 0) {
  if (typeof obj !== "object" || obj === null) return count;
  const keys = Object.keys(obj);
  count += keys.length;
  keys.forEach((k) => { count = countKeys(obj[k], count); });
  return count;
}

function JsonTool() {
  const [input,  setInput]  = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState({ msg: "Ready.", type: "" });
  const outputRef = useRef("");

  const format = useCallback((indent, raw = input) => {
    if (!raw.trim()) { setOutput(""); outputRef.current = ""; setStatus({ msg: "Ready.", type: "" }); return; }
    try {
      const parsed = JSON.parse(raw);
      const result = JSON.stringify(parsed, null, indent);
      setOutput(result);
      outputRef.current = result;
      setStatus({ msg: `✓ Valid JSON — ${countKeys(parsed)} keys/values`, type: "ok" });
    } catch (e) {
      setOutput(""); outputRef.current = "";
      setStatus({ msg: "✗ " + e.message, type: "err" });
    }
  }, [input]);

  useEffect(() => { format(2, input); }, [input]);

  return (
    <div>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">JSON Formatter &amp; Validator</h2>
        <div className="tk-tool-actions">
          <ActionBtn onClick={() => format(2)}>Format</ActionBtn>
          <ActionBtn onClick={() => format(0)}>Minify</ActionBtn>
          <CopyBtn getText={() => outputRef.current} />
          <ActionBtn danger onClick={() => { setInput(""); setOutput(""); outputRef.current = ""; setStatus({ msg: "Ready.", type: "" }); }}>Clear</ActionBtn>
        </div>
      </div>
      <SplitPane
        left={<><div className="tk-pane-label">INPUT</div><textarea className="tk-textarea" value={input} onChange={e => setInput(e.target.value)} placeholder="Paste your JSON here..." /></>}
        right={<><div className="tk-pane-label">OUTPUT</div><pre className="tk-output-pre">{output}</pre></>}
      />
      <StatusBar {...status} />
    </div>
  );
}

// ─── 2. Regex Tester ──────────────────────────────────────────────────────────
function RegexTool() {
  const [pattern, setPattern] = useState("");
  const [flags,   setFlags]   = useState("g");
  const [testStr, setTestStr] = useState("");
  const [output,  setOutput]  = useState([]);
  const [status,  setStatus]  = useState({ msg: "Ready.", type: "" });

  const runRegex = useCallback(() => {
    if (!pattern) { setOutput([]); setStatus({ msg: "Enter a pattern.", type: "" }); return; }
    try {
      const f = flags.includes("g") ? flags : flags + "g";
      const re = new RegExp(pattern, f);
      const matches = [...testStr.matchAll(re)];
      if (matches.length === 0) {
        setOutput([{ type: "none", text: "No matches found." }]);
        setStatus({ msg: "No matches.", type: "err" });
      } else {
        const lines = [`Found ${matches.length} match${matches.length !== 1 ? "es" : ""}:\n`];
        matches.forEach((m, i) => {
          lines.push(`[${i + 1}] "${m[0]}" at index ${m.index}`);
          if (m.length > 1) m.slice(1).forEach((g, gi) => lines.push(`     Group ${gi + 1}: "${g}"`));
        });
        setOutput(lines.map(t => ({ type: "text", text: t })));
        setStatus({ msg: `✓ ${matches.length} match(es) found`, type: "ok" });
      }
    } catch (e) {
      setOutput([{ type: "err", text: "Invalid regex: " + e.message }]);
      setStatus({ msg: "✗ " + e.message, type: "err" });
    }
  }, [pattern, flags, testStr]);

  useEffect(() => { runRegex(); }, [runRegex]);

  return (
    <div>
      <div className="tk-tool-header"><h2 className="tk-tool-title">Regex Tester</h2></div>
      <div className="tk-regex-top">
        <div className="tk-regex-field-wrap">
          <span className="tk-regex-slash">/</span>
          <input className="tk-regex-input" value={pattern} onChange={e => setPattern(e.target.value)} placeholder="your pattern" />
          <span className="tk-regex-slash">/</span>
          <input className="tk-regex-flags" value={flags} onChange={e => setFlags(e.target.value)} placeholder="gim" maxLength={5} />
        </div>
        <ActionBtn onClick={runRegex}>Test</ActionBtn>
      </div>
      <SplitPane
        left={<><div className="tk-pane-label">TEST STRING</div><textarea className="tk-textarea" value={testStr} onChange={e => setTestStr(e.target.value)} placeholder="Type your test string here..." /></>}
        right={<>
          <div className="tk-pane-label">MATCHES</div>
          <pre className="tk-output-pre">
            {output.map((o, i) => (
              <span key={i} className={o.type === "err" ? "tk-regex-no-match" : ""}>{o.text + "\n"}</span>
            ))}
          </pre>
        </>}
      />
      <StatusBar {...status} />
    </div>
  );
}

// ─── 3. Base64 ────────────────────────────────────────────────────────────────
function Base64Tool() {
  const [plain, setPlain]   = useState("");
  const [b64,   setB64]     = useState("");
  const [status, setStatus] = useState({ msg: "Ready.", type: "" });
  const b64Ref = useRef("");

  const encode = () => {
    try {
      const result = btoa(unescape(encodeURIComponent(plain)));
      setB64(result); b64Ref.current = result;
      setStatus({ msg: "✓ Encoded", type: "ok" });
    } catch (e) { setStatus({ msg: "✗ " + e.message, type: "err" }); }
  };

  const decode = () => {
    try {
      setPlain(decodeURIComponent(escape(atob(b64.trim()))));
      setStatus({ msg: "✓ Decoded", type: "ok" });
    } catch { setStatus({ msg: "✗ Invalid Base64", type: "err" }); }
  };

  const handlePlainChange = (v) => {
    setPlain(v);
    if (!v) { setB64(""); b64Ref.current = ""; return; }
    try {
      const result = btoa(unescape(encodeURIComponent(v)));
      setB64(result); b64Ref.current = result;
      setStatus({ msg: "✓ Live encoding", type: "ok" });
    } catch {}
  };

  return (
    <div>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Base64 Encoder / Decoder</h2>
        <div className="tk-tool-actions">
          <ActionBtn onClick={encode}>Encode →</ActionBtn>
          <ActionBtn onClick={decode}>← Decode</ActionBtn>
          <CopyBtn getText={() => b64Ref.current} />
        </div>
      </div>
      <SplitPane
        left={<><div className="tk-pane-label">PLAIN TEXT</div><textarea className="tk-textarea" value={plain} onChange={e => handlePlainChange(e.target.value)} placeholder="Type or paste text..." /></>}
        right={<><div className="tk-pane-label">BASE64</div><textarea className="tk-textarea" value={b64} onChange={e => { setB64(e.target.value); b64Ref.current = e.target.value; }} placeholder="Base64 output appears here..." /></>}
      />
      <StatusBar {...status} />
    </div>
  );
}

// ─── 4. Hash Generator ────────────────────────────────────────────────────────
async function shaHash(algo, text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest(algo, enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function md5(str) {
  function safeAdd(x, y) { const lsw = (x & 0xFFFF) + (y & 0xFFFF); return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xFFFF); }
  function bitRotateLeft(num, cnt) { return (num << cnt) | (num >>> (32 - cnt)); }
  function md5cmn(q, a, b, x, s, t) { return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
  function md5ff(a,b,c,d,x,s,t){return md5cmn((b&c)|(~b&d),a,b,x,s,t);}
  function md5gg(a,b,c,d,x,s,t){return md5cmn((b&d)|(c&~d),a,b,x,s,t);}
  function md5hh(a,b,c,d,x,s,t){return md5cmn(b^c^d,a,b,x,s,t);}
  function md5ii(a,b,c,d,x,s,t){return md5cmn(c^(b|~d),a,b,x,s,t);}
  const utf8 = unescape(encodeURIComponent(str));
  const bArr = [];
  for (let i = 0; i < utf8.length; i++) bArr.push(utf8.charCodeAt(i));
  bArr.push(0x80);
  while (bArr.length % 64 !== 56) bArr.push(0);
  const bitLen = utf8.length * 8;
  bArr.push(bitLen&0xFF,(bitLen>>8)&0xFF,(bitLen>>16)&0xFF,(bitLen>>24)&0xFF,0,0,0,0);
  const m = [];
  for (let i = 0; i < bArr.length; i += 4) m.push(bArr[i]|(bArr[i+1]<<8)|(bArr[i+2]<<16)|(bArr[i+3]<<24));
  let [a,b2,c,d]=[0x67452301,0xEFCDAB89,0x98BADCFE,0x10325476];
  for (let i = 0; i < m.length; i += 16) {
    const [oa,ob,oc,od]=[a,b2,c,d];
    a=md5ff(a,b2,c,d,m[i+0],7,-680876936); d=md5ff(d,a,b2,c,m[i+1],12,-389564586); c=md5ff(c,d,a,b2,m[i+2],17,606105819); b2=md5ff(b2,c,d,a,m[i+3],22,-1044525330);
    a=md5ff(a,b2,c,d,m[i+4],7,-176418897); d=md5ff(d,a,b2,c,m[i+5],12,1200080426); c=md5ff(c,d,a,b2,m[i+6],17,-1473231341); b2=md5ff(b2,c,d,a,m[i+7],22,-45705983);
    a=md5ff(a,b2,c,d,m[i+8],7,1770035416); d=md5ff(d,a,b2,c,m[i+9],12,-1958414417); c=md5ff(c,d,a,b2,m[i+10],17,-42063); b2=md5ff(b2,c,d,a,m[i+11],22,-1990404162);
    a=md5ff(a,b2,c,d,m[i+12],7,1804603682); d=md5ff(d,a,b2,c,m[i+13],12,-40341101); c=md5ff(c,d,a,b2,m[i+14],17,-1502002290); b2=md5ff(b2,c,d,a,m[i+15],22,1236535329);
    a=md5gg(a,b2,c,d,m[i+1],5,-165796510); d=md5gg(d,a,b2,c,m[i+6],9,-1069501632); c=md5gg(c,d,a,b2,m[i+11],14,643717713); b2=md5gg(b2,c,d,a,m[i+0],20,-373897302);
    a=md5gg(a,b2,c,d,m[i+5],5,-701558691); d=md5gg(d,a,b2,c,m[i+10],9,38016083); c=md5gg(c,d,a,b2,m[i+15],14,-660478335); b2=md5gg(b2,c,d,a,m[i+4],20,-405537848);
    a=md5gg(a,b2,c,d,m[i+9],5,568446438); d=md5gg(d,a,b2,c,m[i+14],9,-1019803690); c=md5gg(c,d,a,b2,m[i+3],14,-187363961); b2=md5gg(b2,c,d,a,m[i+8],20,1163531501);
    a=md5gg(a,b2,c,d,m[i+13],5,-1444681467); d=md5gg(d,a,b2,c,m[i+2],9,-51403784); c=md5gg(c,d,a,b2,m[i+7],14,1735328473); b2=md5gg(b2,c,d,a,m[i+12],20,-1926607734);
    a=md5hh(a,b2,c,d,m[i+5],4,-378558); d=md5hh(d,a,b2,c,m[i+8],11,-2022574463); c=md5hh(c,d,a,b2,m[i+11],16,1839030562); b2=md5hh(b2,c,d,a,m[i+14],23,-35309556);
    a=md5hh(a,b2,c,d,m[i+1],4,-1530992060); d=md5hh(d,a,b2,c,m[i+4],11,1272893353); c=md5hh(c,d,a,b2,m[i+7],16,-155497632); b2=md5hh(b2,c,d,a,m[i+10],23,-1094730640);
    a=md5hh(a,b2,c,d,m[i+13],4,681279174); d=md5hh(d,a,b2,c,m[i+0],11,-358537222); c=md5hh(c,d,a,b2,m[i+3],16,-722521979); b2=md5hh(b2,c,d,a,m[i+6],23,76029189);
    a=md5hh(a,b2,c,d,m[i+9],4,-640364487); d=md5hh(d,a,b2,c,m[i+12],11,-421815835); c=md5hh(c,d,a,b2,m[i+15],16,530742520); b2=md5hh(b2,c,d,a,m[i+2],23,-995338651);
    a=md5ii(a,b2,c,d,m[i+0],6,-198630844); d=md5ii(d,a,b2,c,m[i+7],10,1126891415); c=md5ii(c,d,a,b2,m[i+14],15,-1416354905); b2=md5ii(b2,c,d,a,m[i+5],21,-57434055);
    a=md5ii(a,b2,c,d,m[i+12],6,1700485571); d=md5ii(d,a,b2,c,m[i+3],10,-1894986606); c=md5ii(c,d,a,b2,m[i+10],15,-1051523); b2=md5ii(b2,c,d,a,m[i+1],21,-2054922799);
    a=md5ii(a,b2,c,d,m[i+8],6,1873313359); d=md5ii(d,a,b2,c,m[i+15],10,-30611744); c=md5ii(c,d,a,b2,m[i+6],15,-1560198380); b2=md5ii(b2,c,d,a,m[i+13],21,1309151649);
    a=md5ii(a,b2,c,d,m[i+4],6,-145523070); d=md5ii(d,a,b2,c,m[i+11],10,-1120210379); c=md5ii(c,d,a,b2,m[i+2],15,718787259); b2=md5ii(b2,c,d,a,m[i+9],21,-343485551);
    [a,b2,c,d]=[safeAdd(a,oa),safeAdd(b2,ob),safeAdd(c,oc),safeAdd(d,od)];
  }
  return [a,b2,c,d].map(n=>[(n&0xFF),(n>>8&0xFF),(n>>16&0xFF),(n>>24&0xFF)].map(b=>b.toString(16).padStart(2,'0')).join('')).join('');
}

function HashTool() {
  const [text,   setText]   = useState("");
  const [hashes, setHashes] = useState({ sha256:"—", sha1:"—", sha512:"—", md5:"—" });
  const hashesRef = useRef({ sha256:"—", sha1:"—", sha512:"—", md5:"—" });

  useEffect(() => {
    if (!text) {
      const empty = { sha256:"—", sha1:"—", sha512:"—", md5:"—" };
      setHashes(empty); hashesRef.current = empty; return;
    }
    Promise.all([shaHash("SHA-256",text), shaHash("SHA-1",text), shaHash("SHA-512",text)])
      .then(([s256,s1,s512]) => {
        const result = { sha256:s256, sha1:s1, sha512:s512, md5:md5(text) };
        setHashes(result); hashesRef.current = result;
      });
  }, [text]);

  const rows = [
    { label:"SHA-256", key:"sha256" },
    { label:"SHA-1",   key:"sha1"   },
    { label:"SHA-512", key:"sha512" },
    { label:"MD5*",    key:"md5"    },
  ];

  return (
    <div>
      <div className="tk-tool-header"><h2 className="tk-tool-title">Hash Generator</h2></div>
      <div className="tk-pane" style={{ marginBottom:"1rem" }}>
        <div className="tk-pane-label">INPUT</div>
        <textarea className="tk-textarea" style={{ height:"100px" }} value={text} onChange={e => setText(e.target.value)} placeholder="Enter text to hash..." />
      </div>
      <div className="tk-hash-results">
        {rows.map(row => (
          <div key={row.key} className="tk-hash-row">
            <span className="tk-hash-algo">{row.label}</span>
            <code>{hashes[row.key]}</code>
            <CopySmall getText={() => hashesRef.current[row.key]} />
          </div>
        ))}
      </div>
      <div className="tk-status-bar" style={{ marginTop:"0.8rem" }}>
        *MD5 via pure-JS. Use SHA for security.
      </div>
    </div>
  );
}

// ─── 5. Color Converter ───────────────────────────────────────────────────────
function hexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}
function rgbToHsl(r,g,b) {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if (max===min) { h=s=0; } else {
    const d=max-min;
    s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){ case r:h=((g-b)/d+(g<b?6:0))/6;break; case g:h=((b-r)/d+2)/6;break; case b:h=((r-g)/d+4)/6;break; }
  }
  return [Math.round(h*360), Math.round(s*100), Math.round(l*100)];
}
function hslToHex(h,s,l) {
  s/=100; l/=100; const a=s*Math.min(l,1-l);
  const f=n=>{const k=(n+h/30)%12; const c=l-a*Math.max(Math.min(k-3,9-k,1),-1); return Math.round(255*c).toString(16).padStart(2,"0");};
  return `#${f(0)}${f(8)}${f(4)}`;
}
const TW_COLORS = {'#ef4444':'red-500','#f97316':'orange-500','#eab308':'yellow-500','#22c55e':'green-500','#3b82f6':'blue-500','#8b5cf6':'violet-500','#ec4899':'pink-500','#ffffff':'white','#000000':'black','#6b7280':'gray-500','#14b8a6':'teal-500','#06b6d4':'cyan-500'};
function nearestTailwind(r,g,b) {
  let best="custom", bestDist=Infinity;
  Object.entries(TW_COLORS).forEach(([hex,name])=>{
    const tr=parseInt(hex.slice(1,3),16),tg=parseInt(hex.slice(3,5),16),tb=parseInt(hex.slice(5,7),16);
    const dist=Math.sqrt((r-tr)**2+(g-tg)**2+(b-tb)**2);
    if(dist<bestDist){bestDist=dist;best=name;}
  });
  return bestDist<80?best:"custom";
}

function ColorTool() {
  const [hex,      setHex]      = useState("#00ff88");
  const [hexInput, setHexInput] = useState("#00ff88");
  const nativeRef = useRef();
  const hexRef    = useRef("#00ff88");

  const validHex = /^#[0-9a-f]{6}$/i.test(hex);
  const [r,g,b]  = validHex ? hexToRgb(hex) : [0,255,136];
  const [h,s,l]  = rgbToHsl(r,g,b);

  const applyHex = (val) => {
    if (/^#[0-9a-f]{6}$/i.test(val)) { setHex(val.toLowerCase()); hexRef.current = val.toLowerCase(); }
    setHexInput(val.toUpperCase());
  };

  const palette = [];
  for (let li=10; li<=90; li+=8) palette.push(hslToHex(h,s,li));
  palette.push(hslToHex((h+180)%360,s,50));

  const colorValues = [
    { label:"HEX",              val:hexInput,              editable:true, onChange:e=>applyHex(e.target.value) },
    { label:"RGB",              val:`rgb(${r}, ${g}, ${b})` },
    { label:"HSL",              val:`hsl(${h}, ${s}%, ${l}%)` },
    { label:"CSS var",          val:`--color: ${hex.toUpperCase()};` },
    { label:"Tailwind (approx)", val:nearestTailwind(r,g,b) },
  ];

  return (
    <div>
      <div className="tk-tool-header"><h2 className="tk-tool-title">Color Converter</h2></div>
      <div className="tk-color-layout">
        <div className="tk-color-preview-wrap">
          <div className="tk-color-preview" style={{background:hex, boxShadow:`0 0 40px ${hex}55`}} onClick={()=>nativeRef.current?.click()}/>
          <input ref={nativeRef} type="color" value={hex} onChange={e=>applyHex(e.target.value)} style={{opacity:0,position:"absolute",width:0,height:0}}/>
          <div className="tk-color-label" onClick={()=>nativeRef.current?.click()}>{hex.toUpperCase()}</div>
        </div>
        <div className="tk-color-fields">
          {colorValues.map(({label,val,editable,onChange})=>(
            <div key={label} className="tk-color-field" style={{position:"relative"}}>
              <label>{label}</label>
              <div style={{display:"flex", gap:4, alignItems:"center"}}>
                <input type="text" value={val} readOnly={!editable} onChange={onChange} className="tk-color-input" style={{flex:1}}/>
                <CopySmall getText={() => val} />
              </div>
            </div>
          ))}
        </div>
        <div className="tk-color-palette">
          {palette.map((ph,i)=>(
            <div key={i} className="tk-swatch" style={{background:ph}} title={ph} onClick={()=>applyHex(ph)}/>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 6. Diff Checker ──────────────────────────────────────────────────────────
function diffLines(a, b) {
  const aL=a.split("\n"), bL=b.split("\n"), res=[];
  const max=Math.max(aL.length,bL.length);
  for (let i=0;i<max;i++) {
    const la=aL[i], lb=bL[i];
    if (la===lb) res.push({type:"same",text:la??""});
    else { if(la!==undefined)res.push({type:"del",text:la}); if(lb!==undefined)res.push({type:"add",text:lb}); }
  }
  return res;
}

function DiffTool() {
  const [a,    setA]    = useState("");
  const [b,    setB]    = useState("");
  const [diff, setDiff] = useState([]);
  const [run,  setRun]  = useState(false);
  const diffRef = useRef([]);

  const compare = () => {
    const d = diffLines(a, b);
    setDiff(d); diffRef.current = d; setRun(true);
  };
  const clear = () => { setA(""); setB(""); setDiff([]); diffRef.current = []; setRun(false); };

  return (
    <div>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Text Diff Checker</h2>
        <div className="tk-tool-actions">
          <ActionBtn onClick={compare}>Compare</ActionBtn>
          <CopyBtn getText={() => diffRef.current.map(d => (d.type==="add"?"+ ":d.type==="del"?"- ":"  ") + d.text).join("\n")} />
          <ActionBtn danger onClick={clear}>Clear</ActionBtn>
        </div>
      </div>
      <SplitPane
        left={<><div className="tk-pane-label">ORIGINAL</div><textarea className="tk-textarea" value={a} onChange={e=>setA(e.target.value)} placeholder="Original text..."/></>}
        right={<><div className="tk-pane-label">MODIFIED</div><textarea className="tk-textarea" value={b} onChange={e=>setB(e.target.value)} placeholder="Modified text..."/></>}
      />
      {run && (
        <div className="tk-diff-result">
          {diff.length === 0
            ? <span className="tk-diff-same">  No differences.</span>
            : diff.map((d,i) => {
                const prefix = d.type==="add"?"+ ":d.type==="del"?"- ":"  ";
                return <span key={i} className={`tk-diff-${d.type}`}>{prefix}{d.text}</span>;
              })
          }
        </div>
      )}
    </div>
  );
}

// ─── 7. Word Counter ──────────────────────────────────────────────────────────
const STOPWORDS = new Set(["the","and","for","that","this","with","are","was","have","has","not","but","from","they","been","were"]);

function WordTool() {
  const [text, setText] = useState("");

  const words      = text.trim() ? text.trim().split(/\s+/) : [];
  const sentences  = text.trim() ? text.split(/[.!?]+/).filter(s=>s.trim()) : [];
  const paragraphs = text.trim() ? text.split(/\n\s*\n/).filter(p=>p.trim()) : [];
  const unique     = new Set(words.map(w=>w.toLowerCase().replace(/[^a-z0-9]/g,""))).size;
  const readSecs   = Math.max(1, Math.round((words.length/200)*60));
  const readTime   = words.length===0 ? "0s" : readSecs<60 ? readSecs+"s" : Math.round(readSecs/60)+"m "+(readSecs%60)+"s";

  const freq = {};
  words.forEach(w => {
    const c = w.toLowerCase().replace(/[^a-z0-9]/g,"");
    if (c.length>2 && !STOPWORDS.has(c)) freq[c]=(freq[c]||0)+1;
  });
  const topWords = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,12);

  const stats = [
    { val:words.length.toLocaleString(),              lbl:"Words" },
    { val:text.length.toLocaleString(),               lbl:"Characters" },
    { val:text.replace(/\s/g,"").length.toLocaleString(), lbl:"Chars (no spaces)" },
    { val:text ? text.split("\n").length : 0,         lbl:"Lines" },
    { val:sentences.length,                           lbl:"Sentences" },
    { val:readTime,                                   lbl:"Read time" },
    { val:paragraphs.length,                          lbl:"Paragraphs" },
    { val:unique,                                     lbl:"Unique Words" },
  ];

  return (
    <div>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Word Counter &amp; Text Stats</h2>
        <div className="tk-tool-actions">
          <CopyBtn getText={() => text} />
          <ActionBtn danger onClick={()=>setText("")}>Clear</ActionBtn>
        </div>
      </div>
      <textarea className="tk-textarea" style={{height:"180px",width:"100%",marginBottom:"1.5rem"}}
        value={text} onChange={e=>setText(e.target.value)} placeholder="Paste your text here..."/>
      <div className="tk-stats-grid">
        {stats.map(({val,lbl})=>(
          <div key={lbl} className="tk-stat-card">
            <div className="tk-stat-val">{val}</div>
            <div className="tk-stat-lbl">{lbl}</div>
          </div>
        ))}
      </div>
      {topWords.length>0 && (
        <div className="tk-top-words">
          {topWords.map(([w,c])=><div key={w} className="tk-word-chip">{w}<span>{c}</span></div>)}
        </div>
      )}
    </div>
  );
}

// ─── 8. Unit Converter ────────────────────────────────────────────────────────
const UNIT_CATS = {
  length:{ units:["m","km","cm","mm","mi","yd","ft","in","nm","μm"], toBase:{m:1,km:1000,cm:0.01,mm:0.001,mi:1609.34,yd:0.9144,ft:0.3048,in:0.0254,nm:1e-9,"μm":1e-6} },
  weight:{ units:["kg","g","mg","lb","oz","t","st"], toBase:{kg:1,g:0.001,mg:1e-6,lb:0.453592,oz:0.0283495,t:1000,st:6.35029} },
  temp:  { units:["°C","°F","K"], special:true },
  speed: { units:["m/s","km/h","mph","knot","ft/s"], toBase:{"m/s":1,"km/h":0.277778,mph:0.44704,knot:0.514444,"ft/s":0.3048} },
  data:  { units:["B","KB","MB","GB","TB","PB","Kib","Mib","Gib","Tib"], toBase:{B:1,KB:1e3,MB:1e6,GB:1e9,TB:1e12,PB:1e15,Kib:1024,Mib:1048576,Gib:1073741824,Tib:1099511627776} },
};

function convertUnit(val, from, to, cat) {
  if (isNaN(val)) return "";
  if (cat.special) {
    let c;
    if (from==="°C") c=val; else if (from==="°F") c=(val-32)*5/9; else c=val-273.15;
    let r;
    if (to==="°C") r=c; else if (to==="°F") r=c*9/5+32; else r=c+273.15;
    return +r.toFixed(6);
  }
  return +(val*cat.toBase[from]/cat.toBase[to]).toFixed(8);
}

function UnitTool() {
  const [catKey,   setCatKey]   = useState("length");
  const [val,      setVal]      = useState("1");
  const [fromUnit, setFromUnit] = useState("m");
  const [toUnit,   setToUnit]   = useState("km");

  const cat    = UNIT_CATS[catKey];
  const result = convertUnit(parseFloat(val), fromUnit, toUnit, cat);
  const resultRef = useRef("");
  resultRef.current = String(result);

  useEffect(() => { setFromUnit(cat.units[0]); setToUnit(cat.units[1]); }, [catKey]);

  return (
    <div>
      <div className="tk-tool-header"><h2 className="tk-tool-title">Unit Converter</h2></div>
      <div className="tk-unit-tabs">
        {Object.keys(UNIT_CATS).map(k=>(
          <button key={k} className={`tk-unit-tab${catKey===k?" tk-active":""}`} onClick={()=>setCatKey(k)}>
            {k.charAt(0).toUpperCase()+k.slice(1)}
          </button>
        ))}
      </div>
      <div className="tk-unit-converter">
        <div className="tk-unit-row">
          <input type="number" className="tk-unit-num" value={val} onChange={e=>setVal(e.target.value)}/>
          <select className="tk-unit-select" value={fromUnit} onChange={e=>setFromUnit(e.target.value)}>
            {cat.units.map(u=><option key={u}>{u}</option>)}
          </select>
        </div>
        <div className="tk-unit-equals">=</div>
        <div className="tk-unit-row">
          <input type="number" className="tk-unit-num" value={result} readOnly/>
          <select className="tk-unit-select" value={toUnit} onChange={e=>setToUnit(e.target.value)}>
            {cat.units.map(u=><option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div style={{display:"flex", gap:8, marginTop:"1rem"}}>
        <button className="tk-action-btn" onClick={()=>{setFromUnit(toUnit);setToUnit(fromUnit);}}>⇄ Swap</button>
        <CopyBtn getText={() => `${val} ${fromUnit} = ${resultRef.current} ${toUnit}`} />
      </div>
    </div>
  );
}

// ─── Tool registry ────────────────────────────────────────────────────────────
const TOOLS = [
  { id:"json",   label:"JSON",       component:JsonTool   },
  { id:"regex",  label:"REGEX",      component:RegexTool  },
  { id:"base64", label:"BASE64",     component:Base64Tool },
  { id:"hash",   label:"HASH",       component:HashTool   },
  { id:"color",  label:"COLOR",      component:ColorTool  },
  { id:"diff",   label:"DIFF",       component:DiffTool   },
  { id:"word",   label:"WORD COUNT", component:WordTool   },
  { id:"unit",   label:"UNITS",      component:UnitTool   },
];

// ── Whiteboard nav icon ───────────────────────────────────────────────────────
const WhiteboardIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <path d="M8 21h8M12 17v4"/>
    <path d="M6 8l3 4 3-3 3 3 3-4"/>
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ── Main Toolz Component ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
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

  const ToolNav = () => (
    <nav className="tk-tool-nav" style={{ top:0, position:"sticky" }}>
      {TOOLS.map(t => (
        <button
          key={t.id}
          className={`tk-nav-btn${active===t.id?" tk-active":""}`}
          onClick={() => setActive(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );

  // ── Embedded mode ─────────────────────────────────────────────────────────
  if (embedded) {
    return (
      <div className="tk-root" style={{ minHeight:"unset", height:"100%" }}>
        <ToolNav />
        <main className="tk-main">
          <div className="tk-tool-section">
            {ActiveTool && <ActiveTool />}
          </div>
        </main>
        <div style={{
          padding:"0.8rem 2rem 1rem",
          fontSize:"0.6rem", letterSpacing:"0.07em", color:"#3a3a3a",
          fontFamily:"'Space Mono',monospace",
          borderTop:"1px solid #1e1e1e",
        }}>
          all processing is local — no data leaves your browser
        </div>
      </div>
    );
  }

  // ── Standalone mode ───────────────────────────────────────────────────────
  return (
    <div className="tk-root">
      <div className="tk-scanline" />
      <div className="tk-noise" />

      <header className="tk-header">
        <div className="tk-logo">TOOL<span>KIT</span></div>

        <button
          onClick={() => navigate("/white-board")}
          title="Go to Whiteboard"
          style={{
            marginLeft:"auto",
            display:"flex", alignItems:"center", gap:8,
            background:"rgba(255,255,255,0.05)",
            border:"1px solid rgba(255,255,255,0.12)",
            color:"#aaa", cursor:"pointer",
            padding:"7px 14px", borderRadius:100,
            fontFamily:"'Space Mono',monospace",
            fontSize:"0.65rem", letterSpacing:"0.1em",
            transition:"all 0.18s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background="rgba(0,255,136,0.1)";
            e.currentTarget.style.borderColor="rgba(0,255,136,0.4)";
            e.currentTarget.style.color="#00ff88";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background="rgba(255,255,255,0.05)";
            e.currentTarget.style.borderColor="rgba(255,255,255,0.12)";
            e.currentTarget.style.color="#aaa";
          }}
        >
          <WhiteboardIcon />
          WHITEBOARD
        </button>

        <div className="tk-clock">{clock}</div>
      </header>

      <ToolNav />

      <main className="tk-main">
        <div className="tk-tool-section">
          {ActiveTool && <ActiveTool />}
        </div>
      </main>
    </div>
  );
};

export default Toolz;