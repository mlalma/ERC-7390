const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const {
  deployInfraFixture,
  TOKEN1_DECIMALS,
  TOKEN1_START_BALANCE,
  TOKEN2_START_BALANCE,
  OPTION_COUNT,
  PREMIUM,
  ZERO_ADDRESS,
} = require("./Option_Globals");

describe("Canceling", function () {
  it("Should cancel the option contract and return ERC-20 underlying to seller", async function () {
    const { callOption, optionContract, token1, acct1, currentTime } = await loadFixture(deployInfraFixture);

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);

    await expect(optionContract.connect(acct1).cancel(0)).to.emit(optionContract, "Canceled");

    expect(await token1.balanceOf(optionContract.target)).to.equal(0);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE);

    // Make sure data is deleted
    const option = await optionContract.issuance(0);
    expect(option.seller).to.equal(ZERO_ADDRESS);
  });

  it("Should cancel the option contract and return ERC-721 underlying to seller", async function () {
    const { callOption, optionContract, acct1, token3, token4 } = await loadFixture(deployInfraFixture);

    await token3.connect(acct1).approve(optionContract.target, 100);

    const optionData = {
      ...callOption,
      underlyingToken: token3.target,
      underlyingTokenId: 100,
      amount: 1,
    };

    await expect(optionContract.connect(acct1).create(optionData)).to.emit(optionContract, "Created");

    expect(await token3.ownerOf(100)).to.equal(optionContract.target);

    await expect(optionContract.connect(acct1).cancel(0)).to.emit(optionContract, "Canceled");

    expect(await token3.ownerOf(100)).to.equal(acct1.address);

    // Make sure data is deleted
    const option = await optionContract.issuance(0);
    expect(option.seller).to.equal(ZERO_ADDRESS);
  });

  it("Should cancel the option contract and return ERC-1155 underlying to seller", async function () {
    const { callOption, optionContract, acct1, token3, token4 } = await loadFixture(deployInfraFixture);

    const optionData = {
      ...callOption,
      underlyingToken: token4.target,
      underlyingTokenId: 200,
      amount: 100,
    };

    await token4.connect(acct1).setApprovalForAll(optionContract.target, true);
    await expect(optionContract.connect(acct1).create(optionData)).to.emit(optionContract, "Created");
    await token4.connect(acct1).setApprovalForAll(optionContract.target, false);

    expect(await token4.balanceOf(optionContract.target, 200)).to.equal(100);

    await expect(optionContract.connect(acct1).cancel(0)).to.emit(optionContract, "Canceled");

    expect(await token3.ownerOf(100)).to.equal(acct1.address);

    // Make sure data is deleted
    const option = await optionContract.issuance(0);
    expect(option.seller).to.equal(ZERO_ADDRESS);
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
