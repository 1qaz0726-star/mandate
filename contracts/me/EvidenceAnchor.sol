// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title EvidenceAnchor — Mandate 證據存證合約（ME Network，BEACON 2026）
/// @notice 把信任閘門判定 GATE_OK 時的證據雜湊寫上鏈，任何人都能查「這份證據在何時、由誰存證、
///         供應商有沒有親自簽名」。只存雜湊，不存任何原始碳排數據（保密邊界不變）。
/// @dev 刻意保持極小：沒有 owner、沒有升級、沒有刪除。存過的雜湊不能覆寫，避免事後改寫歷史。
contract EvidenceAnchor {
    struct Anchor {
        uint64 anchoredAt;   // 區塊時間
        address anchorer;    // 送交易的帳號（Mandate 後端）
        address supplier;    // 供應商簽名還原出的地址；沒有供應商簽名時為 0
        string caseId;
    }

    mapping(bytes32 => Anchor) private anchors;

    event Anchored(bytes32 indexed evidenceHash, string caseId, address indexed anchorer, address indexed supplier, uint64 anchoredAt);

    error AlreadyAnchored(bytes32 evidenceHash);
    error EmptyHash();
    error BadSignature();

    /// @notice 只存證雜湊（方案 1）
    function anchor(bytes32 evidenceHash, string calldata caseId) external {
        _store(evidenceHash, caseId, address(0));
    }

    /// @notice 存證雜湊，並在鏈上驗證供應商對這個雜湊的簽名（方案 2）。
    /// @param signature 供應商用 ME 錢包對 evidenceHash 做 EIP-191 personal_sign 的 65 bytes 簽名
    function anchorWithSupplier(bytes32 evidenceHash, string calldata caseId, bytes calldata signature) external {
        address supplier = recoverSigner(evidenceHash, signature);
        if (supplier == address(0)) revert BadSignature();
        _store(evidenceHash, caseId, supplier);
    }

    function verify(bytes32 evidenceHash)
        external
        view
        returns (bool exists, uint64 anchoredAt, address anchorer, address supplier, string memory caseId)
    {
        Anchor storage a = anchors[evidenceHash];
        return (a.anchoredAt != 0, a.anchoredAt, a.anchorer, a.supplier, a.caseId);
    }

    /// @notice EIP-191：keccak256("\x19Ethereum Signed Message:\n32" ‖ evidenceHash)
    function recoverSigner(bytes32 evidenceHash, bytes calldata signature) public pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        // 拒絕 malleable 簽名（s 在曲線階數的上半部）
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) return address(0);
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", evidenceHash));
        return ecrecover(digest, v, r, s);
    }

    function _store(bytes32 evidenceHash, string calldata caseId, address supplier) private {
        if (evidenceHash == bytes32(0)) revert EmptyHash();
        if (anchors[evidenceHash].anchoredAt != 0) revert AlreadyAnchored(evidenceHash);
        uint64 t = uint64(block.timestamp);
        anchors[evidenceHash] = Anchor(t, msg.sender, supplier, caseId);
        emit Anchored(evidenceHash, caseId, msg.sender, supplier, t);
    }
}
