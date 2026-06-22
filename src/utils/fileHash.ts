import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';

export function calculateFileHash(
  filePath: string,
  algorithm: 'sha1' | 'sha256',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm);
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
