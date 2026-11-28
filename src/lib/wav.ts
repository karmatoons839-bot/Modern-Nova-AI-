/** Joins real WAV (PCM) clips into one WAV file, in order. */
export async function mergeWavUrls(urls: string[]): Promise<Blob> {
  const buffers = await Promise.all(urls.map(async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer())));
  let fmt: Uint8Array | null = null;
  const chunks: Uint8Array[] = [];
  for (const b of buffers) {
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let p = 12;
    while (p + 8 <= b.length) {
      const id = String.fromCharCode(...b.slice(p, p + 4));
      let size = view.getUint32(p + 4, true);
      if (id === "fmt ") {
        const next = b.slice(p + 8, p + 8 + size);
        if (fmt && (next.length !== fmt.length || next.some((value, index) => value !== fmt?.[index]))) throw new Error("Audio formats do not match.");
        fmt = next;
      }
      if (id === "data") {
        if (size === 0 || size === 0xffffffff || p + 8 + size > b.length) size = b.length - p - 8;
        chunks.push(b.slice(p + 8, p + 8 + size));
        break;
      }
      p += 8 + size + (size % 2);
    }
  }
  if (!fmt || chunks.length !== urls.length || urls.length === 0) throw new Error("Audio clips are not complete WAV files");
  const dataLen = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(12 + 8 + fmt.length + 8 + dataLen);
  const dv = new DataView(out.buffer);
  const w = (o: number, s: string) => [...s].forEach((ch, i) => (out[o + i] = ch.charCodeAt(0)));
  w(0, "RIFF");
  dv.setUint32(4, out.length - 8, true);
  w(8, "WAVE");
  w(12, "fmt ");
  dv.setUint32(16, fmt.length, true);
  out.set(fmt, 20);
  let o = 20 + fmt.length;
  w(o, "data");
  dv.setUint32(o + 4, dataLen, true);
  o += 8;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return new Blob([out], { type: "audio/wav" });
}
