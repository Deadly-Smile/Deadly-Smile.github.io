import { useState, useRef } from "react";
import { CopyBtn, ActionBtn, SplitPane, PaneLabel } from "./tk-shared";

function diffLines(a,b){
  const aL=a.split("\n"),bL=b.split("\n"),res=[];
  const max=Math.max(aL.length,bL.length);
  for(let i=0;i<max;i++){
    const la=aL[i],lb=bL[i];
    if(la===lb)res.push({type:"same",text:la??""});
    else{if(la!==undefined)res.push({type:"del",text:la});if(lb!==undefined)res.push({type:"add",text:lb});}
  }
  return res;
}

export default function DiffTool() {
  const [a,setA]=useState("");const[b,setB]=useState("");
  const [diff,setDiff]=useState([]);const[run,setRun]=useState(false);
  const diffRef=useRef([]);
  const compare=()=>{const d=diffLines(a,b);setDiff(d);diffRef.current=d;setRun(true);};
  const clear=()=>{setA("");setB("");setDiff([]);diffRef.current=[];setRun(false);};
  return(
    <div>
      <div className="tk-tool-header">
        <h2 className="tk-tool-title">Text Diff Checker</h2>
        <div className="tk-tool-actions">
          <ActionBtn onClick={compare}>Compare</ActionBtn>
          <CopyBtn getText={()=>diffRef.current.map(d=>(d.type==="add"?"+ ":d.type==="del"?"- ":"  ")+d.text).join("\n")}/>
          <ActionBtn danger onClick={clear}>Clear</ActionBtn>
        </div>
      </div>
      <SplitPane
        left={<><PaneLabel>ORIGINAL</PaneLabel><textarea className="tk-textarea" value={a} onChange={e=>setA(e.target.value)} placeholder="Original text..."/></>}
        right={<><PaneLabel>MODIFIED</PaneLabel><textarea className="tk-textarea" value={b} onChange={e=>setB(e.target.value)} placeholder="Modified text..."/></>}
      />
      {run&&(
        <div className="tk-diff-result">
          {diff.length===0
            ?<span className="tk-diff-same">  No differences.</span>
            :diff.map((d,i)=>{const p=d.type==="add"?"+ ":d.type==="del"?"- ":"  ";return<span key={i} className={`tk-diff-${d.type}`}>{p}{d.text}</span>;})
          }
        </div>
      )}
    </div>
  );
}
