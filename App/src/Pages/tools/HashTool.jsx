import { useState, useEffect, useRef } from "react";
import { CopySmall } from "./tk-shared";

async function shaHash(algo, text) {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

function md5(str) {
  const safeAdd=(x,y)=>{const l=(x&0xFFFF)+(y&0xFFFF);return(((x>>16)+(y>>16)+(l>>16))<<16)|(l&0xFFFF);};
  const rol=(n,c)=>(n<<c)|(n>>>(32-c));
  const cmn=(q,a,b,x,s,t)=>safeAdd(rol(safeAdd(safeAdd(a,q),safeAdd(x,t)),s),b);
  const ff=(a,b,c,d,x,s,t)=>cmn((b&c)|(~b&d),a,b,x,s,t);
  const gg=(a,b,c,d,x,s,t)=>cmn((b&d)|(c&~d),a,b,x,s,t);
  const hh=(a,b,c,d,x,s,t)=>cmn(b^c^d,a,b,x,s,t);
  const ii=(a,b,c,d,x,s,t)=>cmn(c^(b|~d),a,b,x,s,t);
  const utf8=unescape(encodeURIComponent(str));
  const ba=[];
  for(let i=0;i<utf8.length;i++)ba.push(utf8.charCodeAt(i));
  ba.push(0x80);
  while(ba.length%64!==56)ba.push(0);
  const bl=utf8.length*8;
  ba.push(bl&0xFF,(bl>>8)&0xFF,(bl>>16)&0xFF,(bl>>24)&0xFF,0,0,0,0);
  const m=[];
  for(let i=0;i<ba.length;i+=4)m.push(ba[i]|(ba[i+1]<<8)|(ba[i+2]<<16)|(ba[i+3]<<24));
  let [a,b,c,d]=[0x67452301,0xEFCDAB89,0x98BADCFE,0x10325476];
  for(let i=0;i<m.length;i+=16){
    const[oa,ob,oc,od]=[a,b,c,d];
    a=ff(a,b,c,d,m[i],7,-680876936);d=ff(d,a,b,c,m[i+1],12,-389564586);c=ff(c,d,a,b,m[i+2],17,606105819);b=ff(b,c,d,a,m[i+3],22,-1044525330);
    a=ff(a,b,c,d,m[i+4],7,-176418897);d=ff(d,a,b,c,m[i+5],12,1200080426);c=ff(c,d,a,b,m[i+6],17,-1473231341);b=ff(b,c,d,a,m[i+7],22,-45705983);
    a=ff(a,b,c,d,m[i+8],7,1770035416);d=ff(d,a,b,c,m[i+9],12,-1958414417);c=ff(c,d,a,b,m[i+10],17,-42063);b=ff(b,c,d,a,m[i+11],22,-1990404162);
    a=ff(a,b,c,d,m[i+12],7,1804603682);d=ff(d,a,b,c,m[i+13],12,-40341101);c=ff(c,d,a,b,m[i+14],17,-1502002290);b=ff(b,c,d,a,m[i+15],22,1236535329);
    a=gg(a,b,c,d,m[i+1],5,-165796510);d=gg(d,a,b,c,m[i+6],9,-1069501632);c=gg(c,d,a,b,m[i+11],14,643717713);b=gg(b,c,d,a,m[i],20,-373897302);
    a=gg(a,b,c,d,m[i+5],5,-701558691);d=gg(d,a,b,c,m[i+10],9,38016083);c=gg(c,d,a,b,m[i+15],14,-660478335);b=gg(b,c,d,a,m[i+4],20,-405537848);
    a=gg(a,b,c,d,m[i+9],5,568446438);d=gg(d,a,b,c,m[i+14],9,-1019803690);c=gg(c,d,a,b,m[i+3],14,-187363961);b=gg(b,c,d,a,m[i+8],20,1163531501);
    a=gg(a,b,c,d,m[i+13],5,-1444681467);d=gg(d,a,b,c,m[i+2],9,-51403784);c=gg(c,d,a,b,m[i+7],14,1735328473);b=gg(b,c,d,a,m[i+12],20,-1926607734);
    a=hh(a,b,c,d,m[i+5],4,-378558);d=hh(d,a,b,c,m[i+8],11,-2022574463);c=hh(c,d,a,b,m[i+11],16,1839030562);b=hh(b,c,d,a,m[i+14],23,-35309556);
    a=hh(a,b,c,d,m[i+1],4,-1530992060);d=hh(d,a,b,c,m[i+4],11,1272893353);c=hh(c,d,a,b,m[i+7],16,-155497632);b=hh(b,c,d,a,m[i+10],23,-1094730640);
    a=hh(a,b,c,d,m[i+13],4,681279174);d=hh(d,a,b,c,m[i],11,-358537222);c=hh(c,d,a,b,m[i+3],16,-722521979);b=hh(b,c,d,a,m[i+6],23,76029189);
    a=hh(a,b,c,d,m[i+9],4,-640364487);d=hh(d,a,b,c,m[i+12],11,-421815835);c=hh(c,d,a,b,m[i+15],16,530742520);b=hh(b,c,d,a,m[i+2],23,-995338651);
    a=ii(a,b,c,d,m[i],6,-198630844);d=ii(d,a,b,c,m[i+7],10,1126891415);c=ii(c,d,a,b,m[i+14],15,-1416354905);b=ii(b,c,d,a,m[i+5],21,-57434055);
    a=ii(a,b,c,d,m[i+12],6,1700485571);d=ii(d,a,b,c,m[i+3],10,-1894986606);c=ii(c,d,a,b,m[i+10],15,-1051523);b=ii(b,c,d,a,m[i+1],21,-2054922799);
    a=ii(a,b,c,d,m[i+8],6,1873313359);d=ii(d,a,b,c,m[i+15],10,-30611744);c=ii(c,d,a,b,m[i+6],15,-1560198380);b=ii(b,c,d,a,m[i+13],21,1309151649);
    a=ii(a,b,c,d,m[i+4],6,-145523070);d=ii(d,a,b,c,m[i+11],10,-1120210379);c=ii(c,d,a,b,m[i+2],15,718787259);b=ii(b,c,d,a,m[i+9],21,-343485551);
    [a,b,c,d]=[safeAdd(a,oa),safeAdd(b,ob),safeAdd(c,oc),safeAdd(d,od)];
  }
  return [a,b,c,d].map(n=>[(n&0xFF),(n>>8&0xFF),(n>>16&0xFF),(n>>24&0xFF)].map(x=>x.toString(16).padStart(2,"0")).join("")).join("");
}

export default function HashTool() {
  const [text,   setText]   = useState("");
  const [hashes, setHashes] = useState({ sha256:"—", sha1:"—", sha512:"—", md5:"—" });
  const [isMaximized, setIsMaximized] = useState(false);
  const ref = useRef({ sha256:"—", sha1:"—", sha512:"—", md5:"—" });

  useEffect(() => {
    if (!text) { const e={sha256:"—",sha1:"—",sha512:"—",md5:"—"}; setHashes(e); ref.current=e; return; }
    Promise.all([shaHash("SHA-256",text),shaHash("SHA-1",text),shaHash("SHA-512",text)])
      .then(([s256,s1,s512]) => {
        const r={sha256:s256,sha1:s1,sha512:s512,md5:md5(text)};
        setHashes(r); ref.current=r;
      });
  }, [text]);

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

  return (
    <div className={`tk-editor-container ${isMaximized ? "tk-editor-maximized" : ""}`}>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Hash Generator</h2>
        <button
          onClick={() => setIsMaximized(!isMaximized)}
          className="tk-editor-max-btn"
          title={isMaximized ? "Exit fullscreen" : "Fullscreen editor"}
        >
          {isMaximized ? "✕" : "⊞"}
        </button>
      </div>
      <div className="tk-pane" style={{marginBottom:"1rem"}}>
        <div className="tk-pane-label">INPUT</div>
        <textarea className={`tk-textarea ${isMaximized ? "tk-textarea-maximized" : ""}`} value={text} onChange={e=>setText(e.target.value)} placeholder="Enter text to hash..." />
      </div>
      {!isMaximized && (
        <>
          <div className="tk-hash-results">
            {[{label:"SHA-256",key:"sha256"},{label:"SHA-1",key:"sha1"},{label:"SHA-512",key:"sha512"},{label:"MD5*",key:"md5"}].map(row=>(
              <div key={row.key} className="tk-hash-row">
                <span className="tk-hash-algo">{row.label}</span>
                <code>{hashes[row.key]}</code>
                <CopySmall getText={()=>ref.current[row.key]} />
              </div>
            ))}
          </div>
          <div className="tk-status-bar" style={{marginTop:"0.8rem"}}>*MD5 via pure-JS. Use SHA for security.</div>
        </>
      )}
    </div>
  );
}
