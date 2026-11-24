'use strict';

/**
 * services/chain-anchor — 把信任閘門的證據雜湊存證到 ME Network（Meta Earth），並用 ME ID 驗證供應商。
 * BEACON 2026 新增（起點 tag beacon-baseline = 1d5642e，之後的改動都是比賽期間新增）。
 *
 * 跟 services/timestamp 同一個定位：**增量能力，不是放行的必要條件**。
 *   - 所有對外函式都不拋例外，用 status 欄位表達成敗（'anchored' | 'disabled' | 'error' ...），
 *     上鏈失敗不能影響 Gate 判定。
 *   - 只送雜湊上鏈，不送任何原始碳排數據。
 *
 * 兩條證明：
 *   1. 存證：sha256(canonicalPayload) 寫進 EvidenceAnchor 合約，鏈上有時間、存證帳號、案件編號。
 *   2. 供應商身分：供應商用自己的 ME 錢包對同一個雜湊做 EIP-191 簽名，合約在鏈上還原簽名者地址；
 *      後端再查這個地址在 ME Network 上有沒有 ME ID（DID）。兩者都成立，才算「確定是這家供應商親自送的」。
 *
 * 設定（環境變數）：
 *   ME_EVM_RPC_URL        EVM JSON-RPC（測試網預設 http://118.175.0.249:8545）
 *   ME_EVM_CHAIN_ID       測試網 400
 *   ME_REST_URL           Hub REST（測試網預設 http://118.175.0.249:1317），查 ME ID 用
 *   ME_ANCHOR_CONTRACT    已部署的 EvidenceAnchor 地址
 *   ME_ANCHOR_PRIVATE_KEY 送存證交易的後端金鑰（只放 .dev.vars / wrangler secret，不進 git）
 *
 * 已知限制（見 實驗記錄/ME_Network連線測試_20261111.md）：ME 官方端點都是「IP＋非標準埠＋HTTP」，
 * Cloudflare Workers 線上版的 fetch 很可能連不到，所以這個模組目前以本機 Node 入口為主。
 */

const crypto = require('crypto');
const { ethers } = require('ethers');
const artifact = require('./EvidenceAnchor.artifact.json');
const { toMeAddress, fromMeAddress } = require('./meAddress');

const TESTNET_DEFAULTS = Object.freeze({
  evmRpcUrl: 'http://118.175.0.249:8545',
  evmChainId: 400,
  restUrl: 'http://118.175.0.249:1317',
});

function getConfig(env = process.env) {
  return {
    evmRpcUrl: env.ME_EVM_RPC_URL || TESTNET_DEFAULTS.evmRpcUrl,
    evmChainId: Number(env.ME_EVM_CHAIN_ID || TESTNET_DEFAULTS.evmChainId),
    restUrl: env.ME_REST_URL || TESTNET_DEFAULTS.restUrl,
    contract: env.ME_ANCHOR_CONTRACT || '',
    privateKey: env.ME_ANCHOR_PRIVATE_KEY || '',
  };
}

/** 規範化內容 → 0x 開頭的 32 bytes sha256（跟 RFC 3161 時戳用同一份 canonical payload） */
function evidenceHashOf(canonicalPayload) {
  return '0x' + crypto.createHash('sha256').update(String(canonicalPayload), 'utf8').digest('hex');
}

function provider(cfg) {
  return new ethers.JsonRpcProvider(cfg.evmRpcUrl, cfg.evmChainId, { staticNetwork: true });
}

function contractFor(cfg, runner) {
  return new ethers.Contract(cfg.contract, artifact.abi, runner);
}

/** 供應商端：用 ME 錢包（EVM 金鑰）對證據雜湊簽名。Demo 與測試用；正式情境由供應商自己的錢包簽。 */
async function signEvidenceAsSupplier(supplierWallet, evidenceHash) {
  return supplierWallet.signMessage(ethers.getBytes(evidenceHash));
}

/** 不上鏈的簽名檢查：跟合約 recoverSigner 同一套 EIP-191 規則 */
function recoverSupplier(evidenceHash, signature) {
  try {
    return ethers.verifyMessage(ethers.getBytes(evidenceHash), signature);
  } catch {
    return null;
  }
}

/**
 * 查某個地址有沒有 ME ID。接受 0x 或 me1 地址。
 * 回傳 { status: 'found' | 'not_found' | 'error', meAddress, did?, kycLevel?, error? }
 */
async function lookupMeId(address, { cfg = getConfig(), fetchImpl = globalThis.fetch } = {}) {
  let meAddress;
  try {
    meAddress = String(address).startsWith('0x') ? toMeAddress(address) : String(address);
    fromMeAddress(meAddress); // 驗證格式
  } catch (e) {
    return { status: 'error', error: `地址格式不對：${e.message}` };
  }
  try {
    const url = `${cfg.restUrl}/metaearth/did/did?address=${encodeURIComponent(meAddress)}`;
    const res = await fetchImpl(url, { headers: { accept: 'application/json' } });
    const body = await res.json().catch(() => ({}));
    if (body && body.info && body.info.did) {
      return {
        status: 'found',
        meAddress,
        did: body.info.did,
        kycLevel: body.info.kycLevel ?? body.info.kyc_level ?? '',
        regionId: body.info.regionId ?? body.info.region_id ?? '',
        didStatus: body.info.status ?? '',
      };
    }
    const msg = String((body && body.message) || '');
    if (msg.includes('DID not found') || msg.includes('failed to get DID')) {
      return { status: 'not_found', meAddress };
    }
    return { status: 'error', meAddress, error: `HTTP ${res.status} ${msg}`.trim() };
  } catch (e) {
    return { status: 'error', meAddress, error: e.message };
  }
}

/**
 * 存證。supplierSignature 有給就走 anchorWithSupplier（鏈上驗簽），沒給就只存雜湊。
 * 永遠不拋例外。
 */
async function anchorEvidence({ canonicalPayload, caseId, supplierSignature } = {}, { cfg = getConfig(), runner } = {}) {
  const evidenceHash = evidenceHashOf(canonicalPayload);
  if (!cfg.contract || (!cfg.privateKey && !runner)) {
    return { status: 'disabled', evidenceHash, reason: '未設定 ME_ANCHOR_CONTRACT / ME_ANCHOR_PRIVATE_KEY' };
  }
  try {
    const signer = runner || new ethers.Wallet(cfg.privateKey, provider(cfg));
    const c = contractFor(cfg, signer);
    const tx = supplierSignature
      ? await c.anchorWithSupplier(evidenceHash, String(caseId || ''), supplierSignature)
      : await c.anchor(evidenceHash, String(caseId || ''));
    const receipt = await tx.wait();
    const supplier = supplierSignature ? recoverSupplier(evidenceHash, supplierSignature) : null;
    return {
      status: 'anchored',
      network: 'ME Network',
      chainId: cfg.evmChainId,
      contract: cfg.contract,
      evidenceHash,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      anchorer: await signer.getAddress(),
      supplier,
      supplierMeAddress: supplier ? toMeAddress(supplier) : null,
    };
  } catch (e) {
    const reason = (e && (e.shortMessage || e.reason || e.message)) || String(e);
    return { status: 'error', evidenceHash, error: reason };
  }
}

/** 任何人都能做的查證：讀合約，不需要金鑰 */
async function verifyAnchor(evidenceHash, { cfg = getConfig(), runner } = {}) {
  if (!cfg.contract) return { status: 'disabled' };
  try {
    const c = contractFor(cfg, runner || provider(cfg));
    const [exists, anchoredAt, anchorer, supplier, caseId] = await c.verify(evidenceHash);
    if (!exists) return { status: 'not_found', evidenceHash };
    const hasSupplier = supplier !== ethers.ZeroAddress;
    return {
      status: 'found',
      evidenceHash,
      anchoredAt: new Date(Number(anchoredAt) * 1000).toISOString(),
      anchorer,
      supplier: hasSupplier ? supplier : null,
      supplierMeAddress: hasSupplier ? toMeAddress(supplier) : null,
      caseId,
    };
  } catch (e) {
    return { status: 'error', evidenceHash, error: e.shortMessage || e.message };
  }
}

module.exports = {
  TESTNET_DEFAULTS,
  getConfig,
  evidenceHashOf,
  signEvidenceAsSupplier,
  recoverSupplier,
  lookupMeId,
  anchorEvidence,
  verifyAnchor,
  toMeAddress,
  fromMeAddress,
  artifact,
};
