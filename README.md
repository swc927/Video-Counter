
# Video Counter by SWC — fixed build

Interactive counters over any video. Add multiple counters, set time and value keyframes, and export a WebM with audio. This build fixes two things:
1. Overlay alignment equals export alignment for any aspect ratio or resolution.
2. Export includes the source audio track.

It also adds:
- Counter resize with a corner handle
- HiDPI safe canvas for crisp text

## Quick start
1. Open `index.html` in a modern Chromium-based browser.
2. Upload a video.
3. Create a counter, drag to place, drag the small square to resize.
4. Add keyframes for time and value.
5. Press Export video.

## Why alignment is correct now
We removed the forced 16:9 box and let the video element define the stage size. The overlay sits exactly on top of the video element, and positions are stored as percentages of that box. During export we map those percentages to `videoWidth` and `videoHeight`, so placement is identical.

## Audio in export
We capture the canvas stream then add the audio track from the `<video>` element to the same stream before recording.

## Files changed
- `styles.css`: dropped the aspect ratio box and object-fit contain, added stage styling, resize handle styles.
- `app.js`: added audio to export, HiDPI canvas, resize handle logic, and small robustness tweaks.
- `index.html`: switched wrapper to `videoStage`, no aspect ratio wrapper, kept controls intact.
