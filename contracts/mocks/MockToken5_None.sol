// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

contract MockToken5None is IERC165 {
    /* solhint-disable-next-line no-empty-blocks */
    constructor() {}

    function supportsInterface(bytes4 /*interfaceId*/) external pure returns (bool) {
        return false;
    }
}
