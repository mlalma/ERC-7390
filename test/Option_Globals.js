const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const TokensToIndex = {
  ERC20: 0,
  ERC721: 1,
  ERC1155: 2,
};

const IndexToTokens = {
  0: "ERC20",
  1: "ERC721",
  2: "ERC1155",
};

const TOKEN1_DECIMALS = 10 ** 6;
const TOKEN1_START_BALANCE = 10 * TOKEN1_DECIMALS;
const TOKEN2_START_BALANCE = 10 * 10 ** 6;
const OPTION_COUNT = 1 * 10 ** 6;
const STRIKE = 10 * 4 * 10 ** 5;
const PREMIUM = 3 * 10 ** 4;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function deployInfraFixture() {
  const [owner, acct1, acct2, acct3] = await ethers.getSigners();

  const vanillaOption = await ethers.deployContract("VanillaOption");
  await vanillaOption.waitForDeployment();

  const token1 = await ethers.deployContract("MockToken1ERC20");
  await token1.waitForDeployment();

  const token2 = await ethers.deployContract("MockToken2ERC20");
  await token2.waitForDeployment();

  const token3 = await ethers.deployContract("MockToken3ERC721");
  await token3.waitForDeployment();

  const token4 = await ethers.deployContract("MockToken4ERC1155");
  await token4.waitForDeployment();

  const token5 = await ethers.deployContract("MockToken5None");
  await token5.waitForDeployment();

  await token1.connect(acct1).faucet(TOKEN1_START_BALANCE);
  await token1.connect(acct2).faucet(TOKEN1_START_BALANCE);
  await token1.connect(acct3).faucet(TOKEN1_START_BALANCE);

  await token2.connect(acct1).faucet(TOKEN2_START_BALANCE);
  await token2.connect(acct2).faucet(TOKEN2_START_BALANCE);
  await token2.connect(acct3).faucet(TOKEN2_START_BALANCE);

  await token3.connect(acct1).faucet(100);
  await token3.connect(acct1).faucet(101);
  await token3.connect(acct1).faucet(102);
  await token3.connect(acct2).faucet(103);

  await token4.connect(acct1).faucet(200, OPTION_COUNT);
  await token4.connect(acct1).faucet(201, TOKEN1_START_BALANCE);
  await token4.connect(acct1).faucet(202, PREMIUM);

  await token4.connect(acct2).faucet(202, PREMIUM);

  /* const emptyBytes = ethers.AbiCoder.defaultAbiCoder().encode(["string"], [""]);*/

  currentTime = await time.latest();

  const callOption = {
    side: 0,
    underlyingToken: token1.target,
    underlyingTokenId: 0,
    amount: OPTION_COUNT,
    strikeToken: token2.target,
    strikeTokenId: 0,
    strike: STRIKE,
    premiumToken: token2.target,
    premiumTokenId: 0,
    premium: PREMIUM,
    exerciseWindowStart: currentTime,
    exerciseWindowEnd: currentTime + 60 * 60,
  };

  const putOption = {
    side: 1,
    underlyingToken: token1.target,
    underlyingTokenId: 0,
    amount: OPTION_COUNT,
    strikeToken: token2.target,
    strikeTokenId: 0,
    strike: STRIKE,
    premiumToken: token2.target,
    premiumTokenId: 0,
    premium: PREMIUM,
    exerciseWindowStart: currentTime,
    exerciseWindowEnd: currentTime + 60 * 60,
  };

  return {
    callOption: callOption,
    putOption: putOption,
    optionContract: vanillaOption,
    token1: token1,
    token2: token2,
    token3: token3,
    token4: token4,
    token5: token5,
    acct1: acct1,
    acct2: acct2,
    acct3: acct3,
    currentTime: currentTime,
  };
}

module.exports = {
  deployInfraFixture,
  TOKEN1_DECIMALS,
  TOKEN1_START_BALANCE,
  TOKEN2_START_BALANCE,
  OPTION_COUNT,
  STRIKE,
  PREMIUM,
  ZERO_ADDRESS,
  TokensToIndex,
  IndexToTokens,
};
