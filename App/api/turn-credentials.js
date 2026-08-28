export default async function handler(req, res) {
  try {
    const response = await fetch(
      `https://${process.env.METERED_DOMAIN}/api/v1/turn/credentials?secretKey=${process.env.METERED_API_SECRET}`
    );
    if (!response.ok) throw new Error("Metered fetch failed");
    const iceServers = await response.json();
    res.status(200).json({ iceServers });
  } catch {
    // Fallback so the app never fully breaks — multiple STUN servers for
    // redundancy, plus a public TURN relay since STUN alone can't traverse
    // symmetric NAT or UDP-blocking firewalls.
    res.status(200).json({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
        {
          urls: [
            "turn:openrelay.metered.ca:80",
            "turn:openrelay.metered.ca:443",
            "turn:openrelay.metered.ca:443?transport=tcp",
          ],
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
      fallback: true,
    });
  }
}