/** 按 data URL 缓存图片。加载完成后通知，方便 Workspace 再画一帧。 */
export class ImageCache {
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly loading = new Set<string>();
  private readonly listeners = new Set<() => void>();

  onReady(handler: () => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  get(url: string | undefined): HTMLImageElement | undefined {
    if (!url) {
      return undefined;
    }
    const image = this.images.get(url);
    return image?.complete && image.naturalWidth > 0 ? image : undefined;
  }

  ensure(url: string | undefined): HTMLImageElement | undefined {
    const ready = this.get(url);
    if (ready || !url) {
      return ready;
    }
    if (this.loading.has(url) || this.images.has(url)) {
      return undefined;
    }
    this.loading.add(url);
    const image = new Image();
    image.onload = () => {
      this.loading.delete(url);
      this.images.set(url, image);
      this.notify();
    };
    image.onerror = () => {
      this.loading.delete(url);
    };
    image.src = url;
    this.images.set(url, image);
    return undefined;
  }

  prime(url: string, image: HTMLImageElement): void {
    this.images.set(url, image);
  }

  clear(): void {
    this.images.clear();
    this.loading.clear();
  }

  private notify(): void {
    for (const handler of this.listeners) {
      handler();
    }
  }
}

export const imageCache = new ImageCache();
