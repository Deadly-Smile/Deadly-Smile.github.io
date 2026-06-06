import { clamp } from "./format";

export function buildFFmpegCommand(editState, exportPreset) {
  const { trim, audio, audioLayers, filters, textLayers, meta, filterRange } = editState;
  const inPoint  = trim?.in  ?? 0;
  const outPoint = trim?.out ?? meta?.duration ?? 0;
  const dur      = outPoint - inPoint;

  const hasAudioLayers = audioLayers.length > 0;

  // ── Input args ──────────────────────────────────────────────────────────
  // -ss before -i = fast seek (input seek). Use only when trim is set.
  const inputArgs = [];
  if (trim) inputArgs.push("-ss", String(inPoint));
  inputArgs.push("-i", "input.mp4");
  // Audio layer inputs — NOT seeked; they are trimmed via atrim in the filter graph
  audioLayers.forEach((_, i) => inputArgs.push("-i", `audio_${i}.mp3`));

  // -t goes right after the last input, before any filter/codec args.
  // This is the safest position for trimming output duration.
  const trimOut = trim ? ["-t", String(Math.max(0.1, dur))] : [];

  // Look-range enable expression (relative to trimmed output timeline)
  const lookEnable = filterRange
    ? `:enable='between(t,${Math.max(0, (filterRange.start ?? 0) - inPoint).toFixed(3)},${Math.max(0, (filterRange.end ?? 0) - inPoint).toFixed(3)})'`
    : "";

  // ── Video filter chain ──────────────────────────────────────────────────
  const videoFilterParts = [];
  if (filters.speed !== 1) {
    const spd = clamp(filters.speed, 0.5, 2.0);
    videoFilterParts.push(`setpts=${(1 / spd).toFixed(4)}*PTS`);
  }
  if (filters.brightness !== 0 || filters.contrast !== 1 || filters.saturation !== 1) {
    videoFilterParts.push(
      `eq=brightness=${filters.brightness.toFixed(3)}:contrast=${filters.contrast.toFixed(3)}:saturation=${filters.saturation.toFixed(3)}${lookEnable}`
    );
  }
  textLayers.forEach(layer => {
    const safe = layer.text
      .replace(/\\/g, "\\\\")
      .replace(/'/g,  "\\'")
      .replace(/:/g,  "\\:");
    const x = Math.round((layer.xPct / 100) * (meta?.width  ?? 1280));
    const y = Math.round((layer.yPct / 100) * (meta?.height ?? 720));
    videoFilterParts.push(
      `drawtext=fontsize=${layer.size}:text='${safe}':fontcolor=${layer.color}:x=${x}:y=${y}:enable='between(t,${layer.startTime},${layer.endTime})'`
    );
  });

  const videoChainFor = (preset) => {
    const parts = preset === "social"
      ? ["scale=1280:720:force_original_aspect_ratio=decrease", ...videoFilterParts]
      : [...videoFilterParts];
    return parts.join(",");
  };

  // ── Base audio filters (original track) ────────────────────────────────
  const baseAudioFilters = [];
  if (filters.speed !== 1) baseAudioFilters.push(`atempo=${clamp(filters.speed, 0.5, 2.0)}`);
  if (audio.volume !== 1.0) baseAudioFilters.push(`volume=${audio.volume.toFixed(2)}`);

  // ── Audio mix graph ─────────────────────────────────────────────────────
  let useMix = hasAudioLayers;
  const audioComplexParts = [];
  let audioMap = null;

  if (useMix) {
    const streams = [];

    if (!audio.muted) {
      if (baseAudioFilters.length) {
        audioComplexParts.push(`[0:a]${baseAudioFilters.join(",")}[a_orig]`);
        streams.push("[a_orig]");
      } else {
        streams.push("[0:a]");
      }
    }

    audioLayers.forEach((layer, i) => {
      const idx = i + 1;
      const vol = clamp(layer.volume ?? 1.0, 0, 8).toFixed(2);
      const d   = Math.round(layer.startTime * 1000);
      const clip = Math.max(0, layer.clipStart ?? 0);
      const windowLen = Math.max(0, (layer.endTime ?? 0) - (layer.startTime ?? 0));
      const seg = windowLen > 0
        ? `atrim=start=${clip.toFixed(3)}:end=${(clip + windowLen).toFixed(3)},asetpts=PTS-STARTPTS,`
        : clip > 0
          ? `atrim=start=${clip.toFixed(3)},asetpts=PTS-STARTPTS,`
          : "";
      audioComplexParts.push(`[${idx}:a]${seg}adelay=${d}|${d},volume=${vol}[a_ext${i}]`);
      streams.push(`[a_ext${i}]`);
    });

    if (streams.length === 0) {
      useMix = false;
    } else if (streams.length === 1) {
      audioComplexParts.push(`${streams[0]}anull[aout]`);
      audioMap = "[aout]";
    } else {
      audioComplexParts.push(
        `${streams.join("")}amix=inputs=${streams.length}:duration=first:normalize=0[aout]`
      );
      audioMap = "[aout]";
    }
  }

  // ── Presets ─────────────────────────────────────────────────────────────
  switch (exportPreset) {
    case "copy":
    case "web":
    case "social": {
      const vChain   = videoChainFor(exportPreset);
      const reencode = exportPreset !== "copy" || videoFilterParts.length > 0 || useMix;
      const vcodec   = reencode
        ? [
            "-c:v", "libx264",
            "-crf", exportPreset === "social" ? "25" : "23",
            "-preset", exportPreset === "social" ? "fast" : "medium",
            ...(exportPreset === "web" ? ["-movflags", "+faststart"] : []),
          ]
        : ["-c", "copy"];

      // Args order: inputs → -t → filter/codec → maps → output
      // -t MUST come before codec flags and after all inputs.
      const args = [...inputArgs, ...trimOut];

      if (useMix) {
        const complexParts = [];
        let vMap = "0:v";
        if (vChain) {
          complexParts.push(`[0:v]${vChain}[vout]`);
          vMap = "[vout]";
        }
        complexParts.push(...audioComplexParts);
        args.push(
          "-filter_complex", complexParts.join(";"),
          ...vcodec,
          "-map", vMap,
          "-map", audioMap,
          "-c:a", "aac", "-b:a", "128k",
          // Explicitly allow output to be longer than the shortest stream.
          // Without this, amix can silently truncate or produce 0-byte output.
          "-shortest",
          "output.mp4"
        );
      } else if (audio.muted) {
        if (vChain) args.push("-vf", vChain);
        args.push(...vcodec, "-an", "output.mp4");
      } else {
        if (vChain) args.push("-vf", vChain);
        args.push(
          ...vcodec,
          ...(baseAudioFilters.length ? ["-af", baseAudioFilters.join(",")] : []),
          "-c:a", "aac", "-b:a", "128k",
          "output.mp4"
        );
      }

      return { args, output: "output.mp4" };
    }

    case "gif": {
      const gifDur = Math.min(10, dur || 10);
      return {
        pass1: [
          "-ss", String(inPoint), "-i", "input.mp4",
          "-t", String(gifDur),
          "-vf", "fps=12,scale=480:-1:flags=lanczos,palettegen",
          "palette.png",
        ],
        pass2: [
          "-ss", String(inPoint), "-i", "input.mp4",
          "-i", "palette.png",
          "-t", String(gifDur),
          "-filter_complex", "fps=12,scale=480:-1:flags=lanczos[v];[v][1:v]paletteuse",
          "output.gif",
        ],
        output: "output.gif",
      };
    }

    case "audio": {
      const args = [
        ...inputArgs, ...trimOut,
        "-vn", "-c:a", "libmp3lame", "-q:a", "2",
        "output.mp3",
      ];
      return { args, output: "output.mp3" };
    }

    default: {
      const args = [...inputArgs, ...trimOut, "-c", "copy", "output.mp4"];
      return { args, output: "output.mp4" };
    }
  }
}