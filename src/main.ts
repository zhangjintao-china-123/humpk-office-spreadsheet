import { FormulaBar } from "./ui/formulabar/FormulaBar";
import { Ribbon } from "./ui/ribbon/Ribbon";
import { SheetTabs } from "./ui/sheettabs/SheetTabs";
import { StatusBar } from "./ui/statusbar/StatusBar";
import { Workspace } from "./ui/workspace/Workspace";
import { validateSheetName } from "./model/Workbook";
import "./styles/workspace.css";
import "./styles/ribbon.css";
import "./styles/contextmenu.css";
import "./styles/filter.css";
import "./styles/note.css";
import "./styles/control.css";
import "./styles/print.css";
import "./styles/find.css";

document.title = "humpk-office";

const app = document.getElementById("app");
if (!app) {
  throw new Error("missing #app");
}

app.className = "ho-sheet-app";
app.innerHTML = `
  <div id="ribbon"></div>
  <div id="formulabar"></div>
  <input id="file-json" type="file" accept=".json,.els" hidden />
  <input id="file-xlsx" type="file" accept=".xlsx" hidden />
  <div id="workspace"></div>
  <div id="tabs"></div>
  <div id="statusbar"></div>
`;

const ribbonHost = app.querySelector<HTMLElement>("#ribbon");
const barHost = app.querySelector<HTMLElement>("#formulabar");
const jsonInput = app.querySelector<HTMLInputElement>("#file-json");
const xlsxInput = app.querySelector<HTMLInputElement>("#file-xlsx");
const workspaceHost = app.querySelector<HTMLElement>("#workspace");
const tabsHost = app.querySelector<HTMLElement>("#tabs");
const statusHost = app.querySelector<HTMLElement>("#statusbar");
if (!ribbonHost || !barHost || !jsonInput || !xlsxInput || !workspaceHost || !tabsHost || !statusHost) {
  throw new Error("app chrome missing");
}

const workspace = new Workspace(workspaceHost);
workspace.onRequestAppendRows = () => askAppendRows();
workspace.onRequestRenameSheet = (index, currentName) => renameSheet(index, currentName);
workspace.onRequestDropdownOptions = (current, apply) => askDropdownOptions(current, apply);
const formulaBar = new FormulaBar(barHost, workspace);
const tabs = new SheetTabs(tabsHost, workspace);
const statusBar = new StatusBar(statusHost, workspace);

const ribbon = new Ribbon(ribbonHost, {
  applyFormat: (action) => workspace.applyFormat(action),
  applyBorder: (mode) => workspace.applyBorder(mode),
  undo: () => {
    workspace.history.undo();
    workspace.emitUi();
  },
  redo: () => {
    workspace.history.redo();
    workspace.emitUi();
  },
  newBlank: () => workspace.newBlank(),
  openFile: () => jsonInput.click(),
  saveFile: () => downloadJson(),
  importFile: () => xlsxInput.click(),
  exportFile: () => {
    void downloadXlsx();
  },
  print: () => workspace.printPreview(),
  find: () => workspace.openFind("find"),
  openReplace: () => workspace.openFind("replace"),
  merge: () => workspace.mergeSelection(),
  unmerge: () => workspace.unmergeSelection(),
  insertImage: () => workspace.pickImage(),
  deleteImage: () => workspace.deleteSelectedImage(),
  toggleAutoFilter: () => workspace.toggleAutoFilter(),
  toggleFreeze: () => workspace.toggleFreeze(),
  insertFunction: (name) => workspace.insertFunction(name),
  togglePaintFormat: () => workspace.togglePaintFormat(),
  setSelectionPriority: (priority) => workspace.setSelectionPriority(priority),
  setSelectionShape: (shape) => workspace.setSelectionShape(shape),
  setSelectionVerdict: (verdict) => workspace.setSelectionVerdict(verdict),
  clearSelectionPriority: () => workspace.clearSelectionPriority(),
  clearSelectionShape: () => workspace.clearSelectionShape(),
  unmarkSelection: () => workspace.unmarkSelection(),
  clearSheetMarks: () => workspace.clearSheetMarks(),
  editNote: () => workspace.editNote(),
  deleteNote: () => workspace.deleteNote(),
  appendRowsBelow: () => askAppendRows(),
  formatState: () => workspace.formatState(),
  setEditControlEnabled: (on) => workspace.setEditControlEnabled(on),
  setSelectionTextEdit: () => workspace.setSelectionTextEdit(),
  requestDropdownOptions: () => workspace.requestDropdownOptions(),
  setSelectionSwitch: () => workspace.setSelectionControl({ kind: "switch" }),
  clearSelectionEditable: () => workspace.setSelectionEditable(false),
});

workspace.onUi(() => {
  ribbon.sync();
  formulaBar.sync();
  tabs.sync();
  statusBar.sync();
});

window.addEventListener("resize", () => workspace.render());
window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    downloadJson();
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
    event.preventDefault();
    workspace.printPreview();
  }
});

bindFileInput(jsonInput, "打开文件失败");
bindFileInput(xlsxInput, "导入 Excel 失败");

function bindFileInput(input: HTMLInputElement, failText: string): void {
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    try {
      await workspace.loadFile(file);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : failText);
    }
    input.value = "";
  });
}

function askAppendRows(): void {
  const raw = window.prompt("在选区下方追加的行数", "1");
  if (raw == null) {
    return;
  }
  const count = Number(raw);
  if (!Number.isFinite(count) || count < 1) {
    window.alert("请输入大于 0 的行数");
    return;
  }
  workspace.appendRowsBelow(count);
}

function renameSheet(index: number, currentName: string): void {
  const name = window.prompt("工作表名称", currentName);
  if (name == null) {
    return;
  }
  const error = validateSheetName(name, workspace.workbook.sheets, index);
  if (error) {
    window.alert(error);
    return;
  }
  workspace.renameSheet(index, name);
}

function askDropdownOptions(current: string[], apply: (options: string[]) => void): void {
  const raw = window.prompt("下拉选项，一行一个", current.join("\n"));
  if (raw == null) {
    return;
  }
  const options = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!options.length) {
    window.alert("至少填写一个选项");
    return;
  }
  apply(options);
}

function downloadJson(): void {
  const data = JSON.stringify(workspace.exportJson(), null, 2);
  downloadBlob(new Blob([data], { type: "application/json" }), withExt(workspace.caption, ".json"));
}

async function downloadXlsx(): Promise<void> {
  const data = await workspace.exportXlsx();
  downloadBlob(
    new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    withExt(workspace.caption, ".xlsx"),
  );
}

function withExt(caption: string, ext: string): string {
  const base = caption.replace(/\.(json|xlsx|els)$/i, "");
  return `${base}${ext}`;
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
