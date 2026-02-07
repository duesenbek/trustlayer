const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...");

  const Token = await hre.ethers.getContractFactory("RewardToken");
  const token = await Token.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("1. RewardToken deployed to:", tokenAddress);

  const Crowdfunding = await hre.ethers.getContractFactory("MilestoneCrowdfunding");
  const crowdfunding = await Crowdfunding.deploy(tokenAddress);
  await crowdfunding.waitForDeployment();
  const crowdfundingAddress = await crowdfunding.getAddress();
  console.log("2. MilestoneCrowdfunding deployed to:", crowdfundingAddress);

  await token.transferOwnership(crowdfundingAddress);
  console.log("3. Ownership of Token transferred to Crowdfunding contract");
  
  console.log("\n--- DEPLOYMENT FINISHED ---");
  console.log("TOKEN:", tokenAddress);
  console.log("CROWDFUNDING:", crowdfundingAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});