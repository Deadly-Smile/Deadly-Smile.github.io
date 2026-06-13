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
function applyNoise(d, value) {
  for (let i=0; i<d.length; i+=4) {
    const n=(Math.random()-0.5)*value*2.55;
    d[i]=clamp(d[i]+n); d[i+1]=clamp(d[i+1]+n); d[i+2]=clamp(d[i+2]+n);
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

// ─── Shape drawing helper ─────────────────────────────────────────────────────

function drawShape(ctx, s) {
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle   = s.color;
  ctx.lineWidth   = s.lineWidth;
  ctx.lineCap     = "round";
  const {x1,y1,x2,y2} = s;
  if (s.type==="rect") {
    s.fill ? ctx.fillRect(x1,y1,x2-x1,y2-y1) : ctx.strokeRect(x1,y1,x2-x1,y2-y1);
  } else if (s.type==="circle") {
    const rx=Math.abs(x2-x1)/2, ry=Math.abs(y2-y1)/2, cx=(x1+x2)/2, cy=(y1+y2)/2;
    ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);
    s.fill ? ctx.fill() : ctx.stroke();
  } else if (s.type==="line") {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  } else if (s.type==="arrow") {
    const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy);
    if (len<2) { ctx.restore(); return; }
    const ux=dx/len, uy=dy/len, hw=Math.max(s.lineWidth*3,12), hl=Math.max(s.lineWidth*4,16);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2-ux*hl,y2-uy*hl); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2,y2);
    ctx.lineTo(x2-ux*hl-uy*hw, y2-uy*hl+ux*hw);
    ctx.lineTo(x2-ux*hl+uy*hw, y2-uy*hl-ux*hw);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
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
  { key:"noise",       label:"Noise",        min:0,    max:100,  default:0 },
];
const DEFAULT_ADJ = Object.fromEntries(SLIDERS.map(s=>[s.key,s.default]));

const PANELS = [
  { id:"adjust",    label:"Adjust"    },
  { id:"filters",   label:"Filters"   },
  { id:"transform", label:"Transform" },
  { id:"crop",      label:"Crop"      },
  { id:"resize",    label:"Resize"    },
  { id:"text",      label:"Text"      },
  { id:"draw",      label:"Draw"      },
  { id:"shapes",    label:"Shapes"    },
];

const PRESETS = [
  { id:null,        label:"None"      },
  { id:"grayscale", label:"B & W"     },
  { id:"sepia",     label:"Sepia"     },
  { id:"invert",    label:"Invert"    },
];

const TONE_PRESETS = [
  { id:"vivid", label:"Vivid", adj:{ saturation:50, contrast:20 } },
  { id:"cool",  label:"Cool",  adj:{ temperature:-30, saturation:10 } },
  { id:"warm",  label:"Warm",  adj:{ temperature:40, saturation:10 } },
  { id:"fade",  label:"Fade",  adj:{ brightness:20, contrast:-30, saturation:-20 } },
  { id:"punch", label:"Punch", adj:{ contrast:40, saturation:50, brightness:-5 } },
];

const CROP_RATIOS = [
  { id:null,   label:"Free",  r:null },
  { id:"1:1",  label:"1:1",   r:1 },
  { id:"16:9", label:"16:9",  r:16/9 },
  { id:"4:3",  label:"4:3",   r:4/3 },
  { id:"9:16", label:"9:16",  r:9/16 },
  { id:"3:2",  label:"3:2",   r:3/2 },
];

// ─── Component ─────────────────────────────────────────────────────────────────

const ImageEditorTool = () => {
  const [srcImg,       setSrcImg]       = useState(null);
  const [origImg,      setOrigImg]      = useState(null);
  const [preview,      setPreview]      = useState(null);
  const [adj,          setAdj]          = useState(DEFAULT_ADJ);
  const [filter,       setFilter]       = useState(null);
  const [tonePreset,   setTonePreset]   = useState(null);
  const [panel,        setPanel]        = useState("adjust");
  const [history,      setHistory]      = useState([]);
  const [histIdx,      setHistIdx]      = useState(-1);

  const [resizeW,      setResizeW]      = useState("");
  const [resizeH,      setResizeH]      = useState("");
  const [lockAR,       setLockAR]       = useState(true);

  const [cropMode,     setCropMode]     = useState(false);
  const [cropStart,    setCropStart]    = useState(null);
  const [cropRect,     setCropRect]     = useState(null);
  const [dragging,     setDragging]     = useState(false);
  const [cropAR,       setCropAR]       = useState(null);

  const [textVal,      setTextVal]      = useState("");
  const [textX,        setTextX]        = useState(50);
  const [textY,        setTextY]        = useState(50);
  const [textSize,     setTextSize]     = useState(36);
  const [textColor,    setTextColor]    = useState("#ffffff");
  const [textBold,     setTextBold]     = useState(false);
  const [textItalic,   setTextItalic]   = useState(false);
  const [textAlign,    setTextAlign]    = useState("left");
  const [textDragging, setTextDragging] = useState(false);
  const [eyedropperActive, setEyedropperActive] = useState(false);

  const [drawActive,   setDrawActive]   = useState(false);
  const [drawColor,    setDrawColor]    = useState("#ff0000");
  const [drawSize,     setDrawSize]     = useState(6);
  const [drawOpacity,  setDrawOpacity]  = useState(100);
  const [isDrawing,    setIsDrawing]    = useState(false);
  const lastDrawPt = useRef(null);

  const [shapeTool,    setShapeTool]    = useState("rect");
  const [shapeColor,   setShapeColor]   = useState("#ff0000");
  const [shapeLineWidth, setShapeLineWidth] = useState(3);
  const [shapeFill,    setShapeFill]    = useState(false);
  const [shapes,       setShapes]       = useState([]);
  const [activeShape,  setActiveShape]  = useState(null);
  const [shapeDrawing, setShapeDrawing] = useState(false);
  const shapeStart = useRef(null);

  const [compareMode,  setCompareMode]  = useState(false);
  const [splitX,       setSplitX]       = useState(50);
  const [splitDragging,setSplitDragging]= useState(false);
  const [copied,       setCopied]       = useState(false);

  const canvasRef   = useRef(null);
  const drawCanvasRef = useRef(null);
  const previewRef  = useRef(null);
  const fileRef     = useRef(null);

  // ── Load ───────────────────────────────────────────────────────────────────

  function loadFile(file) {
    if (!file||!file.type.startsWith("image/")) return;
    const r=new FileReader();
    r.onload=ev=>{ const img=new Image(); img.onload=()=>{ setOrigImg(img); initImg(img); }; img.src=ev.target.result; };
    r.readAsDataURL(file);
  }

  function initImg(img) {
    setSrcImg(img); setAdj(DEFAULT_ADJ); setFilter(null); setTonePreset(null);
    setCropRect(null); setCropMode(false); setCropAR(null);
    setShapes([]); setActiveShape(null); setCompareMode(false);
    setHistory([img.src]); setHistIdx(0);
    setResizeW(img.width); setResizeH(img.height);
    clearDrawCanvas();
  }

  function clearDrawCanvas() {
    const dc = drawCanvasRef.current;
    if (!dc) return;
    const ctx = dc.getContext("2d");
    ctx.clearRect(0, 0, dc.width, dc.height);
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
    if (adj.noise>0)         applyNoise(d,adj.noise);
    if (filter==="grayscale") applyGrayscale(d);
    if (filter==="sepia")     applySepia(d);
    if (filter==="invert")    applyInvert(d);
    ctx.putImageData(id,0,0);

    // shapes
    [...shapes, ...(activeShape?[activeShape]:[])].forEach(s=>drawShape(ctx,s));

    // text overlay
    if ((panel==="text"||panel!=="text") && textVal) {
      const style=`${textItalic?"italic ":""}${textBold?"bold ":""}${textSize}px sans-serif`;
      ctx.font=style; ctx.textAlign=textAlign;
      ctx.strokeStyle="rgba(0,0,0,0.6)"; ctx.lineWidth=3;
      ctx.fillStyle=textColor;
      const px=(textX/100)*canvas.width, py=(textY/100)*canvas.height;
      ctx.strokeText(textVal,px,py); ctx.fillText(textVal,px,py);
    }

    // sync draw canvas dimensions
    const dc=drawCanvasRef.current;
    if (dc && (dc.width!==canvas.width||dc.height!==canvas.height)) {
      const tmp=dc.getContext("2d").getImageData(0,0,dc.width,dc.height);
      dc.width=canvas.width; dc.height=canvas.height;
      dc.getContext("2d").putImageData(tmp,0,0);
    }

    setPreview(canvas.toDataURL());
  }, [srcImg,adj,filter,shapes,activeShape,textVal,textX,textY,textSize,textColor,textBold,textItalic,textAlign,panel]);

  useEffect(()=>{ renderPreview(); },[renderPreview]);

  // ── History ────────────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    setHistIdx(idx => {
      if (idx<=0) return idx;
      const ni=idx-1;
      setHistory(h => {
        const img=new Image();
        img.onload=()=>{ setSrcImg(img); setResizeW(img.width); setResizeH(img.height); };
        img.src=h[ni];
        return h;
      });
      return ni;
    });
  }, []);

  const redo = useCallback(() => {
    setHistIdx(idx => {
      setHistory(h => {
        if (idx>=h.length-1) return h;
        const ni=idx+1;
        const img=new Image();
        img.onload=()=>{ setSrcImg(img); setResizeW(img.width); setResizeH(img.height); };
        img.src=h[ni];
        setHistIdx(ni);
        return h;
      });
      return idx;
    });
  }, []);

  function pushHistory(img) {
    setHistory(h => {
      setHistIdx(i => {
        const nh=h.slice(0,i+1); nh.push(img.src);
        setHistory(nh); return nh.length-1;
      });
      return h;
    });
    setSrcImg(img); setResizeW(img.width); setResizeH(img.height);
  }

  // simpler non-closure version used internally
  function pushHistoryDirect(img, h, idx) {
    const nh=h.slice(0,idx+1); nh.push(img.src);
    setHistory(nh); setHistIdx(nh.length-1);
    setSrcImg(img); setResizeW(img.width); setResizeH(img.height);
  }

  function resetAll() {
    if (!origImg) return;
    setSrcImg(origImg); setAdj(DEFAULT_ADJ); setFilter(null); setTonePreset(null);
    setResizeW(origImg.width); setResizeH(origImg.height);
    setHistory([origImg.src]); setHistIdx(0);
    setCropRect(null); setCropMode(false); setCropAR(null);
    setShapes([]); setActiveShape(null); setCompareMode(false);
    clearDrawCanvas();
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    function handler(e) {
      const mod = e.ctrlKey||e.metaKey;
      if (mod && e.key==="z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && (e.key==="y"||(e.key==="z"&&e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key==="Escape") {
        setCropMode(false); setCropRect(null);
        setDrawActive(false);
        setEyedropperActive(false);
        setActiveShape(null); setShapeDrawing(false);
        setCompareMode(false);
      }
    }
    window.addEventListener("keydown", handler);
    return ()=>window.removeEventListener("keydown", handler);
  }, [undo, redo]);

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

  function getPosRaw(e) {
    const r=previewRef.current.getBoundingClientRect();
    return { x:(e.clientX-r.left), y:(e.clientY-r.top), pct:{ x:(e.clientX-r.left)/r.width*100, y:(e.clientY-r.top)/r.height*100 } };
  }

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

  // ── Eyedropper ─────────────────────────────────────────────────────────────

  function sampleColor(e) {
    const {sx,sy}=imgScale();
    const r=previewRef.current.getBoundingClientRect();
    const x=Math.round((e.clientX-r.left)*sx), y=Math.round((e.clientY-r.top)*sy);
    const px=canvasRef.current.getContext("2d").getImageData(x,y,1,1).data;
    setTextColor("#"+[px[0],px[1],px[2]].map(v=>v.toString(16).padStart(2,"0")).join(""));
    setEyedropperActive(false);
  }

  // ── Draw ───────────────────────────────────────────────────────────────────

  function getDrawPos(e) {
    const dc=drawCanvasRef.current, r=previewRef.current.getBoundingClientRect();
    return {
      x: Math.round((e.clientX-r.left)*(dc.width/r.width)),
      y: Math.round((e.clientY-r.top)*(dc.height/r.height)),
    };
  }

  function startDraw(e) {
    const pt=getDrawPos(e);
    lastDrawPt.current=pt;
    setIsDrawing(true);
    // draw a dot on mousedown
    const ctx=drawCanvasRef.current.getContext("2d");
    ctx.globalAlpha=drawOpacity/100;
    ctx.fillStyle=drawColor;
    ctx.beginPath(); ctx.arc(pt.x,pt.y,drawSize/2,0,Math.PI*2); ctx.fill();
  }

  function continueDraw(e) {
    if (!isDrawing||!lastDrawPt.current) return;
    const pt=getDrawPos(e);
    const ctx=drawCanvasRef.current.getContext("2d");
    ctx.globalAlpha=drawOpacity/100;
    ctx.strokeStyle=drawColor; ctx.lineWidth=drawSize; ctx.lineCap="round"; ctx.lineJoin="round";
    ctx.beginPath(); ctx.moveTo(lastDrawPt.current.x,lastDrawPt.current.y); ctx.lineTo(pt.x,pt.y); ctx.stroke();
    lastDrawPt.current=pt;
  }

  async function bakeDraw() {
    if (!srcImg) return;
    const canvas=canvasRef.current, ctx=canvas.getContext("2d");
    // re-render current state then composite draw layer
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
    if (adj.noise>0)         applyNoise(d,adj.noise);
    if (filter==="grayscale") applyGrayscale(d);
    if (filter==="sepia")     applySepia(d);
    if (filter==="invert")    applyInvert(d);
    ctx.putImageData(id,0,0);
    ctx.drawImage(drawCanvasRef.current,0,0);
    const img=await canvasToImg(canvas);
    setAdj(DEFAULT_ADJ); setFilter(null); setTonePreset(null);
    pushHistory(img);
    clearDrawCanvas();
  }

  // ── Shapes ─────────────────────────────────────────────────────────────────

  async function bakeShapes() {
    if (!srcImg||shapes.length===0) return;
    const img=await canvasToImg(canvasRef.current);
    pushHistory(img);
    setShapes([]); setActiveShape(null);
  }

  // ── Compare ────────────────────────────────────────────────────────────────

  function onSplitDragStart(e) { e.preventDefault(); e.stopPropagation(); setSplitDragging(true); }

  // ── Download / Copy ────────────────────────────────────────────────────────

  function download(fmt) {
    if (!preview) return;
    const canvas=canvasRef.current;
    const mime=fmt==="jpg"?"image/jpeg":fmt==="webp"?"image/webp":"image/png";
    const a=document.createElement("a"); a.download=`edited.${fmt}`; a.href=canvas.toDataURL(mime,0.92); a.click();
  }

  function copyToClipboard() {
    if (!preview) return;
    canvasRef.current.toBlob(blob=>{
      navigator.clipboard.write([new ClipboardItem({"image/png":blob})]).then(()=>{
        setCopied(true); setTimeout(()=>setCopied(false),2000);
      });
    });
  }

  // ── Tone preset ────────────────────────────────────────────────────────────

  function applyTonePreset(tp) {
    if (!tp) { setAdj(DEFAULT_ADJ); setTonePreset(null); return; }
    const preset=TONE_PRESETS.find(t=>t.id===tp);
    if (!preset) return;
    setAdj({...DEFAULT_ADJ,...preset.adj});
    setTonePreset(tp);
  }

  // ── Unified mouse handler ──────────────────────────────────────────────────

  function onMouseDown(e) {
    if (!previewRef.current) return;
    e.preventDefault();

    if (splitDragging) return; // handled by split handle

    if (compareMode) return;

    if (eyedropperActive) { sampleColor(e); return; }

    if (cropMode) {
      const p=getPos(e); setCropStart(p); setCropRect(null); setDragging(true); return;
    }

    if (panel==="draw" && drawActive) { startDraw(e); return; }

    if (panel==="shapes") {
      const p=getPos(e); shapeStart.current=p; setShapeDrawing(true);
      setActiveShape({type:shapeTool,x1:p.x,y1:p.y,x2:p.x,y2:p.y,color:shapeColor,lineWidth:shapeLineWidth,fill:shapeFill});
      return;
    }

    if (panel==="text") { setTextDragging(true); const raw=getPosRaw(e); setTextX(Math.round(Math.min(100,Math.max(0,raw.pct.x)))); setTextY(Math.round(Math.min(100,Math.max(0,raw.pct.y)))); return; }
  }

  function onMouseMove(e) {
    e.preventDefault();

    if (splitDragging && previewRef.current) {
      const r=previewRef.current.getBoundingClientRect();
      setSplitX(Math.min(100,Math.max(0,(e.clientX-r.left)/r.width*100)));
      return;
    }

    if (dragging && cropStart && previewRef.current) {
      const p=getPos(e);
      let w=Math.abs(p.x-cropStart.x), h=Math.abs(p.y-cropStart.y);
      if (cropAR) { h=Math.round(w/cropAR); }
      setCropRect({ x:Math.min(cropStart.x,p.x), y:Math.min(cropStart.y,p.y), w, h });
      return;
    }

    if (panel==="draw" && drawActive && isDrawing) { continueDraw(e); return; }

    if (panel==="shapes" && shapeDrawing && shapeStart.current) {
      const p=getPos(e);
      setActiveShape(s=>s?{...s,x2:p.x,y2:p.y}:null);
      return;
    }

    if (panel==="text" && textDragging && previewRef.current) {
      const raw=getPosRaw(e);
      setTextX(Math.round(Math.min(100,Math.max(0,raw.pct.x))));
      setTextY(Math.round(Math.min(100,Math.max(0,raw.pct.y))));
      return;
    }
  }

  function onMouseUp(e) {
    if (splitDragging) { setSplitDragging(false); return; }
    setDragging(false);
    setIsDrawing(false); lastDrawPt.current=null;
    setTextDragging(false);
    if (shapeDrawing && activeShape && (Math.abs(activeShape.x2-activeShape.x1)>2||Math.abs(activeShape.y2-activeShape.y1)>2)) {
      setShapes(s=>[...s,activeShape]);
    }
    setShapeDrawing(false); setActiveShape(null); shapeStart.current=null;
  }

  // ── Switch panel ───────────────────────────────────────────────────────────

  function switchPanel(id) {
    setPanel(id);
    if (id!=="crop")   { setCropMode(false); setCropRect(null); }
    if (id!=="draw")   { setDrawActive(false); }
    if (id!=="shapes") { setActiveShape(null); }
    setEyedropperActive(false);
    setCompareMode(false);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const previewCursor = eyedropperActive ? "crosshair"
    : (panel==="draw"&&drawActive) ? "crosshair"
    : (panel==="text") ? "move"
    : cropMode ? "crosshair"
    : "default";

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
            <button
              className={`ie-btn${compareMode?" ie-btn--accent":""}`}
              onClick={()=>setCompareMode(v=>!v)}
              title="Before / After (Escape to close)"
            >⊞ Compare</button>
          </>}
        </div>
        <div className="ie-topbar-info">
          {srcImg && <span className="ie-dim">{srcImg.width} × {srcImg.height} px</span>}
        </div>
        <div className="ie-topbar-group">
          {srcImg && <>
            <button className="ie-btn" onClick={copyToClipboard}>{copied?"Copied!":"⎘ Copy"}</button>
            <button className="ie-btn" onClick={()=>download("png")}>↓ PNG</button>
            <button className="ie-btn" onClick={()=>download("jpg")}>↓ JPG</button>
            <button className="ie-btn" onClick={()=>download("webp")}>↓ WEBP</button>
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
                  <p className="ie-section-label">Color effects</p>
                  <div className="ie-filter-grid">
                    {PRESETS.map(f=>(
                      <button
                        key={f.id??"none"}
                        className={`ie-filter-btn${filter===f.id?" ie-filter-btn--active":""}`}
                        onClick={()=>setFilter(f.id)}
                      >{f.label}</button>
                    ))}
                  </div>
                  <p className="ie-section-label" style={{marginTop:"1rem"}}>Tone presets</p>
                  <p className="ie-note">Adjusts sliders automatically.</p>
                  <div className="ie-filter-grid">
                    <button
                      className={`ie-filter-btn${tonePreset===null?" ie-filter-btn--active":""}`}
                      onClick={()=>applyTonePreset(null)}
                    >None</button>
                    {TONE_PRESETS.map(t=>(
                      <button
                        key={t.id}
                        className={`ie-filter-btn${tonePreset===t.id?" ie-filter-btn--active":""}`}
                        onClick={()=>applyTonePreset(t.id)}
                      >{t.label}</button>
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
                  <p className="ie-section-label">Aspect ratio</p>
                  <div className="ie-filter-grid">
                    {CROP_RATIOS.map(cr=>(
                      <button
                        key={cr.id??"free"}
                        className={`ie-filter-btn${cropAR===cr.r?" ie-filter-btn--active":""}`}
                        onClick={()=>setCropAR(cr.r)}
                      >{cr.label}</button>
                    ))}
                  </div>
                  <p className="ie-note" style={{marginTop:"0.75rem"}}>{cropMode?"Draw a selection on the image, then apply.":"Enable crop mode, then drag on the image."}</p>
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
                  <p className="ie-note">Click or drag on the image to position.</p>
                  <div className="ie-field-row">
                    <div className="ie-field">
                      <label className="ie-label">X: {textX}%</label>
                    </div>
                    <div className="ie-field">
                      <label className="ie-label">Y: {textY}%</label>
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
                      <div style={{display:"flex",gap:"4px",alignItems:"center"}}>
                        <input type="color" value={textColor} onChange={e=>setTextColor(e.target.value)}
                          style={{flex:1,height:"34px",borderRadius:"var(--tk-radius)",border:"1px solid var(--tk-border)",background:"none",cursor:"pointer"}} />
                        <button
                          className={`ie-btn${eyedropperActive?" ie-btn--accent":""}`}
                          style={{padding:"0 8px",height:"34px",fontSize:"18px"}}
                          title="Pick color from image"
                          onClick={()=>setEyedropperActive(v=>!v)}
                        >✎</button>
                      </div>
                    </div>
                    <div className="ie-field">
                      <label className="ie-label">Align</label>
                      <select className="ie-input" value={textAlign} onChange={e=>setTextAlign(e.target.value)}>
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>
                  <div className="ie-field-row" style={{marginTop:"0.25rem"}}>
                    <label className="ie-checkbox">
                      <input type="checkbox" checked={textBold} onChange={e=>setTextBold(e.target.checked)} />
                      <span>Bold</span>
                    </label>
                    <label className="ie-checkbox">
                      <input type="checkbox" checked={textItalic} onChange={e=>setTextItalic(e.target.checked)} />
                      <span>Italic</span>
                    </label>
                  </div>
                  <button className="ie-btn ie-btn--accent ie-btn--full" style={{marginTop:"0.75rem"}} onClick={bakeText} disabled={!textVal}>
                    Bake text into image
                  </button>
                  <p className="ie-note">Preview updates live. "Bake" makes it permanent.</p>
                </div>
              )}

              {panel==="draw" && (
                <div className="ie-section">
                  <div className="ie-field-row">
                    <div className="ie-field">
                      <label className="ie-label">Color</label>
                      <input type="color" value={drawColor} onChange={e=>setDrawColor(e.target.value)}
                        style={{width:"100%",height:"34px",borderRadius:"var(--tk-radius)",border:"1px solid var(--tk-border)",background:"none",cursor:"pointer"}} />
                    </div>
                  </div>
                  <div className="ie-slider-row">
                    <div className="ie-slider-meta">
                      <span className="ie-slider-label">Brush size</span>
                      <span className="ie-slider-val">{drawSize}px</span>
                    </div>
                    <input type="range" className="ie-range" min="1" max="60" value={drawSize} onChange={e=>setDrawSize(Number(e.target.value))} />
                  </div>
                  <div className="ie-slider-row">
                    <div className="ie-slider-meta">
                      <span className="ie-slider-label">Opacity</span>
                      <span className="ie-slider-val">{drawOpacity}%</span>
                    </div>
                    <input type="range" className="ie-range" min="1" max="100" value={drawOpacity} onChange={e=>setDrawOpacity(Number(e.target.value))} />
                  </div>
                  <button
                    className={`ie-btn ie-btn--full${drawActive?" ie-btn--accent":""}`}
                    style={{marginTop:"0.5rem"}}
                    onClick={()=>setDrawActive(v=>!v)}
                  >{drawActive?"Stop Drawing":"Start Drawing"}</button>
                  <div className="ie-btn-row" style={{marginTop:"0.5rem"}}>
                    <button className="ie-btn ie-btn--full" onClick={clearDrawCanvas}>Clear</button>
                    <button className="ie-btn ie-btn--accent ie-btn--full" onClick={bakeDraw}>Bake</button>
                  </div>
                  <p className="ie-note">Draw freely on the image. "Bake" makes it permanent.</p>
                </div>
              )}

              {panel==="shapes" && (
                <div className="ie-section">
                  <p className="ie-section-label">Shape</p>
                  <div className="ie-filter-grid">
                    {["rect","circle","line","arrow"].map(t=>(
                      <button key={t} className={`ie-filter-btn${shapeTool===t?" ie-filter-btn--active":""}`} onClick={()=>setShapeTool(t)}>
                        {t==="rect"?"Rect":t==="circle"?"Ellipse":t==="line"?"Line":"Arrow"}
                      </button>
                    ))}
                  </div>
                  <div className="ie-field-row" style={{marginTop:"0.75rem"}}>
                    <div className="ie-field">
                      <label className="ie-label">Color</label>
                      <input type="color" value={shapeColor} onChange={e=>setShapeColor(e.target.value)}
                        style={{width:"100%",height:"34px",borderRadius:"var(--tk-radius)",border:"1px solid var(--tk-border)",background:"none",cursor:"pointer"}} />
                    </div>
                  </div>
                  <div className="ie-slider-row">
                    <div className="ie-slider-meta">
                      <span className="ie-slider-label">Stroke</span>
                      <span className="ie-slider-val">{shapeLineWidth}px</span>
                    </div>
                    <input type="range" className="ie-range" min="1" max="20" value={shapeLineWidth} onChange={e=>setShapeLineWidth(Number(e.target.value))} />
                  </div>
                  {(shapeTool==="rect"||shapeTool==="circle") && (
                    <label className="ie-checkbox" style={{marginTop:"0.25rem"}}>
                      <input type="checkbox" checked={shapeFill} onChange={e=>setShapeFill(e.target.checked)} />
                      <span>Fill</span>
                    </label>
                  )}
                  <p className="ie-note" style={{marginTop:"0.6rem"}}>Drag on the image to draw. {shapes.length} shape{shapes.length!==1?"s":""} pending.</p>
                  <div className="ie-btn-row">
                    <button className="ie-btn ie-btn--full" onClick={()=>setShapes([])} disabled={shapes.length===0}>Clear</button>
                    <button className="ie-btn ie-btn--accent ie-btn--full" onClick={bakeShapes} disabled={shapes.length===0}>Bake</button>
                  </div>
                </div>
              )}

            </div>
          </aside>

          {/* Canvas area */}
          <div className="ie-canvas-wrap">
            <div
              className={`ie-preview-shell${cropMode?" ie-preview-shell--crop":""}`}
              style={{cursor:previewCursor, position:"relative", userSelect:"none"}}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              {compareMode && origImg ? (
                <>
                  {/* Before/After split view */}
                  <img
                    ref={previewRef}
                    src={origImg.src}
                    alt="Original"
                    className="ie-preview-img"
                    draggable={false}
                    style={{clipPath:`inset(0 ${100-splitX}% 0 0)`}}
                  />
                  <img
                    src={preview}
                    alt="Edited"
                    className="ie-preview-img"
                    draggable={false}
                    style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",clipPath:`inset(0 0 0 ${splitX}%)`}}
                  />
                  {/* Divider handle */}
                  <div
                    style={{
                      position:"absolute", top:0, left:`${splitX}%`, transform:"translateX(-50%)",
                      width:"3px", height:"100%", background:"white", cursor:"ew-resize",
                      boxShadow:"0 0 4px rgba(0,0,0,0.5)", zIndex:10,
                    }}
                    onMouseDown={onSplitDragStart}
                  >
                    <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"24px",height:"24px",borderRadius:"50%",background:"white",boxShadow:"0 1px 4px rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",color:"#555",fontSize:"12px",fontWeight:"bold",pointerEvents:"none"}}>⇔</div>
                  </div>
                  <div style={{position:"absolute",top:"8px",left:"8px",background:"rgba(0,0,0,0.5)",color:"#fff",fontSize:"11px",padding:"2px 6px",borderRadius:"4px",pointerEvents:"none"}}>Before</div>
                  <div style={{position:"absolute",top:"8px",right:"8px",background:"rgba(0,0,0,0.5)",color:"#fff",fontSize:"11px",padding:"2px 6px",borderRadius:"4px",pointerEvents:"none"}}>After</div>
                </>
              ) : (
                <>
                  {preview && (
                    <img ref={previewRef} src={preview} alt="Preview" className="ie-preview-img" draggable={false} />
                  )}
                  {/* Draw overlay canvas */}
                  {srcImg && (
                    <canvas
                      ref={drawCanvasRef}
                      width={srcImg.width}
                      height={srcImg.height}
                      style={{
                        position:"absolute", top:0, left:0, width:"100%", height:"100%",
                        pointerEvents: (panel==="draw"&&drawActive) ? "auto" : "none",
                        opacity: 1,
                      }}
                    />
                  )}
                  {/* Text position indicator */}
                  {panel==="text" && textVal && (
                    <div style={{
                      position:"absolute",
                      left:`${textX}%`, top:`${textY}%`,
                      transform:"translate(-50%,-50%)",
                      width:"12px", height:"12px",
                      border:"2px solid white",
                      borderRadius:"50%",
                      boxShadow:"0 0 0 1px rgba(0,0,0,0.6)",
                      pointerEvents:"none",
                      zIndex:5,
                    }} />
                  )}
                  {cropMode&&cropRect&&<div className="ie-crop-sel" style={cropOverlayStyle()} />}
                </>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export default ImageEditorTool;
