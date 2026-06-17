// Native CGEventTap test — isolates macOS permission from the uiohook library.
// If "TAP FAILED" -> Input Monitoring permission is genuinely missing.
// If "tap created OK" + events flow -> permission fine, uiohook is the culprit.
//
// Compile: swiftc tap.swift -o tap -framework Cocoa
// Run:     ./tap   (press keys during the 8s window)

import Cocoa
import CoreGraphics

var down = 0
var up = 0

let mask = (1 << CGEventType.keyDown.rawValue) | (1 << CGEventType.keyUp.rawValue)

let cb: CGEventTapCallBack = { _, type, event, _ in
    let kc = event.getIntegerValueField(.keyboardEventKeycode)
    if type == .keyDown { down += 1; print("⬇️ DOWN keyCode=\(kc)") }
    if type == .keyUp   { up += 1;   print("⬆️ UP   keyCode=\(kc)") }
    return Unmanaged.passUnretained(event)
}

guard let tap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .listenOnly,
    eventsOfInterest: CGEventMask(mask),
    callback: cb,
    userInfo: nil) else {
    print("🔴 TAP FAILED — Input Monitoring permission is NOT granted for this process.")
    print("   This is definitive: macOS refused to create the event tap.")
    print("   Fix: System Settings > Privacy & Security > Input Monitoring > enable your terminal, then FULLY quit & reopen it.")
    exit(2)
}

print("🟢 tap created OK — permission granted at creation.")
print("   Listening 8s — PRESS & RELEASE keys (a s d) NOW...\n")

let src = CFMachPortCreateRunLoopSource(nil, tap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), src, .commonModes)
CGEvent.tapEnable(tap: tap, enable: true)

DispatchQueue.global().async {
    Thread.sleep(forTimeInterval: 8)
    print("\n---- result ----")
    print("keydown:", down, " keyup:", up)
    if down > 0 && up > 0 {
        print("✅ NATIVE TAP WORKS — key events flow. (uiohook would be the culprit, not permission)")
    } else if down == 0 && up == 0 {
        print("⚠️  tap created but ZERO events. Either no keys pressed, or macOS filters events despite creation.")
    }
    exit(0)
}

CFRunLoopRun()
