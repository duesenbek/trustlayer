

const appState = {
    currentView: 'home',
    walletConnected: false,
    address: null,
    provider: null,
    signer: null,
    factoryContract: null,
    campaigns: []
};


const FACTORY_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const HARDHAT_NETWORK_ID = '31337';


let TrustLayerABI, CampaignABI, RewardTokenABI;


const views = {
    home: document.getElementById('view-home'),
    project: document.getElementById('view-project'),
    dashboard: document.getElementById('view-dashboard'),
};

const navLinks = document.querySelectorAll('.nav-link');
const walletBtn = document.getElementById('connect-wallet');

async function init() {
    console.log("TrustLayer Helper Initializing...");


    try {
        const tlRes = await fetch('abis/TrustLayer.json');
        const campRes = await fetch('abis/Campaign.json');
        const tokenRes = await fetch('abis/RewardToken.json');

        const tlJson = await tlRes.json();
        const campJson = await campRes.json();
        const tokenJson = await tokenRes.json();

        TrustLayerABI = tlJson.abi;
        CampaignABI = campJson.abi;
        RewardTokenABI = tokenJson.abi;
        console.log("ABIs loaded");
    } catch (e) {
        console.error("Failed to load ABIs", e);
    }

    setupEventListeners();
    checkWalletConnection();
}


function setupEventListeners() {
    console.log("Setting up event listeners");
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.target.getAttribute('data-target');
            if (target) navigateTo(target);
        });
    });

    if (walletBtn) {
        console.log("Wallet button found, attaching listener");
        walletBtn.addEventListener('click', (e) => {
            console.log("Connect button clicked");
            connectWallet();
        });
    } else {
        console.error("Wallet button NOT found");
    }
}

async function checkWalletConnection() {
    if (window.ethereum) {
        try {
            appState.provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await appState.provider.listAccounts();
            if (accounts.length > 0) {
                setupUser(accounts[0]);
            }
        } catch (e) {
            console.error("Error checking wallet connection", e);
        }
    }
}

async function connectWallet() {
    console.log("connectWallet called");
    if (!window.ethereum) {
        alert("Please install MetaMask!");
        return;
    }

    try {
        appState.provider = new ethers.BrowserProvider(window.ethereum);

        const accounts = await appState.provider.send("eth_requestAccounts", []);
        console.log("Accounts received", accounts);

        setupUser(accounts[0]);

        const network = await appState.provider.getNetwork();
        if (network.chainId !== 31337n) {
            // alert("Connected to wrong network. Switching to Localhost...");
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x7a69' }],
                });
                // Update provider after switch
                appState.provider = new ethers.BrowserProvider(window.ethereum);
                // Reload to ensure everything syncs
                window.location.reload();
            } catch (switchError) {
                if (switchError.code === 4902) {
                    try {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: '0x7a69',
                                chainName: 'Hardhat Localhost',
                                rpcUrls: ['http://127.0.0.1:8545'],
                                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
                            }],
                        });
                        window.location.reload();
                    } catch (e) {
                        console.error(e);
                        alert("Failed to add Localhost network.");
                    }
                } else {
                    console.error(switchError);
                    alert("Please switch to Localhost 8545 manually.");
                }
            }
        }
    } catch (error) {
        console.error("Connection failed", error);
        alert("Connection failed: " + error.message);
    }
}

async function setupUser(account) {
    console.log("Setting up user", account);
    appState.signer = await appState.provider.getSigner();
    appState.address = account.address || account;
    appState.walletConnected = true;


    const shortAddr = typeof appState.address === 'string' ? appState.address : appState.address.address;
    walletBtn.textContent = `${shortAddr.substring(0, 6)}...${shortAddr.substring(38)}`;
    walletBtn.classList.add('btn-outline');
    walletBtn.classList.remove('btn-primary');

    const dashboardLink = document.querySelector('[data-target="dashboard"]');
    if (dashboardLink) dashboardLink.style.display = 'inline-block';


    // In setupUser:
    // ...
    // ...
    appState.factoryContract = new ethers.Contract(FACTORY_ADDRESS, TrustLayerABI, appState.provider);

    await loadCampaigns(); // AWAIT THIS so campaigns are loaded before dashboard renders
    loadDashboard();
}

async function loadDashboard() {
    const container = document.getElementById('dashboard-content');
    if (!container) return;

    if (!appState.walletConnected) {
        container.innerHTML = '<p>Please connect wallet.</p>';
        return;
    }

    container.innerHTML = `
        <div class="stats-grid" style="margin-top: 2rem;">
            <div class="stat-card">
                <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem;">Address</div>
                <div class="stat-value" style="font-size: 1.2rem">${appState.address.substring(0, 6)}...${appState.address.substring(38)}</div>
            </div>
            <div class="stat-card">
                <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem;">Network</div>
                <div class="stat-value" style="font-size: 1.2rem">${(await appState.provider.getNetwork()).chainId === 31337n ? 'Localhost' : 'Wrong Network!'}</div>
            </div>
            <div class="stat-card">
                <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem;">ETH Balance</div>
                <div class="stat-value" style="font-size: 1.5rem; color: #10B981; font-weight: bold;" id="user-eth-balance">Loading...</div>
            </div>
            <div class="stat-card">
                <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem;">TSL Tokens</div>
                <div class="stat-value" style="font-size: 1.2rem" id="token-balance">Loading...</div>
            </div>
        </div>

        <h2>My Campaigns</h2>
        <div id="dashboard-campaigns-grid" class="campaigns-grid"></div>
    `;

    // 1. Fetch Balances (Moved from <script>)
    try {
        const ethBal = await appState.provider.getBalance(appState.address);
        const ethBalEl = document.getElementById('user-eth-balance');
        if (ethBalEl) ethBalEl.textContent = parseFloat(ethers.formatEther(ethBal)).toFixed(4) + ' ETH';

        if (!appState.factoryContract) throw new Error("Factory not initialized");
        const tokenAddress = await appState.factoryContract.token();
        console.log("Token Address:", tokenAddress);

        if (tokenAddress === ethers.ZeroAddress) {
            const tbEl = document.getElementById('token-balance');
            if (tbEl) tbEl.textContent = "Not Deployed";
        } else if (RewardTokenABI) {
            const tokenContract = new ethers.Contract(tokenAddress, RewardTokenABI, appState.provider);
            const balance = await tokenContract.balanceOf(appState.address);
            console.log("Token Balance:", balance);
            const tbEl = document.getElementById('token-balance');
            if (tbEl) tbEl.textContent = ethers.formatEther(balance) + ' TSL';
        }
    } catch (e) {
        console.error("Dashboard Balance Error:", e);
        const elEth = document.getElementById('user-eth-balance');
        const elTsl = document.getElementById('token-balance');
        if (elEth && elEth.textContent === 'Loading...') elEth.textContent = "Error";
        if (elTsl) elTsl.textContent = "Error (See Console)";
    }

    // 2. Render My Campaigns
    const myCampaigns = appState.campaigns.filter(c => c.creator.toLowerCase() === appState.address.toLowerCase());
    const dashGrid = document.getElementById('dashboard-campaigns-grid');

    if (myCampaigns.length === 0) {
        dashGrid.innerHTML = '<p>You haven\'t created any campaigns yet.</p>';
        return;
    }
    // ... func continues ...

    const cardsHTML = myCampaigns.map(campData => `
        <div class="card">
            <h3>${campData.title}</h3>
            <div style="margin-bottom: 1rem;">
                <span class="status-badge status-voting">Active</span>
            </div>
            <p>${campData.description}</p>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${Math.min(campData.progress, 100)}%"></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; color: #6B7280; font-size: 0.8rem;">
                <span>${campData.raised} ETH raised</span>
                <span>Goal: ${campData.goal} ETH</span>
            </div>
            <button class="btn btn-outline" style="width: 100%" onclick="viewProject('${campData.address}')">Manage Campaign</button>
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--card-border);">
                <h4 style="font-size: 0.9rem; margin-bottom: 0.5rem;">Add Milestone (Creator Only)</h4>
                <input type="text" id="ms-desc-${campData.address}" placeholder="Description (e.g., 'Prototypes')" style="width: 100%; margin-bottom: 0.5rem; padding: 0.5rem; background: var(--bg-color); border: 1px solid var(--card-border); color: white; font-size: 0.8rem;">
                <input type="number" id="ms-amount-${campData.address}" placeholder="Amount (ETH)" style="width: 100%; margin-bottom: 0.5rem; padding: 0.5rem; background: var(--bg-color); border: 1px solid var(--card-border); color: white; font-size: 0.8rem;">
                <button class="btn btn-primary" style="font-size: 0.8rem; width: 100%;" onclick="createMilestone('${campData.address}')">Create Milestone</button>
            </div>
        </div>
    `).join('');

    dashGrid.innerHTML = cardsHTML;
}

async function loadCampaigns() {
    if (!appState.factoryContract) return;

    console.log("Fetching campaigns...");
    const campaignAddresses = await appState.factoryContract.getDeployedCampaigns();

    const grid = document.getElementById('campaigns-grid');
    grid.innerHTML = '<p>Loading campaigns...</p>';

    appState.campaigns = [];

    const cardsHTML = [];


    try {
        for (const address of campaignAddresses) {
            try {
                const campContract = new ethers.Contract(address, CampaignABI, appState.provider);
                const summary = await campContract.getSummary();
                const campData = {
                    address: address,
                    goal: ethers.formatEther(summary[0]),
                    raised: ethers.formatEther(summary[1]),
                    balance: ethers.formatEther(summary[2]),
                    deadline: Number(summary[3]),
                    creator: summary[4],
                    title: summary[5],
                    description: summary[6],
                    progress: (Number(summary[1]) / Number(summary[0])) * 100
                };
                appState.campaigns.push(campData);
                cardsHTML.push(`
                    <div class="card">
                        <h3>${campData.title}</h3>
                        <p>${campData.description}</p>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${Math.min(campData.progress, 100)}%"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; color: #6B7280; font-size: 0.8rem;">
                            <span>${campData.raised} ETH raised</span>
                            <span>Goal: ${campData.goal} ETH</span>
                        </div>
                        <button class="btn btn-outline" style="width: 100%" onclick="viewProject('${campData.address}')">View Campaign</button>
                    </div>
                `);
            } catch (err) {
                console.error("Error loading specific campaign", address, err);
            }
        }
    } catch (e) {
        console.error("Critical error in loadCampaigns", e);
    }

    if (cardsHTML.length === 0) {
        grid.innerHTML = '<p>No campaigns found. Start one!</p>';
    } else {
        grid.innerHTML = cardsHTML.join('');
    }
}


window.viewProject = async (address) => {
    console.log("Viewing project", address);
    navigateTo('project');

    const container = document.getElementById('project-details-container');
    container.innerHTML = '<p>Loading details...</p>';

    let camp = appState.campaigns.find(c => c.address === address);


    if (!camp) {
        console.log("Campaign not in cache. Fetching direct...");
        try {
            const campContract = new ethers.Contract(address, CampaignABI, appState.provider);
            const summary = await campContract.getSummary();
            camp = {
                address: address,
                goal: ethers.formatEther(summary[0]),
                raised: ethers.formatEther(summary[1]),
                balance: ethers.formatEther(summary[2]),
                deadline: Number(summary[3]),
                creator: summary[4],
                title: summary[5],
                description: summary[6],
                progress: (Number(summary[1]) / Number(summary[0])) * 100
            };
            appState.campaigns.push(camp);
        } catch (e) {
            console.error("Failed to fetch campaign for view", e);
            container.innerHTML = '<p style="color:red">Campaign not found on blockchain.</p>';
            return;
        }
    }


    let milestonesHTML = '<p>No milestones yet.</p>';
    try {
        const campContract = new ethers.Contract(address, CampaignABI, appState.provider);
        const milestonesCount = await campContract.getMilestonesCount();

        if (milestonesCount > 0) {
            let listItems = '';
            for (let i = 0; i < milestonesCount; i++) {
                const m = await campContract.milestones(i);
                const approvedWeight = await campContract.approvalWeights(i);


                const weightEth = ethers.formatEther(approvedWeight);
                const totalRaisedEth = camp.raised;
                const percent = totalRaisedEth > 0 ? (Number(weightEth) / Number(totalRaisedEth)) * 100 : 0;

                let statusClass = 'status-locked';
                let statusText = 'Voting';
                let borderColor = 'var(--warning)';

                if (m.isReleased) {
                    statusClass = 'status-released';
                    statusText = 'Released';
                    borderColor = 'var(--success)';
                } else if (m.isApproved) {
                    statusClass = 'status-voting';
                    statusText = 'Approved';
                    borderColor = '#10B981';
                }


                let actionBtns = '';

                if (!m.isReleased && !m.isApproved) {
                    actionBtns += `<button class="btn btn-primary" style="font-size:0.7rem; padding:0.25rem 0.5rem; margin-right: 0.5rem;" onclick="vote('${address}', ${i})">Vote Yes</button>`;
                }


                if (m.isApproved && !m.isReleased && appState.address.toLowerCase() === camp.creator.toLowerCase()) {
                    actionBtns += `<button class="btn btn-primary" style="font-size:0.7rem; padding:0.25rem 0.5rem; background: #10B981; border: 1px solid #059669;" onclick="withdrawMilestone('${address}', ${i})">Receive Funds 💸</button>`;
                }

                listItems += `
                    <div class="milestone-item" style="border-left: 4px solid ${borderColor}; background: rgba(255,255,255,0.03); padding: 1rem; margin-bottom: 1rem; border-radius: 0 8px 8px 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <h4 style="margin: 0;">${Number(i) + 1}. ${m.description}</h4>
                            <span class="status-badge ${statusClass}">${statusText}</span>
                        </div>
                        <div style="font-size: 0.9rem; margin-bottom: 1rem;">
                            Requested: <strong>${ethers.formatEther(m.amount)} ETH</strong>
                        </div>
                        

                        <div style="margin-bottom: 0.5rem;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">
                                <span>Approval: ${weightEth} / ${Number(totalRaisedEth) / 2} ETH needed</span>
                                <span>${percent.toFixed(1)}%</span>
                            </div>
                            <div class="progress-bar" style="height: 6px; background: #374151;">
                                <div class="progress-fill" style="width: ${Math.min(percent, 100)}%; background: ${m.isApproved ? '#10B981' : '#F59E0B'};"></div>
                            </div>
                        </div>

                        <div style="text-align: right; margin-top: 1rem;">
                            ${actionBtns}
                        </div>
                    </div>
                `;
            }
            milestonesHTML = `<div class="milestones-list">${listItems}</div>`;
        }
    } catch (e) {
        console.error("Error fetching milestones", e);
        milestonesHTML = '<p style="color:red">Error loading milestones or connecting to contract.</p>';
    }

    container.innerHTML = `

        <div>
            <h1>${camp.title}</h1>
            <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
                <span class="status-badge status-voting" style="background: rgba(59, 130, 246, 0.1); color: #60A5FA; border: 1px solid #60A5FA;">
                    Contract: ${camp.address.substring(0, 6)}...${camp.address.substring(38)}
                </span>
            </div>
            
            <p class="description">${camp.description}</p>
            
            <h3 style="margin-top: 3rem; margin-bottom: 1.5rem;">Milestones (Governance)</h3>
            
            ${appState.address.toLowerCase() === camp.creator.toLowerCase() ? `
                <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem;">
                    <h4 style="margin-top: 0; color: #10B981;">Create New Milestone (Unlock Funds)</h4>
                    <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
                        To withdraw funds, create a milestone. Backers must vote to approve it.
                    </p>
                    <div style="display: flex; gap: 1rem;">
                        <input type="text" id="ms-desc-${camp.address}" placeholder="Description (e.g., 'Prototypes')" style="flex: 2; padding: 0.75rem; background: var(--bg-color); border: 1px solid var(--card-border); color: white; border-radius: 4px;">
                        <input type="number" id="ms-amount-${camp.address}" placeholder="Amount (ETH)" style="flex: 1; padding: 0.75rem; background: var(--bg-color); border: 1px solid var(--card-border); color: white; border-radius: 4px;">
                    </div>
                    <button class="btn btn-primary" style="width: 100%; margin-top: 1rem;" onclick="createMilestone('${camp.address}')">Create Milestone Request</button>
                </div>
            ` : ''}

            ${milestonesHTML}
        </div>


        <div>
            <div class="card" style="position: sticky; top: 2rem;">
                <div style="margin-bottom: 1.5rem;">
                    <div style="text-align: right; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Total Pledged</div>
                    <h2 style="color: var(--primary); margin: 0;">${camp.raised} ETH</h2>
                    <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.9rem;">
                        <span>Goal: ${camp.goal} ETH</span>
                        <span>${Math.round(camp.progress)}% Funded</span>
                    </div>
                    <div class="progress-bar" style="margin-top: 0.5rem;">
                        <div class="progress-fill" style="width: ${Math.min(camp.progress, 100)}%"></div>
                    </div>
                </div>


                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
                    <div style="font-size: 0.8rem; color: #34D399; margin-bottom: 0.25rem;">Escrow Balance</div>
                    <div style="font-size: 1.25rem; font-weight: bold; color: white;">${camp.balance || '0.0'} ETH</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">Funds are held in smart contract until milestones are approved.</div>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 2rem; border-top: 1px solid var(--card-border); padding-top: 1rem;">
                    <div>
                        <div id="backers-count-${address}" style="font-weight: 700; font-size: 1.2rem; color: white;">-</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Backers</div>
                    </div>
                    <div>
                        <div style="font-weight: 700; font-size: 1.2rem; color: white;">${camp.deadline ? Math.max(0, Math.ceil((camp.deadline - Date.now() / 1000) / (24 * 3600))) : '-'}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Days Left</div>
                    </div>
                </div>

                <input type="number" id="contribute-amount-${address}" placeholder="Amount (ETH)" style="width: 100%; margin-bottom: 0.5rem; padding: 0.5rem; background: var(--bg-color); border: 1px solid var(--card-border); color: white;">
                <button class="btn btn-primary" style="width: 100%; margin-bottom: 1rem;" onclick="contribute('${address}')">Contribute ETH</button>
            </div>
        </div>
    `;


    (async () => {
        try {
            const contract = new ethers.Contract(address, CampaignABI, appState.provider);
            const events = await contract.queryFilter("Contributed");
            const uniqueBackers = new Set(events.map(e => e.args[0])).size;
            const el = document.getElementById(`backers-count-${address}`);
            if (el) el.textContent = uniqueBackers;
        } catch (e) {
            console.error("Backers count failed", e);
        }
    })();
};

window.contribute = async (address) => {
    if (!appState.walletConnected) return alert("Connect Wallet first");
    const amountInp = document.getElementById(`contribute-amount-${address}`);
    const amount = amountInp.value;
    if (!amount) return alert("Enter amount");

    try {
        const contract = new ethers.Contract(address, CampaignABI, appState.signer);
        const tx = await contract.contribute({ value: ethers.parseEther(amount) });
        alert("Transaction sent...");
        await tx.wait();
        alert("Contribution successful!");
        loadCampaigns();
        viewProject(address);
    } catch (e) {
        console.error(e);
        alert("Error: " + (e.reason || e.message));
    }
};

window.vote = async (campAddress, milestoneId) => {
    if (!appState.walletConnected) {
        alert("Connect wallet first");
        return;
    }

    try {
        const contract = new ethers.Contract(campAddress, CampaignABI, appState.signer);
        const tx = await contract.vote(milestoneId);
        await tx.wait();
        alert("Voted successfully!");
        viewProject(campAddress);
    } catch (e) {
        console.error(e);
        alert("Vote failed: " + (e.reason || e.message));
    }
};

function navigateTo(viewName) {
    // 1. Update Views
    Object.values(views).forEach(el => {
        if (el) el.classList.remove('active');
    });

    if (views[viewName]) {
        views[viewName].classList.add('active');
        appState.currentView = viewName;
    }

    // 2. Update Nav Links
    navLinks.forEach(link => {
        link.classList.remove('active');
        const target = link.getAttribute('data-target');
        if (target === viewName) {
            // Don't highlight "Campaigns" which also points to home, just highlight "Home"
            if (viewName === 'home' && link.textContent.trim() === 'Campaigns') return;
            link.classList.add('active');
        }
    });

    // Special case: If we are in 'project' view, maybe highlight Projects? 
    // Or keep everything inactive.
    if (viewName === 'project') {
        // Optional: Highlight Projects if you consider detail view part of Projects
        // navLinks.forEach(l => { if(l.textContent === 'Projects') l.classList.add('active') });
    }
}


window.showCreateModal = () => {
    document.getElementById('create-modal').style.display = 'flex';
};

window.hideCreateModal = () => {
    document.getElementById('create-modal').style.display = 'none';
};

window.createCampaign = async () => {
    if (!appState.walletConnected) {
        alert("Connect wallet first!");
        return;
    }

    const title = document.getElementById('new-title').value;
    const desc = document.getElementById('new-desc').value;
    const goal = document.getElementById('new-goal').value;
    const durationDays = document.getElementById('new-duration').value;

    if (!title || !desc || !goal || !durationDays) {
        alert("Please fill all fields");
        return;
    }

    try {
        const goalWei = ethers.parseEther(goal);
        const durationSec = durationDays * 24 * 60 * 60;

        console.log("Creating campaign...", { title, desc, goalWei, durationSec });

        const tx = await appState.factoryContract.connect(appState.signer).createCampaign(
            title,
            desc,
            goalWei,
            durationSec
        );

        const btn = document.querySelector('#create-modal .btn-primary');
        const originalText = btn.textContent;
        btn.textContent = "Processing...";
        btn.disabled = true;

        await tx.wait();

        alert("Campaign Created Successfully!");
        hideCreateModal();
        loadCampaigns();

        btn.textContent = originalText;
        btn.disabled = false;


        document.getElementById('new-title').value = '';
        document.getElementById('new-desc').value = '';
        document.getElementById('new-goal').value = '';
        document.getElementById('new-duration').value = '';

    } catch (e) {
        console.error(e);
        alert("Creation failed: " + (e.reason || e.message));
        const btn = document.querySelector('#create-modal .btn-primary');
        btn.textContent = "Create";
        btn.disabled = false;
    }
};

window.createMilestone = async (address) => {
    if (!appState.walletConnected) return alert("Connect Wallet");

    const descInp = document.getElementById(`ms-desc-${address}`);
    const amountInp = document.getElementById(`ms-amount-${address}`);

    const desc = descInp.value;
    const amount = amountInp.value;

    if (!desc || !amount) return alert("Fill all fields");

    try {
        const contract = new ethers.Contract(address, CampaignABI, appState.signer);
        const amountWei = ethers.parseEther(amount);

        console.log("Creating milestone...", { desc, amountWei });

        const tx = await contract.createMilestone(desc, amountWei);
        alert("Transaction sent... Waiting for confirmation.");

        const btn = document.querySelector(`button[onclick="createMilestone('${address}')"]`);
        const originalText = btn.textContent;
        btn.textContent = "Processing...";
        btn.disabled = true;

        await tx.wait();
        alert("Milestone Created!");

        btn.textContent = originalText;
        btn.disabled = false;
        descInp.value = '';
        amountInp.value = '';


        viewProject(address);
    } catch (e) {
        console.error(e);
        alert("Error: " + (e.reason || e.message));
    }
};

window.withdrawMilestone = async (address, id) => {
    if (!appState.walletConnected) return alert("Connect Wallet");

    try {
        const contract = new ethers.Contract(address, CampaignABI, appState.signer);
        console.log("Withdrawing milestone", id);

        const tx = await contract.withdraw(id);
        alert("Withdraw transaction sent...");

        await tx.wait();
        alert("Funds Released to Creator!");
        viewProject(address);
    } catch (e) {
        console.error(e);
        alert("Withdraw failed: " + (e.reason || e.message));
    }
};

document.addEventListener('DOMContentLoaded', init);
