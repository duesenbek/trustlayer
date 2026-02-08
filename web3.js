/* eslint-disable no-alert */
// Web3 integration for MilestoneCrowdfunding + RewardToken (ethers.js v6)
// This file is intended to be included in a plain HTML page.
// It exposes global functions like `connectWallet()` and `createCampaign()`.

// ----------------------------
// Configuration
// ----------------------------
const HARDHAT_CHAIN_ID = 31337;
const HARDHAT_RPC_URL = "http://127.0.0.1:8545";

const MILESTONE_CROWDFUNDING_ADDRESS =
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const REWARD_TOKEN_ADDRESS =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// These paths assume your static server roots at `trustlayer/`
const MILESTONE_CROWDFUNDING_ABI_PATH =
  "./artifacts/contracts/Crowdfunding.sol/MilestoneCrowdfunding.json";
const REWARD_TOKEN_ABI_PATH =
  "./artifacts/contracts/Crowdfunding.sol/RewardToken.json";

// ----------------------------
// Internal state
// ----------------------------
let provider = null;
let signer = null;
let crowdfunding = null;
let rewardToken = null;
let milestoneAbi = null;
let tokenAbi = null;
let listenersAttached = false;

// ----------------------------
// DOM helpers (optional)
// ----------------------------
const $ = (id) => document.getElementById(id);

function setStatus(message) {
  const el = $("status");
  if (el) {
    el.textContent = message;
  } else {
    // Fallback for minimal UI
    console.info(message);
  }
}

function setError(message) {
  const el = $("error");
  if (el) {
    el.textContent = message;
  } else {
    // Required: do not only console.log errors
    alert(message);
  }
}

function clearMessages() {
  const status = $("status");
  const error = $("error");
  if (status) status.textContent = "";
  if (error) error.textContent = "";
}

// ----------------------------
// Error handling
// ----------------------------
function normalizeErrorMessage(err) {
  if (!err) return "Unknown error";

  const raw =
    err.shortMessage ||
    err.reason ||
    err?.info?.error?.message ||
    err.message ||
    String(err);

  const msg = String(raw);

  if (/user rejected|denied|rejected/i.test(msg)) {
    return "Transaction was rejected in MetaMask.";
  }
  if (/insufficient funds/i.test(msg)) {
    return "Insufficient funds for this transaction.";
  }
  if (/wrong network|chain id|chainId/i.test(msg)) {
    return "Please switch to Hardhat Local network (chainId 31337).";
  }
  return msg;
}

async function withUserFeedback(action, successMessage) {
  clearMessages();
  try {
    const result = await action();
    if (successMessage) setStatus(successMessage);
    return result;
  } catch (err) {
    setError(normalizeErrorMessage(err));
    throw err;
  }
}

// ----------------------------
// MetaMask + ethers.js setup
// ----------------------------
function ensureEthereum() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed.");
  }
}

async function ensureProvider() {
  ensureEthereum();
  if (!window.ethers) {
    throw new Error("ethers.js is not available. Include ethers v6 in your HTML.");
  }
  if (!provider) {
    provider = new ethers.BrowserProvider(window.ethereum);
  }
  return provider;
}

async function ensureCorrectNetwork() {
  const net = await provider.getNetwork();
  const chainId = Number(net.chainId);
  if (chainId !== HARDHAT_CHAIN_ID) {
    alert("Please switch to Hardhat Local network");
    throw new Error(
      `Wrong network: connected chainId ${chainId}, expected ${HARDHAT_CHAIN_ID}`
    );
  }
}

async function loadAbis() {
  if (milestoneAbi && tokenAbi) return;

  const [milestoneJson, tokenJson] = await Promise.all([
    fetch(MILESTONE_CROWDFUNDING_ABI_PATH).then((r) => r.json()),
    fetch(REWARD_TOKEN_ABI_PATH).then((r) => r.json()),
  ]);

  milestoneAbi = milestoneJson.abi;
  tokenAbi = tokenJson.abi;
}

async function initContracts() {
  await ensureProvider();
  await loadAbis();
  signer = await provider.getSigner();

  crowdfunding = new ethers.Contract(
    MILESTONE_CROWDFUNDING_ADDRESS,
    milestoneAbi,
    signer
  );
  rewardToken = new ethers.Contract(REWARD_TOKEN_ADDRESS, tokenAbi, signer);
}

function attachMetaMaskListeners() {
  if (!window.ethereum || listenersAttached) return;
  window.ethereum.on("accountsChanged", () => {
    window.location.reload();
  });
  window.ethereum.on("chainChanged", () => {
    window.location.reload();
  });
  listenersAttached = true;
}

// ----------------------------
// Public API
// ----------------------------
async function connectWallet() {
  return withUserFeedback(async () => {
    await ensureProvider();
    attachMetaMaskListeners();

    await provider.send("eth_requestAccounts", []);
    await ensureCorrectNetwork();
    await initContracts();

    const address = await signer.getAddress();
    const walletEl = $("walletAddress");
    if (walletEl) walletEl.textContent = address;
    setStatus(`Connected: ${address}`);

    return address;
  });
}

async function loadCampaigns() {
  return withUserFeedback(async () => {
    if (!crowdfunding) {
      await initContracts();
      await ensureCorrectNetwork();
    }

    const count = await crowdfunding.campaignCount();
    const total = Number(count);
    const campaigns = [];

    for (let i = 0; i < total; i += 1) {
      const c = await crowdfunding.campaigns(i);
      campaigns.push({
        id: i,
        author: c.author,
        goal: c.goal,
        goalEth: ethers.formatEther(c.goal),
        deadline: Number(c.deadline),
        deadlineDate: new Date(Number(c.deadline) * 1000),
        totalRaised: c.totalRaised,
        totalRaisedEth: ethers.formatEther(c.totalRaised),
        completed: c.completed,
        milestoneCount: Number(c.milestoneCount),
      });
    }

    const listEl = $("campaignList");
    if (listEl) {
      listEl.innerHTML = campaigns
        .map(
          (c) =>
            `<div data-id="${c.id}">
              <strong>Campaign #${c.id}</strong><br/>
              Author: ${c.author}<br/>
              Goal: ${c.goalEth} ETH<br/>
              Raised: ${c.totalRaisedEth} ETH<br/>
              Deadline: ${c.deadlineDate.toLocaleString()}<br/>
              Completed: ${c.completed}<br/>
              Milestones: ${c.milestoneCount}
            </div>`
        )
        .join("");
    }

    return campaigns;
  });
}

function parseMilestoneInputs(descs, amounts) {
  const milestoneDescs = Array.isArray(descs)
    ? descs
    : String(descs || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  const milestoneAmountsEth = Array.isArray(amounts)
    ? amounts
    : String(amounts || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  if (milestoneDescs.length !== milestoneAmountsEth.length) {
    throw new Error("Milestone descriptions and amounts length mismatch.");
  }

  const milestoneAmountsWei = milestoneAmountsEth.map((amt) =>
    ethers.parseEther(String(amt))
  );

  return { milestoneDescs, milestoneAmountsWei };
}

async function createCampaign(
  goalEth,
  durationSeconds,
  milestoneDescs,
  milestoneAmountsEth
) {
  return withUserFeedback(async () => {
    if (!crowdfunding) {
      await initContracts();
      await ensureCorrectNetwork();
    }

    const goal =
      goalEth ??
      ($("campaignGoal") ? $("campaignGoal").value : undefined);
    const duration =
      durationSeconds ??
      ($("campaignDuration") ? $("campaignDuration").value : undefined);
    const descs =
      milestoneDescs ??
      ($("milestoneDescs") ? $("milestoneDescs").value : undefined);
    const amounts =
      milestoneAmountsEth ??
      ($("milestoneAmounts") ? $("milestoneAmounts").value : undefined);

    if (!goal || !duration) {
      throw new Error("Goal and duration are required.");
    }

    const goalWei = ethers.parseEther(String(goal));
    const durationNum = Number(duration);
    const { milestoneDescs: descList, milestoneAmountsWei: amtList } =
      parseMilestoneInputs(descs, amounts);

    const tx = await crowdfunding.createCampaign(
      goalWei,
      durationNum,
      descList,
      amtList
    );
    await tx.wait();
    await loadCampaigns();
  }, "Campaign created successfully.");
}

async function contribute(campaignId, ethAmount) {
  return withUserFeedback(async () => {
    if (!crowdfunding) {
      await initContracts();
      await ensureCorrectNetwork();
    }

    const amount =
      ethAmount ??
      ($("contributeAmount") ? $("contributeAmount").value : undefined);
    const id =
      campaignId ??
      ($("contributeCampaignId") ? $("contributeCampaignId").value : undefined);

    if (amount === undefined || id === undefined) {
      throw new Error("campaignId and ethAmount are required.");
    }

    const value = ethers.parseEther(String(amount));
    const tx = await crowdfunding.contribute(Number(id), { value });
    await tx.wait();
    await loadCampaigns();
  }, "Contribution sent successfully.");
}

async function vote(campaignId, milestoneId) {
  return withUserFeedback(async () => {
    if (!crowdfunding) {
      await initContracts();
      await ensureCorrectNetwork();
    }

    const cid =
      campaignId ?? ($("voteCampaignId") ? $("voteCampaignId").value : undefined);
    const mid =
      milestoneId ??
      ($("voteMilestoneId") ? $("voteMilestoneId").value : undefined);

    if (cid === undefined || mid === undefined) {
      throw new Error("campaignId and milestoneId are required.");
    }

    const tx = await crowdfunding.vote(Number(cid), Number(mid));
    await tx.wait();
  }, "Vote submitted.");
}

async function requestRelease(campaignId, milestoneId) {
  return withUserFeedback(async () => {
    if (!crowdfunding) {
      await initContracts();
      await ensureCorrectNetwork();
    }

    const cid =
      campaignId ??
      ($("requestCampaignId") ? $("requestCampaignId").value : undefined);
    const mid =
      milestoneId ??
      ($("requestMilestoneId") ? $("requestMilestoneId").value : undefined);

    if (cid === undefined || mid === undefined) {
      throw new Error("campaignId and milestoneId are required.");
    }

    const tx = await crowdfunding.requestRelease(Number(cid), Number(mid));
    await tx.wait();
  }, "Release requested.");
}

async function releaseFunds(campaignId, milestoneId) {
  return withUserFeedback(async () => {
    if (!crowdfunding) {
      await initContracts();
      await ensureCorrectNetwork();
    }

    const cid =
      campaignId ??
      ($("releaseCampaignId") ? $("releaseCampaignId").value : undefined);
    const mid =
      milestoneId ??
      ($("releaseMilestoneId") ? $("releaseMilestoneId").value : undefined);

    if (cid === undefined || mid === undefined) {
      throw new Error("campaignId and milestoneId are required.");
    }

    const tx = await crowdfunding.releaseFunds(Number(cid), Number(mid));
    await tx.wait();
  }, "Funds released.");
}

async function loadTokenBalance() {
  return withUserFeedback(async () => {
    if (!rewardToken) {
      await initContracts();
      await ensureCorrectNetwork();
    }

    const address = await signer.getAddress();
    const [balance, decimals, symbol] = await Promise.all([
      rewardToken.balanceOf(address),
      rewardToken.decimals(),
      rewardToken.symbol(),
    ]);

    const formatted = ethers.formatUnits(balance, decimals);
    const el = $("tokenBalance");
    if (el) el.textContent = `${formatted} ${symbol}`;

    return { balance, formatted, symbol };
  });
}

// ----------------------------
// Optional auto-init if already connected
// ----------------------------
async function initOnLoad() {
  try {
    await ensureProvider();
    attachMetaMaskListeners();
    const accounts = await provider.send("eth_accounts", []);
    if (accounts && accounts.length) {
      await ensureCorrectNetwork();
      await initContracts();
      const walletEl = $("walletAddress");
      if (walletEl) walletEl.textContent = accounts[0];
    }
  } catch (err) {
    // Silent: user can click connectWallet()
    console.debug("Auto-init skipped:", err);
  }
}

// Expose to window for HTML buttons
window.connectWallet = connectWallet;
window.loadCampaigns = loadCampaigns;
window.createCampaign = createCampaign;
window.contribute = contribute;
window.vote = vote;
window.requestRelease = requestRelease;
window.releaseFunds = releaseFunds;
window.loadTokenBalance = loadTokenBalance;

// Kick off auto-init
initOnLoad();
