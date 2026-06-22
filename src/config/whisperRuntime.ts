export const WHISPER_RUNTIME_VERSION = '1.9.1';

export const WHISPER_MODEL = {
  fileName: 'ggml-base.en.bin',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
  // Hugging Face LFS object hash. The HTTP ETag is an Xet storage hash and
  // does not match the downloaded file's SHA-256 digest.
  sha256: 'a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002',
} as const;

export const WINDOWS_X64_RUNTIME = {
  archiveName: `whisper-bin-x64-${WHISPER_RUNTIME_VERSION}.zip`,
  url: `https://github.com/ggml-org/whisper.cpp/releases/download/v${WHISPER_RUNTIME_VERSION}/whisper-bin-x64.zip`,
  sha256: '7d8be46ecd31828e1eb7a2ecdd0d6b314feafd82163038ab6092594b0a063539',
  executableRelativePath: 'Release/whisper-cli.exe',
} as const;
