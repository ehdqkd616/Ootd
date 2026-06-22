// Generates assets/icon.ico (16x16, 32x32, 48x48 RGBA bitmaps in a single ICO)
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function crc32(buf) {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  let v = 0xFFFFFFFF;
  for (const b of buf) v = t[(v ^ b) & 0xFF] ^ (v >>> 8);
  return (v ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const tp  = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tp, data])));
  return Buffer.concat([len, tp, data, crc]);
}

function makePng(size, r, g, b) {
  const cx = (size - 1) / 2, cy = (size - 1) / 2, rad = size / 2 - 1;
  const sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = [];
  for (let y = 0; y < size; y++) {
    raw.push(0);
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const a = d < rad ? 255 : d < rad + 1.2 ? Math.round(255 * (rad + 1.2 - d) / 1.2) : 0;
      raw.push(r, g, b, a);
    }
  }
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.from(raw))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ICO format: header + directory + PNG data
const sizes  = [16, 32, 48, 256];
const images = sizes.map((s) => makePng(s, 0x22, 0xC5, 0x5E)); // green

// ICO header: RESERVED(2) TYPE(2=1) COUNT(2)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);

// Directory entries: 16 bytes each
const dirEntry = Buffer.alloc(16 * sizes.length);
let offset = 6 + 16 * sizes.length;
for (let i = 0; i < sizes.length; i++) {
  const s    = sizes[i];
  const data = images[i];
  dirEntry[i * 16 + 0] = s === 256 ? 0 : s; // width (0 = 256)
  dirEntry[i * 16 + 1] = s === 256 ? 0 : s; // height
  dirEntry[i * 16 + 2] = 0;  // color count
  dirEntry[i * 16 + 3] = 0;  // reserved
  dirEntry.writeUInt16LE(1,    i * 16 + 4); // planes
  dirEntry.writeUInt16LE(32,   i * 16 + 6); // bit count
  dirEntry.writeUInt32LE(data.length, i * 16 + 8);  // size
  dirEntry.writeUInt32LE(offset,      i * 16 + 12); // offset
  offset += data.length;
}

const ico = Buffer.concat([header, dirEntry, ...images]);
const outPath = path.join(__dirname, 'assets', 'icon.ico');
fs.writeFileSync(outPath, ico);
console.log(`Created ${outPath} (${ico.length} bytes, sizes: ${sizes.join(',')})`);
