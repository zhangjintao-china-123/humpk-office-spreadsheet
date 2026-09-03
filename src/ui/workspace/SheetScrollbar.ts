export class SheetScrollbar {
  readonly el: HTMLElement;
  readonly thumb: HTMLElement;

  constructor(
    readonly vertical: boolean,
    private readonly host: {
      viewSize(): number;
      contentSize(): number;
      scrollPos(): number;
      setScroll(pos: number): void;
    },
  ) {
    this.el = document.createElement("div");
    this.el.className = vertical ? "ho-sheet-vbar" : "ho-sheet-hbar";
    this.thumb = document.createElement("div");
    this.thumb.className = vertical ? "ho-sheet-vbar-thumb" : "ho-sheet-hbar-thumb";
    this.el.append(this.thumb);
    this.thumb.addEventListener("pointerdown", this.onThumbDown);
    this.el.addEventListener("pointerdown", this.onTrackDown);
    this.el.addEventListener("wheel", this.onWheel, { passive: false });
  }

  layout(): void {
    const view = Math.max(1, this.host.viewSize());
    const content = Math.max(this.host.contentSize(), view + 1);
    const thumb = Math.max(28, (view / content) * view);
    const maxScroll = content - view;
    const travel = Math.max(1, view - thumb);
    const pos = maxScroll <= 0 ? 0 : (this.host.scrollPos() / maxScroll) * travel;
    if (this.vertical) {
      this.thumb.style.height = `${thumb}px`;
      this.thumb.style.top = `${pos}px`;
    } else {
      this.thumb.style.width = `${thumb}px`;
      this.thumb.style.left = `${pos}px`;
    }
  }

  private onThumbDown = (event: PointerEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    const start = this.axis(event);
    const startScroll = this.host.scrollPos();
    const move = (next: PointerEvent): void => {
      const view = Math.max(1, this.host.viewSize());
      const content = Math.max(this.host.contentSize(), view + 1);
      const thumb = this.vertical ? this.thumb.offsetHeight : this.thumb.offsetWidth;
      const travel = Math.max(1, view - thumb);
      const maxScroll = Math.max(0, content - view);
      this.host.setScroll(startScroll + ((this.axis(next) - start) / travel) * maxScroll);
    };
    const up = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  private onTrackDown = (event: PointerEvent): void => {
    if (event.target === this.thumb) {
      return;
    }
    event.preventDefault();
    const rect = this.el.getBoundingClientRect();
    const view = Math.max(1, this.host.viewSize());
    const content = Math.max(this.host.contentSize(), view + 1);
    const thumb = this.vertical ? this.thumb.offsetHeight : this.thumb.offsetWidth;
    const click = this.vertical ? event.clientY - rect.top : event.clientX - rect.left;
    const travel = Math.max(1, view - thumb);
    const maxScroll = Math.max(0, content - view);
    this.host.setScroll(((click - thumb / 2) / travel) * maxScroll);
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const delta = this.vertical ? event.deltaY : event.deltaX || event.deltaY;
    this.host.setScroll(this.host.scrollPos() + delta);
  };

  private axis(event: PointerEvent): number {
    return this.vertical ? event.clientY : event.clientX;
  }
}
