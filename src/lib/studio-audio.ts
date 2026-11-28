/** Real PCM/WAV encoding; only loaded when a complete MP3 export is requested. */
export async function wavToMp3(blob: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const label = (at: number, length: number) => String.fromCharCode(...bytes.slice(at, at + length));
  if (label(0, 4) !== 'RIFF' || label(8, 4) !== 'WAVE') throw new Error('Expected real WAV audio.');
  let rate = 0;
  let channels = 0;
  let pcm: Uint8Array | undefined;
  for (let p = 12; p + 8 <= bytes.length;) {
    const size = view.getUint32(p + 4, true);
    const id = label(p, 4);
    if (id === 'fmt ') {
      if (view.getUint16(p + 8, true) !== 1 || view.getUint16(p + 22, true) !== 16) throw new Error('MP3 export requires 16-bit PCM audio.');
      channels = view.getUint16(p + 10, true);
      rate = view.getUint32(p + 12, true);
    }
    if (id === 'data') { pcm = bytes.slice(p + 8, Math.min(bytes.length, p + 8 + size)); break; }
    p += 8 + size + size % 2;
  }
  if (!pcm?.length || !rate || channels !== 1) throw new Error('Unsupported audio format for MP3 export.');
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const encoder = new Mp3Encoder(1, rate, 128);
  const samples = new Int16Array(pcm.length / 2);
  const data = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  for (let i = 0; i < samples.length; i++) samples[i] = data.getInt16(i * 2, true);
  const chunks: ArrayBuffer[] = [];
  for (let i = 0; i < samples.length; i += 1152) {
    const chunk = encoder.encodeBuffer(samples.subarray(i, i + 1152));
    if (chunk.length) chunks.push(new Uint8Array(chunk).buffer);
    if (i % (1152 * 600) === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  const end = encoder.flush();
  if (end.length) chunks.push(new Uint8Array(end).buffer);
  return new Blob(chunks, { type: 'audio/mpeg' });
}