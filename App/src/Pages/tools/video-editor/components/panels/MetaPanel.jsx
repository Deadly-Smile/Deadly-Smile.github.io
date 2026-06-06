import { formatTime, formatSize } from "../../utils/format";

export function MetaPanel({ meta, file }) {
  if (!meta) return <p style={{ fontSize: 12, color: "var(--ve-text3)" }}>No file loaded.</p>;
  return (
    <div>
      <div className="ve-section-title">File Info</div>
      <div className="ve-meta-grid">
        {[["Filename", file?.name ?? "—"], ["Size", formatSize(file?.size)], ["Duration", formatTime(meta.duration, true)],
          ["Resolution", meta.width && meta.height ? `${meta.width}×${meta.height}` : "—"], ["FPS", meta.fps ? `${meta.fps} fps` : "—"],
          ["Codec", meta.videoCodec ?? "—"], ["Audio", meta.audioChannels > 0 ? `${meta.audioChannels}ch` : "None"],
          ["Bitrate", meta.bitrate ? `${(meta.bitrate / 1000).toFixed(0)} kbps` : "—"]
        ].map(([k, v]) => (
          <div className="ve-meta-item" key={k}><div className="ve-meta-key">{k}</div><div className="ve-meta-val">{v}</div></div>
        ))}
      </div>
    </div>
  );
}
