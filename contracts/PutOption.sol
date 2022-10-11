// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Option.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PutOption is Option {
    constructor(
        address _underlyingToken,
        uint256 _amount,
        uint256 _strike,
        uint256 _expiration,
        uint256 _durationExerciseAfterExpiration,
        address _premiumToken,
        uint256 _premium,
        uint256 _auctionDeadline,
        address _STABLEAddress,
        OptionType _optionType
    ) {
        // the underlying token and the stablecoin cannot be the same
        if (
            _underlyingToken == _STABLEAddress && _underlyingToken != address(0)
        ) {
            revert InvalidValue();
        }

        if (
            _underlyingToken == address(0) ||
            _premiumToken == address(0) ||
            _amount == 0 ||
            _STABLEAddress == address(0)
        ) {
            revert InvalidValue();
        }

        if (_expiration <= block.timestamp) revert InvalidValue();
        if (_durationExerciseAfterExpiration == 0) revert InvalidValue();
        if (_auctionDeadline >= _expiration) revert InvalidValue();

        STABLE = IERC20(_STABLEAddress);

        uint256 underlyingDecimals = ERC20(_underlyingToken).decimals();

        bool success = STABLE.transferFrom(
            msg.sender,
            address(this),
            (_strike * _amount) / 10**(underlyingDecimals)
        );
        if (!success) revert TransferFailed();

        amount = _amount;

        strike = _strike;

        expiration = _expiration;

        durationExerciseAfterExpiration = _durationExerciseAfterExpiration;

        premiumToken = _premiumToken;
        premium = _premium;

        auctionDeadline = _auctionDeadline;

        optionType = _optionType;

        writer = msg.sender;

        optionState = OptionState.Created;
    }

    /// @notice buyer exercise his option = sell the x amount of underlyingToken
    function exerciseOption() external {
        if (optionState != OptionState.Bought) revert Forbidden();

        if (msg.sender != buyer) revert Forbidden();

        uint256 m_expiration = expiration;

        if (optionType == OptionType.European) {
            if (block.timestamp <= m_expiration) revert Expired();
        }
        if (block.timestamp <= auctionDeadline) revert Forbidden();
        if (block.timestamp > m_expiration + durationExerciseAfterExpiration)
            revert Forbidden();

        address m_underlyingToken = underlyingToken;

        uint256 underlyingDecimals = ERC20(m_underlyingToken).decimals();

        uint256 m_amount = amount;

        // buyer sell the underlying asset to writer
        bool success = IERC20(m_underlyingToken).transferFrom(
            msg.sender,
            writer,
            m_amount
        );
        if (!success) revert TransferFailed();

        // transfer compensation to option buyer
        success = STABLE.transfer(
            msg.sender,
            (strike * m_amount) / 10**(underlyingDecimals)
        );
        if (!success) revert TransferFailed();

        optionState = OptionState.Exercised;
    }

    /// @notice if buyer hasn't exercised his option during the period 'durationExerciseAfterExpiration',
    /// writer can retrieve their funds
    function retrieveExpiredTokens() external {
        OptionState m_optionState = optionState;

        if (
            m_optionState != OptionState.Bought &&
            m_optionState != OptionState.Created
        ) revert Forbidden();

        if (msg.sender != writer) revert Forbidden();

        // if no one bought this option, the writer can retrieve their tokens as soon as it expires
        if (m_optionState == OptionState.Created) {
            if (block.timestamp <= expiration) revert Forbidden();
        } else {
            if (block.timestamp <= expiration + durationExerciseAfterExpiration)
                revert Forbidden();
        }

        bool success = IERC20(underlyingToken).transfer(msg.sender, amount);
        if (!success) revert TransferFailed();

        optionState = OptionState.Expired;
    }

    /// @notice return all the properties of that option
    /// @notice it prevents having to make multiple calls
    /// @dev doesn't include the bidders and bids array/map
    /// @dev it's using inline assembly for gas efficiency purpose, so the code is not very flexible
    function getFullProperties()
        external
        view
        returns (
            address,
            uint256,
            uint256,
            uint256,
            uint256,
            address,
            uint256,
            uint256,
            address,
            address,
            OptionState,
            address
        )
    {
        assembly {
            let freeMemPointer := mload(0x40)

            let i := 0x20
            let j := 0x01

            // first mstore not in the loop, more gas efficient because it avoids using add()
            mstore(freeMemPointer, sload(underlyingToken.slot))

            for {

            } lt(i, 0x180) {
                // 0x180 == 384 == number of slots (= variables stored) * 32 bytes == 12 * 32
                i := add(i, 0x20)
                j := add(j, 0x01)
            } {
                mstore(
                    add(freeMemPointer, i),
                    sload(add(underlyingToken.slot, j))
                ) // underlyingToken.slot == 0
            }

            return(freeMemPointer, i) // i == 0x180 == add(add(freeMemPointer, i), 0x20)
        }

        /* The assembly code above is the equivalent of :

        return (
            underlyingToken,
            amount,
            strike,
            expiration,
            durationExerciseAfterExpiration,
            premiumToken,
            premium,
            auctionDeadline,
            writer,
            buyer,
            optionState,
            address(STABLE)
        ); */
    }
}
