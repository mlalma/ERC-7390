// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MockToken4ERC1155 is ERC1155 {
    /* solhint-disable-next-line no-empty-blocks */
    constructor() ERC1155("MockToken4") {}

    // Anyone can mint some Mockerinos for themselves
    function faucet(uint256 tokenId, uint256 amount) external {
        _mint(msg.sender, tokenId, amount, bytes(""));
    }
}
