'use strict';

/**
 * ME Network 地址轉換：ethermint 系的同一把 secp256k1 金鑰，EVM 地址（0x…，20 bytes）
 * 跟 Cosmos 地址（me1…）是同一串 20 bytes，只是編碼不同（bech32，前綴 'me'）。
 * 自己實作 bech32（BIP-173），不多拉一個依賴。
 */

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const PREFIX = 'me';

function polymod(values) {
  let chk = 1;
  for (const v of values) {
    const b = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((b >>> i) & 1) chk ^= GEN[i];
  }
  return chk >>> 0;
}

function hrpExpand(hrp) {
  const out = [];
  for (const c of hrp) out.push(c.charCodeAt(0) >> 5);
  out.push(0);
  for (const c of hrp) out.push(c.charCodeAt(0) & 31);
  return out;
}

function convertBits(data, from, to, pad) {
  let acc = 0;
  let bits = 0;
  const out = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    if (value < 0 || value >> from) throw new Error('invalid value');
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) out.push((acc << (to - bits)) & maxv);
  } else if (bits >= from || ((acc << (to - bits)) & maxv)) {
    throw new Error('invalid padding');
  }
  return out;
}

function toMeAddress(evmAddress) {
  const hex = String(evmAddress).replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{40}$/.test(hex)) throw new Error('EVM 地址必須是 20 bytes hex');
  const bytes = hex.match(/../g).map((h) => parseInt(h, 16));
  const words = convertBits(bytes, 8, 5, true);
  const values = hrpExpand(PREFIX).concat(words, [0, 0, 0, 0, 0, 0]);
  const mod = polymod(values) ^ 1;
  const checksum = [];
  for (let i = 0; i < 6; i++) checksum.push((mod >> (5 * (5 - i))) & 31);
  return PREFIX + '1' + words.concat(checksum).map((w) => CHARSET[w]).join('');
}

function fromMeAddress(meAddress) {
  const s = String(meAddress).toLowerCase();
  const pos = s.lastIndexOf('1');
  if (s.slice(0, pos) !== PREFIX) throw new Error('不是 me1 開頭的地址');
  const data = [];
  for (const c of s.slice(pos + 1)) {
    const v = CHARSET.indexOf(c);
    if (v === -1) throw new Error('含有 bech32 不允許的字元');
    data.push(v);
  }
  if (polymod(hrpExpand(PREFIX).concat(data)) !== 1) throw new Error('bech32 檢查碼錯誤');
  const bytes = convertBits(data.slice(0, -6), 5, 8, false);
  if (bytes.length !== 20) throw new Error('長度不是 20 bytes');
  return '0x' + bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

module.exports = { toMeAddress, fromMeAddress, PREFIX };
