import { useEffect, useState, useRef, useCallback } from "react";
import { Stage, Layer, Line, Rect, Arrow, Text } from "react-konva";
import { HexColorPicker } from "react-colorful";
import Toolz from "./Toolz";

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const ICONS = {
  pen:      "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
  eraser:   ["M20.707 5.826a1 1 0 0 0-1.414-1.413L5.489 18.217a1 1 0 0 0 0 1.414l2.62 2.621a1 1 0 0 0 1.414 0l11.184-11.04", "M3 21h10"],
  rect:     "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z",
  circle:   "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
  arrow:    "M5 12h14M12 5l7 7-7 7",
  text:     ["M4 7V4h16v3", "M9 20h6", "M12 4v16"],
  undo:     "M3 7v6h6M3.5 13A9 9 0 1 0 5.64 5.64",
  redo:     "M21 7v6h-6M20.5 13A9 9 0 1 1 18.36 5.64",
  trash:    ["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"],
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  grid:     ["M3 3h7v7H3z","M14 3h7v7h-7z","M3 14h7v7H3z","M14 14h7v7h-7z"],
  sticky:   ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z","M14 2v6h6"],
  palette:  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.55 0 1-.45 1-1 0-.26-.1-.49-.26-.68a.99.99 0 0 1-.24-.66c0-.55.45-1 1-1h1.18c3.03 0 5.5-2.47 5.5-5.5C21.18 6.22 17.04 2 12 2z",
  tools:    "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  close:    "M18 6L6 18M6 6l12 12",
};

const TOOL_LIST = [
  { id:"pen",    icon:"pen",    label:"Pen",       shortcut:"P" },
  { id:"eraser", icon:"eraser", label:"Eraser",    shortcut:"E" },
  { id:"rect",   icon:"rect",   label:"Rectangle", shortcut:"R" },
  { id:"circle", icon:"circle", label:"Ellipse",   shortcut:"C" },
  { id:"arrow",  icon:"arrow",  label:"Arrow",     shortcut:"A" },
  { id:"text",   icon:"text",   label:"Text",      shortcut:"T" },
];

const PRESET_COLORS = [
  "#1a1a2e","#16213e","#0f3460","#533483",
  "#e94560","#f5a623","#f8e71c","#7ed321",
  "#4a90e2","#50e3c2","#ffffff","#b8b8b8",
];
const STROKE_WIDTHS = [2,4,7,12,20];
const STICKY_COLORS = ["#fff9c4","#ffe0b2","#f8bbd0","#c8e6c9","#b3e5fc","#e1bee7"];

// ═══════════════════════════════════════════════════════════════════════════════
// ── Toolkit Drawer ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const ToolkitDrawer = ({ open, onClose }) => {
  const stop = (e) => e.stopPropagation();

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position:"fixed", inset:0, zIndex:490,
        background:"rgba(10,10,18,0.5)",
        backdropFilter:"blur(3px)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition:"opacity 0.3s ease",
      }} />

      {/* Drawer */}
      <div
        onMouseDown={stop}
        onTouchStart={stop}
        style={{
          position:"fixed", top:0, right:0, bottom:0,
          width:"min(860px, 94vw)",
          zIndex:500,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition:"transform 0.38s cubic-bezier(0.22,1,0.36,1)",
          display:"flex", flexDirection:"column",
          boxShadow:"-12px 0 60px rgba(0,0,0,0.4)",
          borderLeft:"1px solid rgba(255,255,255,0.07)",
          borderRadius:"12px 0 0 12px",
          overflow:"hidden",
        }}
      >
        {/* Drawer top bar */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"12px 16px",
          background:"#0a0a0a",
          borderBottom:"1px solid #1e1e1e",
          flexShrink:0,
        }}>
          <div style={{
            display:"flex", alignItems:"center", gap:10,
            fontFamily:"'Space Mono', monospace",
          }}>
            {/* Coloured dot cluster */}
            <span style={{ color:"#00ff88", display:"flex" }}>
              <Icon d={ICONS.tools} size={13} />
            </span>
            <span style={{ fontSize:13, letterSpacing:"0.14em" }}>
              <span style={{ color:"#e8e8e8" }}>TOOL</span>
              <span style={{ color:"#00ff88" }}>KIT</span>
            </span>
            <span style={{
              fontSize:9, color:"#3a3a3a", letterSpacing:"0.1em",
              background:"#1a1a1a", padding:"2px 7px",
              borderRadius:100, border:"1px solid #2a2a2a",
            }}>
              embedded
            </span>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{
              fontSize:10, color:"#444", fontFamily:"monospace", letterSpacing:"0.08em",
            }}>
              Esc to close
            </span>
            <button onClick={onClose} style={{
              background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.09)",
              color:"#666", cursor:"pointer",
              width:30, height:30, borderRadius:8,
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"all 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background="rgba(233,69,96,0.18)"; e.currentTarget.style.color="#ff6b8a"; }}
              onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.color="#666"; }}
            >
              <Icon d={ICONS.close} size={13} />
            </button>
          </div>
        </div>

        {/* Scrollable Toolz content — no outer chrome, embedded mode */}
        <div style={{ flex:1, overflowY:"auto", overflowX:"hidden" }}>
          <Toolz embedded />
        </div>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ── WhiteBoard ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const WhiteBoard = () => {
  const stageRef     = useRef(null);
  const containerRef = useRef(null);

  const [size, setSize]               = useState({ w: window.innerWidth, h: window.innerHeight });
  const [tool, setTool]               = useState("pen");
  const [color, setColor]             = useState("#1a1a2e");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [opacity, setOpacity]         = useState(1);
  const [showPicker, setShowPicker]   = useState(false);
  const [showWidthPicker, setShowWidthPicker] = useState(false);
  const [showGrid, setShowGrid]       = useState(false);
  const [canvasColor, setCanvasColor] = useState("#f8f5f0");
  const [toolkitOpen, setToolkitOpen] = useState(false);

  const [elements, setElements] = useState([]);
  const [history, setHistory]   = useState([[]]);
  const [histIdx, setHistIdx]   = useState(0);
  const isDrawing = useRef(false);

  const [textInput, setTextInput] = useState(null);
  const [textValue, setTextValue] = useState("");
  const textareaRef = useRef(null);

  const [stickies, setStickies]   = useState([]);
  const [showStickyPalette, setShowStickyPalette] = useState(false);

  // ── Resize ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── History ──────────────────────────────────────────────────────────────────
  const pushHistory = useCallback((els) => {
    const nh = history.slice(0, histIdx+1).concat([els]);
    setHistory(nh); setHistIdx(nh.length-1);
  }, [history, histIdx]);

  const undo = useCallback(() => {
    if (histIdx===0) return;
    const i = histIdx-1; setHistIdx(i); setElements(history[i]);
  }, [histIdx, history]);

  const redo = useCallback(() => {
    if (histIdx>=history.length-1) return;
    const i = histIdx+1; setHistIdx(i); setElements(history[i]);
  }, [histIdx, history]);

  // ── Keyboard ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName==="TEXTAREA"||e.target.tagName==="INPUT") return;
      if (e.key==="Escape")                          { setToolkitOpen(false); return; }
      if ((e.ctrlKey||e.metaKey)&&e.key==="k")      { e.preventDefault(); setToolkitOpen(v=>!v); return; }
      if ((e.ctrlKey||e.metaKey)&&e.key==="z")      { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey||e.metaKey)&&e.key==="y")      { e.preventDefault(); redo(); return; }
      if ((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key==="Z") { e.preventDefault(); redo(); return; }
      const t = TOOL_LIST.find(t=>t.shortcut.toLowerCase()===e.key.toLowerCase());
      if (t&&!e.ctrlKey&&!e.metaKey) setTool(t.id);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo]);

  // ── Click-outside dropdowns ───────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (!e.target.closest(".wb-picker-wrap"))  setShowPicker(false);
      if (!e.target.closest(".wb-width-wrap"))   setShowWidthPicker(false);
      if (!e.target.closest(".wb-sticky-wrap"))  setShowStickyPalette(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Drawing ───────────────────────────────────────────────────────────────────
  const getPos = (e) => e.target.getStage().getPointerPosition();

  const mkEl = (pos) => ({
    id:Date.now(), tool, color, strokeWidth, opacity,
    x:pos.x, y:pos.y, x2:pos.x, y2:pos.y,
    points:[pos.x, pos.y],
  });

  const onPointerDown = (e) => {
    if (toolkitOpen) return;
    if (tool==="text") {
      const pos=getPos(e); setTextInput(pos); setTextValue("");
      setTimeout(()=>textareaRef.current?.focus(),0); return;
    }
    isDrawing.current=true;
    setElements(prev=>[...prev, mkEl(getPos(e))]);
  };

  const onPointerMove = (e) => {
    if (!isDrawing.current) return;
    const pos=getPos(e);
    setElements(prev=>{
      const u=[...prev]; const l={...u[u.length-1]};
      if (tool==="pen"||tool==="eraser") l.points=[...l.points,pos.x,pos.y];
      else { l.x2=pos.x; l.y2=pos.y; }
      u[u.length-1]=l; return u;
    });
  };

  const onPointerUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current=false; pushHistory([...elements]);
  };

  const commitText = () => {
    if (!textValue.trim()||!textInput){ setTextInput(null); return; }
    const el={ id:Date.now(), tool:"text", x:textInput.x, y:textInput.y,
      color, opacity, strokeWidth, text:textValue, fontSize:Math.max(14,strokeWidth*6) };
    const n=[...elements,el]; setElements(n); pushHistory(n);
    setTextInput(null); setTextValue("");
  };

  const clearAll = () => { setElements([]); setStickies([]); pushHistory([]); };

  const exportPNG = () => {
    const a=document.createElement("a");
    a.download="whiteboard.png"; a.href=stageRef.current.toDataURL({pixelRatio:2}); a.click();
  };

  const addSticky = (bg) => {
    setStickies(p=>[...p,{ id:Date.now(), x:80+Math.random()*400, y:80+Math.random()*300, text:"", bg }]);
    setShowStickyPalette(false);
  };

  // ── Render elements ──────────────────────────────────────────────────────────
  const renderEl = (el) => {
    const b={ key:el.id, opacity:el.opacity, stroke:el.color, strokeWidth:el.strokeWidth, listening:false };
    if (el.tool==="pen")    return <Line {...b} points={el.points} tension={0.4} lineCap="round" lineJoin="round" globalCompositeOperation="source-over" />;
    if (el.tool==="eraser") return <Line {...b} points={el.points} tension={0.4} lineCap="round" lineJoin="round" stroke={canvasColor} strokeWidth={el.strokeWidth*3} globalCompositeOperation="source-over" />;
    if (el.tool==="rect")   return <Rect {...b} x={Math.min(el.x,el.x2)} y={Math.min(el.y,el.y2)} width={Math.abs(el.x2-el.x)} height={Math.abs(el.y2-el.y)} fill="transparent" cornerRadius={3} />;
    if (el.tool==="circle") { const cx=(el.x+el.x2)/2,cy=(el.y+el.y2)/2,rx=Math.abs(el.x2-el.x)/2,ry=Math.abs(el.y2-el.y)/2; return <Line {...b} points={[cx,cy-ry,cx+rx,cy,cx,cy+ry,cx-rx,cy,cx,cy-ry]} tension={0.7} closed fill="transparent" />; }
    if (el.tool==="arrow")  return <Arrow {...b} points={[el.x,el.y,el.x2,el.y2]} pointerLength={10} pointerWidth={8} fill={el.color} />;
    if (el.tool==="text")   return <Text key={el.id} x={el.x} y={el.y} text={el.text} fill={el.color} fontSize={el.fontSize} opacity={el.opacity} fontFamily="'DM Serif Display',serif" listening={false} />;
    return null;
  };

  // ── Grid ──────────────────────────────────────────────────────────────────────
  const gridLines = [];
  if (showGrid) {
    for (let x=0;x<size.w;x+=32) gridLines.push(<Line key={`gv${x}`} points={[x,0,x,size.h]} stroke="#c9c3bb" strokeWidth={0.5} listening={false} />);
    for (let y=0;y<size.h;y+=32) gridLines.push(<Line key={`gh${y}`} points={[0,y,size.w,y]} stroke="#c9c3bb" strokeWidth={0.5} listening={false} />);
  }

  const cursorMap = { pen:"crosshair", eraser:"cell", text:"text", rect:"crosshair", circle:"crosshair", arrow:"crosshair" };

  return (
    <div ref={containerRef} style={{
      width:"100vw", height:"100vh", overflow:"hidden",
      background:canvasColor, position:"relative",
      cursor: toolkitOpen ? "default" : (cursorMap[tool]||"default"),
    }}>
      {/* Canvas */}
      <Stage ref={stageRef} width={size.w} height={size.h}
        onMouseDown={onPointerDown} onMousemove={onPointerMove} onMouseup={onPointerUp}
        onTouchStart={onPointerDown} onTouchmove={onPointerMove} onTouchend={onPointerUp}>
        <Layer>
          {gridLines}
          {elements.map(renderEl)}
        </Layer>
      </Stage>

      {/* Stickies */}
      {stickies.map(s=>(
        <StickyNote key={s.id} sticky={s}
          onUpdate={(id,p)=>setStickies(prev=>prev.map(x=>x.id===id?{...x,...p}:x))}
          onRemove={(id)=>setStickies(prev=>prev.filter(x=>x.id!==id))} />
      ))}

      {/* Text overlay */}
      {textInput && (
        <textarea ref={textareaRef} value={textValue}
          onChange={e=>setTextValue(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();commitText();} if(e.key==="Escape")setTextInput(null); }}
          onBlur={commitText}
          style={{
            position:"fixed", left:textInput.x, top:textInput.y,
            background:"transparent", border:"2px dashed "+color,
            color, outline:"none", resize:"none",
            fontSize:Math.max(14,strokeWidth*6),
            fontFamily:"'DM Serif Display',serif",
            minWidth:120, minHeight:40, padding:"4px 8px",
            borderRadius:4, zIndex:200,
          }}
          placeholder="Type here…"
        />
      )}

      {/* ══════════════════════════════════════════════════
          TOP TOOLBAR
      ══════════════════════════════════════════════════ */}
      <div style={{
        position:"fixed", top:16, left:"50%", transform:"translateX(-50%)",
        display:"flex", alignItems:"center", gap:4,
        background:"rgba(255,255,255,0.88)", backdropFilter:"blur(20px)",
        borderRadius:16, padding:"6px 10px",
        boxShadow:"0 4px 32px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.9) inset",
        border:"1px solid rgba(200,195,187,0.5)",
        zIndex:100,
      }}>
        {TOOL_LIST.map(t=>(
          <WbBtn key={t.id} active={tool===t.id} title={`${t.label} (${t.shortcut})`} onClick={()=>setTool(t.id)}>
            <Icon d={ICONS[t.icon]} size={17} />
          </WbBtn>
        ))}

        <Divider />

        {/* Color */}
        <div className="wb-picker-wrap" style={{position:"relative"}}>
          <button onClick={()=>setShowPicker(v=>!v)} title="Color" style={{
            width:32,height:32,borderRadius:10,background:color,
            border:"3px solid white",boxShadow:"0 0 0 1.5px rgba(0,0,0,0.15)",
            cursor:"pointer",transition:"transform 0.15s",
          }}
            onMouseEnter={e=>e.currentTarget.style.transform="scale(1.1)"}
            onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
          />
          {showPicker&&(
            <div style={{
              position:"absolute",top:44,left:"50%",transform:"translateX(-50%)",
              background:"rgba(255,255,255,0.97)",backdropFilter:"blur(20px)",
              borderRadius:16,padding:16,zIndex:300,
              boxShadow:"0 16px 48px rgba(0,0,0,0.18)",
              border:"1px solid rgba(200,195,187,0.5)",
            }}>
              <HexColorPicker color={color} onChange={setColor} style={{width:200}} />
              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6,marginTop:12}}>
                {PRESET_COLORS.map(c=>(
                  <button key={c} onClick={()=>setColor(c)} style={{
                    width:26,height:26,borderRadius:7,background:c,border:"none",cursor:"pointer",
                    outline:color===c?"2px solid #4a90e2":"none",outlineOffset:2,
                  }}/>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stroke */}
        <div className="wb-width-wrap" style={{position:"relative"}}>
          <WbBtn title="Stroke & opacity" onClick={()=>setShowWidthPicker(v=>!v)} active={showWidthPicker}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              {[2,5,10].map(w=><div key={w} style={{width:16,height:w/3,background:"currentColor",borderRadius:4}}/>)}
            </div>
          </WbBtn>
          {showWidthPicker&&(
            <div style={{
              position:"absolute",top:44,left:"50%",transform:"translateX(-50%)",
              background:"rgba(255,255,255,0.97)",backdropFilter:"blur(20px)",
              borderRadius:14,padding:"12px 16px",zIndex:300,
              boxShadow:"0 16px 48px rgba(0,0,0,0.18)",
              border:"1px solid rgba(200,195,187,0.5)",
              display:"flex",flexDirection:"column",gap:8,minWidth:160,
            }}>
              <div style={{fontSize:11,color:"#888",letterSpacing:"0.08em"}}>STROKE SIZE</div>
              <input type="range" min={1} max={30} value={strokeWidth} onChange={e=>setStrokeWidth(Number(e.target.value))} style={{accentColor:color}}/>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                {STROKE_WIDTHS.map(w=>(
                  <button key={w} onClick={()=>setStrokeWidth(w)} style={{
                    width:32,height:32,borderRadius:8,
                    background:strokeWidth===w?"#f0ede8":"transparent",
                    border:"none",cursor:"pointer",
                    display:"flex",alignItems:"center",justifyContent:"center",
                  }}>
                    <div style={{width:18,height:Math.min(w,12),background:color,borderRadius:4}}/>
                  </button>
                ))}
              </div>
              <div style={{fontSize:11,color:"#888",letterSpacing:"0.08em"}}>OPACITY</div>
              <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={e=>setOpacity(Number(e.target.value))} style={{accentColor:color}}/>
              <div style={{fontSize:11,color:"#aaa",textAlign:"right"}}>{Math.round(opacity*100)}%</div>
            </div>
          )}
        </div>

        <Divider />

        <WbBtn title="Toggle grid" active={showGrid} onClick={()=>setShowGrid(v=>!v)}>
          <Icon d={ICONS.grid} size={17} />
        </WbBtn>

        <div className="wb-sticky-wrap" style={{position:"relative"}}>
          <WbBtn title="Add sticky note" onClick={()=>setShowStickyPalette(v=>!v)} active={showStickyPalette}>
            <Icon d={ICONS.sticky} size={17}/>
          </WbBtn>
          {showStickyPalette&&(
            <div style={{
              position:"absolute",top:44,left:"50%",transform:"translateX(-50%)",
              background:"rgba(255,255,255,0.97)",backdropFilter:"blur(20px)",
              borderRadius:14,padding:12,zIndex:300,
              boxShadow:"0 16px 48px rgba(0,0,0,0.18)",
              border:"1px solid rgba(200,195,187,0.5)",
              display:"flex",gap:8,
            }}>
              {STICKY_COLORS.map(bg=>(
                <button key={bg} onClick={()=>addSticky(bg)} style={{
                  width:30,height:30,borderRadius:6,background:bg,
                  border:"none",cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.12)",transition:"transform 0.1s",
                }}
                  onMouseEnter={e=>e.currentTarget.style.transform="scale(1.15)"}
                  onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
                />
              ))}
            </div>
          )}
        </div>

        <WbBtn title="Toggle canvas color" onClick={()=>setCanvasColor(c=>c==="#f8f5f0"?"#1a1a2e":"#f8f5f0")}>
          <Icon d={ICONS.palette} size={17}/>
        </WbBtn>

        <Divider />

        <WbBtn title="Undo (Ctrl+Z)" onClick={undo} disabled={histIdx===0}>
          <Icon d={ICONS.undo} size={17}/>
        </WbBtn>
        <WbBtn title="Redo (Ctrl+Y)" onClick={redo} disabled={histIdx>=history.length-1}>
          <Icon d={ICONS.redo} size={17}/>
        </WbBtn>

        <Divider />

        <WbBtn title="Export PNG" onClick={exportPNG}>
          <Icon d={ICONS.download} size={17}/>
        </WbBtn>
        <WbBtn title="Clear all" onClick={clearAll} danger>
          <Icon d={ICONS.trash} size={17}/>
        </WbBtn>

        <Divider />

        {/* ── TOOLKIT BUTTON ── */}
        <WbBtn
          title="Open Toolkit (Ctrl+K)"
          onClick={()=>setToolkitOpen(v=>!v)}
          active={toolkitOpen}
          toolkit
        >
          <Icon d={ICONS.tools} size={17}/>
        </WbBtn>
      </div>

      {/* Status pill */}
      <div style={{
        position:"fixed",bottom:20,left:20,
        background:"rgba(255,255,255,0.85)",backdropFilter:"blur(14px)",
        borderRadius:100,padding:"6px 14px",
        fontSize:12,color:"#555",letterSpacing:"0.1em",
        boxShadow:"0 2px 12px rgba(0,0,0,0.08)",
        border:"1px solid rgba(200,195,187,0.5)",
        display:"flex",alignItems:"center",gap:8,
        zIndex:50,fontFamily:"monospace",
      }}>
        <span style={{color,fontWeight:700}}>●</span>
        {TOOL_LIST.find(t=>t.id===tool)?.label.toUpperCase()}
        <span style={{opacity:0.4,fontSize:10}}>·</span>
        <span style={{opacity:0.6}}>W{strokeWidth}</span>
        <span style={{opacity:0.4,fontSize:10}}>·</span>
        <span style={{opacity:0.6}}>{Math.round(opacity*100)}%</span>
        {toolkitOpen && <>
          <span style={{opacity:0.4,fontSize:10}}>·</span>
          <span style={{color:"#4a90e2",fontSize:10,letterSpacing:"0.06em"}}>TOOLKIT OPEN</span>
        </>}
      </div>

      {/* Object count */}
      <div style={{
        position:"fixed",bottom:20,right:20,
        fontFamily:"monospace",fontSize:11,color:"#aaa",
        letterSpacing:"0.08em",zIndex:50,
      }}>
        {elements.length} objects · {stickies.length} notes
      </div>

      {/* ══ Toolkit Drawer ══ */}
      <ToolkitDrawer open={toolkitOpen} onClose={()=>setToolkitOpen(false)} />
    </div>
  );
};

// ── WbBtn (whiteboard toolbar button) ─────────────────────────────────────────
const WbBtn = ({ children, active, onClick, title, disabled, danger, toolkit }) => (
  <button onClick={onClick} title={title} disabled={disabled} style={{
    width:36, height:36, borderRadius:10, border:"none",
    background: toolkit&&active
      ? "linear-gradient(135deg, #00ff88 0%, #4a90e2 100%)"
      : active ? "#ede9e3" : "transparent",
    color: danger   ? "#e94560"
         : toolkit&&active ? "#fff"
         : toolkit  ? "#4a90e2"
         : active   ? "#1a1a2e" : "#555",
    cursor: disabled?"not-allowed":"pointer",
    opacity: disabled?0.35:1,
    display:"flex", alignItems:"center", justifyContent:"center",
    transition:"all 0.12s",
    boxShadow: toolkit&&active
      ? "0 0 14px rgba(0,255,136,0.4), 0 2px 8px rgba(74,144,226,0.3)"
      : active ? "inset 0 1px 3px rgba(0,0,0,0.08)" : "none",
  }}
    onMouseEnter={e=>{ if(!disabled&&!(toolkit&&active)) e.currentTarget.style.background="#f5f2ed"; }}
    onMouseLeave={e=>{ e.currentTarget.style.background = toolkit&&active ? "linear-gradient(135deg,#00ff88,#4a90e2)" : active?"#ede9e3":"transparent"; }}
  >
    {children}
  </button>
);

// ── Divider ───────────────────────────────────────────────────────────────────
const Divider = () => (
  <div style={{width:1,height:24,background:"rgba(0,0,0,0.09)",margin:"0 4px"}}/>
);

// ── StickyNote ────────────────────────────────────────────────────────────────
const StickyNote = ({ sticky, onUpdate, onRemove }) => {
  const drag = useRef(null);
  const [pos, setPos] = useState({ x:sticky.x, y:sticky.y });

  const onMouseDown = (e) => {
    if (e.target.tagName==="TEXTAREA"||e.target.tagName==="BUTTON") return;
    drag.current={ mx:e.clientX, my:e.clientY, sx:pos.x, sy:pos.y };
    const mv=(ev)=>setPos({ x:drag.current.sx+ev.clientX-drag.current.mx, y:drag.current.sy+ev.clientY-drag.current.my });
    const up=()=>{ window.removeEventListener("mousemove",mv); window.removeEventListener("mouseup",up); };
    window.addEventListener("mousemove",mv); window.addEventListener("mouseup",up);
  };

  return (
    <div onMouseDown={onMouseDown} style={{
      position:"fixed", left:pos.x, top:pos.y, zIndex:150,
      width:180, minHeight:160, background:sticky.bg,
      borderRadius:4, boxShadow:"3px 5px 18px rgba(0,0,0,0.13), 0 1px 0 rgba(255,255,255,0.7) inset",
      cursor:"grab", padding:"8px 8px 12px",
      display:"flex", flexDirection:"column",
      transform:`rotate(${(sticky.id%7-3)*0.4}deg)`,
      transition:"box-shadow 0.15s",
    }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="6px 10px 28px rgba(0,0,0,0.18)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="3px 5px 18px rgba(0,0,0,0.13)"}
    >
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:4}}>
        <button onClick={()=>onRemove(sticky.id)} style={{
          background:"none",border:"none",cursor:"pointer",
          fontSize:14,color:"rgba(0,0,0,0.3)",lineHeight:1,padding:2,
        }}>✕</button>
      </div>
      <textarea value={sticky.text} onChange={e=>onUpdate(sticky.id,{text:e.target.value})}
        placeholder="Write a note…" style={{
          flex:1,background:"transparent",border:"none",outline:"none",
          resize:"none",fontFamily:"'DM Serif Display',serif",
          fontSize:14,color:"#333",lineHeight:1.6,minHeight:100,
        }}/>
    </div>
  );
};

export default WhiteBoard;