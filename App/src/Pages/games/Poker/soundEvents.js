// ─── Which sounds a state change should play ─────────────────────────────────
// Pure: compares two consecutive table states and names the events between
// them. Works the same for solo, host and guest — a guest just diffs the
// states it receives over the wire, so nothing extra goes on the network.
import { isBettingRoundOver } from "./engine.js";

function isLive(state) {
  return state.street !== "waiting" && state.street !== "handOver";
}

export function isSeatsTurn(state, seatId) {
  return isLive(state) && state.actingIndex === seatId && !isBettingRoundOver(state);
}

export function diffEvents(prev, next, mySeatId) {
  if (!prev || !next || prev === next) return [];
  const events = [];

  if (next.handNumber !== prev.handNumber) {
    if (next.handNumber > 0) events.push("shuffle");
  } else {
    if (next.board.length > prev.board.length) events.push("card");

    // Per-seat actions only within the same street — a new street resets
    // every streetBet/hasActed, which isn't anyone acting.
    if (next.street === prev.street) {
      for (const p of next.players) {
        const before = prev.players.find(q => q.id === p.id);
        if (!before) continue;
        if (p.folded && !before.folded) events.push("fold");
        else if (p.allIn && !before.allIn) events.push("allIn");
        else if (p.streetBet > before.streetBet) events.push("chips");
        else if (p.hasActed && !before.hasActed && !p.folded) events.push("check");
      }
    }

    for (const p of next.players) {
      const before = prev.players.find(q => q.id === p.id);
      if (before && (p.rebuys ?? 0) > (before.rebuys ?? 0)) events.push("chips");
    }

    if (next.result && !prev.result) {
      const won = next.result.winners.some(w => w.playerId === mySeatId);
      const me = next.players.find(p => p.id === mySeatId);
      if (won) events.push("win");
      else if (me?.inHand && !me.folded) events.push("lose");
      else events.push("pot");
    }
  }

  if (isSeatsTurn(next, mySeatId) && !isSeatsTurn(prev, mySeatId)) events.push("myTurn");

  return [...new Set(events)];
}
