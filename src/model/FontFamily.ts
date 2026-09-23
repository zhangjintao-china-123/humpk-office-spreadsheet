/** Office / Windows 字体名 → 本机常见别名，仅用于显示，导出仍写原名。 */
const FONT_ALIASES: Record<string, string[]> = {
  宋体: ["SimSun", "NSimSun", "Songti SC", "STSong"],
  新宋体: ["NSimSun", "SimSun", "Songti SC", "STSong"],
  黑体: ["SimHei", "Heiti SC", "STHeiti", "PingFang SC", "Hiragino Sans GB"],
  微软雅黑: ["Microsoft YaHei", "Microsoft YaHei UI", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC"],
  "微软雅黑 Light": ["Microsoft YaHei Light", "PingFang SC", "Hiragino Sans GB"],
  楷体: ["KaiTi", "KaiTi_GB2312", "Kaiti SC", "STKaiti"],
  仿宋: ["FangSong", "FangSong_GB2312", "STFangsong"],
  等线: ["DengXian", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB"],
  "等线 Light": ["DengXian Light", "PingFang SC"],
  华文宋体: ["STSong", "Songti SC"],
  华文黑体: ["STHeiti", "Heiti SC", "PingFang SC"],
  华文楷体: ["STKaiti", "Kaiti SC"],
  华文仿宋: ["STFangsong"],
  华文中宋: ["STZhongsong", "Songti SC"],
  华文细黑: ["STXihei", "PingFang SC", "Heiti SC"],
  华文行楷: ["STXingkai"],
  华文隶书: ["STLiti"],
  华文琥珀: ["STHupo"],
  华文新魏: ["STXinwei"],
  隶书: ["LiSu", "STLiti"],
  幼圆: ["YouYuan"],
  方正舒体: ["FZShuTi"],
  方正姚体: ["FZYaoTi"],
  "苹方-简": ["PingFang SC"],
  冬青黑体简体中文: ["Hiragino Sans GB"],
  "宋体-简": ["Songti SC"],
  "黑体-简": ["Heiti SC"],
  "楷体-简": ["Kaiti SC"],
  Calibri: ["Carlito", "Helvetica Neue", "Arial"],
  "Calibri Light": ["Carlito", "Helvetica Neue"],
  Cambria: ["Caladea", "Georgia", "Times New Roman"],
  Candara: ["Helvetica Neue", "Arial"],
  Aptos: ["Calibri", "Carlito", "Segoe UI", "Helvetica Neue"],
  "Aptos Light": ["Calibri Light", "Helvetica Neue"],
  "Aptos Display": ["Calibri", "Helvetica Neue"],
  "Segoe UI": ["Helvetica Neue", "Arial"],
  "Century Gothic": ["Apple Gothic", "Futura", "Arial"],
  Garamond: ["Palatino", "Palatino Linotype", "Times New Roman"],
  "Book Antiqua": ["Palatino", "Palatino Linotype"],
  "Franklin Gothic Medium": ["Arial Narrow", "Arial"],
  "Palatino Linotype": ["Palatino"],
  "Lucida Sans Unicode": ["Lucida Grande"],
  "Comic Sans MS": ["Comic Sans", "Chalkboard SE"],
};

export function quoteFontName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Arial";
  }
  if (/^[\w-]+$/.test(trimmed)) {
    return trimmed;
  }
  return `"${trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function cssFontFamily(name?: string): string {
  const font = name?.trim() || "Arial";
  const names = [font, ...(FONT_ALIASES[font] ?? [])];
  return [...new Set(names)].map(quoteFontName).join(", ");
}
