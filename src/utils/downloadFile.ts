import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import * as https from 'node:https';
import * as path from 'node:path';

const MAX_REDIRECTS = 8;

export async function downloadFile(
  url: string,
  destination: string,
  onProgress: (percentage: number | undefined) => void,
): Promise<void> {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporaryPath = `${destination}.download`;
  await rm(temporaryPath, { force: true });

  try {
    await download(url, temporaryPath, onProgress, 0);
    await rename(temporaryPath, destination);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

function download(
  url: string,
  destination: string,
  onProgress: (percentage: number | undefined) => void,
  redirectCount: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'vscode-voice-assistant' } });

    request.on('response', (response) => {
      const statusCode = response.statusCode ?? 0;
      const location = response.headers.location;

      if (statusCode >= 300 && statusCode < 400 && location) {
        response.resume();
        if (redirectCount >= MAX_REDIRECTS) {
          reject(new Error('Too many redirects while downloading Whisper files.'));
          return;
        }

        const redirectUrl = new URL(location, url).toString();
        void download(redirectUrl, destination, onProgress, redirectCount + 1).then(
          resolve,
          reject,
        );
        return;
      }

      if (statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed with HTTP status ${statusCode}.`));
        return;
      }

      const totalBytes = Number(response.headers['content-length']) || undefined;
      let downloadedBytes = 0;
      const file = createWriteStream(destination);

      response.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        onProgress(totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : undefined);
      });
      response.on('error', reject);
      file.on('error', reject);
      file.on('finish', () => {
        file.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
      response.pipe(file);
    });

    request.on('error', reject);
  });
}
