/** Shared timeline coordinate math. */
export function timelineScale({ viewportWidth, labelWidth, duration, zoom, gutter = 30, minTrackWidth = 200 }) {
  const safeDuration = Math.max(1, Number(duration) || 1);
  const safeZoom = Math.max(0.1, Number(zoom) || 1);
  const available = Math.max(minTrackWidth, (Number(viewportWidth) || 0) - (Number(labelWidth) || 0) - gutter);
  const pixelsPerFrame = (available / safeDuration) * safeZoom;
  return {
    pixelsPerFrame,
    trackWidth: safeDuration * pixelsPerFrame,
    contentWidth: (Number(labelWidth) || 0) + safeDuration * pixelsPerFrame + gutter,
  };
}

export function frameToTimelineX(frame, inPoint, pixelsPerFrame, labelWidth) {
  return labelWidth + (frame - inPoint) * pixelsPerFrame;
}

export function clientXToFrame(clientX, innerLeft, inPoint, pixelsPerFrame, labelWidth) {
  const scale = Math.max(0.0001, Number(pixelsPerFrame) || 0.0001);
  return inPoint + (clientX - innerLeft - labelWidth) / scale;
}
