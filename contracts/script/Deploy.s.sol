// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Script } from "forge-std/Script.sol";
import { Grove721 } from "../src/Grove721.sol";
import { Grove1155 } from "../src/Grove1155.sol";

interface ISafeConfiguration {
    function getOwners() external view returns (address[] memory);
    function getThreshold() external view returns (uint256);
}

contract Deploy is Script {
    function run() external returns (Grove721 oneOfOnes, Grove1155 editions) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address adminSafe = vm.envAddress("GROVE_ADMIN_SAFE");
        address registrar = vm.envAddress("GROVE_REGISTRAR");
        address minter = vm.envAddress("GROVE_MINTER");
        address pauseGuardian = vm.envAddress("GROVE_PAUSE_GUARDIAN");
        uint256 expectedChainId = vm.envUint("GROVE_EXPECTED_CHAIN_ID");

        require(expectedChainId == 8453 || expectedChainId == 84532, "unsupported Base network");
        require(block.chainid == expectedChainId, "unexpected chain");
        require(adminSafe.code.length > 0, "admin Safe has no code");
        require(ISafeConfiguration(adminSafe).getOwners().length == 3, "admin Safe must have 3 owners");
        require(ISafeConfiguration(adminSafe).getThreshold() == 2, "admin Safe must require 2 owners");
        require(adminSafe != registrar && adminSafe != minter && adminSafe != pauseGuardian, "admin role not separated");
        require(
            registrar != minter && registrar != pauseGuardian && minter != pauseGuardian,
            "operational roles not separated"
        );

        vm.startBroadcast(deployerKey);
        oneOfOnes = new Grove721(adminSafe, registrar, minter, pauseGuardian, "Grove One of Ones", "GROVE");
        editions = new Grove1155(adminSafe, registrar, minter, pauseGuardian);
        vm.stopBroadcast();

        require(oneOfOnes.hasRole(oneOfOnes.REGISTRAR_ROLE(), registrar), "721 registrar mismatch");
        require(oneOfOnes.hasRole(oneOfOnes.MINTER_ROLE(), minter), "721 minter mismatch");
        require(oneOfOnes.hasRole(oneOfOnes.PAUSER_ROLE(), pauseGuardian), "721 guardian mismatch");
        require(editions.hasRole(editions.REGISTRAR_ROLE(), registrar), "1155 registrar mismatch");
        require(editions.hasRole(editions.MINTER_ROLE(), minter), "1155 minter mismatch");
        require(editions.hasRole(editions.PAUSER_ROLE(), pauseGuardian), "1155 guardian mismatch");
    }
}
