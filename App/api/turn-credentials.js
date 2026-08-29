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
        {
          urls: "stun:stun.relay.metered.ca:80",
        },
        {
          urls: "turn:global.relay.metered.ca:80",
          username: process.env.METERED_USERNAME,
          credential: process.env.METERED_CREDENTIAL,
        },
        {
          urls: "turn:global.relay.metered.ca:80?transport=tcp",
          username: process.env.METERED_USERNAME,
          credential: process.env.METERED_CREDENTIAL,
        },
        {
          urls: "turn:global.relay.metered.ca:443",
          username: process.env.METERED_USERNAME,
          credential: process.env.METERED_CREDENTIAL,
        },
        {
          urls: "turns:global.relay.metered.ca:443?transport=tcp",
          username: process.env.METERED_USERNAME,
          credential: process.env.METERED_CREDENTIAL,
        },
      ],
      fallback: true,
    });
  }
}