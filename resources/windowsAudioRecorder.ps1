param(
    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

$recorderSource = @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class VoiceAssistantAudioRecorder
{
    private const uint WaveMapper = 0xFFFFFFFF;
    private const uint CallbackFunction = 0x00030000;
    private const uint WaveDataMessage = 0x03C0;
    private const uint WaveHeaderDone = 0x00000001;
    private const int SampleRate = 16000;
    private const ushort Channels = 1;
    private const ushort BitsPerSample = 16;
    private const int BufferSize = 3200;
    private const int BufferCount = 4;

    [StructLayout(LayoutKind.Sequential)]
    private struct WaveFormat
    {
        public ushort FormatTag;
        public ushort Channels;
        public uint SamplesPerSecond;
        public uint AverageBytesPerSecond;
        public ushort BlockAlign;
        public ushort BitsPerSample;
        public ushort ExtraSize;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct WaveHeader
    {
        public IntPtr Data;
        public uint BufferLength;
        public uint BytesRecorded;
        public IntPtr UserData;
        public uint Flags;
        public uint Loops;
        public IntPtr Next;
        public IntPtr Reserved;
    }

    private sealed class AudioBuffer
    {
        public IntPtr Data;
        public IntPtr Header;
    }

    private delegate void WaveInputCallback(
        IntPtr input,
        uint message,
        IntPtr instance,
        IntPtr parameterOne,
        IntPtr parameterTwo
    );

    [DllImport("winmm.dll")]
    private static extern int waveInOpen(
        out IntPtr input,
        uint deviceId,
        ref WaveFormat format,
        IntPtr callback,
        IntPtr instance,
        uint flags
    );

    [DllImport("winmm.dll")]
    private static extern int waveInPrepareHeader(IntPtr input, IntPtr header, int headerSize);

    [DllImport("winmm.dll")]
    private static extern int waveInUnprepareHeader(IntPtr input, IntPtr header, int headerSize);

    [DllImport("winmm.dll")]
    private static extern int waveInAddBuffer(IntPtr input, IntPtr header, int headerSize);

    [DllImport("winmm.dll")]
    private static extern int waveInStart(IntPtr input);

    [DllImport("winmm.dll")]
    private static extern int waveInStop(IntPtr input);

    [DllImport("winmm.dll")]
    private static extern int waveInReset(IntPtr input);

    [DllImport("winmm.dll")]
    private static extern int waveInClose(IntPtr input);

    [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
    private static extern int waveInGetErrorText(int errorCode, StringBuilder text, int textSize);

    private static readonly object Sync = new object();
    private static readonly WaveInputCallback Callback = OnAudioBuffer;
    private static FileStream output;
    private static IntPtr activeInput;
    private static long audioBytes;
    private static bool recording;

    public static int Run(string outputPath)
    {
        var buffers = new List<AudioBuffer>();
        int headerSize = Marshal.SizeOf(typeof(WaveHeader));

        try
        {
            var format = new WaveFormat
            {
                FormatTag = 1,
                Channels = Channels,
                SamplesPerSecond = SampleRate,
                AverageBytesPerSecond = SampleRate * Channels * BitsPerSample / 8,
                BlockAlign = (ushort)(Channels * BitsPerSample / 8),
                BitsPerSample = BitsPerSample,
                ExtraSize = 0
            };

            Check(
                waveInOpen(
                    out activeInput,
                    WaveMapper,
                    ref format,
                    Marshal.GetFunctionPointerForDelegate(Callback),
                    IntPtr.Zero,
                    CallbackFunction
                ),
                "Unable to open the default microphone"
            );

            output = new FileStream(outputPath, FileMode.Create, FileAccess.Write, FileShare.Read);
            WriteWaveHeader(output, 0);
            audioBytes = 0;

            for (int index = 0; index < BufferCount; index++)
            {
                var buffer = new AudioBuffer
                {
                    Data = Marshal.AllocHGlobal(BufferSize),
                    Header = Marshal.AllocHGlobal(headerSize)
                };
                var header = new WaveHeader
                {
                    Data = buffer.Data,
                    BufferLength = BufferSize,
                    BytesRecorded = 0
                };
                Marshal.StructureToPtr(header, buffer.Header, false);
                Check(waveInPrepareHeader(activeInput, buffer.Header, headerSize), "Unable to prepare audio buffer");
                Check(waveInAddBuffer(activeInput, buffer.Header, headerSize), "Unable to queue audio buffer");
                buffers.Add(buffer);
            }

            recording = true;
            Check(waveInStart(activeInput), "Unable to start microphone recording");
            Console.Out.WriteLine("READY");
            Console.Out.Flush();

            string command = Console.In.ReadLine();
            if (command == "STOP")
            {
                recording = false;
                waveInStop(activeInput);
                waveInReset(activeInput);
                Thread.Sleep(120);
            }

            lock (Sync)
            {
                output.Position = 0;
                WriteWaveHeader(output, audioBytes);
                output.Flush();
                output.Dispose();
                output = null;
            }

            Cleanup(activeInput, buffers, headerSize);
            activeInput = IntPtr.Zero;
            buffers.Clear();
            WriteMessage("COMPLETE", outputPath);
            return 0;
        }
        catch (Exception error)
        {
            recording = false;
            if (activeInput != IntPtr.Zero)
            {
                waveInReset(activeInput);
                Thread.Sleep(80);
            }
            lock (Sync)
            {
                if (output != null)
                {
                    output.Dispose();
                    output = null;
                }
            }
            if (activeInput != IntPtr.Zero)
            {
                Cleanup(activeInput, buffers, headerSize);
                activeInput = IntPtr.Zero;
            }
            WriteMessage("ERROR", error.Message);
            return 1;
        }
    }

    private static void OnAudioBuffer(
        IntPtr input,
        uint message,
        IntPtr instance,
        IntPtr headerPointer,
        IntPtr reserved
    )
    {
        if (message != WaveDataMessage || headerPointer == IntPtr.Zero)
        {
            return;
        }

        var header = (WaveHeader)Marshal.PtrToStructure(headerPointer, typeof(WaveHeader));
        if (header.BytesRecorded > 0)
        {
            var audio = new byte[header.BytesRecorded];
            Marshal.Copy(header.Data, audio, 0, audio.Length);
            lock (Sync)
            {
                if (output != null)
                {
                    output.Write(audio, 0, audio.Length);
                    audioBytes += audio.Length;
                }
            }
            Console.Out.WriteLine("LEVEL:" + CalculateRms(audio));
            Console.Out.Flush();
        }

        if (recording)
        {
            header.BytesRecorded = 0;
            header.Flags &= ~WaveHeaderDone;
            Marshal.StructureToPtr(header, headerPointer, false);
            waveInAddBuffer(input, headerPointer, Marshal.SizeOf(typeof(WaveHeader)));
        }
    }

    private static int CalculateRms(byte[] audio)
    {
        long sumOfSquares = 0;
        int sampleCount = audio.Length / 2;
        for (int index = 0; index + 1 < audio.Length; index += 2)
        {
            short sample = (short)(audio[index] | (audio[index + 1] << 8));
            sumOfSquares += (long)sample * sample;
        }
        return sampleCount == 0
            ? 0
            : (int)Math.Sqrt((double)sumOfSquares / sampleCount);
    }

    private static void WriteWaveHeader(Stream target, long dataLength)
    {
        var writer = new BinaryWriter(target, Encoding.ASCII, true);
        writer.Write(Encoding.ASCII.GetBytes("RIFF"));
        writer.Write((int)(36 + dataLength));
        writer.Write(Encoding.ASCII.GetBytes("WAVEfmt "));
        writer.Write(16);
        writer.Write((ushort)1);
        writer.Write(Channels);
        writer.Write(SampleRate);
        writer.Write(SampleRate * Channels * BitsPerSample / 8);
        writer.Write((ushort)(Channels * BitsPerSample / 8));
        writer.Write(BitsPerSample);
        writer.Write(Encoding.ASCII.GetBytes("data"));
        writer.Write((int)dataLength);
        writer.Flush();
    }

    private static void Cleanup(IntPtr input, IEnumerable<AudioBuffer> buffers, int headerSize)
    {
        foreach (AudioBuffer buffer in buffers)
        {
            waveInUnprepareHeader(input, buffer.Header, headerSize);
            Marshal.FreeHGlobal(buffer.Header);
            Marshal.FreeHGlobal(buffer.Data);
        }
        waveInClose(input);
    }

    private static void Check(int errorCode, string operation)
    {
        if (errorCode == 0)
        {
            return;
        }
        var errorText = new StringBuilder(256);
        waveInGetErrorText(errorCode, errorText, errorText.Capacity);
        throw new InvalidOperationException(operation + ": " + errorText);
    }

    private static void WriteMessage(string prefix, string message)
    {
        string encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes(message));
        Console.Out.WriteLine(prefix + ":" + encoded);
        Console.Out.Flush();
    }
}
'@

try {
    Add-Type -TypeDefinition $recorderSource
    exit [VoiceAssistantAudioRecorder]::Run($OutputPath)
}
catch {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($_.Exception.Message)
    $encoded = [System.Convert]::ToBase64String($bytes)
    [System.Console]::Out.WriteLine("ERROR:${encoded}")
    [System.Console]::Out.Flush()
    exit 1
}
