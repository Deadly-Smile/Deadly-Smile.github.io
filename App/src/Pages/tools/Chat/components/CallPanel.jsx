import {
  FaPhone, FaPhoneSlash, FaVideo, FaVideoSlash,
  FaMicrophone, FaMicrophoneSlash, FaDesktop,
} from "react-icons/fa";
import { s } from "../styles";

const canScreenShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

// Rendered above whichever conversation is open — a call belongs to one peer
// but stays visible (and its media elements mounted) while browsing others.
export function CallPanel({ call, peerLabel }) {
  const { callState, callType, isMuted, isCameraOff, isScreenSharing, isRemoteScreenSharing, refs } = call;

  if (callState === "incoming") return (
    <div style={s.callBanner}>
      <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
        {callType === "video" ? <FaVideo /> : <FaPhone />} Incoming {callType} call from <b>{peerLabel}</b>…
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={s.btnPrimary} onClick={call.acceptCall}><FaPhone size={13} /> Accept</button>
        <button style={s.btnDanger} onClick={call.declineCall}><FaPhoneSlash size={13} /> Decline</button>
      </div>
    </div>
  );

  if (callState !== "outgoing" && callState !== "active") return null;

  return (
    <div style={s.callPanel}>
      <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--tk-text-dim)" }}>
        {callState === "outgoing" ? `Calling ${peerLabel}…` : `In call with ${peerLabel}`}
      </p>
      {callType === "video" && (
        <div style={s.videoStage}>
          {/* Both remote elements stay mounted for the whole call so their refs
              exist the instant a "stream" event fires — only their visibility
              toggles with whether the peer is currently sharing their screen. */}
          <video ref={refs.remoteScreenVideoRef} autoPlay playsInline style={{ ...s.remoteVideo, display: isRemoteScreenSharing ? "block" : "none" }} />
          <video ref={refs.remoteVideoRef} autoPlay playsInline style={{ ...s.remoteVideo, display: isRemoteScreenSharing ? "none" : "block" }} />
          <video ref={refs.localVideoRef} autoPlay playsInline muted style={s.localVideo} />
          <video ref={refs.localScreenVideoRef} autoPlay playsInline muted style={{ ...s.localVideo, ...s.localScreenThumb, display: isScreenSharing ? "block" : "none" }} />
        </div>
      )}
      {callType === "audio" && (
        <>
          {/* Not rendered visually — carries the remote audio track. Mounted for
              the whole outgoing→active lifecycle so the ref exists the moment
              the "stream" event actually arrives. */}
          <audio ref={refs.remoteVideoRef} autoPlay style={{ display: "none" }} />
          {callState === "active" && <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--tk-text)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><FaPhone size={12} /> Voice call connected</p>}
        </>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
        <button style={s.iconBtn} title={isMuted ? "Unmute" : "Mute"} onClick={call.toggleMute}>
          {isMuted ? <FaMicrophoneSlash size={14} /> : <FaMicrophone size={14} />}
        </button>
        {callType === "video" && (
          <button style={s.iconBtn} title={isCameraOff ? "Turn camera on" : "Turn camera off"} onClick={call.toggleCamera}>
            {isCameraOff ? <FaVideoSlash size={14} /> : <FaVideo size={14} />}
          </button>
        )}
        {callType === "video" && canScreenShare && (
          <button
            style={{ ...s.iconBtn, ...(isScreenSharing ? s.iconBtnActive : null) }}
            title={isScreenSharing ? "Stop sharing your screen" : "Share your screen"}
            onClick={isScreenSharing ? call.stopScreenShare : call.startScreenShare}
          >
            <FaDesktop size={14} />
          </button>
        )}
        <button style={s.btnDanger} onClick={call.endCall}><FaPhoneSlash size={13} /> Hang up</button>
      </div>
    </div>
  );
}
