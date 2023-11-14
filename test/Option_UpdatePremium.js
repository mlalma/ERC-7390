const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployInfraFixture, TOKEN2_START_BALANCE, OPTION_COUNT, PREMIUM } = require("./Option_Globals");

describe("Updating option premium", function () {
  it("Should update premium successfully for ERC20", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;
    await token2.connect(acct2).approve(optionContract.target, premiumPaid);
    await expect(optionContract.connect(acct2).buy(0, boughtOptions)).to.emit(optionContract, "Bought");

    await expect(optionContract.connect(acct1).updatePremium(0, callOption.premium * 2)).to.emit(
      optionContract,
      "PremiumUpdated"
    );

    await token2.connect(acct2).approve(optionContract.target, premiumPaid * 2);
    await expect(optionContract.connect(acct2).buy(0, boughtOptions)).to.emit(optionContract, "Bought");

    expect(await token2.balanceOf(acct1.address)).to.equal(TOKEN2_START_BALANCE + premiumPaid * 3);
    expect(await token2.balanceOf(acct2.address)).to.equal(TOKEN2_START_BALANCE - premiumPaid * 3);
    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions * 2);
  });

  it("Should update premium successfully for ERC1155", async function () {
    const { callOption, optionContract, token1, token4, acct1, acct2 } = await loadFixture(deployInfraFixture);

    let premiumToken, premiumTokenId, premiumAmount;
    premiumToken = token4.target;
    premiumTokenId = 202;
    premiumAmount = PREMIUM;

    const optionData = {
      ...callOption,
      premiumToken: premiumToken,
      premiumTokenId: premiumTokenId,
      premium: premiumAmount,
    };

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(optionData)).to.emit(optionContract, "Created");

    const boughtOptions = OPTION_COUNT / 10;
    const premiumPaid = (boughtOptions * PREMIUM) / OPTION_COUNT;

    await token4.connect(acct2).setApprovalForAll(optionContract.target, true);
    await expect(optionContract.connect(acct2).buy(0, boughtOptions)).to.emit(optionContract, "Bought");
    await token4.connect(acct2).setApprovalForAll(optionContract.target, false);

    await expect(optionContract.connect(acct1).updatePremium(0, optionData.premium * 2)).to.emit(
      optionContract,
      "PremiumUpdated"
    );

    await token4.connect(acct2).setApprovalForAll(optionContract.target, true);
    await expect(optionContract.connect(acct2).buy(0, boughtOptions)).to.emit(optionContract, "Bought");
    await token4.connect(acct2).setApprovalForAll(optionContract.target, false);

    expect(await token4.balanceOf(acct1.address, 202)).to.equal(PREMIUM + premiumPaid * 3);
    expect(await token4.balanceOf(acct2.address, 202)).to.equal(PREMIUM - premiumPaid * 3);
    expect(await optionContract.balanceOf(acct2.address, 0)).to.equal(boughtOptions * 2);
  });

  it("Should fail to update premium for ERC721", async function () {
    const { callOption, optionContract, token1, token3, acct1 } = await loadFixture(deployInfraFixture);

    let premiumToken, premiumTokenId, premiumAmount;
    premiumToken = token3.target;
    premiumTokenId = 103;
    premiumAmount = 1;

    const optionData = {
      ...callOption,
      premiumToken: premiumToken,
      premiumTokenId: premiumTokenId,
      premium: premiumAmount,
    };

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);
    await expect(optionContract.connect(acct1).create(optionData)).to.emit(optionContract, "Created");
    await expect(optionContract.connect(acct1).updatePremium(0, 10)).to.be.revertedWith("0 or 1 for ERC-721");
  });

  it("Should fail to update since no issuance exists", async function () {
    const { callOption, optionContract, token1, token2, acct1, acct2 } = await loadFixture(deployInfraFixture);
    await expect(optionContract.connect(acct1).updatePremium(0, 1)).to.be.revertedWith("seller");
  });

  it("Should fail to update premium since the updater is not the seller", async function () {
    const { callOption, optionContract, token1, acct1, acct2 } = await loadFixture(deployInfraFixture);

    await token1.connect(acct1).approve(optionContract.target, OPTION_COUNT);

    await expect(optionContract.connect(acct1).create(callOption)).to.emit(optionContract, "Created");

    await expect(optionContract.connect(acct2).updatePremium(0, 1)).to.be.revertedWith("seller");
  });
});
