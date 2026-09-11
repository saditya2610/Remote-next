// generate-icon.js — Generate a 256x256 ICO for electron-builder
// Creates a valid ICO file with a NexLink lightning-bolt icon

const fs   = require('fs');
const path = require('path');

function createICO256() {
  const SIZE = 256;
  const BPP  = 32; // BGRA

  // ── BITMAPINFOHEADER (40 bytes) ────────────────────────────
  const hdr = Buffer.alloc(40);
  hdr.writeUInt32LE(40,       0);  // biSize
  hdr.writeInt32LE( SIZE,     4);  // biWidth
  hdr.writeInt32LE( SIZE * 2, 8);  // biHeight (×2 for ICO convention)
  hdr.writeUInt16LE(1,       12);  // biPlanes
  hdr.writeUInt16LE(BPP,     14);  // biBitCount
  hdr.writeUInt32LE(0,       16);  // biCompression (BI_RGB)
  hdr.writeUInt32LE(SIZE * SIZE * 4, 20); // biSizeImage
  hdr.writeInt32LE( 0,       24);  // biXPelsPerMeter
  hdr.writeInt32LE( 0,       28);  // biYPelsPerMeter
  hdr.writeUInt32LE(0,       32);  // biClrUsed
  hdr.writeUInt32LE(0,       36);  // biClrImportant

  // ── Pixel data (BGRA, bottom-up) ────────────────────────────
  const px = Buffer.alloc(SIZE * SIZE * 4, 0); // start fully transparent

  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R  = SIZE / 2 - 2; // outer radius of circle

  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      // ICO pixels are stored bottom-up
      const storeRow = SIZE - 1 - row;
      const idx = (storeRow * SIZE + col) * 4;

      const dx = col - cx;
      const dy = row - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > R) continue; // outside circle → transparent

      // ── Background: dark navy #070B17 ─────────────────
      let B = 0x17, G = 0x0B, R_ = 0x07, A = 255;

      // ── Gradient ring (outer 12px): electric blue → cyan ──
      const ringStart = R - 14;
      if (dist >= ringStart) {
        const t = Math.max(0, Math.min(1, (dist - ringStart) / 14));
        // Blend: navy → electric blue (#2D7EFF) at ring, fade at edge
        const alpha = dist <= R - 2 ? 255 : Math.round(255 * (1 - (dist - (R - 2)) / 2));
        B  = Math.round(0x17 + (0xFF - 0x17) * t);
        G  = Math.round(0x0B + (0x7E - 0x0B) * t);
        R_ = Math.round(0x07 + (0x2D - 0x07) * t);
        A  = alpha;
      }

      // ── Soft glow in center ────────────────────────────
      const glowR = R * 0.5;
      if (dist < glowR) {
        const g = Math.max(0, 1 - dist / glowR) * 0.12;
        B  = Math.min(255, Math.round(B  + (0xFF - B)  * g));
        G  = Math.min(255, Math.round(G  + (0x7E - G)  * g));
        R_ = Math.min(255, Math.round(R_ + (0x2D - R_) * g));
      }

      // ── Lightning bolt ⚡ ──────────────────────────────
      // Bolt is drawn in icon-space (col/row 0-255)
      // Upper half bolt: right-leaning triangle top-center → middle-left
      // Lower half bolt: middle-right → bottom-center

      const bInBolt = isInBolt(col, row, SIZE);
      if (bInBolt) {
        // White/yellow bolt with blue glow
        const edgeDist = bInBolt; // 0..1 (1 = center of bolt)
        const brightness = 0.85 + edgeDist * 0.15;
        B  = Math.round(200 * brightness);
        G  = Math.round(230 * brightness);
        R_ = Math.round(255 * brightness);
        A  = 255;
      }

      // Anti-alias at circle edge
      if (dist > R - 1.5) {
        A = Math.round(A * (1 - (dist - (R - 1.5)) / 1.5));
      }

      px[idx + 0] = B;
      px[idx + 1] = G;
      px[idx + 2] = R_;
      px[idx + 3] = A;
    }
  }

  // ── AND mask (all opaque, 1-bit, padded to 4-byte rows) ─────
  const maskRowBytes = Math.ceil(SIZE / 32) * 4;
  const mask = Buffer.alloc(SIZE * maskRowBytes, 0);

  // ── Assemble ICO ─────────────────────────────────────────────
  const imageData  = Buffer.concat([hdr, px, mask]);
  const imageSize  = imageData.length;
  const imageOffset = 6 + 16; // ICONDIR(6) + ICONDIRENTRY(16)

  // ICONDIR
  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // type = icon
  dir.writeUInt16LE(1, 4); // count = 1

  // ICONDIRENTRY
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0,          0); // width  (0 = 256)
  entry.writeUInt8(0,          1); // height (0 = 256)
  entry.writeUInt8(0,          2); // color count (0 = >8bpp)
  entry.writeUInt8(0,          3); // reserved
  entry.writeUInt16LE(1,       4); // planes
  entry.writeUInt16LE(BPP,     6); // bit count
  entry.writeUInt32LE(imageSize,  8); // bytes in resource
  entry.writeUInt32LE(imageOffset,12); // offset

  return Buffer.concat([dir, entry, imageData]);
}

// ── Lightning bolt hit-test ───────────────────────────────────
// Returns 0 (outside) or 0..1 (inside, higher = center)
function isInBolt(col, row, S) {
  // Normalize to 0-1
  const x = col / S;
  const y = row / S;

  // Upper bolt shard: from top-right down to mid-left
  // Occupies roughly x:[0.42,0.72], y:[0.12,0.52]
  const inUpper = (
    x >= 0.38 && x <= 0.72 &&
    y >= 0.10 && y <= 0.53 &&
    // Left edge: slants from (0.58,0.10) to (0.38,0.53)
    x >= 0.58 - (y - 0.10) / (0.53 - 0.10) * (0.58 - 0.38) &&
    // Right edge: slants from (0.72,0.10) to (0.52,0.53)
    x <= 0.72 - (y - 0.10) / (0.53 - 0.10) * (0.72 - 0.52)
  );

  // Lower bolt shard: from mid-right down to bottom-left
  // Occupies roughly x:[0.28,0.62], y:[0.48,0.90]
  const inLower = (
    x >= 0.28 && x <= 0.63 &&
    y >= 0.47 && y <= 0.90 &&
    // Left edge: slants from (0.28,0.47) to (0.42,0.90)
    x >= 0.28 + (y - 0.47) / (0.90 - 0.47) * (0.42 - 0.28) &&
    // Right edge: slants from (0.62,0.47) to (0.48,0.90)
    x <= 0.62 - (y - 0.47) / (0.90 - 0.47) * (0.62 - 0.48)
  );

  if (!inUpper && !inLower) return 0;

  // Return a softness value (distance from boundary) — simplified
  return 0.7;
}

// ── Write ─────────────────────────────────────────────────────
const outPath = path.join(__dirname, 'electron', 'icon.ico');
const ico = createICO256();
fs.writeFileSync(outPath, ico);
console.log(`✓ Icon generated: ${outPath} (${ico.length} bytes, 256×256 @ 32bpp)`);
