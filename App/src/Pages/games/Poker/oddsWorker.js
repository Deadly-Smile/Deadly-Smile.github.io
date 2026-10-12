// Runs estimateOdds off the main thread (a few hundred ms of evaluation would
// otherwise stutter the table animations). One request in, one result out.
import { estimateOdds } from "./odds.js";

self.onmessage = (e) => {
  const { id, hole, board, opponents } = e.data;
  try {
    self.postMessage({ id, result: estimateOdds({ hole, board, opponents }) });
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};
