const { ethers } = require("hardhat");

async function main() {
    const FACTORY_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    console.log(`Checking Factory at ${FACTORY_ADDRESS}...`);

    const code = await ethers.provider.getCode(FACTORY_ADDRESS);
    if (code === "0x") {
        console.error("ERROR: No contract code at Factory address! Did you forget to deploy?");
        return;
    }
    console.log("SUCCESS: Factory contract found.");

    const TrustLayer = await ethers.getContractAt("TrustLayer", FACTORY_ADDRESS);

    try {
        const campaigns = await TrustLayer.getDeployedCampaigns();
        console.log(`Deployed Campaigns Count: ${campaigns.length}`);
        campaigns.forEach(c => console.log(` - ${c}`));
    } catch (e) {
        console.error("Failed to get campaigns:", e.message);
    }

    try {
        const tokenAddr = await TrustLayer.token();
        console.log(`Token Address: ${tokenAddr}`);

        if (tokenAddr !== ethers.ZeroAddress) {
            const tokenCode = await ethers.provider.getCode(tokenAddr);
            if (tokenCode === "0x") {
                console.error("ERROR: No code at Token address!");
            } else {
                console.log("SUCCESS: Token contract code found.");
                const RewardToken = await ethers.getContractAt("RewardToken", tokenAddr);
                const name = await RewardToken.name();
                console.log(`Token Name: ${name}`);
            }
        }
    } catch (e) {
        console.error("Failed to get token info:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
