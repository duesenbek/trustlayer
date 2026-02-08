const ethers = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    console.log("Checking code at:", address);
    const code = await provider.getCode(address);
    console.log("Code size:", code.length);

    if (code === "0x") {
        console.log("ERROR: No code found at address. Contract is NOT deployed.");
    } else {
        console.log("SUCCESS: Contract code found.");
    }
}

main().catch(console.error);
