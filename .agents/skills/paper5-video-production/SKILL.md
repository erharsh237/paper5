---
name: paper5-video-production
description: Production-grade marketing video creation, preview, and deterministic MP4 export pipeline for Paper5 animations using Playwright and FFmpeg (with Remotion architectural patterns).
---

# Paper5 Video Production Skill

The `paper5-video-production` skill provides an automated, deterministic video production and export engine for Paper5 product films, UI motion reels, and marketing animations. It captures pixel-perfect frames directly from the Chromium rendering pipeline and encodes broadcast-ready MP4 files using FFmpeg—completely eliminating screen recordings, browser chrome, OS dialogs, dropped frames, and compression artifacts.

---

## 1. Architecture & Framework Overview

Paper5 marketing films are architected as lightweight, hardware-accelerated HTML5 Keynote-style animations:

- **Visual Layer**: HTML5 DOM with modern CSS3 3D transforms (`translate3d`, `scale`, `rotateX`), cubic-bezier transition curves, and Tailwind CSS.
- **Audio Synthesizer**: Web Audio API engine (`FilmAudio`) producing tempo-synced chord progressions (118 BPM Indie-Electro) and tactile UI sound effects (whoosh, pop, chime, click, resolve) connected to an audio destination stream (`MediaStreamAudioDestinationNode`).
- **Rendering Engine**: Headless Chromium instance operated via Playwright CDP (Chrome DevTools Protocol) using compositor screencast frame streaming.
- **Audio/Video Muxer**: FFmpeg (`@ffmpeg-installer/ffmpeg`) encoding to H.264 (High Profile, YUV420p, CRF 18) and AAC (48 kHz stereo, 192 kbps).

### HTML5/Playwright vs. Remotion Architecture

| Feature | HTML5 + Playwright + FFmpeg (Current) | Remotion (React-Based Alternative) |
| :--- | :--- | :--- |
| **Animation Paradigm** | CSS Transitions + async timeline sequencing | React components driven by `useCurrentFrame()` |
| **Audio Integration** | Web Audio API synth + PCM stream capture | `<Audio />` components with asset timeline |
| **Rendering Method** | Headless Chrome Compositor -> FFmpeg pipe | Chromium frame evaluation -> FFmpeg |
| **Project Portability** | Preserves standalone HTML/CSS presentation | Requires Node/React bundle build step |
| **When to Use** | Standalone web films, real interactive UI embeds | Multi-track video composition, complex dynamic data |

---

## 2. Supported Video Formats & Specifications

| Format | Aspect Ratio | Dimensions | Frame Rate | Intended Distribution |
| :--- | :--- | :--- | :--- | :--- |
| **Portrait (Reel)** | `9:16` | **1080 × 1920** | 60 FPS (or 30 FPS) | Instagram Reels, Stories, TikTok, YouTube Shorts |
| **Landscape (Widescreen)** | `16:9` | **1920 × 1080** | 60 FPS (or 30 FPS) | YouTube, Product Landing Page Hero, Presentations |
| **Square (Feed)** | `1:1` | **1080 × 1080** | 60 FPS (or 30 FPS) | Instagram Feed, LinkedIn, Twitter/X Media |

### Video & Audio Encoding Parameters:
- **Video Codec**: `H.264 / AVC` (`libx264`), High Profile (Level 4.2 / 5.1).
- **Pixel Format**: `yuv420p` (strictly enforced for universal mobile and desktop playback).
- **Quality / Bitrate**: CRF 18 (visually lossless broadcast standard) or CRF 23 (standard web).
- **Audio Codec**: `AAC-LC` (`aac`), 48,000 Hz sample rate, stereo, 192 kbps.
- **Container Flags**: `+faststart` (optimizes MP4 for progressive web streaming).

---

## 3. Automation Workflow

The rendering pipeline follows a strict 5-stage lifecycle:

```
[1. Launch Browser] -> [2. Verify Assets] -> [3. Parallel Stream Capture] -> [4. FFmpeg Encoding] -> [5. Validation]
```

1. **Launch Browser**: Playwright launches headless Chrome/Edge with flags `--autoplay-policy=no-user-gesture-required`, `--disable-gpu-vsync`, and `--enable-gpu-rasterization`.
2. **Verify Assets**: Awaits `domcontentloaded`, `document.fonts.ready`, and ensures icon SVGs and stylesheets are fully computed before animation triggers.
3. **Capture**:
   - Audio is captured directly from `FilmAudio.getMediaStreamTrack()` via in-memory `MediaRecorder`.
   - Video frames are captured directly from Chrome's Skia rendering engine via CDP `Page.startScreencast`.
4. **Encoding**: FFmpeg streams captured frames and the audio track, merging them with sample-accurate synchronization.
5. **Validation**: FFprobe inspects the generated `.mp4` file in `exports/` to verify resolution, codec, duration, and frame rate.

---

## 4. CLI Commands & Quick Reference

### Standard Preset Commands

```bash
# Instagram Reel Preset: 1080x1920 @ 60 FPS
npm run video:reel

# YouTube / Landscape Preset: 1920x1080 @ 60 FPS
npm run video:youtube

# Instagram Square Preset: 1080x1080 @ 30 FPS
npm run video:square

# 5-Second Test Render (Phase 4 validation)
npm run video:test

# Final Launch Video Export: 1080x1920 @ 60 FPS -> exports/paper5-instagram-launch.mp4
npm run video:launch
```

### Direct Script Execution with Custom Flags

```bash
# Custom resolution, custom output path, and 30 FPS
node .agents/skills/paper5-video-production/scripts/render.mjs --aspect portrait --fps 30 --out exports/my-custom-video.mp4

# High-fidelity CRF 18 export
node .agents/skills/paper5-video-production/scripts/render.mjs --aspect portrait --fps 60 --quality high

# Custom local or preview URL
node .agents/skills/paper5-video-production/scripts/render.mjs --url http://localhost:5173/product-film.html --aspect landscape
```

---

## 5. File & Directory Layout

```
.agents/skills/paper5-video-production/
├── SKILL.md                 # Agent instructions & documentation
└── scripts/
    └── render.mjs           # Master Playwright + FFmpeg export engine
exports/                     # Auto-generated destination for final MP4 files
├── paper5-portrait-60fps.mp4
└── paper5-portrait-60fps-preview.mp4
```

---

## 6. Verification Checklist

Whenever an export completes, verify the output video using the built-in FFmpeg stream inspector:

1. **Resolution**: Must exactly match requested aspect ratio (e.g., `1080x1920`).
2. **Frame Rate**: Stream must report `60 fps` (or `30 fps`).
3. **Audio Stream**: Must contain `Stream #0:1: Audio: aac, 48000 Hz, stereo`.
4. **No Clipping / Cropping**: Check that Dynamic Island, text badges, and chassis borders are unclipped.
5. **No Screen Recording Chrome**: Never allow browser tabs, OS taskbars, or director pill controls into the exported video.
