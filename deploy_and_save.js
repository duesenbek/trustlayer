const fs = require('fs');
const hre = require("hardhat");

async function main() {
    console.log("Deploying...");
    const trustLayer = await hre.ethers.deployContract("TrustLayer");
    await trustLayer.waitForDeployment();
    const address = trustLayer.target;
    console.log("Deployed to:", address);
    fs.writeFileSync("deployed_address.txt", address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
