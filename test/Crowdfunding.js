const { expect } = require("chai");

describe("Crowdfunding Test", function () {
  it("Should create a campaign", async function () {
    const [owner] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("RewardToken");
    const token = await Token.deploy();
    
    const CF = await ethers.getContractFactory("MilestoneCrowdfunding");
    const cf = await CF.deploy(await token.getAddress());

    await cf.createCampaign(
      ethers.parseEther("1"), 
      3600, 
      ["Test Stage"], 
      [ethers.parseEther("1")]
    );

    expect(await cf.campaignCount()).to.equal(1);
    console.log("SUCCESS: Campaign created!");
  });
});