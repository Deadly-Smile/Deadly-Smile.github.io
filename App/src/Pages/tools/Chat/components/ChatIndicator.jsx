import { FaPhoneSlash } from "react-icons/fa";
import { BackgroundDock } from "../../../../Utils/KeepAlive";
import { ind } from "../styles";

// Shown in the KeepAlive dock while the user is on another page: online
// status, unread count, call state, and a way back or fully offline.
export function ChatIndicator({ onlineCount, unread, callState, callType, callPeerLabel, onOpen, onHangUp, onLeave }) {
  const inCall = callState === "outgoing" || callState === "active";
  const ringing = callState === "incoming";
  const label = ringing ? `${callPeerLabel} is calling — tap to answer`
    : inCall ? `On ${callType} call · ${callPeerLabel}`
    : `Chat · ${onlineCount} online`;
  return (
    <BackgroundDock>
      <div style={{ ...ind.bar, ...(ringing ? ind.barRinging : null) }} role="region" aria-label="P2P Chat">
        <button type="button" style={ind.title} onClick={onOpen} title="Open P2P Chat">
          <span aria-hidden="true">{ringing || inCall ? (callType === "video" ? "📹" : "📞") : "💬"}</span>
          <span style={ind.titleText}>{label}</span>
          {unread > 0 && <span style={ind.badge}>{unread > 99 ? "99+" : unread}</span>}
        </button>
        {(ringing || inCall) && (
          <button type="button" style={{ ...ind.btn, color: "#ff3366" }} onClick={onHangUp} title={ringing ? "Decline" : "Hang up"}>
            <FaPhoneSlash size={12} />
          </button>
        )}
        <button type="button" style={ind.btn} onClick={onLeave} title="Go offline (close chat)">✕</button>
      </div>
    </BackgroundDock>
  );
}
