// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RewardToken is ERC20, Ownable {
    constructor() ERC20("Project Reward Token", "PRT") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}

contract MilestoneCrowdfunding is Ownable {
    RewardToken public token;

    struct Milestone {
        string description;
        uint256 amountToRelease;
        bool requested;
        bool released;
        uint256 votesFor;
    }

    struct Campaign {
        address author;
        uint256 goal;
        uint256 deadline;
        uint256 totalRaised;
        bool completed;
        uint256 milestoneCount;
        mapping(uint256 => Milestone) milestones;
        mapping(address => uint256) contributions;
        mapping(address => mapping(uint256 => bool)) hasVoted;
    }

    uint256 public campaignCount;
    mapping(uint256 => Campaign) public campaigns;

    constructor(address _tokenAddress) Ownable(msg.sender) {
        token = RewardToken(_tokenAddress);
    }

    function createCampaign(
        uint256 _goal,
        uint256 _duration,
        string[] memory _milestoneDescs,
        uint256[] memory _milestoneAmounts
    ) external {
        require(
            _milestoneDescs.length == _milestoneAmounts.length,
            "Mismatch lengths"
        );
        campaignCount++;
        Campaign storage c = campaigns[campaignCount];
        c.author = msg.sender;
        c.goal = _goal;
        c.deadline = block.timestamp + _duration;
        c.milestoneCount = _milestoneDescs.length;

        for (uint256 i = 0; i < _milestoneDescs.length; i++) {
            c.milestones[i] = Milestone(
                _milestoneDescs[i],
                _milestoneAmounts[i],
                false,
                false,
                0
            );
        }
    }

    function contribute(uint256 _campaignId) external payable {
        Campaign storage c = campaigns[_campaignId];
        require(block.timestamp < c.deadline, "Ended");
        c.contributions[msg.sender] += msg.value;
        c.totalRaised += msg.value;
        token.mint(msg.sender, msg.value * 100);
    }

    function requestRelease(
        uint256 _campaignId,
        uint256 _milestoneId
    ) external {
        require(msg.sender == campaigns[_campaignId].author, "Not author");
        campaigns[_campaignId].milestones[_milestoneId].requested = true;
    }

    function vote(uint256 _campaignId, uint256 _milestoneId) external {
        Campaign storage c = campaigns[_campaignId];
        require(c.contributions[msg.sender] > 0, "No contribution");
        require(!c.hasVoted[msg.sender][_milestoneId], "Voted already");
        c.milestones[_milestoneId].votesFor += c.contributions[msg.sender];
        c.hasVoted[msg.sender][_milestoneId] = true;
    }

    function releaseFunds(uint256 _campaignId, uint256 _milestoneId) external {
        Campaign storage c = campaigns[_campaignId];
        Milestone storage m = c.milestones[_milestoneId];
        require(
            m.requested && !m.released && m.votesFor > c.totalRaised / 2,
            "Cannot release"
        );
        m.released = true;
        payable(c.author).transfer(m.amountToRelease);
    }
}
