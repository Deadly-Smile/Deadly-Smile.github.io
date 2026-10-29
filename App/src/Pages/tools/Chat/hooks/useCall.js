import { useState, useEffect, useRef, useCallback } from "react";
import { macFromPeerId } from "../identity";

// Audio/video/screen-share calls with one peer at a time. Layers a PeerJS
// MediaConnection on top of the device's existing Peer instance/ICE config —
// no extra signaling needed. The callee always sees an incoming-call prompt
// first; `call.answer()` only ever runs after they explicitly accept, and
// calls are only accepted from peers whose data link passed the handshake.
export function useCall({ peerRef, getConn, isTrusted, onError }) {
  const [callState, setCallState] = useState("idle"); // idle | outgoing | incoming | active
  const [callType, setCallType] = useState("audio");  // audio | video
  const [callPeer, setCallPeer] = useState(null);     // mac
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);

  const callStateRef = useRef(callState);
  callStateRef.current = callState;
  const callPeerRef = useRef(callPeer);
  callPeerRef.current = callPeer;

  const callRef = useRef(null);           // active PeerJS MediaConnection
  const incomingCallRef = useRef(null);   // MediaConnection awaiting accept/decline
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);        // local camera preview
  const localScreenVideoRef = useRef(null);  // local outgoing-screen preview
  const remoteVideoRef = useRef(null);       // remote camera (or the lone <audio> for voice calls)
  const remoteScreenVideoRef = useRef(null); // remote peer's shared screen, if any
  const screenShareRef = useRef(null);       // { screenStream, screenTrack, sender } while sharing
  // A call's first "stream" event is always the camera/mic; PeerJS fires one
  // "stream" event per remote MediaStream, so a second one occurring later in
  // the same call can only be a screen share added via addTrack afterwards —
  // no need to correlate stream ids across the data channel to tell them apart.
  const primaryStreamReceivedRef = useRef(false);

  const endCall = useCallback(() => {
    callRef.current?.close();
    incomingCallRef.current?.close();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenShareRef.current?.screenTrack.stop();
    callRef.current = null;
    incomingCallRef.current = null;
    localStreamRef.current = null;
    screenShareRef.current = null;
    primaryStreamReceivedRef.current = false;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (localScreenVideoRef.current) localScreenVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteScreenVideoRef.current) remoteScreenVideoRef.current.srcObject = null;
    setCallState("idle");
    setCallPeer(null);
    setIsMuted(false); setIsCameraOff(false); setIsScreenSharing(false); setIsRemoteScreenSharing(false);
  }, []);

  // Runs after the call panel's DOM actually mounts/changes — assigns the
  // local preview from the ref (not state) since getUserMedia is fetched
  // imperatively in startCall/acceptCall, not stored as render state.
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
  }, [callState, callType]);

  const wireCall = useCallback((call) => {
    callRef.current = call;
    primaryStreamReceivedRef.current = false;
    call.on("stream", (remoteStream) => {
      if (!primaryStreamReceivedRef.current) {
        primaryStreamReceivedRef.current = true;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        setCallState("active");
      } else if (remoteScreenVideoRef.current) {
        remoteScreenVideoRef.current.srcObject = remoteStream;
      }
    });
    call.on("close", endCall);
    call.on("error", endCall);
  }, [endCall]);

  // Wired to peer.on("call") by Chat.jsx.
  const handleIncomingCall = useCallback((call) => {
    const mac = macFromPeerId(call.peer);
    if (!mac || !isTrusted(mac) || callStateRef.current !== "idle") { call.close(); return; }
    incomingCallRef.current = call;
    setCallPeer(mac);
    setCallType(call.metadata?.video ? "video" : "audio");
    setCallState("incoming");
  }, [isTrusted]);

  const handleCallMeta = useCallback((mac, data) => {
    if (mac !== callPeerRef.current) return;
    setIsRemoteScreenSharing(!!data.sharingScreen);
    if (!data.sharingScreen && remoteScreenVideoRef.current) remoteScreenVideoRef.current.srcObject = null;
  }, []);

  // The data link to the call's peer dropped — the call can't be controlled anymore.
  const handleLinkClosed = useCallback((mac) => {
    if (mac === callPeerRef.current) endCall();
  }, [endCall]);

  // Local <video>/<audio> preview is wired via the effect above rather than
  // right here — at this exact line the call panel (which the preview
  // element lives in) hasn't necessarily mounted yet, so the ref can still
  // be null the instant the stream arrives.
  const startCall = async (mac, video) => {
    const conn = getConn(mac);
    if (!conn || callStateRef.current !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      localStreamRef.current = stream;
      setCallPeer(mac);
      setCallType(video ? "video" : "audio");
      setCallState("outgoing");
      wireCall(peerRef.current.call(conn.peer, stream, { metadata: { video } }));
    } catch (e) {
      onError("Could not access camera/microphone: " + e.message);
    }
  };

  const acceptCall = async () => {
    const call = incomingCallRef.current;
    if (!call) return;
    try {
      const video = callType === "video";
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      localStreamRef.current = stream;
      incomingCallRef.current = null;
      setCallState("outgoing"); // "connecting" in spirit — mounts the call panel before the remote stream can arrive
      call.answer(stream);
      wireCall(call);
    } catch (e) {
      onError("Could not access camera/microphone: " + e.message);
      endCall();
    }
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  };

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsCameraOff(!track.enabled);
  };

  const stopScreenShare = () => {
    const shared = screenShareRef.current;
    if (!shared) return;
    if (shared.sender) callRef.current?.peerConnection?.removeTrack(shared.sender);
    shared.screenTrack.stop();
    screenShareRef.current = null;
    if (localScreenVideoRef.current) localScreenVideoRef.current.srcObject = null;
    getConn(callPeerRef.current)?.send({ type: "call-meta", sharingScreen: false });
    setIsScreenSharing(false);
  };

  // Adds the screen as a *second* outgoing video track (RTCPeerConnection.
  // addTrack) rather than replacing the camera track — so both keep flowing
  // at once. Adding a track fires the underlying peerConnection's
  // negotiationneeded event, which PeerJS's MediaConnection already listens
  // for and renegotiates automatically, same as setting up the call itself.
  // Scoped to video calls only: an audio-only call has no camera sender
  // already established for this to layer alongside.
  const startScreenShare = async () => {
    if (!callRef.current || callType !== "video" || isScreenSharing) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = callRef.current.peerConnection?.addTrack(screenTrack, screenStream);
      screenShareRef.current = { screenStream, screenTrack, sender };
      screenTrack.onended = () => stopScreenShare(); // user hit the browser's built-in "Stop sharing"
      if (localScreenVideoRef.current) localScreenVideoRef.current.srcObject = screenStream;
      getConn(callPeerRef.current)?.send({ type: "call-meta", sharingScreen: true });
      setIsScreenSharing(true);
    } catch (e) {
      onError("Could not start screen share: " + e.message);
    }
  };

  return {
    callState, callType, callPeer, isMuted, isCameraOff, isScreenSharing, isRemoteScreenSharing,
    refs: { localVideoRef, localScreenVideoRef, remoteVideoRef, remoteScreenVideoRef },
    startCall, acceptCall, declineCall: endCall, endCall, toggleMute, toggleCamera, startScreenShare, stopScreenShare,
    handleIncomingCall, handleCallMeta, handleLinkClosed,
  };
}
