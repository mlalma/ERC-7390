// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockToken3ERC721 is ERC721 {
    /* solhint-disable-next-line no-empty-blocks */
    constructor() ERC721("MockToken3", "MOCK3") {}

    // Anyone can mint some Mockerinos for themselves
    function faucet(uint256 tokenId) external {
        _mint(msg.sender, tokenId);
    }
}
