// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Campaign.sol";

import "./RewardToken.sol";

contract TrustLayer {
    // Array of all deployed campaigns
    Campaign[] public deployedCampaigns;
    RewardToken public token;

    // Event emitted when a new campaign is created
    event CampaignCreated(address campaignAddress, address creator, string title, uint256 goal);

    constructor() {
        token = new RewardToken();
    }

    /**
     * @dev Creates a new Campaign contract.
     * @param _title Title of the project.
     * @param _description Brief description.
     * @param _goal Funding goal in wei.
     * @param _duration Duration in seconds.
     */
    function createCampaign(
        string memory _title,
        string memory _description,
        uint256 _goal,
        uint256 _duration
    ) public {
        Campaign newCampaign = new Campaign(
            msg.sender,
            _title,
            _description,
            _goal,
            _duration,
            address(this) // Pass Factory address instead of Token address
        );
        deployedCampaigns.push(newCampaign);
        isCampaign[address(newCampaign)] = true;
        
        emit CampaignCreated(address(newCampaign), msg.sender, _title, _goal);
    }

    mapping(address => bool) public isCampaign;

    function mintReward(address to, uint256 amount) external {
        require(isCampaign[msg.sender], "Only campaigns can mint");
        token.mint(to, amount);
    }

    /**
     * @dev Returns the entire list of deployed campaigns.
     */
    function getDeployedCampaigns() public view returns (Campaign[] memory) {
        return deployedCampaigns;
    }
}
