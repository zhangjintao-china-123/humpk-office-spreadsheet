export interface EditCommand {
  do(): void;
  undo(): void;
}
