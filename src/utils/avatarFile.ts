import { AVATAR_MAX_FILE_BYTES } from '../data/runnerProfileDefaults';

export { AVATAR_MAX_FILE_BYTES };

/** Reads an image file as a data URL for the crop dialog. */
export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

