// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { AccessControlDefaultAdminRules } from
    "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title Grove721
/// @notice Immutable work records and idempotent mint delivery for curated one-of-one works.
/// @dev Pausing stops mint delivery only. Collector transfers can never be frozen by the School.
contract Grove721 is ERC721, ERC2981, AccessControlDefaultAdminRules, Pausable {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    struct Work {
        string tokenUri;
        bool configured;
    }

    mapping(uint256 tokenId => Work work) private works;
    mapping(bytes32 orderId => bool processed) public processedOrders;

    event WorkConfigured(
        uint256 indexed tokenId, string tokenUri, address indexed royaltyReceiver, uint96 royaltyFeeNumerator
    );
    event OrderMinted(bytes32 indexed orderId, uint256 indexed tokenId, address indexed recipient, uint256 quantity);

    error InvalidAddress();
    error InvalidOrder();
    error InvalidTokenURI();
    error WorkAlreadyConfigured();
    error WorkNotConfigured();
    error OrderAlreadyProcessed();

    constructor(
        address admin,
        address registrar,
        address minter,
        address pauseGuardian,
        string memory name_,
        string memory symbol_
    ) ERC721(name_, symbol_) AccessControlDefaultAdminRules(2 days, admin) {
        if (admin == address(0) || registrar == address(0) || minter == address(0) || pauseGuardian == address(0)) {
            revert InvalidAddress();
        }
        _grantRole(REGISTRAR_ROLE, registrar);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, pauseGuardian);
    }

    /// @notice Permanently records a work's metadata and royalty signal before sale.
    function configure(uint256 tokenId, string calldata tokenUri, address royaltyReceiver, uint96 royaltyFeeNumerator)
        external
        onlyRole(REGISTRAR_ROLE)
    {
        if (royaltyReceiver == address(0)) revert InvalidAddress();
        if (!_isIpfsUri(tokenUri)) revert InvalidTokenURI();
        if (works[tokenId].configured) revert WorkAlreadyConfigured();
        works[tokenId] = Work({ tokenUri: tokenUri, configured: true });
        _setTokenRoyalty(tokenId, royaltyReceiver, royaltyFeeNumerator);
        emit WorkConfigured(tokenId, tokenUri, royaltyReceiver, royaltyFeeNumerator);
    }

    /// @notice Delivers one configured work after an authoritative offchain order settles.
    /// @param orderId A PII-free hash domain-bound to chain, collection, acquisition line, token, recipient, and quantity.
    function mint(bytes32 orderId, uint256 tokenId, address recipient) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (orderId == bytes32(0)) revert InvalidOrder();
        if (recipient == address(0)) revert InvalidAddress();
        if (processedOrders[orderId]) revert OrderAlreadyProcessed();
        if (!works[tokenId].configured) revert WorkNotConfigured();

        processedOrders[orderId] = true;
        _safeMint(recipient, tokenId);
        emit OrderMinted(orderId, tokenId, recipient, 1);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return works[tokenId].tokenUri;
    }

    function isConfigured(uint256 tokenId) external view returns (bool) {
        return works[tokenId].configured;
    }

    function _isIpfsUri(string calldata value) private pure returns (bool) {
        bytes calldata uriBytes = bytes(value);
        return uriBytes.length > 7 && uriBytes[0] == "i" && uriBytes[1] == "p" && uriBytes[2] == "f"
            && uriBytes[3] == "s" && uriBytes[4] == ":" && uriBytes[5] == "/" && uriBytes[6] == "/";
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981, AccessControlDefaultAdminRules)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
