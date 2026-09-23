/** Office 主题色，与 Excel「开始 > 字体颜色 / 填充」一致。 */
const THEME = ["#ffffff", "#000000", "#e7e6e6", "#44546a", "#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47"];

const THEME_TINTS = [
  [-0.05, -0.15, -0.25, -0.35, -0.5],
  [0.5, 0.35, 0.25, 0.15, 0.05],
  [-0.1, -0.25, -0.5, -0.75, -0.9],
  [0.8, 0.6, 0.4, -0.25, -0.5],
  [0.8, 0.6, 0.4, -0.25, -0.5],
  [0.8, 0.6, 0.4, -0.25, -0.5],
  [0.8, 0.6, 0.4, -0.25, -0.5],
  [0.8, 0.6, 0.4, -0.25, -0.5],
  [0.8, 0.6, 0.4, -0.25, -0.5],
  [0.8, 0.6, 0.4, -0.25, -0.5],
];

const STANDARD = ["#c00000", "#ff0000", "#ffc000", "#ffff00", "#92d050", "#00b050", "#00b0f0", "#0070c0", "#002060", "#7030a0"];

export type PaletteKind = "color" | "fill";

export function colorPaletteMarkup(kind: PaletteKind): string {
  const attr = kind === "color" ? "data-color" : "data-fill";
  const none = kind === "fill"
    ? `<button type="button" class="ho-sheet-swatch-none" data-fill="none" title="无填充"><span></span>无填充</button>`
    : "";
  return `
    <div class="ho-sheet-palette">
      ${none}
      <div class="ho-sheet-palette-label">主题颜色</div>
      <div class="ho-sheet-palette-grid ho-sheet-palette-theme">
        ${THEME.map((color) => swatch(attr, color)).join("")}
      </div>
      <div class="ho-sheet-palette-grid ho-sheet-palette-tints">
        ${THEME_TINTS[0].map((_, row) => THEME.map((color, col) => swatch(attr, applyTint(color, THEME_TINTS[col][row]))).join("")).join("")}
      </div>
      <div class="ho-sheet-palette-label">标准色</div>
      <div class="ho-sheet-palette-grid">
        ${STANDARD.map((color) => swatch(attr, color)).join("")}
      </div>
      <button type="button" class="ho-sheet-palette-more" data-more-color="${kind}">更多颜色...</button>
      <input type="color" class="ho-sheet-color-input" data-color-input="${kind}" value="#000000" tabindex="-1" />
    </div>
  `;
}

export function normalizeHex(value: string | undefined): string {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw || raw === "none") {
    return raw || "";
  }
  if (/^#[0-9a-f]{6}$/.test(raw)) {
    return raw;
  }
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return raw;
}

function swatch(attr: string, color: string): string {
  const hex = normalizeHex(color);
  const light = isLight(hex) ? " is-light" : "";
  return `<button type="button" class="ho-sheet-swatch${light}" ${attr}="${hex}" title="${hex.toUpperCase()}" style="background:${hex}"></button>`;
}

function applyTint(css: string, tint: number): string {
  const rgb = cssToRgb(css);
  if (!rgb) {
    return css;
  }
  const next = rgb.map((channel) => {
    if (tint < 0) {
      return Math.round(channel * (1 + tint));
    }
    return Math.round(channel * (1 - tint) + 255 * tint);
  });
  return `#${next.map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join("")}`;
}

function cssToRgb(css: string): [number, number, number] | null {
  const hex = css.replace(/^#/, "");
  if (hex.length !== 6) {
    return null;
  }
  const n = Number.parseInt(hex, 16);
  if (!Number.isFinite(n)) {
    return null;
  }
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function isLight(css: string): boolean {
  const rgb = cssToRgb(css);
  if (!rgb) {
    return false;
  }
  return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 210;
}
