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

export const MACOS_RECORDER = {
  version: '0.1.0',
  archiveName: 'decibri-universal2-apple-darwin.tar.gz',
  url: 'https://github.com/decibri/decibri-cli/releases/download/v0.1.0/decibri-universal2-apple-darwin.tar.gz',
  sha256: '5ac42b8afaab1d06ac3e20ebdf6e1890153ea56e155ce46215aa1161634a79aa',
  executableRelativePath: 'decibri',
} as const;

export const MACOS_WHISPER_RUNTIMES = {
  arm64: {
    archiveName: 'whisper_cpp_cli-0.0.3-py3-none-macosx_11_0_arm64.whl',
    url: 'https://files.pythonhosted.org/packages/fd/eb/4d1a96d887b62fdddc58e3e0c9c94f673b54cd9fc025329340f9c4d052bc/whisper_cpp_cli-0.0.3-py3-none-macosx_11_0_arm64.whl',
    sha256: '6c9cb1d10770da5b7f92c54c2ace29142694b5b392c274db1d95ce1d2f6223d2',
  },
  x64: {
    archiveName: 'whisper_cpp_cli-0.0.3-py3-none-macosx_10_12_x86_64.whl',
    url: 'https://files.pythonhosted.org/packages/a5/11/359833bd72353eb0142defc26ac2d8bd957da5b72540bd546ce7f0caea83/whisper_cpp_cli-0.0.3-py3-none-macosx_10_12_x86_64.whl',
    sha256: '1d85c6ca3dbf907c07a59f8daa620b3d0e3b263356c5220357dd7e06b42bc523',
  },
  executableRelativePath: 'whisper_cpp_cli-0.0.3.data/scripts/whisper-cpp',
  version: '0.0.3',
} as const;
