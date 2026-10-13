// No test framework is configured in this project (see CLAUDE.md) — this is a
// plain script exercising the upload file-type helpers. Run manually with:
//   node src/Pages/tools/MusicPlayer/utils.test.js
import { isSupportedAudioFile, audioMimeFor } from "./utils.js";

let failures = 0;
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    failures++;
    console.error(`✗ ${name}`);
    console.error("  expected:", JSON.stringify(expected));
    console.error("  actual:  ", JSON.stringify(actual));
  } else {
    console.log(`✓ ${name}`);
  }
}
const f = (name, type) => ({ name, type });

check("audio/mpeg", isSupportedAudioFile(f("a.mp3", "audio/mpeg")), true);
check("audio/x-wav", isSupportedAudioFile(f("a.wav", "audio/x-wav")), true);
check("audio/vnd.wave", isSupportedAudioFile(f("a.wav", "audio/vnd.wave")), true);
check("audio/x-m4a", isSupportedAudioFile(f("a.m4a", "audio/x-m4a")), true);
check("flac with empty type", isSupportedAudioFile(f("song.FLAC", "")), true);
check("m4a labelled video/mp4", isSupportedAudioFile(f("a.m4a", "video/mp4")), true);
check("opus with octet-stream", isSupportedAudioFile(f("a.opus", "application/octet-stream")), true);
check("rejects image", isSupportedAudioFile(f("cover.jpg", "image/jpeg")), false);
check("rejects text", isSupportedAudioFile(f("notes.txt", "")), false);
check("rejects no extension", isSupportedAudioFile(f("README", "")), false);

check("keeps real audio type", audioMimeFor(f("a.wav", "audio/x-wav")), "audio/x-wav");
check("guesses flac", audioMimeFor(f("a.flac", "")), "audio/flac");
check("guesses m4a over video/mp4", audioMimeFor(f("a.m4a", "video/mp4")), "audio/mp4");
check("guesses mp3 over octet-stream", audioMimeFor(f("a.mp3", "application/octet-stream")), "audio/mpeg");

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
