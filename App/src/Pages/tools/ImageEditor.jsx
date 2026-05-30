import { useState, useRef, useEffect, useCallback } from "react";

// ─── Pixel-level filters ───────────────────────────────────────────────────────

function clamp(v) { return Math.min(255, Math.max(0, v)); }

function applyBrightness(d, value) {
  for (let i = 0; i < d.length; i += 4) {
    d[i]=clamp(d[i]+value); d[i+1]=clamp(d[i+1]+value); d[i+2]=clamp(d[i+2]+value);
  }
}
function applyContrast(d, value) {
  const f = (259*(value+255))/(255*(259-value));
  for (let i=0; i<d.length; i+=4) {
    d[i]=clamp(Math.round(f*(d[i]-128)+128));
    d[i+1]=clamp(Math.round(f*(d[i+1]-128)+128));
    d[i+2]=clamp(Math.round(f*(d[i+2]-128)+128));
  }
}
function applySaturation(d, value) {
  for (let i=0; i<d.length; i+=4) {
    const g=0.2989*d[i]+0.5870*d[i+1]+0.1140*d[i+2], f=1+value/100;
    d[i]=clamp(Math.round(g+(d[i]-g)*f));
    d[i+1]=clamp(Math.round(g+(d[i+1]-g)*f));
    d[i+2]=clamp(Math.round(g+(d[i+2]-g)*f));
  }
}
function applyHue(d, deg) {
  const cos=Math.cos(deg*Math.PI/180), sin=Math.sin(deg*Math.PI/180);
  for (let i=0; i<d.length; i+=4) {
    const r=d[i],g=d[i+1],b=d[i+2];
    d[i]  =clamp(Math.round(r*(0.213+cos*0.787-sin*0.213)+g*(0.213-cos*0.213+sin*0.143)+b*(0.213-cos*0.213-sin*0.787)));
    d[i+1]=clamp(Math.round(r*(0.715-cos*0.715-sin*0.715)+g*(0.715+cos*0.285+sin*0.140)+b*(0.715-cos*0.715+sin*0.715)));
    d[i+2]=clamp(Math.round(r*(0.072-cos*0.072+sin*0.928)+g*(0.072-cos*0.072-sin*0.283)+b*(0.072+cos*0.928+sin*0.072)));
  }
}
function applyTemperature(d, value) {
  for (let i=0; i<d.length; i+=4) { d[i]=clamp(d[i]+value); d[i+2]=clamp(d[i+2]-value); }
}
function applyBlur(data, w, h, radius) {
  const src=new Uint8ClampedArray(data);
  for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
    let r=0,g=0,b=0,c=0;
    for (let ky=-radius; ky<=radius; ky++) for (let kx=-radius; kx<=radius; kx++) {
      const px=Math.min(w-1,Math.max(0,x+kx)), py=Math.min(h-1,Math.max(0,y+ky));
      const idx=(py*w+px)*4; r+=src[idx]; g+=src[idx+1]; b+=src[idx+2]; c++;
    }
    const idx=(y*w+x)*4; data[idx]=Math.round(r/c); data[idx+1]=Math.round(g/c); data[idx+2]=Math.round(b/c);
  }
}
function applySharpen(data, w, h, strength) {
  const src=new Uint8ClampedArray(data), k=[0,-1,0,-1,5,-1,0,-1,0];
  for (let y=1; y<h-1; y++) for (let x=1; x<w-1; x++) {
    let r=0,g=0,b=0;
    for (let ky=-1; ky<=1; ky++) for (let kx=-1; kx<=1; kx++) {
      const idx=((y+ky)*w+(x+kx))*4, ki=k[(ky+1)*3+(kx+1)];
      r+=src[idx]*ki; g+=src[idx+1]*ki; b+=src[idx+2]*ki;
    }
    const idx=(y*w+x)*4;
    data[idx]  =clamp(Math.round(src[idx]  +(r-src[idx]  )*strength));
    data[idx+1]=clamp(Math.round(src[idx+1]+(g-src[idx+1])*strength));
    data[idx+2]=clamp(Math.round(src[idx+2]+(b-src[idx+2])*strength));
  }
}
function applyVignette(data, w, h, strength) {
  const cx=w/2, cy=h/2, md=Math.sqrt(cx*cx+cy*cy);
  for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
    const d=Math.sqrt((x-cx)**2+(y-cy)**2)/md, f=1-d*d*strength;
    const idx=(y*w+x)*4;
    data[idx]=clamp(Math.round(data[idx]*f)); data[idx+1]=clamp(Math.round(data[idx+1]*f)); data[idx+2]=clamp(Math.round(data[idx+2]*f));
  }
}
function applyGrayscale(d) {
  for (let i=0; i<d.length; i+=4) { const g=Math.round(0.2989*d[i]+0.5870*d[i+1]+0.1140*d[i+2]); d[i]=d[i+1]=d[i+2]=g; }
}
function applySepia(d) {
  for (let i=0; i<d.length; i+=4) {
    const r=d[i],g=d[i+1],b=d[i+2];
    d[i]=clamp(Math.round(0.393*r+0.769*g+0.189*b));
    d[i+1]=clamp(Math.round(0.349*r+0.686*g+0.168*b));
    d[i+2]=clamp(Math.round(0.272*r+0.534*g+0.131*b));
  }
}
function applyInvert(d) { for (let i=0; i<d.length; i+=4) { d[i]=255-d[i]; d[i+1]=255-d[i+1]; d[i+2]=255-d[i+2]; } }

// ─── Canvas transforms ─────────────────────────────────────────────────────────

function rotateCanvas(img, angle) {
  const c=document.createElement("canvas");
  const rad=angle*Math.PI/180;
  if (angle===90||angle===270) { c.width=img.height; c.height=img.width; }
  else { c.width=img.width; c.height=img.height; }
  const ctx=c.getContext("2d");
  ctx.translate(c.width/2,c.height/2); ctx.rotate(rad); ctx.drawImage(img,-img.width/2,-img.height/2);
  return c;
}
function flipCanvas(img, horiz) {
  const c=document.createElement("canvas"); c.width=img.width; c.height=img.height;
  const ctx=c.getContext("2d");
  ctx.translate(horiz?img.width:0, horiz?0:img.height);
  ctx.scale(horiz?-1:1, horiz?1:-1); ctx.drawImage(img,0,0);
  return c;
}
function canvasToImg(canvas) {
  return new Promise(res => { const i=new Image(); i.onload=()=>res(i); i.src=canvas.toDataURL(); });
}

// ─── Config ────────────────────────────────────────────────────────────────────

const SLIDERS = [
  { key:"brightness",  label:"Brightness",   min:-100, max:100,  default:0 },
  { key:"contrast",    label:"Contrast",     min:-100, max:100,  default:0 },
  { key:"saturation",  label:"Saturation",   min:-100, max:100,  default:0 },
  { key:"hue",         label:"Hue",          min:-180, max:180,  default:0 },
  { key:"temperature", label:"Temperature",  min:-80,  max:80,   default:0 },
  { key:"sharpen",     label:"Sharpen",      min:0,    max:100,  default:0 },
  { key:"blur",        label:"Blur",         min:0,    max:10,   default:0 },
  { key:"vignette",    label:"Vignette",     min:0,    max:100,  default:0 },
];
const DEFAULT_ADJ = Object.fromEntries(SLIDERS.map(s=>[s.key,s.default]));

const PANELS = [
  { id:"adjust",    label:"Adjust"    },
  { id:"filters",   label:"Filters"   },
  { id:"transform", label:"Transform" },
  { id:"crop",      label:"Crop"      },
  { id:"resize",    label:"Resize"    },
  { id:"text",      label:"Text"      },
];

const PRESETS = [
  { id:null,        label:"None"      },
  { id:"grayscale", label:"B & W"     },
  { id:"sepia",     label:"Sepia"     },
  { id:"invert",    label:"Invert"    },
];

// ─── Component ─────────────────────────────────────────────────────────────────

const ImageEditorTool = () => {
  const [srcImg,      setSrcImg]      = useState(null);
  const [origImg,     setOrigImg]     = useState(null);
  const [preview,     setPreview]     = useState(null);
  const [adj,         setAdj]         = useState(DEFAULT_ADJ);
  const [filter,      setFilter]      = useState(null);
  const [panel,       setPanel]       = useState("adjust");
  const [history,     setHistory]     = useState([]);
  const [histIdx,     setHistIdx]     = useState(-1);

  const [resizeW,     setResizeW]     = useState("");
  const [resizeH,     setResizeH]     = useState("");
  const [lockAR,      setLockAR]      = useState(true);

  const [cropMode,    setCropMode]    = useState(false);
  const [cropStart,   setCropStart]   = useState(null);
  const [cropRect,    setCropRect]    = useState(null);
  const [dragging,    setDragging]    = useState(false);

  const [textVal,     setTextVal]     = useState("");
  const [textX,       setTextX]       = useState(50);
  const [textY,       setTextY]       = useState(50);
  const [textSize,    setTextSize]    = useState(36);
  const [textColor,   setTextColor]   = useState("#ffffff");
  const [textBold,    setTextBold]    = useState(false);

  const canvasRef  = useRef(null);
  const previewRef = useRef(null);
  const fileRef    = useRef(null);

  // ── Load ───────────────────────────────────────────────────────────────────

  function loadFile(file) {
    if (!file||!file.type.startsWith("image/")) return;
    const r=new FileReader();
    r.onload=ev=>{ const img=new Image(); img.onload=()=>{ setOrigImg(img); initImg(img); }; img.src=ev.target.result; };
    r.readAsDataURL(file);
  }

  function initImg(img) {
    setSrcImg(img); setAdj(DEFAULT_ADJ); setFilter(null);
    setCropRect(null); setCropMode(false);
    setHistory([img.src]); setHistIdx(0);
    setResizeW(img.width); setResizeH(img.height);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const renderPreview = useCallback(() => {
    if (!srcImg) return;
    const canvas=canvasRef.current, ctx=canvas.getContext("2d");
    canvas.width=srcImg.width; canvas.height=srcImg.height;
    ctx.drawImage(srcImg,0,0);
    const id=ctx.getImageData(0,0,canvas.width,canvas.height), d=id.data;
    if (adj.brightness!==0)  applyBrightness(d,adj.brightness);
    if (adj.contrast!==0)    applyContrast(d,adj.contrast);
    if (adj.saturation!==0)  applySaturation(d,adj.saturation);
    if (adj.hue!==0)         applyHue(d,adj.hue);
    if (adj.temperature!==0) applyTemperature(d,adj.temperature);
    if (adj.blur>0)          applyBlur(d,canvas.width,canvas.height,adj.blur);
    if (adj.sharpen>0)       applySharpen(d,canvas.width,canvas.height,adj.sharpen/100);
    if (adj.vignette>0)      applyVignette(d,canvas.width,canvas.height,adj.vignette/100);
    if (filter==="grayscale") applyGrayscale(d);
    if (filter==="sepia")     applySepia(d);
    if (filter==="invert")    applyInvert(d);
    ctx.putImageData(id,0,0);
    if (panel==="text"&&textVal) {
      ctx.font=`${textBold?"bold ":""}${textSize}px sans-serif`;
      ctx.strokeStyle="rgba(0,0,0,0.6)"; ctx.lineWidth=3;
      ctx.fillStyle=textColor;
      const px=(textX/100)*canvas.width, py=(textY/100)*canvas.height;
      ctx.strokeText(textVal,px,py); ctx.fillText(textVal,px,py);
    }
    setPreview(canvas.toDataURL());
  }, [srcImg,adj,filter,textVal,textX,textY,textSize,textColor,textBold,panel]);

  useEffect(()=>{ renderPreview(); },[renderPreview]);

  // ── History ────────────────────────────────────────────────────────────────

  function pushHistory(img) {
    const h=history.slice(0,histIdx+1); h.push(img.src);
    setHistory(h); setHistIdx(h.length-1);
    setSrcImg(img); setResizeW(img.width); setResizeH(img.height);
  }

  function undo() {
    if (histIdx<=0) return;
    const idx=histIdx-1, img=new Image();
    img.onload=()=>{ setSrcImg(img); setResizeW(img.width); setResizeH(img.height); };
    img.src=history[idx]; setHistIdx(idx);
  }

  function redo() {
    if (histIdx>=history.length-1) return;
    const idx=histIdx+1, img=new Image();
    img.onload=()=>{ setSrcImg(img); setResizeW(img.width); setResizeH(img.height); };
    img.src=history[idx]; setHistIdx(idx);
  }

  function resetAll() {
    if (!origImg) return;
    setSrcImg(origImg); setAdj(DEFAULT_ADJ); setFilter(null);
    setResizeW(origImg.width); setResizeH(origImg.height);
    setHistory([origImg.src]); setHistIdx(0);
    setCropRect(null); setCropMode(false);
  }

  // ── Transforms ────────────────────────────────────────────────────────────

  async function doTransform(fn) {
    if (!srcImg) return;
    const img=await canvasToImg(fn(srcImg));
    pushHistory(img);
  }

  // ── Resize ─────────────────────────────────────────────────────────────────

  async function applyResize() {
    const w=parseInt(resizeW,10), h=parseInt(resizeH,10);
    if (!w||!h||w<1||h<1||!srcImg) return;
    const c=document.createElement("canvas"); c.width=w; c.height=h;
    c.getContext("2d").drawImage(srcImg,0,0,w,h);
    pushHistory(await canvasToImg(c));
  }

  function onResizeW(v) { setResizeW(v); if(lockAR&&srcImg) setResizeH(Math.round(v*(srcImg.height/srcImg.width))); }
  function onResizeH(v) { setResizeH(v); if(lockAR&&srcImg) setResizeW(Math.round(v*(srcImg.width/srcImg.height))); }

  // ── Crop ───────────────────────────────────────────────────────────────────

  function imgScale() {
    if (!srcImg||!previewRef.current) return {sx:1,sy:1};
    const r=previewRef.current.getBoundingClientRect();
    return { sx:srcImg.width/r.width, sy:srcImg.height/r.height };
  }

  function getPos(e) {
    const r=previewRef.current.getBoundingClientRect(), {sx,sy}=imgScale();
    return { x:Math.round((e.clientX-r.left)*sx), y:Math.round((e.clientY-r.top)*sy) };
  }

  function onMouseDown(e) {
    if (!cropMode) return; e.preventDefault();
    const p=getPos(e); setCropStart(p); setCropRect(null); setDragging(true);
  }
  function onMouseMove(e) {
    if (!dragging||!cropStart) return; e.preventDefault();
    const p=getPos(e);
    setCropRect({ x:Math.min(cropStart.x,p.x), y:Math.min(cropStart.y,p.y), w:Math.abs(p.x-cropStart.x), h:Math.abs(p.y-cropStart.y) });
  }
  function onMouseUp() { setDragging(false); }

  async function applyCrop() {
    if (!cropRect||cropRect.w<2||cropRect.h<2) return;
    const c=document.createElement("canvas"); c.width=cropRect.w; c.height=cropRect.h;
    c.getContext("2d").drawImage(srcImg,cropRect.x,cropRect.y,cropRect.w,cropRect.h,0,0,cropRect.w,cropRect.h);
    pushHistory(await canvasToImg(c));
    setCropRect(null); setCropMode(false);
  }

  function cropOverlayStyle() {
    if (!cropRect||!srcImg||!previewRef.current) return { display:"none" };
    const r=previewRef.current.getBoundingClientRect(), sx=r.width/srcImg.width, sy=r.height/srcImg.height;
    return { left:cropRect.x*sx, top:cropRect.y*sy, width:cropRect.w*sx, height:cropRect.h*sy };
  }

  // ── Text ───────────────────────────────────────────────────────────────────

  async function bakeText() {
    if (!textVal||!srcImg) return;
    const img=await canvasToImg(canvasRef.current);
    pushHistory(img); setTextVal("");
  }

  // ── Download ───────────────────────────────────────────────────────────────

  function download(fmt) {
    if (!preview) return;
    const canvas=canvasRef.current;
    const mime=fmt==="jpg"?"image/jpeg":"image/png";
    const a=document.createElement("a"); a.download=`edited.${fmt}`; a.href=canvas.toDataURL(mime,0.92); a.click();
  }

  // ── Switch panel ───────────────────────────────────────────────────────────

  function switchPanel(id) {
    setPanel(id);
    if (id!=="crop") { setCropMode(false); setCropRect(null); }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="ie-root">
      <canvas ref={canvasRef} style={{display:"none"}} />

      {/* Top bar */}
      <div className="ie-topbar">
        <div className="ie-topbar-group">
          <input ref={fileRef} type="file" accept="image/*" onChange={e=>loadFile(e.target.files[0])} style={{display:"none"}} />
          <button className="ie-btn ie-btn--accent" onClick={()=>fileRef.current?.click()}>Open</button>
          {srcImg && <>
            <button className="ie-btn" onClick={undo}  disabled={histIdx<=0}>↩ Undo</button>
            <button className="ie-btn" onClick={redo}  disabled={histIdx>=history.length-1}>↪ Redo</button>
            <button className="ie-btn" onClick={resetAll}>Reset</button>
          </>}
        </div>
        <div className="ie-topbar-info">
          {srcImg && <span className="ie-dim">{srcImg.width} × {srcImg.height} px</span>}
        </div>
        <div className="ie-topbar-group">
          {srcImg && <>
            <button className="ie-btn" onClick={()=>download("png")}>↓ PNG</button>
            <button className="ie-btn" onClick={()=>download("jpg")}>↓ JPG</button>
          </>}
        </div>
      </div>

      {!srcImg ? (
        /* Drop zone */
        <div
          className="ie-dropzone"
          onClick={()=>fileRef.current?.click()}
          onDragOver={e=>e.preventDefault()}
          onDrop={e=>{e.preventDefault();loadFile(e.dataTransfer.files[0]);}}
        >
          <div className="ie-drop-icon">+</div>
          <div className="ie-drop-text">Drop an image or click to open</div>
          <div className="ie-drop-sub">PNG · JPG · WEBP · GIF</div>
        </div>
      ) : (
        <div className="ie-workspace">

          {/* Side panel */}
          <aside className="ie-panel">
            <div className="ie-panel-tabs">
              {PANELS.map(p=>(
                <button
                  key={p.id}
                  className={`ie-tab${panel===p.id?" ie-tab--active":""}`}
                  onClick={()=>switchPanel(p.id)}
                >{p.label}</button>
              ))}
            </div>

            <div className="ie-panel-body">

              {panel==="adjust" && (
                <div className="ie-section">
                  {SLIDERS.map(s=>(
                    <div key={s.key} className="ie-slider-row">
                      <div className="ie-slider-meta">
                        <span className="ie-slider-label">{s.label}</span>
                        <span className="ie-slider-val">{adj[s.key]}</span>
                      </div>
                      <input
                        type="range" className="ie-range"
                        min={s.min} max={s.max} value={adj[s.key]}
                        onChange={e=>setAdj(p=>({...p,[s.key]:Number(e.target.value)}))}
                      />
                    </div>
                  ))}
                  <button className="ie-btn ie-btn--ghost ie-btn--full" onClick={()=>setAdj(DEFAULT_ADJ)}>
                    Reset adjustments
                  </button>
                </div>
              )}

              {panel==="filters" && (
                <div className="ie-section">
                  <p className="ie-note">One-click presets. Stacks with Adjust sliders.</p>
                  <div className="ie-filter-grid">
                    {PRESETS.map(f=>(
                      <button
                        key={f.id??"none"}
                        className={`ie-filter-btn${filter===f.id?" ie-filter-btn--active":""}`}
                        onClick={()=>setFilter(f.id)}
                      >{f.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {panel==="transform" && (
                <div className="ie-section">
                  <p className="ie-section-label">Rotate</p>
                  <div className="ie-btn-row">
                    <button className="ie-btn ie-btn--full" onClick={()=>doTransform(i=>rotateCanvas(i,90))}>↻ 90°</button>
                    <button className="ie-btn ie-btn--full" onClick={()=>doTransform(i=>rotateCanvas(i,270))}>↺ 90°</button>
                    <button className="ie-btn ie-btn--full" onClick={()=>doTransform(i=>rotateCanvas(i,180))}>180°</button>
                  </div>
                  <p className="ie-section-label">Flip</p>
                  <div className="ie-btn-row">
                    <button className="ie-btn ie-btn--full" onClick={()=>doTransform(i=>flipCanvas(i,true))}>↔ Horizontal</button>
                    <button className="ie-btn ie-btn--full" onClick={()=>doTransform(i=>flipCanvas(i,false))}>↕ Vertical</button>
                  </div>
                </div>
              )}

              {panel==="crop" && (
                <div className="ie-section">
                  <p className="ie-note">{cropMode?"Draw a selection on the image, then apply.":"Enable crop mode, then drag on the image."}</p>
                  <button
                    className={`ie-btn ie-btn--full${cropMode?" ie-btn--accent":""}`}
                    onClick={()=>{setCropMode(v=>!v);setCropRect(null);}}
                  >
                    {cropMode?"Cancel":"Start Crop"}
                  </button>
                  {cropRect&&cropRect.w>1&&(
                    <>
                      <p className="ie-note" style={{marginTop:"0.6rem"}}>
                        {cropRect.w} × {cropRect.h} px &nbsp;@&nbsp; ({cropRect.x}, {cropRect.y})
                      </p>
                      <button className="ie-btn ie-btn--accent ie-btn--full" onClick={applyCrop}>
                        Apply Crop
                      </button>
                    </>
                  )}
                </div>
              )}

              {panel==="resize" && (
                <div className="ie-section">
                  <div className="ie-field-row">
                    <div className="ie-field">
                      <label className="ie-label">Width</label>
                      <input className="ie-input" type="number" min="1" value={resizeW} onChange={e=>onResizeW(e.target.value)} />
                    </div>
                    <div className="ie-field">
                      <label className="ie-label">Height</label>
                      <input className="ie-input" type="number" min="1" value={resizeH} onChange={e=>onResizeH(e.target.value)} />
                    </div>
                  </div>
                  <label className="ie-checkbox">
                    <input type="checkbox" checked={lockAR} onChange={e=>setLockAR(e.target.checked)} />
                    <span>Lock aspect ratio</span>
                  </label>
                  <button className="ie-btn ie-btn--accent ie-btn--full" style={{marginTop:"0.75rem"}} onClick={applyResize}>
                    Apply Resize
                  </button>
                  <div className="ie-note" style={{marginTop:"0.6rem"}}>
                    Original: {origImg?.width} × {origImg?.height} px
                  </div>
                </div>
              )}

              {panel==="text" && (
                <div className="ie-section">
                  <div className="ie-field">
                    <label className="ie-label">Text content</label>
                    <input className="ie-input" type="text" placeholder="Your text…" value={textVal} onChange={e=>setTextVal(e.target.value)} />
                  </div>
                  <div className="ie-field-row">
                    <div className="ie-field">
                      <label className="ie-label">X (%)</label>
                      <input className="ie-input" type="number" min="0" max="100" value={textX} onChange={e=>setTextX(Number(e.target.value))} />
                    </div>
                    <div className="ie-field">
                      <label className="ie-label">Y (%)</label>
                      <input className="ie-input" type="number" min="0" max="100" value={textY} onChange={e=>setTextY(Number(e.target.value))} />
                    </div>
                  </div>
                  <div className="ie-slider-row">
                    <div className="ie-slider-meta">
                      <span className="ie-slider-label">Font size</span>
                      <span className="ie-slider-val">{textSize}px</span>
                    </div>
                    <input type="range" className="ie-range" min="8" max="200" value={textSize} onChange={e=>setTextSize(Number(e.target.value))} />
                  </div>
                  <div className="ie-field-row">
                    <div className="ie-field">
                      <label className="ie-label">Color</label>
                      <input type="color" value={textColor} onChange={e=>setTextColor(e.target.value)}
                        style={{width:"100%",height:"34px",borderRadius:"var(--tk-radius)",border:"1px solid var(--tk-border)",background:"none",cursor:"pointer"}} />
                    </div>
                    <div className="ie-field" style={{justifyContent:"flex-end"}}>
                      <label className="ie-checkbox" style={{marginTop:"auto"}}>
                        <input type="checkbox" checked={textBold} onChange={e=>setTextBold(e.target.checked)} />
                        <span>Bold</span>
                      </label>
                    </div>
                  </div>
                  <button className="ie-btn ie-btn--accent ie-btn--full" style={{marginTop:"0.75rem"}} onClick={bakeText} disabled={!textVal}>
                    Bake text into image
                  </button>
                  <p className="ie-note">Preview updates live. "Bake" makes it permanent.</p>
                </div>
              )}

            </div>
          </aside>

          {/* Canvas area */}
          <div className="ie-canvas-wrap">
            <div
              className={`ie-preview-shell${cropMode?" ie-preview-shell--crop":""}`}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              {preview&&<img ref={previewRef} src={preview} alt="Preview" className="ie-preview-img" draggable={false} />}
              {cropMode&&cropRect&&<div className="ie-crop-sel" style={cropOverlayStyle()} />}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export default ImageEditorTool;