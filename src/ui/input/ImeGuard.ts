/** 判断文本是否已含汉字（组字结束后的结果，不是拼音）。 */
export function isCjk(text: string): boolean {
  return /[\u2e80-\u2fd5\u3190-\u319f\u3400-\u9fff\uf900-\ufaff]/.test(text);
}

/** 首输是直接敲出的英文/数字，而不是中文输入法组字。 */
export function isDirectLatinInput(composing: boolean, text: string): boolean {
  return !composing && text !== "" && !isCjk(text);
}

/**
 * 与 xlsheet 一致：只用 keyCode 判断英数，中文输入法首键是 229，不会误开编。
 * 不要用 event.key.length === 1，拼音字母的 key 也是单个拉丁字符。
 */
export function isLatinKeyCode(keyCode: number, key: string): boolean {
  return (
    (keyCode >= 65 && keyCode <= 90)
    || (keyCode >= 48 && keyCode <= 57)
    || (keyCode >= 96 && keyCode <= 105)
    || key === "="
  );
}
