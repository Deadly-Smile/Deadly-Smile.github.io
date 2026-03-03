import { useState } from "react";
import { CopyBtn, ActionBtn } from "./tk-shared";

const STOP=new Set(["the","and","for","that","this","with","are","was","have","has","not","but","from","they","been","were"]);

export default function WordTool() {
  const [text,setText]=useState("");
  const words=text.trim()?text.trim().split(/\s+/):[];
  const sentences=text.trim()?text.split(/[.!?]+/).filter(s=>s.trim()):[];
  const paragraphs=text.trim()?text.split(/\n\s*\n/).filter(p=>p.trim()):[];
  const unique=new Set(words.map(w=>w.toLowerCase().replace(/[^a-z0-9]/g,""))).size;
  const rs=Math.max(1,Math.round((words.length/200)*60));
  const readTime=words.length===0?"0s":rs<60?rs+"s":Math.round(rs/60)+"m "+(rs%60)+"s";
  const freq={};
  words.forEach(w=>{const c=w.toLowerCase().replace(/[^a-z0-9]/g,"");if(c.length>2&&!STOP.has(c))freq[c]=(freq[c]||0)+1;});
  const topWords=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const stats=[
    {val:words.length.toLocaleString(),lbl:"Words"},
    {val:text.length.toLocaleString(),lbl:"Characters"},
    {val:text.replace(/\s/g,"").length.toLocaleString(),lbl:"Chars (no spaces)"},
    {val:text?text.split("\n").length:0,lbl:"Lines"},
    {val:sentences.length,lbl:"Sentences"},
    {val:readTime,lbl:"Read time"},
    {val:paragraphs.length,lbl:"Paragraphs"},
    {val:unique,lbl:"Unique Words"},
  ];
  return(
    <div>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Word Counter &amp; Text Stats</h2>
        <div className="tk-tool-actions">
          <CopyBtn getText={()=>text}/>
          <ActionBtn danger onClick={()=>setText("")}>Clear</ActionBtn>
        </div>
      </div>
      <textarea className="tk-textarea" style={{height:"180px",width:"100%",marginBottom:"1.5rem"}} value={text} onChange={e=>setText(e.target.value)} placeholder="Paste your text here..."/>
      <div className="tk-stats-grid">
        {stats.map(({val,lbl})=>(
          <div key={lbl} className="tk-stat-card">
            <div className="tk-stat-val">{val}</div>
            <div className="tk-stat-lbl">{lbl}</div>
          </div>
        ))}
      </div>
      {topWords.length>0&&<div className="tk-top-words">{topWords.map(([w,c])=><div key={w} className="tk-word-chip">{w}<span>{c}</span></div>)}</div>}
    </div>
  );
}
