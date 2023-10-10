// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC7390} from "./interfaces/IERC7390.sol";
import {IERC20Metadata as IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract VanillaOption is IERC7390, ERC1155, ReentrancyGuard, IERC1155Receiver {
    struct OptionIssuance {
        VanillaOptionData data;
        address seller;
        uint256 exercisedOptions;
        uint256 soldOptions;
    }

    mapping(uint256 => OptionIssuance) public issuance;
    uint256 public issuanceCounter;

    /* solhint-disable-next-line no-empty-blocks */
    constructor() ERC1155("") ReentrancyGuard() {}

    function create(VanillaOptionData calldata optionData) external nonReentrant returns (uint256) {
        require(optionData.exerciseWindowEnd > block.timestamp, "exerciseWindowEnd");

        OptionIssuance memory newIssuance;
        newIssuance.data = optionData;
        newIssuance.seller = _msgSender();

        if (optionData.side == Side.Call) {
            _transferFrom(
                optionData.underlyingToken,
                optionData.underlyingTokenId,
                _msgSender(),
                address(this),
                optionData.amount
            );
        } else {
            _transferFrom(
                optionData.strikeToken,
                optionData.strikeTokenId,
                _msgSender(),
                address(this),
                (optionData.strike * optionData.amount) / 10 ** _getTokenDecimals(optionData.underlyingToken)
            );
        }

        issuance[issuanceCounter++] = newIssuance;
        emit Created(issuanceCounter - 1);

        return issuanceCounter - 1;
    }

    function buy(uint256 id, uint256 amount) external nonReentrant {
        OptionIssuance memory selectedIssuance = issuance[id];

        require(amount > 0, "buyerOptionCount");
        require(block.timestamp <= selectedIssuance.data.exerciseWindowEnd, "exceriseWindowEnd");
        require(selectedIssuance.data.amount - selectedIssuance.soldOptions >= amount, "amount");

        if (selectedIssuance.data.premium > 0) {
            uint256 remainder = (amount * selectedIssuance.data.premium) % selectedIssuance.data.amount;
            uint256 premiumPaid = (amount * selectedIssuance.data.premium) / selectedIssuance.data.amount;
            if (remainder > 0) {
                premiumPaid += 1;
            }

            bool success = IERC20(selectedIssuance.data.premiumToken).transferFrom(
                _msgSender(),
                selectedIssuance.seller,
                premiumPaid
            );
            if (!success) revert("Transfer Failed");
        }

        issuance[id].soldOptions += amount;
        _mint(_msgSender(), id, amount, bytes(""));
        emit Bought(id, amount, _msgSender());
    }

    function exercise(uint256 id, uint256 amount) external nonReentrant {
        OptionIssuance memory selectedIssuance = issuance[id];

        require(amount > 0, "amount");
        require(balanceOf(_msgSender(), id) >= amount, "balance");
        require(
            block.timestamp >= selectedIssuance.data.exerciseWindowStart &&
                block.timestamp <= selectedIssuance.data.exerciseWindowEnd,
            "timestamp"
        );

        address underlyingToken = selectedIssuance.data.underlyingToken;
        uint256 underlyingTokenId = selectedIssuance.data.underlyingTokenId;
        address strikeToken = selectedIssuance.data.strikeToken;
        uint256 strikeTokenId = selectedIssuance.data.strikeTokenId;

        uint256 remainder = (amount * selectedIssuance.data.strike) % selectedIssuance.data.amount;
        uint256 transferredStrikeTokens = (amount * selectedIssuance.data.strike) / selectedIssuance.data.amount;

        if (remainder > 0) {
            if (selectedIssuance.data.side == Side.Call) {
                transferredStrikeTokens += 1;
            } else {
                if (transferredStrikeTokens > 0) {
                    transferredStrikeTokens--;
                }
            }
        }

        require(transferredStrikeTokens > 0, "transferredStrikeTokens");
        if (selectedIssuance.data.side == Side.Call) {
            // Buyer pays seller for the underlying token(s) at strike price
            _transferFrom(strikeToken, strikeTokenId, _msgSender(), selectedIssuance.seller, transferredStrikeTokens);

            // Transfer underlying token(s) to buyer
            _transfer(underlyingToken, underlyingTokenId, _msgSender(), amount);
        } else {
            // Buyer transfers the underlying token(s) to writer
            _transferFrom(underlyingToken, underlyingTokenId, _msgSender(), selectedIssuance.seller, amount);

            // Pay buyer the strike price
            _transfer(strikeToken, strikeTokenId, _msgSender(), transferredStrikeTokens);
        }

        // Burn used option tokens
        _burn(_msgSender(), id, amount);
        issuance[id].exercisedOptions += amount;

        emit Exercised(id, amount);
    }

    function retrieveExpiredTokens(uint256 id) external nonReentrant {
        OptionIssuance memory selectedIssuance = issuance[id];

        require(_msgSender() == selectedIssuance.seller, "seller");
        require(block.timestamp > selectedIssuance.data.exerciseWindowEnd, "exerciseWindowEnd");

        if (selectedIssuance.data.amount > selectedIssuance.exercisedOptions) {
            uint256 underlyingTokenGiveback = selectedIssuance.data.amount - selectedIssuance.exercisedOptions;
            _transfer(
                selectedIssuance.data.underlyingToken,
                selectedIssuance.data.underlyingTokenId,
                _msgSender(),
                underlyingTokenGiveback
            );
        }

        delete issuance[id];
        emit Expired(id);
    }

    function cancel(uint256 id) external nonReentrant {
        OptionIssuance memory selectedIssuance = issuance[id];

        require(_msgSender() == selectedIssuance.seller, "seller");
        require(selectedIssuance.soldOptions == 0, "soldOptions");

        _transfer(
            selectedIssuance.data.underlyingToken,
            selectedIssuance.data.underlyingTokenId,
            _msgSender(),
            selectedIssuance.data.amount
        );

        delete issuance[id];
        emit Canceled(id);
    }

    function updatePremium(uint256 id, uint256 amount) external nonReentrant {
        OptionIssuance memory selectedIssuance = issuance[id];

        require(_msgSender() == selectedIssuance.seller, "seller");
        require(block.timestamp <= selectedIssuance.data.exerciseWindowEnd, "exerciseWindowEnd");

        issuance[id].data.premium = amount;
        emit PremiumUpdated(id, amount);
    }

    function _transfer(address tokenAddress, uint256 tokenId, address to, uint256 amount) internal {
        if (IERC165(tokenAddress).supportsInterface(type(IERC721).interfaceId)) {
            require(amount == 1, "NFTs are single tokens");
            IERC721(tokenAddress).transferFrom(address(this), to, tokenId);
        } else if (IERC165(tokenAddress).supportsInterface(type(IERC1155).interfaceId)) {
            IERC1155(tokenAddress).safeTransferFrom(address(this), to, tokenId, amount, bytes(""));
        } else {
            bool success = IERC20(tokenAddress).transfer(to, amount);
            if (!success) revert("Transfer failed");
        }
    }

    function _transferFrom(address tokenAddress, uint256 tokenId, address from, address to, uint256 amount) internal {
        if (IERC165(tokenAddress).supportsInterface(type(IERC721).interfaceId)) {
            require(amount == 1, "NFTs are single tokens");
            IERC721(tokenAddress).transferFrom(from, to, tokenId);
        } else if (IERC165(tokenAddress).supportsInterface(type(IERC1155).interfaceId)) {
            IERC1155(tokenAddress).safeTransferFrom(from, to, tokenId, amount, bytes(""));
        } else {
            bool success = IERC20(tokenAddress).transferFrom(from, to, amount);
            if (!success) revert("Transfer failed");
        }
    }

    function _getTokenDecimals(address tokenAddress) internal view returns (uint8) {
        if (IERC165(tokenAddress).supportsInterface(type(IERC721).interfaceId)) {
            return 0;
        } else if (IERC165(tokenAddress).supportsInterface(type(IERC1155).interfaceId)) {
            // We have to assume zero decimals since we can't access the metadata for URI
            // Limits the usefulness of the protocol, but should be used only for "fungible NFTs" >.<
            return 0;
        } else {
            return IERC20(tokenAddress).decimals();
        }
    }

    /*function _isFungible(address tokenAddress) internal view returns (bool) {
        return IERC165(tokenAddress).supportsInterface(type(IERC20).interfaceId);
    }*/

    function _mint(address to, uint256 id, uint256 amount, bytes memory data) internal override {
        super._mint(to, id, amount, data);
    }

    function _burn(address from, uint256 id, uint256 amount) internal override {
        super._burn(from, id, amount);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, IERC165) returns (bool) {
        return interfaceId == type(IERC7390).interfaceId || super.supportsInterface(interfaceId);
    }

    function onERC1155Received(
        address /*operator*/,
        address /*from*/,
        uint256 /*id*/,
        uint256 /*value*/,
        bytes calldata /*data*/
    ) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address /*operator*/,
        address /*from*/,
        uint256[] calldata /*ids*/,
        uint256[] calldata /*values*/,
        bytes calldata /*data*/
    ) external pure returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
