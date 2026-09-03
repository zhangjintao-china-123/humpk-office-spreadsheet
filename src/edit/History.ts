import type { EditCommand } from "./EditCommand";

export class History {
  private undoStack: EditCommand[] = [];
  private redoStack: EditCommand[] = [];

  do(command: EditCommand): void {
    command.do();
    this.undoStack.push(command);
    this.redoStack = [];
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) {
      return false;
    }
    command.undo();
    this.redoStack.push(command);
    return true;
  }

  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) {
      return false;
    }
    command.do();
    this.undoStack.push(command);
    return true;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
