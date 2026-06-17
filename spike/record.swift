// Mic recording spike — AVAudioRecorder writes 16kHz mono WAV directly
// (whisper.cpp requires 16kHz; AVAudioRecorder resamples internally).
//
// Compile: swiftc record.swift -o record -framework AVFoundation
// Run:     ./record [out.wav] [seconds]
//   default: rec.wav, 4s
//
// macOS will prompt for Microphone permission the first time (grant to your terminal).

import AVFoundation

let args = CommandLine.arguments
let outPath = args.count > 1 ? args[1] : "rec.wav"
let seconds = args.count > 2 ? (Double(args[2]) ?? 4.0) : 4.0

let url = URL(fileURLWithPath: outPath)
let settings: [String: Any] = [
    AVFormatIDKey: kAudioFormatLinearPCM,
    AVSampleRateKey: 16000,
    AVNumberOfChannelsKey: 1,
    AVLinearPCMBitDepthKey: 16,
    AVLinearPCMIsFloatKey: false,
    AVLinearPCMIsBigEndianKey: false,
    AVLinearPCMIsNonInterleaved: false,
]

var recorder: AVAudioRecorder
do {
    recorder = try AVAudioRecorder(url: url, settings: settings)
} catch {
    print("❌ cannot init recorder: \(error)")
    exit(1)
}

guard recorder.record() else {
    print("❌ record() returned false — likely Microphone permission denied.")
    print("   System Settings > Privacy & Security > Microphone > enable your terminal, restart.")
    exit(2)
}

print("🎤 recording \(seconds)s -> \(outPath) (speak Korean now!) ...")
Thread.sleep(forTimeInterval: seconds)
recorder.stop()

// report
let fm = FileManager.default
if fm.fileExists(atPath: outPath) {
    let sz = (try? fm.attributesOfItem(atPath: outPath)[.size] as? Int) ?? 0
    print("✅ saved \(outPath) (\(sz) bytes)")
    if sz < 1000 { print("⚠️  file very small — mic permission or no input?") }
} else {
    print("❌ file not created")
}
