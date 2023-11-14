const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const {
  deployInfraFixture,
  TOKEN1_START_BALANCE,
  TOKEN2_START_BALANCE,
  OPTION_COUNT,
  STRIKE,
  PREMIUM,
  TokensToIndex,
  IndexToTokens,
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

  it("Should fail to create an option with unknown token type as an underlying", async function () {
    const { callOption, optionContract, acct1, token5 } = await loadFixture(deployInfraFixture);

    const optionData = {
      ...callOption,
      underlyingToken: token5.target,
      underlyingTokenId: 0,
      amount: 1,
    };

    await expect(optionContract.connect(acct1).create(optionData)).to.be.rejectedWith("Unknown token");
    expect(await optionContract.issuanceCounter()).to.equal(0);
  });

  it(`Should correctly create call options with all different combinations`, async function () {
    for (underlyingIndex = 0; underlyingIndex < 3; underlyingIndex++) {
      for (strikeIndex = 0; strikeIndex < 3; strikeIndex++) {
        for (premiumIndex = 0; premiumIndex < 3; premiumIndex++) {
          const { callOption, optionContract, acct1, token1, token3, token4 } = await loadFixture(deployInfraFixture);

          /*
          console.log(
            `Creating call option with underlying token ${IndexToTokens[underlyingIndex]}, strike token ${IndexToTokens[strikeIndex]} and premium token ${IndexToTokens[premiumIndex]}`
          );
          */

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

          let premiumToken, premiumTokenId, premiumAmount;
          switch (premiumIndex) {
            case 0:
              premiumToken = token1.target;
              premiumTokenId = 0;
              premiumAmount = PREMIUM;
              break;
            case 1:
              premiumToken = token3.target;
              premiumTokenId = 102;
              premiumAmount = 1;
              break;
            case 2:
              premiumToken = token4.target;
              premiumTokenId = 202;
              premiumAmount = PREMIUM;
              break;
          }

          const optionData = {
            ...callOption,
            underlyingToken: underlyingToken,
            underlyingTokenId: underlyingTokenId,
            amount: underlyingAmount,

            strikeToken: strikeToken,
            strikeTokenId: strikeTokenId,
            strike: strikeAmount,

            premiumToken: premiumToken,
            premiumTokenId: premiumTokenId,
            premium: premiumAmount,
          };

          if (underlyingIndex == 0) {
            await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
          } else if (underlyingIndex == 1) {
            await token3.connect(acct1).approve(optionContract.target, 100);
          } else if (underlyingIndex == 2) {
            await token4.connect(acct1).setApprovalForAll(optionContract.target, true);
          }

          await expect(optionContract.connect(acct1).create(optionData)).to.emit(optionContract, "Created");

          if (underlyingIndex == 2) {
            await token4.connect(acct1).setApprovalForAll(optionContract.target, false);
          }

          const option = await optionContract.issuance(0);
          expect(option.exercisedOptions).to.equal(0);
          expect(option.soldOptions).to.equal(0);
          expect(option.underlyingTokenType).to.equal(underlyingIndex);
          expect(option.strikeTokenType).to.equal(strikeIndex);
          expect(option.premiumTokenType).to.equal(premiumIndex);
          expect(option.data.side).to.equal(optionData.side);
          expect(option.data.underlyingToken).to.equal(underlyingToken);
          expect(option.data.amount).to.equal(underlyingAmount);
          expect(option.data.underlyingTokenId).to.equal(underlyingTokenId);
          expect(option.data.strikeToken).to.equal(strikeToken);
          expect(option.data.strikeTokenId).to.equal(strikeTokenId);
          expect(option.data.strike).to.equal(strikeAmount);
          expect(option.data.premiumToken).to.equal(premiumToken);
          expect(option.data.premiumTokenId).to.equal(premiumTokenId);
          expect(option.data.premium).to.equal(premiumAmount);
          expect(option.data.exerciseWindowStart).to.equal(optionData.exerciseWindowStart);
          expect(option.data.exerciseWindowEnd).to.equal(optionData.exerciseWindowEnd);
        }
      }
    }
  });

  it(`Should correctly create put options with all different combinations`, async function () {
    for (underlyingIndex = 0; underlyingIndex < 3; underlyingIndex++) {
      for (strikeIndex = 0; strikeIndex < 3; strikeIndex++) {
        for (premiumIndex = 0; premiumIndex < 3; premiumIndex++) {
          const { putOption, optionContract, acct1, token1, token3, token4 } = await loadFixture(deployInfraFixture);

          /*
          console.log(
            `Creating put option with underlying token ${IndexToTokens[underlyingIndex]}, strike token ${IndexToTokens[strikeIndex]} and premium token ${IndexToTokens[premiumIndex]}`
          );
          */

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
              underlyingAmount = 2;
              break;
          }

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

          let premiumToken, premiumTokenId, premiumAmount;
          switch (premiumIndex) {
            case 0:
              premiumToken = token1.target;
              premiumTokenId = 0;
              premiumAmount = PREMIUM;
              break;
            case 1:
              premiumToken = token3.target;
              premiumTokenId = 102;
              premiumAmount = 1;
              break;
            case 2:
              premiumToken = token4.target;
              premiumTokenId = 202;
              premiumAmount = PREMIUM;
              break;
          }

          const optionData = {
            ...putOption,
            underlyingToken: underlyingToken,
            underlyingTokenId: underlyingTokenId,
            amount: underlyingAmount,

            strikeToken: strikeToken,
            strikeTokenId: strikeTokenId,
            strike: strikeAmount,

            premiumToken: premiumToken,
            premiumTokenId: premiumTokenId,
            premium: premiumAmount,
          };

          if (strikeIndex == 0) {
            await token1.connect(acct1).approve(optionContract.target, 10 * STRIKE);
          } else if (strikeIndex == 1) {
            await token3.connect(acct1).approve(optionContract.target, 101);
          } else if (strikeIndex == 2) {
            await token4.connect(acct1).setApprovalForAll(optionContract.target, true);
          }

          await expect(optionContract.connect(acct1).create(optionData)).to.emit(optionContract, "Created");

          if (underlyingIndex == 2) {
            await token4.connect(acct1).setApprovalForAll(optionContract.target, false);
          }

          const option = await optionContract.issuance(0);
          expect(option.exercisedOptions).to.equal(0);
          expect(option.soldOptions).to.equal(0);
          expect(option.underlyingTokenType).to.equal(underlyingIndex);
          expect(option.strikeTokenType).to.equal(strikeIndex);
          expect(option.premiumTokenType).to.equal(premiumIndex);
          expect(option.data.side).to.equal(optionData.side);
          expect(option.data.underlyingToken).to.equal(underlyingToken);
          expect(option.data.amount).to.equal(underlyingAmount);
          expect(option.data.underlyingTokenId).to.equal(underlyingTokenId);
          expect(option.data.strikeToken).to.equal(strikeToken);
          expect(option.data.strikeTokenId).to.equal(strikeTokenId);
          expect(option.data.strike).to.equal(strikeAmount);
          expect(option.data.premiumToken).to.equal(premiumToken);
          expect(option.data.premiumTokenId).to.equal(premiumTokenId);
          expect(option.data.premium).to.equal(premiumAmount);
          expect(option.data.exerciseWindowStart).to.equal(optionData.exerciseWindowStart);
          expect(option.data.exerciseWindowEnd).to.equal(optionData.exerciseWindowEnd);
        }
      }
    }
  });
});
