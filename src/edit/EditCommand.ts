export interface EditCommand {
  do(): void;
  undo(): void;
  /** 撤销/重做后需要把当前编辑页写回磁盘，避免和已保存文件分叉。 */
  persistOnHistory?: boolean;
}
