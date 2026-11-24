'use strict';
/**
 * 離線編譯 EvidenceAnchor.sol → services/chain-anchor/EvidenceAnchor.artifact.json
 * 跟 packages/contracts/buildValidators.js 同一個模式：build time 產生靜態產物，執行期直接 require()，
 * 不在 Workers 裡動態編譯（見 CLAUDE.md「Code generation from strings disallowed」）。
 * evmVersion 固定 paris：ME Network 是 ethermint/evmos 系，不確定支援 Shanghai 的 PUSH0，保守不用。
 * 改了 .sol 要重跑：node contracts/me/build.js
 */
const fs = require('fs');
const path = require('path');
const solc = require('solc');

const src = fs.readFileSync(path.join(__dirname, 'EvidenceAnchor.sol'), 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'EvidenceAnchor.sol': { content: src } },
  settings: {
    evmVersion: 'paris',
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (out.errors || []).filter((e) => e.severity === 'error');
for (const e of out.errors || []) console.error(e.formattedMessage);
if (errors.length) process.exit(1);
const c = out.contracts['EvidenceAnchor.sol'].EvidenceAnchor;
const artifact = {
  contractName: 'EvidenceAnchor',
  compiler: `solc ${solc.version()}`,
  evmVersion: 'paris',
  sourceSha256: require('crypto').createHash('sha256').update(src).digest('hex'),
  abi: c.abi,
  bytecode: '0x' + c.evm.bytecode.object,
};
const dest = path.join(__dirname, '..', '..', 'services', 'chain-anchor', 'EvidenceAnchor.artifact.json');
fs.writeFileSync(dest, JSON.stringify(artifact, null, 2) + '\n');
console.log('wrote', path.relative(process.cwd(), dest), 'bytecode', c.evm.bytecode.object.length / 2, 'bytes');
