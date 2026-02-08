// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RewardToken.sol";

interface ITrustLayer {
    function mintReward(address to, uint256 amount) external;
}

contract Campaign {
    struct Milestone {
        string description;
        uint256 amount;
        bool isApproved;
        bool isReleased;
        uint256 votingDeadline; // When voting ends for this milestone
    }

    address public creator;
    string public title;
    string public description;
    uint256 public goal;
    uint256 public deadline;
    uint256 public totalRaised;
    bool public isFunded;

    Milestone[] public milestones;
    mapping(address => uint256) public contributions;
    // Mapping from milestone ID -> voter address -> has voted
    mapping(uint256 => mapping(address => bool)) public approvals;
    // Mapping from milestone ID -> total approval weight (in wei)
    mapping(uint256 => uint256) public approvalWeights;
    
    address public factory;

    event Contributed(address contributor, uint256 amount);
    event MilestoneCreated(uint256 id, string description, uint256 amount);
    event VoteCast(address voter, uint256 milestoneId, bool approve);
    event FundsReleased(uint256 milestoneId, uint256 amount);

    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator can call this");
        _;
    }

    modifier onlyContributor() {
        require(contributions[msg.sender] > 0, "Only contributors can call this");
        _;
    }

    constructor(
        address _creator,
        string memory _title,
        string memory _description,
        uint256 _goal,
        uint256 _duration,
        address _factory
    ) {
        creator = _creator;
        title = _title;
        description = _description;
        goal = _goal;
        deadline = block.timestamp + _duration;
        factory = _factory;
    }

    /**
     * @dev Contribute ETH to the campaign.
     * Funds are held in the contract until milestones are approved.
     */
    function contribute() public payable {
        require(block.timestamp < deadline, "Campaign has ended");
        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;
        
        if (totalRaised >= goal) {
            isFunded = true;
        }

        // Mint 1000 tokens per 1 ETH via Factory
        // amount * 1000
        ITrustLayer(factory).mintReward(msg.sender, msg.value * 1000);

        emit Contributed(msg.sender, msg.value);
    }

    /**
     * @dev Creator adds a milestone.
     */
    function createMilestone(string memory _desc, uint256 _amount) public onlyCreator {
        require(isFunded, "Campaign must be met goal first");
        require(address(this).balance >= _amount, "Insufficient balance");

        Milestone memory newMilestone = Milestone({
            description: _desc,
            amount: _amount,
            isApproved: false,
            isReleased: false,
            votingDeadline: 0 // Set when voting starts? Or simplified to open voting.
        });

        milestones.push(newMilestone);
        emit MilestoneCreated(milestones.length - 1, _desc, _amount);
    }

    /**
     * @dev Contributors vote to approve a milestone.
     * Voting power is proportional to contribution.
     */
    function vote(uint256 _milestoneId) public onlyContributor {
        Milestone storage milestone = milestones[_milestoneId];
        require(!milestone.isReleased, "Milestone already released");
        require(!approvals[_milestoneId][msg.sender], "Already voted");

        approvals[_milestoneId][msg.sender] = true;
        approvalWeights[_milestoneId] += contributions[msg.sender];

        // Check if > 50% of total raised funds have approved
        if (approvalWeights[_milestoneId] > totalRaised / 2) {
            milestone.isApproved = true;
        }

        emit VoteCast(msg.sender, _milestoneId, true);
    }

    /**
     * @dev Creator withdraws funds for an approved milestone.
     */
    function withdraw(uint256 _milestoneId) public onlyCreator {
        Milestone storage milestone = milestones[_milestoneId];
        require(milestone.isApproved, "Milestone not approved");
        require(!milestone.isReleased, "Already released");

        milestone.isReleased = true;
        payable(creator).transfer(milestone.amount);

        emit FundsReleased(_milestoneId, milestone.amount);
    }
    
    /**
     * @dev Helper to get campaign summary.
     */
    function getSummary() public view returns (
        uint256, uint256, uint256, uint256, address, string memory, string memory
    ) {
        return (
            goal,
            totalRaised,
            address(this).balance,
            deadline,
            creator,
            title,
            description
        );
    }

    function getMilestonesCount() public view returns (uint256) {
        return milestones.length;
    }
}
