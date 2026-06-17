// Native push-to-talk + paste prototype v2.
// FIX: modifier keys (Option/Cmd) fire as .flagsChanged, NOT .keyDown/.keyUp.
//      So we watch .flagsChanged and detect transitions of the device-specific
//      bits for RIGHT CMD (0x10) and RIGHT OPTION (0x40).
// Whichever you hold fires START; releasing fires STOP + paste.
//
// Compile: swiftc ptt-tap.swift -o ptt-tap -framework Cocoa
// Run:     ./ptt-tap    (focus TextEdit, hold Right Cmd or Right Option, release)

import Cocoa
import CoreGraphics

let RIGHT_CMD_BIT: UInt64 = 0x10 // NX_DEVICERCMDKEYMASK
let RIGHT_OPT_BIT: UInt64 = 0x40 // NX_DEVICERALTKEYMASK
let TEST_TEXT = "안녕하세요! push-to-talk 스파이크 성공 🎉 (수식키 홀드 후 릴리스)"

var heldKey: String? = nil
var pressAt = Date()

func setClipboardAndPaste(_ text: String) {
    let pb = NSPasteboard.general
    pb.clearContents()
    pb.setString(text, forType: .string)
    Thread.sleep(forTimeInterval: 0.05)
    let src = CGEventSource(stateID: .hidSystemState)
    let vDown = CGEvent(keyboardEventSource: src, virtualKey: 9, keyDown: true)  // 9 = V
    let vUp   = CGEvent(keyboardEventSource: src, virtualKey: 9, keyDown: false)
    vDown?.flags = .maskCommand
    vUp?.flags   = .maskCommand
    vDown?.post(tap: .cghidEventTap)
    vUp?.post(tap: .cghidEventTap)
}

func start(_ k: String) {
    heldKey = k
    pressAt = Date()
    print("🔴 RECORDING... (\(k) down)")
}
func stop() {
    let heldMs = Int(Date().timeIntervalSince(pressAt) * 1000)
    let k = heldKey ?? "?"
    heldKey = nil
    print("⏹️  STOP — \(k) released after \(heldMs)ms. Pasting into focused app...")
    DispatchQueue.global().async {
        setClipboardAndPaste(TEST_TEXT)
        print("   done. (if nothing appeared → grant Accessibility to Terminal)")
    }
}

// watch keyDown + keyUp + flagsChanged
let mask = (1 << CGEventType.keyDown.rawValue)
         | (1 << CGEventType.keyUp.rawValue)
         | (1 << CGEventType.flagsChanged.rawValue)

let cb: CGEventTapCallBack = { _, type, event, _ in
    guard type == .flagsChanged else { return Unmanaged.passUnretained(event) }
    let f = event.flags.rawValue
    let cmdNow = (f & RIGHT_CMD_BIT) != 0
    let optNow = (f & RIGHT_OPT_BIT) != 0

    if heldKey == nil {
        if cmdNow      { start("Right Cmd") }
        else if optNow { start("Right Option") }
    } else {
        if heldKey == "Right Cmd" && !cmdNow    { stop() }
        else if heldKey == "Right Option" && !optNow { stop() }
    }
    return Unmanaged.passUnretained(event)
}

guard let tap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .listenOnly,
    eventsOfInterest: CGEventMask(mask),
    callback: cb,
    userInfo: nil) else {
    print("🔴 TAP FAILED — Input Monitoring permission missing.")
    exit(2)
}

signal(SIGINT) { _ in print("\nstopping..."); exit(0) }

print("=== native PTT + paste prototype v2 (flagsChanged) ===")
print("Hold RIGHT CMD  or  RIGHT OPTION  = record; release = paste test text.")
print("TIP: open TextEdit and click into it FIRST, so it receives the paste.")
print("Ctrl+C to quit.\n")

let rlSrc = CFMachPortCreateRunLoopSource(nil, tap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), rlSrc, .commonModes)
CGEvent.tapEnable(tap: tap, enable: true)
CFRunLoopRun()
