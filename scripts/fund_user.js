const hre = require("hardhat");

async function main() {
    const userAddress = "0x7de66314006bafed8a4afb883779ffcdcd4e5171";
    const amount = "100000"; // ETH
    const amountWei = hre.ethers.parseEther(amount);
    const amountHex = "0x" + amountWei.toString(16);

    console.log(`Setting balance for ${userAddress} to ${amount} ETH...`);

    try {
        await hre.network.provider.send("hardhat_setBalance", [
            userAddress,
            amountHex,
        ]);
        console.log("Balance set successfully!");
    } catch (e) {
        console.error("Set balance failed:", e);
        // Fallback: Try sending from first account
        const [signer] = await hre.ethers.getSigners();
        console.log("Fallback: Sending 1000 ETH from signer", signer.address);
        await signer.sendTransaction({
            to: userAddress,
            value: hre.ethers.parseEther("1000")
        });
        console.log("Sent 1000 ETH.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
