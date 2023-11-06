const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const {
  deployInfraFixture,
  TOKEN1_DECIMALS,
  TOKEN1_START_BALANCE,
  TOKEN2_START_BALANCE,
  OPTION_COUNT,
  PREMIUM,
  STRIKE,
  ZERO_ADDRESS,
  TokensToIndex,
} = require("./Option_Globals");

describe("Canceling", function () {
  it("Should cancel the call contract and return underlying token back to seller for all token types", async function () {
    const { callOption, optionContract, acct1, token1, token3, token4 } = await loadFixture(deployInfraFixture);

    for (let underlyingIndex = 0; underlyingIndex < 3; underlyingIndex++) {
      let underlyingToken, underlyingTokenId, underlyingAmount;
      switch (underlyingIndex) {
        case 0:
          underlyingToken = token1.target;
          underlyingTokenId = 0;
          underlyingAmount = OPTION_COUNT;
          break;
        case 1:
          underlyingToken = token3.target;
          underlyingTokenId = 100;
          underlyingAmount = 1;
          break;
        case 2:
          underlyingToken = token4.target;
          underlyingTokenId = 200;
          underlyingAmount = OPTION_COUNT;
          break;
      }

      const optionData = {
        ...callOption,
        underlyingToken: underlyingToken,
        underlyingTokenId: underlyingTokenId,
        amount: underlyingAmount,
      };

      if (underlyingIndex == 0) {
        await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
      } else if (underlyingIndex == 1) {
        await token3.connect(acct1).approve(optionContract.target, 100);
      } else if (underlyingIndex == 2) {
        await token4.connect(acct1).setApprovalForAll(optionContract.target, true);
      }

      await expect(optionContract.connect(acct1).create(optionData)).to.emit(optionContract, "Created");

      if (underlyingIndex == 0) {
        expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
        expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);
      } else if (underlyingIndex == 1) {
        expect(await token3.ownerOf(100)).to.equal(optionContract.target);
      } else if (underlyingIndex == 2) {
        await token4.connect(acct1).setApprovalForAll(optionContract.target, false);
        expect(await token4.balanceOf(optionContract.target, 200)).to.equal(OPTION_COUNT);
        expect(await token4.balanceOf(acct1.address, 200)).to.equal(0);
      }

      await expect(optionContract.connect(acct1).cancel(underlyingIndex)).to.emit(optionContract, "Canceled");

      if (underlyingIndex == 0) {
        expect(await token1.balanceOf(optionContract.target)).to.equal(0);
        expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE);
      } else if (underlyingIndex == 1) {
        expect(await token3.ownerOf(100)).to.equal(acct1.address);
      } else if (underlyingIndex == 2) {
        expect(await token4.balanceOf(optionContract.target, 200)).to.equal(0);
        expect(await token4.balanceOf(acct1.address, 200)).to.equal(OPTION_COUNT);
      }

      // Make sure data is deleted
      const option = await optionContract.issuance(underlyingIndex);
      expect(option.seller).to.equal(ZERO_ADDRESS);
    }
  });

  it("Should cancel the put contract and return strike tokens back to seller for all token types", async function () {
    const { putOption, optionContract, acct1, token1, token3, token4 } = await loadFixture(deployInfraFixture);

    for (let strikeIndex = 0; strikeIndex < 3; strikeIndex++) {
      let strikeToken, strikeTokenId, strikeAmount;
      switch (strikeIndex) {
        case 0:
          strikeToken = token1.target;
          strikeTokenId = 0;
          strikeAmount = STRIKE;
          break;
        case 1:
          strikeToken = token3.target;
          strikeTokenId = 101;
          strikeAmount = 1;
          break;
        case 2:
          strikeToken = token4.target;
          strikeTokenId = 201;
          strikeAmount = STRIKE;
          break;
      }

      const optionData = {
        ...putOption,
        amount: 2,
        strikeToken: strikeToken,
        strikeTokenId: strikeTokenId,
        strike: strikeAmount,
      };

      if (strikeIndex == 0) {
        await token1.connect(acct1).approve(optionContract.target, 2 * STRIKE);
      } else if (strikeIndex == 1) {
        await token3.connect(acct1).approve(optionContract.target, 101);
      } else if (strikeIndex == 2) {
        await token4.connect(acct1).setApprovalForAll(optionContract.target, true);
      }

      await expect(optionContract.connect(acct1).create(optionData)).to.emit(optionContract, "Created");

      if (strikeIndex == 0) {
        expect(await token1.balanceOf(optionContract.target)).to.equal((2 * STRIKE) / 10 ** 6);
        expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - (2 * STRIKE) / 10 ** 6);
      } else if (strikeIndex == 1) {
        expect(await token3.ownerOf(101)).to.equal(optionContract.target);
      } else if (strikeIndex == 2) {
        await token4.connect(acct1).setApprovalForAll(optionContract.target, false);
        expect(await token4.balanceOf(optionContract.target, 201)).to.equal((2 * STRIKE) / 10 ** 6);
        expect(await token4.balanceOf(acct1.address, 201)).to.equal(TOKEN1_START_BALANCE - (2 * STRIKE) / 10 ** 6);
      }

      await expect(optionContract.connect(acct1).cancel(strikeIndex)).to.emit(optionContract, "Canceled");

      if (strikeIndex == 0) {
        expect(await token1.balanceOf(optionContract.target)).to.equal(0);
        expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE);
      } else if (strikeIndex == 1) {
        expect(await token3.ownerOf(101)).to.equal(acct1.address);
      } else if (strikeIndex == 2) {
        expect(await token4.balanceOf(optionContract.target, 201)).to.equal(0);
        expect(await token4.balanceOf(acct1.address, 201)).to.equal(TOKEN1_START_BALANCE);
      }

      const option = await optionContract.issuance(strikeIndex);
      expect(option.seller).to.equal(ZERO_ADDRESS);
    }
  });

  it("Should fail to cancel the option contract since option(s) are already bought", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    const totalStrikePrice = (boughtOptions * callOption.strike) / TOKEN1_DECIMALS;
    await token2.connect(acct2).approve(optionContract.target, premiumPaid + totalStrikePrice);
    await expect(optionContract.connect(acct2).buy(0, boughtOptions)).to.emit(optionContract, "Bought");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);
    expect(await token1.balanceOf(acct2.address)).to.equal(TOKEN1_START_BALANCE);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE + premiumPaid);
    expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE - premiumPaid);
    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions);

    await expect(optionContract.connect(acct1).cancel(0)).to.be.revertedWith("soldOptions");

    const option = await optionContract.issuance(0);
    expect(option.seller).to.not.equal(ZERO_ADDRESS);
  });

  it("Should fail to cancel since no issuance exists", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await expect(optionContract.connect(acct1).cancel(0)).to.be.revertedWith("seller");
  });

  it("Should fail to cancel since the canceling party is not the seller", async function () {
    const { callOption, optionContract, token1, acct1, acct2 } = await loadFixture(deployInfraFixture);

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);

    await expect(optionContract.connect(acct2).cancel(0)).to.be.revertedWith("seller");
  });
});
