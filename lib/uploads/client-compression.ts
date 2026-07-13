"use client";

import imageCompression from "browser-image-compression";

const COMPRESSION_THRESHOLD_BYTES = 10 * 1024 * 1024;
const TARGET_SIZE_MB = 4;
const MAX_DIMENSION = 2400;

export async function compressImageIfNeeded(file: File): Promise<File> {
  if (file.size <= COMPRESSION_THRESHOLD_BYTES) {
    return file;
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: TARGET_SIZE_MB,
      maxWidthOrHeight: MAX_DIMENSION,
      useWebWorker: true,
      initialQuality: 0.8,
    });

    const compressedFile = new File([compressed], file.name, {
      type: compressed.type || file.type,
      lastModified: Date.now(),
    });

    return compressedFile.size < file.size ? compressedFile : file;
  } catch {
    return file;
  }
}
