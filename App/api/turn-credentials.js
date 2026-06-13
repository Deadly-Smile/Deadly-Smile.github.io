export default async function handler(req, res) {
  try {
    const response = await fetch(
      `https://${process.env.METERED_DOMAIN}/api/v1/turn/credentials?secretKey=${process.env.METERED_API_SECRET}`
    );
    if (!response.ok) throw new Error("Metered fetch failed");
    const iceServers = await response.json();
    res.status(200).json({ iceServers });
  } catch {
    // Fallback to Google STUN so the app never fully breaks
    res.status(200).json({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      fallback: true,
    });
  }
}