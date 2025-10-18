# Counter Animator by SWC

A single page tool that animates a numeric counter from any start value to any end value over a set duration with custom styling, glow and export to WebM video using the MediaRecorder API. No server or dependencies required.

## Features
- Start value end value duration controls with easing and formatting
- Live preview on a canvas with gradient or transparent backgrounds or chroma key
- Custom font size weight colour and glow shadow
- Canvas resize for common video sizes like 1920x1080 and 1080x1920
- Export to .webm with vp9 or vp8 via MediaRecorder

## Limitations
- Alpha transparency in WebM depends on browser support. If you need a transparent asset pick chroma key background and remove it in your editor.
- MP4 export is not available without a server or ffmpeg in the browser.

## Quick start
Open index.html in a modern Chromium browser. Set your values. Click Preview then Record video then Download last video.
