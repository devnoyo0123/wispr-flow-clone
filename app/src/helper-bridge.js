const { spawn } = require('child_process');
const path = require('path');
const { EventEmitter } = require('events');
const config = require('./config');

class HelperBridge extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.buf = '';
    this.ready = false;
  }

  start() {
    const bin = path.resolve(__dirname, '../native/wispr-helper');
    this.proc = spawn(bin, [], { stdio: ['pipe', 'pipe', 'pipe'] });

    this.proc.stdout.on('data', (d) => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        this._dispatch(msg);
      }
    });

    this.proc.stderr.on('data', (d) => process.stderr.write(`[helper] ${d}`));
    this.proc.on('exit', (code) => {
      this.ready = false;
      this.emit('exit', code);
    });
  }

  _dispatch(msg) {
    const ev = msg.event;
    if (ev === 'ready' && !this.ready) {
      this.ready = true;
      // push current config once helper is up
      this.send({ cmd: 'set_hotkey', name: config.get('hotkey') });
      this.emit('ready', msg);
      return;
    }
    if (ev) this.emit(ev, msg);
    else this.emit('message', msg);
  }

  send(obj) {
    this.proc?.stdin?.write(JSON.stringify(obj) + '\n');
  }

  stop() {
    try { this.proc?.kill('SIGTERM'); } catch {}
  }
}

module.exports = { HelperBridge };
