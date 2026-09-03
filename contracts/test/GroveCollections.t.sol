// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { IERC2981 } from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import { Grove721 } from "../src/Grove721.sol";
import { Grove1155 } from "../src/Grove1155.sol";

contract GroveCollectionsTest is Test {
    Grove721 internal oneOfOnes;
    Grove1155 internal editions;

    address internal collector = makeAddr("collector");
    address internal secondCollector = makeAddr("second-collector");
    address internal artist = makeAddr("artist");
    address internal attacker = makeAddr("attacker");
    address internal registrar = makeAddr("registrar");
    address internal minter = makeAddr("minter");
    address internal pauseGuardian = makeAddr("pause-guardian");

    function setUp() public {
        oneOfOnes = new Grove721(address(this), registrar, minter, pauseGuardian, "Grove One of Ones", "GROVE");
        editions = new Grove1155(address(this), registrar, minter, pauseGuardian);
    }

    function configure721(uint256 tokenId, string memory tokenUri, uint96 royalty) internal {
        vm.prank(registrar);
        oneOfOnes.configure(tokenId, tokenUri, artist, royalty);
    }

    function mint721(bytes32 orderId, uint256 tokenId, address recipient) internal {
        vm.prank(minter);
        oneOfOnes.mint(orderId, tokenId, recipient);
    }

    function configure1155(uint256 tokenId, uint256 cap, string memory tokenUri, uint96 royalty) internal {
        vm.prank(registrar);
        editions.configure(tokenId, cap, tokenUri, artist, royalty);
    }

    function mint1155(bytes32 orderId, uint256 tokenId, address recipient, uint256 quantity) internal {
        vm.prank(minter);
        editions.mint(orderId, tokenId, recipient, quantity);
    }

    function testOneOfOneConfigurationAndOrderAreImmutable() public {
        configure721(101, "ipfs://work/101.json", 1_000);
        bytes32 orderId = keccak256("acquisition-1");
        mint721(orderId, 101, collector);

        assertEq(oneOfOnes.ownerOf(101), collector);
        assertEq(oneOfOnes.tokenURI(101), "ipfs://work/101.json");
        (address receiver, uint256 amount) = oneOfOnes.royaltyInfo(101, 1_000e6);
        assertEq(receiver, artist);
        assertEq(amount, 100e6);

        vm.expectRevert(Grove721.WorkAlreadyConfigured.selector);
        configure721(101, "ipfs://changed", 0);
        vm.expectRevert(Grove721.OrderAlreadyProcessed.selector);
        mint721(orderId, 102, attacker);
    }

    function testOnlyAuthorizedRolesCanConfigureMintPauseOrUnpause() public {
        vm.startPrank(attacker);
        vm.expectRevert();
        oneOfOnes.configure(1, "ipfs://work/1", artist, 0);
        vm.expectRevert();
        oneOfOnes.mint(keccak256("order"), 1, attacker);
        vm.expectRevert();
        oneOfOnes.pause();
        vm.expectRevert();
        oneOfOnes.unpause();
        vm.stopPrank();
    }

    function testPauseBlocksMintButNeverCollectorTransfer() public {
        configure721(1, "ipfs://work/1", 0);
        mint721(keccak256("order-1"), 1, collector);
        configure721(2, "ipfs://work/2", 0);
        vm.prank(pauseGuardian);
        oneOfOnes.pause();

        vm.expectRevert();
        mint721(keccak256("order-2"), 2, secondCollector);
        vm.prank(collector);
        oneOfOnes.transferFrom(collector, secondCollector, 1);
        assertEq(oneOfOnes.ownerOf(1), secondCollector);
    }

    function testEditionCapAndOrderIdempotencyAreEnforced() public {
        configure1155(7, 5, "ipfs://work/7.json", 750);
        assertEq(editions.uri(7), "ipfs://work/7.json");
        (address receiver, uint256 amount) = editions.royaltyInfo(7, 10_000);
        assertEq(receiver, artist);
        assertEq(amount, 750);
        mint1155(keccak256("order-a"), 7, collector, 3);
        mint1155(keccak256("order-b"), 7, secondCollector, 2);
        assertEq(editions.totalSupply(7), 5);

        vm.expectRevert(Grove1155.SupplyCapExceeded.selector);
        mint1155(keccak256("order-c"), 7, collector, 1);
        vm.expectRevert(Grove1155.OrderAlreadyProcessed.selector);
        mint1155(keccak256("order-b"), 7, collector, 1);
    }

    function testMetadataMustUseContentAddressedScheme() public {
        vm.expectRevert(Grove721.InvalidTokenURI.selector);
        configure721(1, "https://mutable.example/work.json", 500);
        vm.expectRevert(Grove1155.InvalidTokenURI.selector);
        configure1155(1, 1, "", 500);
    }

    function testEditionTransfersRemainLiveWhileMintingIsPaused() public {
        configure1155(8, 2, "ipfs://work/8.json", 750);
        mint1155(keccak256("order-a"), 8, collector, 2);
        vm.prank(pauseGuardian);
        editions.pause();

        vm.expectRevert();
        mint1155(keccak256("order-b"), 8, secondCollector, 1);
        vm.prank(collector);
        editions.safeTransferFrom(collector, secondCollector, 8, 1, "");
        assertEq(editions.balanceOf(secondCollector, 8), 1);
    }

    function testStandardsAreAdvertised() public view {
        assertTrue(oneOfOnes.supportsInterface(type(IERC2981).interfaceId));
        assertTrue(editions.supportsInterface(type(IERC2981).interfaceId));
    }

    function testFuzzEditionSupplyNeverExceedsCap(uint32 rawCap, uint32 rawFirst, uint32 rawSecond) public {
        uint256 cap = bound(rawCap, 1, 1_000_000);
        uint256 first = bound(rawFirst, 1, cap);
        uint256 second = bound(rawSecond, 1, 1_000_000);
        configure1155(99, cap, "ipfs://work/99.json", 500);
        mint1155(keccak256("fuzz-order-a"), 99, collector, first);

        if (first + second > cap) {
            vm.expectRevert(Grove1155.SupplyCapExceeded.selector);
            mint1155(keccak256("fuzz-order-b"), 99, secondCollector, second);
            assertEq(editions.totalSupply(99), first);
        } else {
            mint1155(keccak256("fuzz-order-b"), 99, secondCollector, second);
            assertEq(editions.totalSupply(99), first + second);
        }
    }

    function testFuzzOrderIdMintsAtMostOnce(bytes32 orderId) public {
        vm.assume(orderId != bytes32(0));
        configure721(77, "ipfs://work/77.json", 500);
        mint721(orderId, 77, collector);
        vm.expectRevert(Grove721.OrderAlreadyProcessed.selector);
        mint721(orderId, 77, secondCollector);
        assertEq(oneOfOnes.ownerOf(77), collector);
    }

    function testOperationalRolesAreSeparated() public view {
        assertTrue(oneOfOnes.hasRole(oneOfOnes.DEFAULT_ADMIN_ROLE(), address(this)));
        assertFalse(oneOfOnes.hasRole(oneOfOnes.REGISTRAR_ROLE(), address(this)));
        assertTrue(oneOfOnes.hasRole(oneOfOnes.REGISTRAR_ROLE(), registrar));
        assertFalse(oneOfOnes.hasRole(oneOfOnes.MINTER_ROLE(), registrar));
        assertTrue(oneOfOnes.hasRole(oneOfOnes.MINTER_ROLE(), minter));
        assertFalse(oneOfOnes.hasRole(oneOfOnes.PAUSER_ROLE(), minter));
        assertTrue(oneOfOnes.hasRole(oneOfOnes.PAUSER_ROLE(), pauseGuardian));
    }
}
