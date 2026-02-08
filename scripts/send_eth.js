const hre = require("hardhat");

async function main() {
    const [sender] = await hre.ethers.getSigners();
    const receiver = "0xc94d1845694CECB74496Df90f7e0Da500A2FB6Ec"; // User address
    const amount = hre.ethers.parseEther("1000");

    console.log(`Sending 1000 ETH from ${sender.address} to ${receiver}...`);

    const tx = await sender.sendTransaction({
        to: receiver,
        value: amount
    });

    console.log("Transaction sent:", tx.hash);
    await tx.wait();
    console.log("Success! Funds transferred.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
