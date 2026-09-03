import { FormulaBar } from "./ui/formulabar/FormulaBar";
import { Ribbon } from "./ui/ribbon/Ribbon";
import { SheetTabs } from "./ui/sheettabs/SheetTabs";
import { Workspace } from "./ui/workspace/Workspace";
import "./styles/workspace.css";
import "./styles/ribbon.css";
import "./styles/contextmenu.css";
import "./styles/filter.css";
import "./styles/print.css";

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
`;

const ribbonHost = app.querySelector<HTMLElement>("#ribbon");
const barHost = app.querySelector<HTMLElement>("#formulabar");
const jsonInput = app.querySelector<HTMLInputElement>("#file-json");
const xlsxInput = app.querySelector<HTMLInputElement>("#file-xlsx");
const workspaceHost = app.querySelector<HTMLElement>("#workspace");
const tabsHost = app.querySelector<HTMLElement>("#tabs");
if (!ribbonHost || !barHost || !jsonInput || !xlsxInput || !workspaceHost || !tabsHost) {
  throw new Error("app chrome missing");
}

const workspace = new Workspace(workspaceHost);
const formulaBar = new FormulaBar(barHost, workspace);
const tabs = new SheetTabs(tabsHost, workspace);

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
  merge: () => workspace.mergeSelection(),
  unmerge: () => workspace.unmergeSelection(),
  insertImage: () => workspace.pickImage(),
  deleteImage: () => workspace.deleteSelectedImage(),
  toggleAutoFilter: () => workspace.toggleAutoFilter(),
  toggleFreeze: () => workspace.toggleFreeze(),
  insertFunction: (name) => workspace.insertFunction(name),
  togglePaintFormat: () => workspace.togglePaintFormat(),
  formatState: () => workspace.formatState(),
});

workspace.onUi(() => {
  ribbon.sync();
  formulaBar.sync();
  tabs.sync();
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
