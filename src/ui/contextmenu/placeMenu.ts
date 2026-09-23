const GAP = 4;

/** Place a fixed menu at the cursor, flipping up/left when it would overflow. */
export function placeContextMenu(el: HTMLElement, x: number, y: number): void {
  el.hidden = false;
  el.style.left = "0px";
  el.style.top = "0px";
  document.body.append(el);

  const { width, height } = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = x;
  if (x + width + GAP > vw) {
    left = x - width;
  }
  left = clamp(left, GAP, vw - width - GAP);

  let top = y;
  if (y + height + GAP > vh) {
    top = y - height;
  }
  top = clamp(top, GAP, vh - height - GAP);

  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

export function placeSubmenu(panel: HTMLElement): void {
  panel.style.left = "100%";
  panel.style.right = "auto";
  panel.style.top = "-4px";
  panel.style.bottom = "auto";

  const first = panel.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (first.right + GAP > vw) {
    panel.style.left = "auto";
    panel.style.right = "100%";
  }

  const next = panel.getBoundingClientRect();
  if (next.bottom + GAP > vh) {
    panel.style.top = "auto";
    panel.style.bottom = "-4px";
  }
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}
