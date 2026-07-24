'use strict';

const PCF_REQUIRED_FIELDS = [
  'tCO2e',
  'unit',
  'method',
  'boundary',
  'period',
  'supplierId',
];

const PCF_LEVEL2_FIELDS = [
  { key: 'cnCode', label: '產品 CN 碼' },
  { key: 'emissionPerUnit', label: '單位產品排放' },
  { key: 'verificationStatus', label: '查驗狀態' },
];

function hasPcfQualityFields(input) {
  if (!input || typeof input !== 'object') return false;
  return PCF_REQUIRED_FIELDS.every((k) => {
    const v = input[k];
    if (v == null) return false;
    if (typeof v === 'string' && v.trim() === '') return false;
    if (k === 'tCO2e' && !Number.isFinite(Number(v))) return false;
    return true;
  });
}

function getMissingLevel1(input) {
  if (!input || typeof input !== 'object') return PCF_REQUIRED_FIELDS.slice();
  return PCF_REQUIRED_FIELDS.filter((k) => {
    const v = input[k];
    if (v == null) return true;
    if (typeof v === 'string' && v.trim() === '') return true;
    if (k === 'tCO2e' && !Number.isFinite(Number(v))) return true;
    return false;
  });
}

function getMissingLevel2(input) {
  if (!input || typeof input !== 'object') {
    return PCF_LEVEL2_FIELDS.map((f) => f.key);
  }
  return PCF_LEVEL2_FIELDS.filter((f) => {
    const v = input[f.key];
    return v == null || (typeof v === 'string' && v.trim() === '');
  }).map((f) => f.key);
}

function checkVerificationConsistency(input) {
  if (!input || input.verificationStatus !== 'verified') return null;
  const id = input.verificationReportId;
  if (id == null || String(id).trim() === '') {
    return '標示已查驗但缺少查驗報告編號，不能對外宣稱已驗證。';
  }
  return null;
}

function enrichPayloadWithQualityTier(payload) {
  const enriched = { ...payload };
  const missingL2 = getMissingLevel2(enriched);
  const warnings = missingL2.map((k) => {
    const field = PCF_LEVEL2_FIELDS.find((f) => f.key === k);
    return `缺 ${field ? field.label : k}：若直接給客戶，可能被要求補件或改填預設值。`;
  });
  enriched.qualityTier = missingL2.length === 0 ? 'COMPLETE' : 'PARTIAL';
  enriched.warnings = warnings;
  return enriched;
}

function checkPcfPayload(input) {
  const missingL1 = getMissingLevel1(input);
  if (missingL1.length > 0) {
    return {
      pass: false,
      level: 1,
      decision: 'DENY_CONSTRAINT',
      policyId: 'POL-CARB-001',
      missingFields: missingL1,
      warnings: [],
    };
  }
  const verifyErr = checkVerificationConsistency(input);
  if (verifyErr) {
    return {
      pass: false,
      level: 2,
      decision: 'DENY_CONSTRAINT',
      policyId: 'POL-CARB-002',
      missingFields: ['verificationReportId'],
      warnings: [verifyErr],
    };
  }
  const missingL2 = getMissingLevel2(input);
  const warnings = missingL2.map((k) => {
    const field = PCF_LEVEL2_FIELDS.find((f) => f.key === k);
    return `缺 ${field ? field.label : k}：若直接給客戶，可能被要求補件或改填預設值。`;
  });
  return {
    pass: true,
    level: missingL2.length === 0 ? 2 : 1,
    decision: 'ALLOW',
    policyId: missingL2.length === 0 ? 'POL-ALLOW-000' : 'POL-CARB-002',
    missingFields: missingL2,
    warnings,
    qualityTier: missingL2.length === 0 ? 'COMPLETE' : 'PARTIAL',
  };
}

function buildSupplementLetter(input, missingFields) {
  const labels = {
    method: '計算方法（如 ISO 14067）',
    boundary: '系統邊界（如 cradle-to-gate）',
    period: '報告期間',
    unit: '功能單位',
    tCO2e: '嵌入排放量',
    supplierId: '供應商識別',
    cnCode: '產品 CN 碼',
    emissionPerUnit: '單位產品排放',
    verificationStatus: '查驗狀態',
    verificationReportId: '查驗報告編號',
  };
  const lines = (missingFields || []).map((k) => `- ${labels[k] || k}`);
  return (
    `您好，\n\n` +
    `感謝提供碳排資料。為符合客戶／CBAM 申報要求，尚缺以下項目，請協助補充：\n\n` +
    `${lines.join('\n') || '- （請確認所有必填欄位）'}\n\n` +
    `補齊後我們才能將此數據用於對外回覆或申報草稿。\n\n` +
    `此致`
  );
}

module.exports = {
  PCF_REQUIRED_FIELDS,
  PCF_LEVEL2_FIELDS,
  hasPcfQualityFields,
  getMissingLevel1,
  getMissingLevel2,
  checkVerificationConsistency,
  enrichPayloadWithQualityTier,
  checkPcfPayload,
  buildSupplementLetter,
};
