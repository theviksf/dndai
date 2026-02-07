import LZString from 'lz-string';

export type WorkerRequest =
  | { type: 'compress'; id: number; jsonString: string }
  | { type: 'decompress'; id: number; compressedData: string };

export type WorkerResponse =
  | { type: 'compress'; id: number; compressedData: string; uncompressedSize: number; compressedSize: number }
  | { type: 'decompress'; id: number; jsonString: string }
  | { type: 'error'; id: number; error: string };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { type, id } = e.data;

  try {
    if (type === 'compress') {
      const { jsonString } = e.data;
      const uncompressedSize = new Blob([jsonString]).size;
      const compressedData = LZString.compressToUTF16(jsonString);
      const compressedSize = new Blob([compressedData]).size;

      self.postMessage({
        type: 'compress',
        id,
        compressedData,
        uncompressedSize,
        compressedSize,
      } satisfies WorkerResponse);
    } else if (type === 'decompress') {
      const { compressedData } = e.data;
      const jsonString = LZString.decompressFromUTF16(compressedData);

      if (!jsonString) {
        self.postMessage({
          type: 'error',
          id,
          error: 'Decompression returned null',
        } satisfies WorkerResponse);
        return;
      }

      self.postMessage({
        type: 'decompress',
        id,
        jsonString,
      } satisfies WorkerResponse);
    }
  } catch (err: any) {
    self.postMessage({
      type: 'error',
      id,
      error: err.message || String(err),
    } satisfies WorkerResponse);
  }
};
