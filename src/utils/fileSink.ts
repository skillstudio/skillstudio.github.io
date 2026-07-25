import type { ByteSink } from "../types/streaming";

type SaveFilePicker = (options: {
  suggestedName: string;
  types: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<FileSystemFileHandle>;

export type DownloadSink = {
  sink: ByteSink;
  complete: () => Promise<void>;
};

export async function createDownloadSink(fileName: string): Promise<DownloadSink> {
  const picker = (window as typeof window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: fileName,
        types: [{ description: "PNG image", accept: { "image/png": [".png"] } }],
      });
      const writable = await handle.createWritable();
      return {
        sink: {
          write: async (chunk) => { await writable.write(chunk.slice().buffer as ArrayBuffer); },
          close: () => writable.close(),
          abort: (reason) => writable.abort(reason),
        },
        complete: async () => {},
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }

  const root = await navigator.storage.getDirectory();
  const tempName = `.imgskills-${crypto.randomUUID()}.png`;
  const handle = await root.getFileHandle(tempName, { create: true });
  const writable = await handle.createWritable();
  return {
    sink: {
      write: async (chunk) => { await writable.write(chunk.slice().buffer as ArrayBuffer); },
      close: () => writable.close(),
      abort: (reason) => writable.abort(reason),
    },
    complete: async () => {
      const file = await handle.getFile();
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      await root.removeEntry(tempName);
    },
  };
}
