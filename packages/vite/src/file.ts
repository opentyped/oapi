import { open, readFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export async function removeFile(file: string): Promise<void> {
  await unlink(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
}

/** Atomic per-file replacement; unchanged artifacts keep their modification time. */
export async function replaceFile(file: string, content: string): Promise<void> {
  try {
    if ((await readFile(file, 'utf8')) === content) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const temporary = path.join(path.dirname(file), `.typedapi-${randomUUID()}.tmp`);
  const handle = await open(temporary, 'wx');
  try {
    try {
      await handle.writeFile(content);
    } finally {
      await handle.close();
    }
    await rename(temporary, file);
  } finally {
    await removeFile(temporary);
  }
}
