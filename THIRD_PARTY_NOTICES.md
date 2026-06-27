# Third-Party Notices

## whisper.cpp

This extension downloads the `whisper.cpp` runtime and an OpenAI Whisper model
when local transcription is used for the first time.

- Project: https://github.com/ggml-org/whisper.cpp
- License: MIT
- Model source: https://huggingface.co/ggerganov/whisper.cpp

The downloaded files remain in VS Code's extension global storage and are used
only for local speech-to-text transcription.

The macOS runtime is distributed by the `whisper.cpp-cli` Python package:

- Project: https://pypi.org/project/whisper.cpp-cli/
- License: MIT

## decibri-cli

On macOS, this extension downloads `decibri-cli` for local CoreAudio microphone
capture.

- Project: https://github.com/decibri/decibri-cli
- License: Apache-2.0

The downloaded binary remains in VS Code's extension global storage. Recorded
audio is passed only to the local Whisper runtime.
