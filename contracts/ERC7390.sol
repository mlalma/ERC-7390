// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC7390} from "./interfaces/IERC7390.sol";
import {IERC20Metadata as IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

abstract contract ERC7390 is IERC7390, ERC1155, ReentrancyGuard {
    mapping(uint256 => OptionIssuance) private _issuance;
    uint256 private _issuanceCounter;

    /* solhint-disable-next-line no-empty-blocks */
    constructor() ERC1155("") ReentrancyGuard() {}

    function create(VanillaOptionData calldata optionData) public virtual nonReentrant returns (uint256) {
        require(optionData.exerciseWindowEnd > block.timestamp, "exerciseWindowEnd");

        OptionIssuance memory newIssuance;
        newIssuance.data = optionData;
        newIssuance.seller = _msgSender();

        IERC20 underlyingToken = IERC20(optionData.underlyingToken);
        newIssuance.strikeAmount = (optionData.strike * optionData.amount) / (10 ** underlyingToken.decimals());
        if (optionData.side == Side.Call) {
            _transferFrom(underlyingToken, _msgSender(), address(this), optionData.amount);
        } else {
            _transferFrom(
                IERC20(optionData.strikeToken),
                _msgSender(),
                address(this),
                newIssuance.strikeAmount
            );
        }

        uint256 issuanceId = _issuanceCounter;

        _issuance[issuanceId] = newIssuance;
        emit Created(issuanceId);
        _issuanceCounter++;

        return issuanceId;
    }

    function buy(uint256 id, uint256 amount) public virtual nonReentrant {
        OptionIssuance memory selectedIssuance = _issuance[id];

        require(amount > 0, "buyerOptionCount");
        require(block.timestamp <= selectedIssuance.data.exerciseWindowEnd, "exceriseWindowEnd");
        require(selectedIssuance.data.amount - selectedIssuance.soldAmount >= amount, "amount");

        if (selectedIssuance.data.premium > 0) {
            uint256 remainder = (amount * selectedIssuance.data.premium) % selectedIssuance.data.amount;
            uint256 premiumPaid = (amount * selectedIssuance.data.premium) / selectedIssuance.data.amount;
            if (remainder > 0) premiumPaid++;

            bool success = IERC20(selectedIssuance.data.premiumToken).transferFrom(
                _msgSender(),
                selectedIssuance.seller,
                premiumPaid
            );
            if (!success) revert("Transfer Failed");
        }

        _issuance[id].soldAmount += amount;
        _mint(_msgSender(), id, amount, bytes(""));
        emit Bought(id, amount, _msgSender());
    }

    function exercise(uint256 id, uint256 amount) public virtual nonReentrant {
        OptionIssuance memory selectedIssuance = _issuance[id];

        require(amount > 0, "amount");
        require(balanceOf(_msgSender(), id) >= amount, "balance");
        require(
            block.timestamp >= selectedIssuance.data.exerciseWindowStart &&
            block.timestamp <= selectedIssuance.data.exerciseWindowEnd,
            "timestamp"
        );

        IERC20 underlyingToken = IERC20(selectedIssuance.data.underlyingToken);
        IERC20 strikeToken = IERC20(selectedIssuance.data.strikeToken);

        uint256 remainder = (amount * selectedIssuance.data.strike) % selectedIssuance.data.amount;
        uint256 transferredStrikeAmount = (amount * selectedIssuance.data.strike) / selectedIssuance.data.amount;

        if (remainder > 0) {
            if (selectedIssuance.data.side == Side.Call) {
                transferredStrikeAmount++;
            } else {
                if (transferredStrikeAmount > 0) {
                    transferredStrikeAmount--;
                }
            }
        }

        require(transferredStrikeAmount > 0, "transferredStrikeAmount");
        if (selectedIssuance.data.side == Side.Call) {
            // Buyer pays seller for the underlying token(s) at strike price
            _transferFrom(strikeToken, _msgSender(), selectedIssuance.seller, transferredStrikeAmount);

            // Transfer underlying token(s) to buyer
            _transfer(underlyingToken, _msgSender(), amount);
        } else {
            require(selectedIssuance.transferredStrikeAmount + transferredStrikeAmount <= selectedIssuance.strikeAmount, "Exercise amount exceeds strike amount");

            // Buyer transfers the underlying token(s) to writer
            _transferFrom(underlyingToken, _msgSender(), selectedIssuance.seller, amount);

            // Pay buyer the strike price
            _transfer(strikeToken, _msgSender(), transferredStrikeAmount);
        }

        // Burn used option tokens
        _burn(_msgSender(), id, amount);
        _issuance[id].exercisedOptions += amount;
        _issuance[id].transferredStrikeAmount += transferredStrikeAmount;

        emit Exercised(id, amount);
    }

    function retrieveExpiredTokens(uint256 id) public virtual nonReentrant {
        OptionIssuance memory selectedIssuance = _issuance[id];

        require(_msgSender() == selectedIssuance.seller, "seller");
        require(block.timestamp > selectedIssuance.data.exerciseWindowEnd, "exerciseWindowEnd");

        if (selectedIssuance.data.amount > selectedIssuance.exercisedOptions) {
            if (selectedIssuance.data.side == Side.Call) {
                uint256 underlyingTokenGiveback = selectedIssuance.data.amount - selectedIssuance.exercisedOptions;
                _transfer(IERC20(selectedIssuance.data.underlyingToken), _msgSender(), underlyingTokenGiveback);
            } else {
                uint256 strikeTokenGiveback = selectedIssuance.strikeAmount - selectedIssuance.transferredStrikeAmount;
                _transfer(IERC20(selectedIssuance.data.strikeToken), _msgSender(), strikeTokenGiveback);
            }                        
        }

        delete _issuance[id];
        emit Expired(id);
    }

    function cancel(uint256 id) public virtual nonReentrant {
        OptionIssuance memory selectedIssuance = _issuance[id];

        require(_msgSender() == selectedIssuance.seller, "seller");
        require(selectedIssuance.soldOptions == 0, "soldOptions");
    
        if (selectedIssuance.data.side == Side.Call) {
            _transfer(IERC20(selectedIssuance.data.underlyingToken), _msgSender(), selectedIssuance.data.amount);
        } else {
            _transfer(IERC20(selectedIssuance.data.strikeToken), _msgSender(), selectedIssuance.strikeAmount);          
        }

        delete _issuance[id];
        emit Canceled(id);
    }

    function updatePremium(uint256 id, uint256 amount) public virtual nonReentrant {
        OptionIssuance memory selectedIssuance = _issuance[id];

        require(_msgSender() == selectedIssuance.seller, "seller");
        require(block.timestamp <= selectedIssuance.data.exerciseWindowEnd, "exerciseWindowEnd");

        _issuance[id].data.premium = amount;
        emit PremiumUpdated(id, amount);
    }

    function issuance(uint256 id) public view virtual returns (OptionIssuance memory) {
        return _issuance[id];
    }

    function _transfer(IERC20 token, address to, uint256 amount) internal {
        bool success = token.transfer(to, amount);
        if (!success) revert("Transfer failed");
    }

    function _transferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        bool success = token.transferFrom(from, to, amount);
        if (!success) revert("Transfer failed");
    }

    function _mint(address to, uint256 id, uint256 amount, bytes memory data) internal override {
        super._mint(to, id, amount, data);
    }

    function _burn(address from, uint256 id, uint256 amount) internal override {
        super._burn(from, id, amount);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155) returns (bool) {
        return
            interfaceId == type(IERC7390).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
