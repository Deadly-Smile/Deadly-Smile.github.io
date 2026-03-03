import { useState, useEffect, useRef } from "react";
import { CopyBtn } from "./tk-shared";

const CATS={
  length:{units:["m","km","cm","mm","mi","yd","ft","in","nm","μm"],toBase:{m:1,km:1000,cm:0.01,mm:0.001,mi:1609.34,yd:0.9144,ft:0.3048,in:0.0254,nm:1e-9,"μm":1e-6}},
  weight:{units:["kg","g","mg","lb","oz","t","st"],toBase:{kg:1,g:0.001,mg:1e-6,lb:0.453592,oz:0.0283495,t:1000,st:6.35029}},
  temp:{units:["°C","°F","K"],special:true},
  speed:{units:["m/s","km/h","mph","knot","ft/s"],toBase:{"m/s":1,"km/h":0.277778,mph:0.44704,knot:0.514444,"ft/s":0.3048}},
  data:{units:["B","KB","MB","GB","TB","PB","Kib","Mib","Gib","Tib"],toBase:{B:1,KB:1e3,MB:1e6,GB:1e9,TB:1e12,PB:1e15,Kib:1024,Mib:1048576,Gib:1073741824,Tib:1099511627776}},
};
function convert(val,from,to,cat){
  if(isNaN(val))return"";
  if(cat.special){let c;if(from==="°C")c=val;else if(from==="°F")c=(val-32)*5/9;else c=val-273.15;let r;if(to==="°C")r=c;else if(to==="°F")r=c*9/5+32;else r=c+273.15;return+r.toFixed(6);}
  return+(val*cat.toBase[from]/cat.toBase[to]).toFixed(8);
}

export default function UnitTool() {
  const [catKey,setCatKey]=useState("length");
  const [val,setVal]=useState("1");
  const [from,setFrom]=useState("m");
  const [to,setTo]=useState("km");
  const cat=CATS[catKey];
  const result=convert(parseFloat(val),from,to,cat);
  const resRef=useRef("");resRef.current=String(result);
  useEffect(()=>{setFrom(cat.units[0]);setTo(cat.units[1]);},[catKey]);
  return(
    <div>
      <div className="tk-tool-header"><h2 className="tk-tool-title">Unit Converter</h2></div>
      <div className="tk-unit-tabs">
        {Object.keys(CATS).map(k=>(
          <button key={k} className={`tk-unit-tab${catKey===k?" tk-active":""}`} onClick={()=>setCatKey(k)}>
            {k.charAt(0).toUpperCase()+k.slice(1)}
          </button>
        ))}
      </div>
      <div className="tk-unit-converter">
        <div className="tk-unit-row">
          <input type="number" className="tk-unit-num" value={val} onChange={e=>setVal(e.target.value)}/>
          <select className="tk-unit-select" value={from} onChange={e=>setFrom(e.target.value)}>{cat.units.map(u=><option key={u}>{u}</option>)}</select>
        </div>
        <div className="tk-unit-equals">=</div>
        <div className="tk-unit-row">
          <input type="number" className="tk-unit-num" value={result} readOnly/>
          <select className="tk-unit-select" value={to} onChange={e=>setTo(e.target.value)}>{cat.units.map(u=><option key={u}>{u}</option>)}</select>
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:"1rem"}}>
        <button className="tk-action-btn" onClick={()=>{setFrom(to);setTo(from);}}>⇄ Swap</button>
        <CopyBtn getText={()=>`${val} ${from} = ${resRef.current} ${to}`}/>
      </div>
    </div>
  );
}
