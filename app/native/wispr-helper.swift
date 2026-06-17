// wispr-helper — unified native helper for the Wispr Flow clone.
// Spawned by Electron main as a child process. Talks JSON-lines over stdio.
//
// Capabilities (all proven in the spike):
//   - Global hotkey via CGEventTap + flagsChanged (modifier device bits)
//   - Mic recording via AVAudioRecorder -> 16kHz mono WAV
//   - Paste into focused app via NSPasteboard + CGEvent Cmd+V
//
// stdout (helper -> main):
//   {"event":"ready","hotkey":"rightCmd"}
//   {"event":"recording_started","hotkey":"rightCmd"}
//   {"event":"recording_stopped","wav":"/tmp/wispr-*.wav","duration_ms":1948}
//   {"event":"hotkey_set","hotkey":"rightOption"}
//   {"event":"error","message":"..."} | {"event":"fatal","message":"..."}
// stdin (main -> helper):
//   {"cmd":"set_hotkey","name":"rightCmd"}
//   {"cmd":"paste","text":"..."}
//
// Build: swiftc wispr-helper.swift -o wispr-helper -framework Cocoa -framework AVFoundation

import Cocoa
import CoreGraphics
import AVFoundation

// --- Modifier name -> device-specific bit (NX_DEVICExxxKEYMASK) ---
let MODIFIERS: [String: (bit: UInt64, label: String)] = [
    "rightCmd":     (0x10,   "Right Command"),
    "rightOption":  (0x40,   "Right Option"),
    "leftCmd":      (0x08,   "Left Command"),
    "leftOption":   (0x20,   "Left Option"),
    "rightControl": (0x2000, "Right Control"),
    "leftControl":  (0x01,   "Left Control"),
]

// --- shared state (tap callback on main run loop; stdin on a bg queue) ---
let stateLock = NSLock()
var hotkeyName = "rightCmd"
var recording = false
var pressAt = Date()
var recorder: AVAudioRecorder?
var wavPath = ""

// --- stdout: unbuffered JSON line ---
func send(_ obj: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: obj) else { return }
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data([0x0A]))
}

func startRecording() -> Bool {
    let fn = "wispr-\(Int(Date().timeIntervalSince1970 * 1000)).wav"
    wavPath = (NSTemporaryDirectory() as NSString).appendingPathComponent(fn)
    let url = URL(fileURLWithPath: wavPath)
    let settings: [String: Any] = [
        AVFormatIDKey: kAudioFormatLinearPCM,
        AVSampleRateKey: 16000,
        AVNumberOfChannelsKey: 1,
        AVLinearPCMBitDepthKey: 16,
        AVLinearPCMIsFloatKey: false,
        AVLinearPCMIsBigEndianKey: false,
        AVLinearPCMIsNonInterleaved: false,
    ]
    guard let r = try? AVAudioRecorder(url: url, settings: settings) else { return false }
    recorder = r
    return r.record()
}

func pasteText(_ text: String) {
    let pb = NSPasteboard.general
    pb.clearContents()
    pb.setString(text, forType: .string)
    DispatchQueue.global().async {
        Thread.sleep(forTimeInterval: 0.05)
        let src = CGEventSource(stateID: .hidSystemState)
        let vDown = CGEvent(keyboardEventSource: src, virtualKey: 9, keyDown: true)  // 9 = V
        let vUp   = CGEvent(keyboardEventSource: src, virtualKey: 9, keyDown: false)
        vDown?.flags = .maskCommand
        vUp?.flags   = .maskCommand
        vDown?.post(tap: .cghidEventTap)
        vUp?.post(tap: .cghidEventTap)
    }
}

func handleCommand(_ cmd: [String: Any]) {
    guard let op = cmd["cmd"] as? String else { return }
    switch op {
    case "set_hotkey":
        if let name = cmd["name"] as? String, MODIFIERS[name] != nil {
            stateLock.lock(); hotkeyName = name; stateLock.unlock()
            send(["event": "hotkey_set", "hotkey": name])
        } else {
            send(["event": "error", "message": "unknown hotkey: \(cmd["name"] ?? "?")"])
        }
    case "paste":
        if let text = cmd["text"] as? String { pasteText(text) }
    default:
        send(["event": "error", "message": "unknown cmd: \(op)"])
    }
}

// --- event tap ---
let mask = (1 << CGEventType.flagsChanged.rawValue)
         | (1 << CGEventType.keyDown.rawValue)
         | (1 << CGEventType.keyUp.rawValue)

let cb: CGEventTapCallBack = { _, type, event, _ in
    guard type == .flagsChanged else { return Unmanaged.passUnretained(event) }

    stateLock.lock()
    let name = hotkeyName
    let bit = MODIFIERS[name]?.bit
    stateLock.unlock()
    guard let bit = bit else { return Unmanaged.passUnretained(event) }

    let nowDown = (event.flags.rawValue & bit) != 0

    stateLock.lock()
    if nowDown && !recording {
        recording = true
        pressAt = Date()
        let ok = startRecording()
        let rec = recording
        stateLock.unlock()
        if ok {
            send(["event": "recording_started", "hotkey": name])
        } else {
            stateLock.lock(); recording = false; recorder = nil; stateLock.unlock()
            _ = rec
            send(["event": "error", "message": "AVAudioRecorder start failed (mic permission?)"])
        }
    } else if !nowDown && recording {
        let dur = Int(Date().timeIntervalSince(pressAt) * 1000)
        let path = wavPath
        recording = false
        let r = recorder
        recorder = nil
        stateLock.unlock()
        r?.stop()
        send(["event": "recording_stopped", "wav": path, "duration_ms": dur])
    } else {
        stateLock.unlock()
    }
    return Unmanaged.passUnretained(event)
}

// --- stdin JSON-lines reader ---
var inputBuf = Data()
FileHandle.standardInput.readabilityHandler = { handle in
    let chunk = handle.availableData
    if chunk.isEmpty { return }
    inputBuf.append(chunk)
    while let nl = inputBuf.firstIndex(of: 0x0A) {
        let line = inputBuf.subdata(in: 0..<nl)
        inputBuf.removeSubrange(0...nl)
        if let obj = try? JSONSerialization.jsonObject(with: line) as? [String: Any] {
            handleCommand(obj)
        }
    }
}

// --- boot ---
guard let tap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .listenOnly,
    eventsOfInterest: CGEventMask(mask),
    callback: cb,
    userInfo: nil) else {
    send(["event": "fatal", "message": "CGEventTap creation failed — grant Input Monitoring to the app"])
    exit(2)
}

signal(SIGTERM) { _ in exit(0) }
signal(SIGINT)  { _ in exit(0) }

let rlSrc = CFMachPortCreateRunLoopSource(nil, tap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), rlSrc, .commonModes)
CGEvent.tapEnable(tap: tap, enable: true)

send(["event": "ready", "hotkey": hotkeyName])
CFRunLoopRun()
