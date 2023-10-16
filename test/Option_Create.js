const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const {
  deployInfraFixture,
  TOKEN1_START_BALANCE,
  TOKEN2_START_BALANCE,
  OPTION_COUNT,
  STRIKE,
} = require("./Option_Globals");

describe("Creation", function () {
  it("Should correctly create an all-ERC20 call option", async function () {
    const { callOption, optionContract, token1, acct1 } = await loadFixture(deployInfraFixture);

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");
    expect(await optionContract.issuanceCounter()).to.equal(1);

    const option = await optionContract.issuance(0);
    expect(option.seller).to.equal(acct1.address);
    expect(option.exercisedOptions).to.equal(0);
    expect(option.soldOptions).to.equal(0);
    expect(option.underlyingTokenType).to.equal(0);
    expect(option.strikeTokenType).to.equal(0);
    expect(option.premiumTokenType).to.equal(0);
    expect(option.data.side).to.equal(callOption.side);
    expect(option.data.underlyingToken).to.equal(callOption.underlyingToken);
    expect(option.data.amount).to.equal(callOption.amount);
    expect(option.data.underlyingTokenId).to.equal(callOption.underlyingTokenId);
    expect(option.data.strikeToken).to.equal(callOption.strikeToken);
    expect(option.data.strikeTokenId).to.equal(callOption.strikeTokenId);
    expect(option.data.strike).to.equal(callOption.strike);
    expect(option.data.premiumToken).to.equal(callOption.premiumToken);
    expect(option.data.premiumTokenId).to.equal(callOption.premiumTokenId);
    expect(option.data.premium).to.equal(callOption.premium);
    expect(option.data.exerciseWindowStart).to.equal(callOption.exerciseWindowStart);
    expect(option.data.exerciseWindowEnd).to.equal(callOption.exerciseWindowEnd);

    expect(await token1.balanceOf(optionContract.target)).to.equal(OPTION_COUNT);
    expect(await token1.balanceOf(acct1.address)).to.equal(TOKEN1_START_BALANCE - OPTION_COUNT);
  });

  it("Should correctly create an all-ERC20 put option", async function () {
    const { putOption, optionContract, token2, acct1 } = await loadFixture(deployInfraFixture);

    const TOTAL_UNDERLYING_PRICE = (OPTION_COUNT * STRIKE) / 10 ** 6;
    await token2.connect(acct1).approve(optionContract.target, TOTAL_UNDERLYING_PRICE);

    await expect(optionContract.connect(acct1).create(putOption)).to.emit(optionContract, "Created");
    expect(await optionContract.issuanceCounter()).to.equal(1);

    const option = await optionContract.issuance(0);
    expect(option.seller).to.equal(acct1.address);
    expect(option.exercisedOptions).to.equal(0);
    expect(option.soldOptions).to.equal(0);
    expect(option.underlyingTokenType).to.equal(0);
    expect(option.strikeTokenType).to.equal(0);
    expect(option.premiumTokenType).to.equal(0);
    expect(option.data.side).to.equal(1);
    expect(option.data.underlyingToken).to.equal(putOption.underlyingToken);
    expect(option.data.amount).to.equal(putOption.amount);
    expect(option.data.underlyingTokenId).to.equal(putOption.underlyingTokenId);
    expect(option.data.strikeToken).to.equal(putOption.strikeToken);
    expect(option.data.strike).to.equal(putOption.strike);
    expect(option.data.strikeTokenId).to.equal(putOption.strikeTokenId);
    expect(option.data.premiumToken).to.equal(putOption.premiumToken);
    expect(option.data.premiumTokenId).to.equal(putOption.premiumTokenId);
    expect(option.data.premium).to.equal(putOption.premium);
    expect(option.data.exerciseWindowStart).to.equal(putOption.exerciseWindowStart);
    expect(option.data.exerciseWindowEnd).to.equal(putOption.exerciseWindowEnd);

    expect(await token2.balanceOf(optionContract.target)).to.equal(TOTAL_UNDERLYING_PRICE);
    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE - TOTAL_UNDERLYING_PRICE);
  });

  it("Should fail to create an option because times are wrong", async function () {
    const { callOption, optionContract, token1, acct1, currentTime } = await loadFixture(deployInfraFixture);
    const OPTION_COUNT = 1 * 10 ** 6;

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

    const optionData = {
      ...callOption,
      exerciseWindowEnd: currentTime,
    };
    await expect(optionContract.connect(acct1).create(optionData)).to.be.revertedWith("exerciseWindowEnd");
  });

  it("Should fail to create an option because token transfer is not approved", async function () {
    const { callOption, optionContract, acct1 } = await loadFixture(deployInfraFixture);

    await expect(optionContract.connect(acct1).create(callOption)).to.be.revertedWith("ERC20: insufficient allowance");
  });

  it("Should correctly create an option with ERC-721 as an underlying", async function () {
    const { callOption, optionContract, acct1, token3 } = await loadFixture(deployInfraFixture);

    await token3.connect(acct1).approve(optionContract.target, 100);

    const optionData = {
      ...callOption,
      underlyingToken: await token3.getAddress(),
      underlyingTokenId: 100,
      amount: 1,
    };

    await expect(optionContract.connect(acct1).create(optionData)).to.emit(optionContract, "Created");
    expect(await optionContract.issuanceCounter()).to.equal(1);

    const option = await optionContract.issuance(0);
    expect(option.underlyingTokenType).to.equal(1);
    expect(option.strikeTokenType).to.equal(0);
    expect(option.premiumTokenType).to.equal(0);
  });
});
