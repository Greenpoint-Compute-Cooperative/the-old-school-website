// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { AccessControlDefaultAdminRules } from
    "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { ERC1155Supply } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import { ERC1155URIStorage } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title Grove1155
/// @notice Immutable work records, hard edition caps, and idempotent delivery for curated editions.
/// @dev Pausing stops mint delivery only. Collector transfers can never be frozen by the School.
contract Grove1155 is ERC1155Supply, ERC1155URIStorage, ERC2981, AccessControlDefaultAdminRules, Pausable {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    mapping(uint256 tokenId => uint256 supplyCap) public maxSupply;
    mapping(bytes32 orderId => bool processed) public processedOrders;

    event WorkConfigured(
        uint256 indexed tokenId,
        uint256 maxSupply,
        string tokenUri,
        address indexed royaltyReceiver,
        uint96 royaltyFeeNumerator
    );
    event OrderMinted(bytes32 indexed orderId, uint256 indexed tokenId, address indexed recipient, uint256 quantity);

    error InvalidAddress();
    error InvalidOrder();
    error InvalidQuantity();
    error InvalidTokenURI();
    error WorkAlreadyConfigured();
    error WorkNotConfigured();
    error OrderAlreadyProcessed();
    error SupplyCapExceeded();

    constructor(address admin, address registrar, address minter, address pauseGuardian)
        ERC1155("")
        AccessControlDefaultAdminRules(2 days, admin)
    {
        if (admin == address(0) || registrar == address(0) || minter == address(0) || pauseGuardian == address(0)) {
            revert InvalidAddress();
        }
        _grantRole(REGISTRAR_ROLE, registrar);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, pauseGuardian);
    }

    /// @notice Permanently records an edition's metadata, cap, and royalty signal before sale.
    function configure(
        uint256 tokenId,
        uint256 supplyCap,
        string calldata tokenUri,
        address royaltyReceiver,
        uint96 royaltyFeeNumerator
    ) external onlyRole(REGISTRAR_ROLE) {
        if (royaltyReceiver == address(0)) revert InvalidAddress();
        if (supplyCap == 0) revert InvalidQuantity();
        if (!_isIpfsUri(tokenUri)) revert InvalidTokenURI();
        if (maxSupply[tokenId] != 0) revert WorkAlreadyConfigured();
        maxSupply[tokenId] = supplyCap;
        _setURI(tokenId, tokenUri);
        _setTokenRoyalty(tokenId, royaltyReceiver, royaltyFeeNumerator);
        emit WorkConfigured(tokenId, supplyCap, tokenUri, royaltyReceiver, royaltyFeeNumerator);
    }

    /// @notice Delivers configured editions after an authoritative offchain order settles.
    /// @param orderId A PII-free hash domain-bound to chain, collection, acquisition line, token, recipient, and quantity.
    function mint(bytes32 orderId, uint256 tokenId, address recipient, uint256 quantity)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        if (orderId == bytes32(0)) revert InvalidOrder();
        if (recipient == address(0)) revert InvalidAddress();
        if (quantity == 0) revert InvalidQuantity();
        if (processedOrders[orderId]) revert OrderAlreadyProcessed();
        if (maxSupply[tokenId] == 0) revert WorkNotConfigured();
        if (totalSupply(tokenId) + quantity > maxSupply[tokenId]) revert SupplyCapExceeded();

        processedOrders[orderId] = true;
        _mint(recipient, tokenId, quantity, "");
        emit OrderMinted(orderId, tokenId, recipient, quantity);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function uri(uint256 tokenId) public view override(ERC1155, ERC1155URIStorage) returns (string memory) {
        return super.uri(tokenId);
    }

    function _isIpfsUri(string calldata value) private pure returns (bool) {
        bytes calldata uriBytes = bytes(value);
        return uriBytes.length > 7 && uriBytes[0] == "i" && uriBytes[1] == "p" && uriBytes[2] == "f"
            && uriBytes[3] == "s" && uriBytes[4] == ":" && uriBytes[5] == "/" && uriBytes[6] == "/";
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, ERC2981, AccessControlDefaultAdminRules)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155, ERC1155Supply)
    {
        super._update(from, to, ids, values);
    }
}
