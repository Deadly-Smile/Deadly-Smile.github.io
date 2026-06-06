export const PRESET_FILTERS = {
  bw:      { label: "B&W",     css: "grayscale(1)",                                brightness: 0,    contrast: 1.1, saturation: 0    },
  vintage: { label: "Vintage", css: "sepia(0.6) contrast(1.1) brightness(1.05)",   brightness: 0.05, contrast: 1.1, saturation: 0.6  },
  fade:    { label: "Fade",    css: "opacity(0.85) brightness(1.1) saturate(0.75)",brightness: 0.1,  contrast: 0.9, saturation: 0.75 },
  punch:   { label: "Punch",   css: "contrast(1.3) saturate(1.5) brightness(1.05)",brightness: 0.05, contrast: 1.3, saturation: 1.5  },
};

export const EXPORT_PRESETS = [
  { id: "copy",   name: "Original Quality",  desc: "Stream copy — fast, lossless" },
  { id: "web",    name: "Web Optimised",      desc: "H.264 + AAC, CRF 23, faststart" },
  { id: "social", name: "Social / Twitter",   desc: "720p H.264, under 140 MB" },
  { id: "gif",    name: "Animated GIF",       desc: "First 10s, palette-optimised" },
  { id: "audio",  name: "Audio Only",         desc: "Extract to MP3" },
];

export const TABS = [
  { id: "meta",     label: "Info"     },
  { id: "trim",     label: "Trim"     },
  { id: "audio",    label: "Audio"    },
  { id: "filters",  label: "Look"     },
  { id: "text",     label: "Text"     },
  { id: "snapshot", label: "Snapshot" },
  { id: "export",   label: "Export"   },
];
