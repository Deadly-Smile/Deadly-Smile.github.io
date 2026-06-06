import { FFmpegProvider } from "../../../context/FFmpegContext";
import { VideoEditorInner } from "./components/VideoEditorInner";

export default function VideoEditorTool() {
  return (
    <FFmpegProvider>
      <VideoEditorInner />
    </FFmpegProvider>
  );
}
