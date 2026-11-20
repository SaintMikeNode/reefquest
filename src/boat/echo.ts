// Ring buffer of recent soundings for the echogram strip (10 Hz, ~60 s).
export const ECHO_N = 600;
export const echo = {
  depth: new Float32Array(ECHO_N),
  benthic: new Uint8Array(ECHO_N),
  head: 0,
  count: 0,
  push(d: number, b: number) {
    this.depth[this.head] = d;
    this.benthic[this.head] = b;
    this.head = (this.head + 1) % ECHO_N;
    this.count = Math.min(ECHO_N, this.count + 1);
  },
  reset() {
    this.head = 0;
    this.count = 0;
  },
};
