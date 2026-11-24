'use strict';

/**
 * services/chain-anchor 離線測試：用 ganache 在記憶體裡跑一條本機 EVM 鏈，不連 ME Network。
 * 執行：npm run smoke:chain-anchor
 */

const assert = require('assert');
const ganache = require('ganache');
const { ethers } = require('ethers');
const anchor = require('../../services/chain-anchor');

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

(async () => {
  console.log('chain-anchor 離線測試');

  await check('地址轉換：0x ↔ me1 跟實測錢包一致、可以來回', async () => {
    const evm = '0x3f6e31c7Af68208658a12506C34ACB6F10788eCd';
    const me = 'me18ahrr3a0dqsgvk9py5rvxjktdug83rkdsptvmu';
    assert.strictEqual(anchor.toMeAddress(evm), me);
    assert.strictEqual(anchor.fromMeAddress(me).toLowerCase(), evm.toLowerCase());
    assert.throws(() => anchor.fromMeAddress('me18ahrr3a0dqsgvk9py5rvxjktdug83rkdsptvmv'), /檢查碼/);
  });

  await check('沒設定合約／金鑰時回 disabled，不拋例外', async () => {
    const r = await anchor.anchorEvidence({ canonicalPayload: 'x', caseId: 'c' }, { cfg: { contract: '', privateKey: '' } });
    assert.strictEqual(r.status, 'disabled');
    assert.match(r.evidenceHash, /^0x[0-9a-f]{64}$/);
  });

  const g = ganache.provider({ logging: { quiet: true }, chain: { chainId: 400, hardfork: 'merge' }, wallet: { totalAccounts: 3 } });
  const browser = new ethers.BrowserProvider(g);
  const backend = await browser.getSigner(0);
  const stranger = await browser.getSigner(1);
  const supplier = ethers.Wallet.createRandom();

  const factory = new ethers.ContractFactory(anchor.artifact.abi, anchor.artifact.bytecode, backend);
  const deployed = await factory.deploy();
  await deployed.waitForDeployment();
  const cfg = { contract: await deployed.getAddress(), privateKey: '', evmChainId: 400 };

  const payload = JSON.stringify({ caseId: 'TW-STEEL-01', inputHash: 'abc', verification: 'GATE_OK', reasonCodes: [] });
  const hash = anchor.evidenceHashOf(payload);

  await check('方案 1：只存證雜湊，鏈上查得到時間、存證帳號、案件編號', async () => {
    const r = await anchor.anchorEvidence({ canonicalPayload: payload, caseId: 'TW-STEEL-01' }, { cfg, runner: backend });
    assert.strictEqual(r.status, 'anchored', r.error);
    assert.strictEqual(r.evidenceHash, hash);
    const v = await anchor.verifyAnchor(hash, { cfg, runner: browser });
    assert.strictEqual(v.status, 'found');
    assert.strictEqual(v.caseId, 'TW-STEEL-01');
    assert.strictEqual(v.anchorer, await backend.getAddress());
    assert.strictEqual(v.supplier, null);
  });

  await check('同一個雜湊不能存第二次（不能改寫歷史）', async () => {
    const r = await anchor.anchorEvidence({ canonicalPayload: payload, caseId: 'OTHER' }, { cfg, runner: stranger });
    assert.strictEqual(r.status, 'error');
    const v = await anchor.verifyAnchor(hash, { cfg, runner: browser });
    assert.strictEqual(v.caseId, 'TW-STEEL-01');
  });

  await check('沒存過的雜湊查不到', async () => {
    const v = await anchor.verifyAnchor(anchor.evidenceHashOf('never'), { cfg, runner: browser });
    assert.strictEqual(v.status, 'not_found');
  });

  const payload2 = payload.replace('abc', 'def');
  const hash2 = anchor.evidenceHashOf(payload2);

  await check('方案 2：供應商簽名，合約在鏈上還原出供應商地址', async () => {
    const sig = await anchor.signEvidenceAsSupplier(supplier, hash2);
    const r = await anchor.anchorEvidence({ canonicalPayload: payload2, caseId: 'TW-STEEL-01', supplierSignature: sig }, { cfg, runner: backend });
    assert.strictEqual(r.status, 'anchored', r.error);
    assert.strictEqual(r.supplier, supplier.address);
    const v = await anchor.verifyAnchor(hash2, { cfg, runner: browser });
    assert.strictEqual(v.supplier, supplier.address);
    assert.strictEqual(v.supplierMeAddress, anchor.toMeAddress(supplier.address));
  });

  await check('簽的是別份證據 → 還原出的地址不是供應商（鏈上紀錄對不上）', async () => {
    const payload3 = payload.replace('abc', 'ghi');
    const sigForOther = await anchor.signEvidenceAsSupplier(supplier, anchor.evidenceHashOf('別份證據'));
    const r = await anchor.anchorEvidence({ canonicalPayload: payload3, caseId: 'X', supplierSignature: sigForOther }, { cfg, runner: backend });
    assert.strictEqual(r.status, 'anchored');
    assert.notStrictEqual(r.supplier, supplier.address);
  });

  await check('簽名長度不對 → 合約拒絕', async () => {
    const r = await anchor.anchorEvidence({ canonicalPayload: 'bad-sig', caseId: 'X', supplierSignature: '0x1234' }, { cfg, runner: backend });
    assert.strictEqual(r.status, 'error');
  });

  await check('合約的 recoverSigner 跟後端 ethers 的驗簽結果一致', async () => {
    const sig = await anchor.signEvidenceAsSupplier(supplier, hash);
    const onChain = await deployed.recoverSigner(hash, sig);
    assert.strictEqual(onChain, anchor.recoverSupplier(hash, sig));
  });

  await check('ME ID 查詢：有 DID／沒有 DID／節點錯誤 三種回應', async () => {
    const mk = (status, body) => async () => ({ status, json: async () => body });
    const cfgRest = { restUrl: 'http://example.invalid' };
    const found = await anchor.lookupMeId(supplier.address, {
      cfg: cfgRest,
      fetchImpl: mk(200, { info: { did: 'did:me:abc', kycLevel: '2', status: 'active' } }),
    });
    assert.strictEqual(found.status, 'found');
    assert.strictEqual(found.did, 'did:me:abc');
    assert.strictEqual(found.meAddress, anchor.toMeAddress(supplier.address));
    const missing = await anchor.lookupMeId(found.meAddress, {
      cfg: cfgRest,
      fetchImpl: mk(500, { code: 2, message: 'codespace did code 111: DID not found' }),
    });
    assert.strictEqual(missing.status, 'not_found');
    const broken = await anchor.lookupMeId(found.meAddress, {
      cfg: cfgRest,
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    assert.strictEqual(broken.status, 'error');
    const badAddr = await anchor.lookupMeId('cosmos1xyz', { cfg: cfgRest, fetchImpl: mk(200, {}) });
    assert.strictEqual(badAddr.status, 'error');
  });

  console.log(`\n${passed} 項全部通過`);
  process.exit(0);
})().catch((e) => {
  console.error('\n失敗：', e);
  process.exit(1);
});
