# LBCI Beta Deck — Desktop

The same playout deck as the web app (operionadvisory.com/beta-deck-player/),
packaged as an Electron desktop app so it isn't sandboxed the way a browser
tab is. That buys two things the web version cannot do on its own:

1. **Direct SRT output** — opens a real SRT connection straight to an IP:port
   via a bundled/local `ffmpeg`. No relay, no WHIP, no MediaMTX — this is the
   thing the browser version fundamentally couldn't do (browsers have no raw
   UDP socket API at all).
2. **Native multi-display video out** — uses Electron's own `screen` API to
   place a borderless window on whichever display is plugged into your
   Blackmagic/AJA monitor-output device, fed via the same capture pipeline.
   Works immediately, no vendor SDK required. If you separately have an
   **ffmpeg build compiled with `--enable-decklink`** (requires Blackmagic's
   proprietary SDK — see below), the app also offers genuine hardware
   DeckLink output as an alternative to the window.

## What's genuinely verified vs. what needs your hardware

I built and tested this in a sandboxed Linux container with **no Blackmagic
or AJA hardware attached, ever** — that's a hard limit, not a shortcut I
took. Here's exactly what that means per feature:

| Feature | Status |
|---|---|
| Electron shell, UI, all existing deck functionality | Verified — same renderer code as the web app, re-tested end-to-end |
| Direct SRT output | **Verified end-to-end**: launched the real app, fed it a test clip, started a feed to `srt://127.0.0.1:PORT`, and a *separate* real `ffmpeg` process acting as an SRT listener received valid H.264/AAC and wrote a playable `.ts` file |
| Native multi-display output window | **Verified end-to-end**: opened a real second window positioned via Electron's `screen` API, confirmed its `<video>` element actually decoded and played the relayed frames (readyState 4, `currentTime` advancing in real time) |
| DeckLink hardware output (`-f decklink`) | **Not verified against real hardware** — I have none. The ffmpeg invocation follows ffmpeg's documented decklink output device interface, but I cannot confirm it drives an actual card. Needs testing on a machine with Desktop Video installed and a decklink-enabled ffmpeg build |
| AJA hardware output | **Not implemented.** ffmpeg has no built-in AJA output device (unlike DeckLink). A real path would mean building a custom native Node addon against AJA's NTV2 SDK (open source, unlike Blackmagic's) — a substantial separate project, and still unverifiable here with no AJA hardware to test against. Ask if you want this scoped out properly |

## Running it

```bash
npm install
npm start
```

This runs against whatever `ffmpeg` is on your `PATH`. For a packaged build,
drop a static ffmpeg binary (see below) into `resources/<platform>/`.

## Packaging

```bash
npm run dist
```

Builds via `electron-builder` for the current platform (`win`/`mac`/`linux`
targets are configured in `package.json`). **You must supply your own
ffmpeg binary first** — see `resources/<platform>/.gitkeep` for where —
because:

- A standard ffmpeg build (even one with SRT support) is easy to get, but
- **SRT support specifically isn't in every "static ffmpeg" distribution.**
  Confirm with `ffmpeg -protocols | grep srt` before bundling. Builds from
  [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds) (GitHub
  Releases, "full" variants) are a commonly used source that includes it,
  for Windows and Linux. For macOS, [evermeet.cx](https://evermeet.cx/ffmpeg/)
  builds include it too.
- **DeckLink output needs a build compiled with `--enable-decklink`**,
  which links Blackmagic's proprietary Desktop Video SDK at compile time —
  essentially nobody distributes this prebuilt, because of the SDK's
  license. To get one: install [Desktop Video](https://www.blackmagicdesign.com/support),
  download the matching Desktop Video SDK from the same page, and compile
  ffmpeg yourself with `--enable-decklink --extra-cflags=-I<sdk>/Win/include`
  (path varies by OS) pointed at the SDK's headers. This is the same
  requirement regardless of this being a web or desktop app — it's intrinsic
  to how DeckLink output works in ffmpeg.

Without a bundled binary, the app falls back to whatever `ffmpeg` is on the
end user's own `PATH` at runtime — fine for your own use, not fine for
distributing to people who won't have ffmpeg installed.

## How SRT output actually sends

Enter a destination as `srt://host:port` in the deck's SRT picker (no WHIP
URL, unlike the web version) and hit Start. The app appends `?mode=caller`
if you didn't specify a mode, so it connects *out* to a listening receiver —
the common case for pushing to a hardware decoder or playout server. If your
receiver instead expects to connect to *you*, type the full URL yourself,
e.g. `srt://0.0.0.0:9000?mode=listener`.

## How native display output actually works

Rather than trying to pass a live `MediaStream` object across Electron's
process boundary (unreliable — each `BrowserWindow` is its own renderer
process), the main window records Program to WebM chunks (same
`MediaRecorder` approach the web version uses for its WHIP path) and relays
them over IPC to a second window, which plays them back with the Media
Source Extensions API. This is why opening a new display output, or starting
a new SRT feed, causes a brief (~1 frame) glitch on anything already
running: every active consumer needs a fresh recorder session so it gets a
valid WebM header, so the shared recorder restarts whenever the active set
changes.

## Files

- `main.js` — Electron main process: ffmpeg process management (SRT,
  DeckLink), display enumeration, output-window lifecycle, all IPC
- `preload.js` — the `window.betaDeckNative` bridge exposed to the renderer
- `renderer/index.html` — the deck itself (same UI/logic as the web app,
  with native-path branches gated behind `window.betaDeckNative` so one
  codebase still works unmodified in a plain browser)
- `renderer/output-display.html` — the minimal page shown on the output
  display, playing relayed chunks via MSE
- `resources/<platform>/` — drop your own SRT-enabled ffmpeg binary here
  before running `npm run dist` for that platform
