param(
    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

$recorderSource = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class VoiceAssistantAudioRecorder
{
    [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
    private static extern int mciSendString(
        string command,
        StringBuilder returnValue,
        int returnLength,
        IntPtr callback
    );

    [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
    private static extern bool mciGetErrorString(
        int errorCode,
        StringBuilder errorText,
        int errorTextSize
    );

    public static void Run(string outputPath)
    {
        try
        {
            Send("open new type waveaudio alias voiceassistant");
            Send(
                "set voiceassistant time format ms bitspersample 16 channels 1 " +
                "samplespersec 16000 bytespersec 32000 alignment 2"
            );
            Send("record voiceassistant");
            Console.Out.WriteLine("READY");
            Console.Out.Flush();

            string command = Console.In.ReadLine();
            if (command == "STOP")
            {
                Send("stop voiceassistant");
                Send("save voiceassistant \"" + outputPath.Replace("\"", "\"\"") + "\"");
            }

            Send("close voiceassistant");
            WriteMessage("COMPLETE", outputPath);
        }
        catch (Exception error)
        {
            TryClose();
            WriteMessage("ERROR", error.Message);
            Environment.ExitCode = 1;
        }
    }

    private static void Send(string command)
    {
        int errorCode = mciSendString(command, null, 0, IntPtr.Zero);
        if (errorCode == 0)
        {
            return;
        }

        var errorText = new StringBuilder(256);
        mciGetErrorString(errorCode, errorText, errorText.Capacity);
        throw new InvalidOperationException(errorText.ToString());
    }

    private static void TryClose()
    {
        mciSendString("close voiceassistant", null, 0, IntPtr.Zero);
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
    [VoiceAssistantAudioRecorder]::Run($OutputPath)
    exit [System.Environment]::ExitCode
}
catch {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($_.Exception.Message)
    $encoded = [System.Convert]::ToBase64String($bytes)
    [System.Console]::Out.WriteLine("ERROR:${encoded}")
    [System.Console]::Out.Flush()
    exit 1
}
