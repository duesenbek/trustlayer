const hre = require("hardhat");

async function main() {
  console.log("Deploying TrustLayer Factory...");

  const trustLayer = await hre.ethers.deployContract("TrustLayer");

  await trustLayer.waitForDeployment();

  console.log(
    `TrustLayer Factory deployed to: ${trustLayer.target}`
  );

  const tokenAddress = await trustLayer.token();
  console.log(`RewardToken deployed to: ${tokenAddress}`);

  // Optional: Create a detailed campaign validation
  /*
  const [deployer] = await hre.ethers.getSigners();
  console.log("Creating a test campaign...");
  const tx = await trustLayer.createCampaign(
      "Test Campaign",
      "A test description",
      hre.ethers.parseEther("10"), // 10 ETH goal
      3600 * 24 * 30 // 30 days
  );
  await tx.wait();
  
  const campaigns = await trustLayer.getDeployedCampaigns();
  console.log("Deployed Campaigns:", campaigns);
  */
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});