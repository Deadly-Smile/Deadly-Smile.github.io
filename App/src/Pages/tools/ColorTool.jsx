import { useState, useRef } from "react";
import { CopySmall } from "./tk-shared";

function hexToRgb(hex) { return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]; }
function rgbToHsl(r,g,b) {
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if(max===min){h=s=0;}else{
    const d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;case b:h=((r-g)/d+4)/6;break;}
  }
  return[Math.round(h*360),Math.round(s*100),Math.round(l*100)];
}
function hslToHex(h,s,l){
  s/=100;l/=100;const a=s*Math.min(l,1-l);
  const f=n=>{const k=(n+h/30)%12;const c=l-a*Math.max(Math.min(k-3,9-k,1),-1);return Math.round(255*c).toString(16).padStart(2,"0");};
  return`#${f(0)}${f(8)}${f(4)}`;
}
const TW_COLORS={'#ef4444':'red-500','#f97316':'orange-500','#eab308':'yellow-500','#22c55e':'green-500','#3b82f6':'blue-500','#8b5cf6':'violet-500','#ec4899':'pink-500','#ffffff':'white','#000000':'black','#6b7280':'gray-500','#14b8a6':'teal-500','#06b6d4':'cyan-500'};
function nearestTailwind(r,g,b){let best="custom",bd=Infinity;Object.entries(TW_COLORS).forEach(([hex,name])=>{const tr=parseInt(hex.slice(1,3),16),tg=parseInt(hex.slice(3,5),16),tb=parseInt(hex.slice(5,7),16);const d=Math.sqrt((r-tr)**2+(g-tg)**2+(b-tb)**2);if(d<bd){bd=d;best=name;}});return bd<80?best:"custom";}

export default function ColorTool() {
  const [hex,setHex]=useState("#00ff88");
  const [hexInput,setHexInput]=useState("#00ff88");
  const nativeRef=useRef();
  const validHex=/^#[0-9a-f]{6}$/i.test(hex);
  const [r,g,b]=validHex?hexToRgb(hex):[0,255,136];
  const [h,s,l]=rgbToHsl(r,g,b);
  const applyHex=val=>{if(/^#[0-9a-f]{6}$/i.test(val))setHex(val.toLowerCase());setHexInput(val.toUpperCase());};
  const palette=[];
  for(let li=10;li<=90;li+=8)palette.push(hslToHex(h,s,li));
  palette.push(hslToHex((h+180)%360,s,50));
  const fields=[
    {label:"HEX",val:hexInput,editable:true,onChange:e=>applyHex(e.target.value)},
    {label:"RGB",val:`rgb(${r}, ${g}, ${b})`},
    {label:"HSL",val:`hsl(${h}, ${s}%, ${l}%)`},
    {label:"CSS var",val:`--color: ${hex.toUpperCase()};`},
    {label:"Tailwind",val:nearestTailwind(r,g,b)},
  ];
  return(
    <div>
      <div className="tk-tool-header"><h2 className="tk-tool-title">Color Converter</h2></div>
      <div className="tk-color-layout">
        <div className="tk-color-preview-wrap">
          <div className="tk-color-preview" style={{background:hex,boxShadow:`0 0 40px ${hex}55`}} onClick={()=>nativeRef.current?.click()}/>
          <input ref={nativeRef} type="color" value={hex} onChange={e=>applyHex(e.target.value)} style={{opacity:0,position:"absolute",width:0,height:0}}/>
          <div className="tk-color-label" onClick={()=>nativeRef.current?.click()}>{hex.toUpperCase()}</div>
        </div>
        <div className="tk-color-fields">
          {fields.map(({label,val,editable,onChange})=>(
            <div key={label} className="tk-color-field">
              <label>{label}</label>
              <div style={{display:"flex",gap:4,alignItems:"center"}}>
                <input type="text" value={val} readOnly={!editable} onChange={onChange} className="tk-color-input" style={{flex:1}}/>
                <CopySmall getText={()=>val}/>
              </div>
            </div>
          ))}
        </div>
        <div className="tk-color-palette">
          {palette.map((ph,i)=><div key={i} className="tk-swatch" style={{background:ph}} title={ph} onClick={()=>applyHex(ph)}/>)}
        </div>
      </div>
    </div>
  );
}
