const ethers = require('ethers');

async function main() {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const address = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    const abi = [
        "function getDeployedCampaigns() view returns (address[])"
    ];
    const contract = new ethers.Contract(address, abi, provider);

    try {
        const campaigns = await contract.getDeployedCampaigns();
        console.log("Deployed campaigns count:", campaigns.length);
        console.log("Campaign addresses:", campaigns);
    } catch (e) {
        console.error("Error fetching campaigns:", e);
    }
}

main().catch(console.error);
