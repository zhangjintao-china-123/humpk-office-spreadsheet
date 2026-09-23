export type FontGroup = {
  label: string;
  fonts: string[];
};

export const FONT_GROUPS: FontGroup[] = [
  {
    label: "中文",
    fonts: [
      "等线",
      "等线 Light",
      "宋体",
      "新宋体",
      "黑体",
      "微软雅黑",
      "微软雅黑 Light",
      "楷体",
      "仿宋",
      "华文宋体",
      "华文黑体",
      "华文楷体",
      "华文仿宋",
      "华文中宋",
      "华文细黑",
      "华文行楷",
      "华文隶书",
      "华文琥珀",
      "华文新魏",
      "隶书",
      "幼圆",
      "方正舒体",
      "方正姚体",
      "苹方-简",
      "PingFang SC",
      "冬青黑体简体中文",
      "Hiragino Sans GB",
      "宋体-简",
      "Songti SC",
      "黑体-简",
      "Heiti SC",
      "楷体-简",
      "Kaiti SC",
    ],
  },
  {
    label: "英文",
    fonts: [
      "Aptos",
      "Aptos Display",
      "Aptos Light",
      "Arial",
      "Arial Black",
      "Arial Narrow",
      "Calibri",
      "Calibri Light",
      "Cambria",
      "Candara",
      "Century Gothic",
      "Comic Sans MS",
      "Consolas",
      "Constantia",
      "Corbel",
      "Courier New",
      "Franklin Gothic Medium",
      "Garamond",
      "Georgia",
      "Helvetica",
      "Helvetica Neue",
      "Impact",
      "Lucida Console",
      "Lucida Sans Unicode",
      "Palatino Linotype",
      "Segoe UI",
      "Tahoma",
      "Times",
      "Times New Roman",
      "Trebuchet MS",
      "Verdana",
    ],
  },
];

export const FONT_NAMES = FONT_GROUPS.flatMap((group) => group.fonts);

export function fontSelectMarkup(extra?: string): string {
  const extraName = extra?.trim();
  const extraOption = extraName && !FONT_NAMES.includes(extraName) ? option(extraName) : "";
  return `${extraOption}${FONT_GROUPS.map((group) => `<optgroup label="${group.label}">${group.fonts.map(option).join("")}</optgroup>`).join("")}`;
}

export function ensureFontOption(select: HTMLSelectElement, name: string): void {
  const font = name.trim();
  if (!font || Array.from(select.options).some((item) => item.value === font)) {
    return;
  }
  select.insertAdjacentHTML("afterbegin", option(font));
}

function option(name: string): string {
  const safe = name.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<option value="${safe}" style="font-family:'${safe}'">${safe}</option>`;
}
