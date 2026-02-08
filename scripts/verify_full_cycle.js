const { ethers } = require("hardhat");

async function main() {
    console.log("Starting Full Cycle Verification...");

    const [deployer, userA, userB] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log(`User A (Creator): ${userA.address}`);
    console.log(`User B (Contributor): ${userB.address}`);

    // 1. Deploy Factory
    const TrustLayer = await ethers.getContractFactory("TrustLayer");
    const trustLayer = await TrustLayer.deploy();
    await trustLayer.waitForDeployment();
    console.log(`TrustLayer Factory deployed to: ${await trustLayer.getAddress()}`);

    // 2. User A Creates Campaign
    const goal = ethers.parseEther("10");
    const duration = 60 * 60 * 24; // 1 day
    const txCreate = await trustLayer.connect(userA).createCampaign("Test Campaign", "Desc", goal, duration);
    await txCreate.wait();

    const campaigns = await trustLayer.getDeployedCampaigns();
    const campaignAddress = campaigns[0];
    console.log(`Campaign created at: ${campaignAddress}`);

    const campaign = await ethers.getContractAt("Campaign", campaignAddress);

    // 3. User B Contributes
    console.log("User B contributing 10 ETH...");
    const txContrib = await campaign.connect(userB).contribute({ value: ethers.parseEther("10") });
    await txContrib.wait();

    // Check Token Balance
    const tokenAddress = await trustLayer.token();
    const token = await ethers.getContractAt("RewardToken", tokenAddress);
    const balanceB = await token.balanceOf(userB.address);
    console.log(`User B Reward Token Balance: ${ethers.formatEther(balanceB)} TSL`);

    // 4. User A Creates Milestone
    console.log("User A creating milestone...");
    const txMilestone = await campaign.connect(userA).createMilestone("Milestone 1", ethers.parseEther("1"));
    await txMilestone.wait();

    // 5. User B Votes
    console.log("User B voting...");
    const txVote = await campaign.connect(userB).vote(0);
    await txVote.wait();

    // 6. User A Receives Funds
    const balanceBefore = await ethers.provider.getBalance(userA.address);
    console.log(`User A Balance Before: ${ethers.formatEther(balanceBefore)} ETH`);

    console.log("User A receiving funds...");
    const txWithdraw = await campaign.connect(userA).withdraw(0);
    await txWithdraw.wait();

    const balanceAfter = await ethers.provider.getBalance(userA.address);
    console.log(`User A Balance After: ${ethers.formatEther(balanceAfter)} ETH`);

    if (balanceAfter > balanceBefore) {
        console.log("SUCCESS: Funds received successfully!");
    } else {
        console.error("FAILURE: Balance did not increase.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
