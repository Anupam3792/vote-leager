const contractAddress = "0xd2C1833b5fE068f96e038Bfdef4ee02001dbF0A3";
const contractABI = [
    {"inputs":[{"internalType":"string","name":"id","type":"string"},{"internalType":"string","name":"name","type":"string"}],"name":"addCandidate","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"string","name":"id","type":"string"},{"internalType":"uint256","name":"endDate","type":"uint256"},{"internalType":"string[]","name":"names","type":"string[]"}],"name":"createSession","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"string","name":"id","type":"string"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"deleteCandidate","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"string","name":"id","type":"string"}],"name":"deleteSession","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"string","name":"id","type":"string"},{"internalType":"uint256","name":"candidateIndex","type":"uint256"}],"name":"vote","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"getActiveSessions","outputs":[{"internalType":"string[]","name":"","type":"string[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"string","name":"id","type":"string"}],"name":"getCandidates","outputs":[{"internalType":"string[]","name":"names","type":"string[]"},{"internalType":"uint256[]","name":"votes","type":"uint256[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"string","name":"id","type":"string"}],"name":"getSessionInfo","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"string","name":"id","type":"string"},{"internalType":"address","name":"user","type":"address"}],"name":"hasVoted","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"}
];

let provider, signer, contract, userAddress;

/**
 * Extracts the session ID from the URL query parameters.
 * @returns {string|null} The session ID if present, otherwise null.
 * Used to determine which voting session is being viewed or voted on.
 */
function getSessionIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('session');
}

/**
 * Connects the user's wallet using MetaMask and updates the UI with the account address.
 * No parameters.
 * @returns {Promise<void>} No return value. Updates UI and contract instance.
 * Used for voter authentication and enabling voting actions in VoteLedger.
 */
async function connectWallet() {
    if (window.ethereum) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();
        contract = new ethers.Contract(contractAddress, contractABI, signer);
        document.getElementById('connectWalletBtn').textContent = userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
        document.getElementById('connectWalletBtn').classList.remove('btn-warning');
        document.getElementById('connectWalletBtn').classList.add('btn-success');
        document.getElementById('connectWalletBtn').disabled = false;
    } else {
        alert('MetaMask not found!');
    }
}

document.getElementById('connectWalletBtn').onclick = connectWallet;

/**
 * Loads all active voting sessions from the contract and stores them for later use.
 * No parameters.
 * @returns {Promise<void>} No return value. Updates the DOM and global session list.
 * Used to display available sessions and auto-select based on URL.
 */
async function loadSessions() {
    const votingSessionsList = document.getElementById('votingSessionsList');
    votingSessionsList.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
    try {
        const rpcProvider = new ethers.providers.JsonRpcProvider("https://polygon-rpc.com");
        const readContract = new ethers.Contract(contractAddress, contractABI, rpcProvider);
        const sessionIds = await readContract.getActiveSessions();
        let sessions = [];
        for (const id of sessionIds) {
            const [candidateCount, endDate] = await readContract.getSessionInfo(id);
            sessions.push({
                id,
                candidateCount: Number(candidateCount),
                endDate: Number(endDate)
            });
        }
        // Store sessions for later use
        window._allSessions = sessions;
        // Auto-select session if present in URL
        const urlSessionId = getSessionIdFromUrl();
        if (urlSessionId && sessions.some(s => s.id === urlSessionId)) {
            selectSession(urlSessionId);
        } else {
            // Optionally, show a session picker if no session is selected
            // (not required per user request)
        }
    } catch (e) {
        document.getElementById('selectedSessionDetails').innerHTML = `<div class='alert alert-danger'>Failed to load sessions.</div>`;
    }
}

let selectedSessionId = null;

/**
 * Selects a voting session and displays its details in the UI.
 * @param {string} sessionId - The ID of the session to select.
 * @returns {Promise<void>} No return value. Updates the DOM with session details.
 * Used to show the selected session's information and candidates.
 */
async function selectSession(sessionId) {
    selectedSessionId = sessionId;
    // Show only the selected session's details
    const detailsDiv = document.getElementById('selectedSessionDetails');
    const noSessionDiv = document.getElementById('noSessionSelected');
    const session = (window._allSessions || []).find(s => s.id === sessionId);
    if (!session) {
        detailsDiv.innerHTML = `<div class='alert alert-danger'>Session not found.</div>`;
        return;
    }
    if (noSessionDiv) noSessionDiv.style.display = 'none';
    const endDateObj = new Date(session.endDate * 1000);
    detailsDiv.innerHTML = `
        <div class='d-flex flex-column flex-md-row align-items-center justify-content-between'>
            <div>
                <h3 class='text-primary mb-2'>Session: <span class='fw-bold'>${session.id}</span></h3>
                <div class='mb-2'><strong>Ends:</strong> <span class='text-info'>${endDateObj.toLocaleString()}</span></div>
                <div><strong>Candidates:</strong> <span class='text-info'>${session.candidateCount}</span></div>
            </div>
            <div class='mt-3 mt-md-0'>
                <span class='badge bg-success fs-6 px-3 py-2'><i class='fa-solid fa-circle-check me-1'></i> Active</span>
            </div>
        </div>
    `;
    await loadCandidates(sessionId);
}

/**
 * Loads the list of candidates for a session and displays them, with optional vote highlight.
 * @param {string} sessionId - The ID of the session.
 * @param {number|null} highlightIdx - Index of the candidate to highlight (optional).
 * @returns {Promise<void>} No return value. Updates the DOM with candidate cards.
 * Used to show candidates and update vote counts after voting.
 */
async function loadCandidates(sessionId, highlightIdx = null) {
    const candidatesList = document.getElementById('candidatesList');
    const voteStatus = document.getElementById('voteStatus');
    candidatesList.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
    voteStatus.textContent = '';
    try {
        const rpcProvider = new ethers.providers.JsonRpcProvider("https://polygon-rpc.com");
        const readContract = new ethers.Contract(contractAddress, contractABI, rpcProvider);
        const [names, votes] = await readContract.getCandidates(sessionId);
        let html = '';
        names.forEach((name, idx) => {
            html += `
                <div class='card bg-light text-dark h-100 shadow candidate-card mb-3' style='min-width:220px;max-width:320px;'>
                    <div class='card-body d-flex flex-column align-items-center'>
                        <span class='fs-5 fw-bold mb-2'>${name}</span>
                        <div class='d-flex align-items-center mb-2'>
                            <span class='candidate-vote-icon' style='margin-right:0.5rem;'><i class='fa-solid fa-square-poll-vertical'></i></span>
                            <span class='candidate-vote-count${highlightIdx === idx ? " vote-highlight" : ""}' id='vote-count-${idx}'>${votes[idx]}</span>
                            <span class='candidate-vote-label'>votes</span>
                        </div>
                        <button class='btn btn-primary vote-btn' data-candidate-idx='${idx}' data-session-id='${sessionId}' ${highlightIdx !== null ? 'disabled' : ''}>
                            Vote
                        </button>
                    </div>
                </div>
            `;
        });
        candidatesList.innerHTML = html;
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.onclick = async function() {
                await castVote(btn.getAttribute('data-session-id'), btn.getAttribute('data-candidate-idx'));
            };
        });
        // Remove highlight after 1s
        if (highlightIdx !== null) {
            setTimeout(() => {
                const el = document.getElementById(`vote-count-${highlightIdx}`);
                if (el) el.classList.remove('vote-highlight');
            }, 1200);
        }
    } catch (e) {
        candidatesList.innerHTML = `<div class='alert alert-danger'>Failed to load candidates.</div>`;
    }
}

/**
 * Casts a vote for a candidate in the selected session and updates the UI.
 * @param {string} sessionId - The ID of the session.
 * @param {number} candidateIdx - The index of the candidate to vote for.
 * @returns {Promise<void>} No return value. Updates contract state and UI.
 * Used by voters to submit their vote in VoteLedger.
 */
async function castVote(sessionId, candidateIdx) {
    const voteStatus = document.getElementById('voteStatus');
    if (!window.ethereum) {
        voteStatus.innerHTML = '<span class="text-danger">MetaMask not found!</span>';
        return;
    }
    if (!signer || !userAddress) {
        voteStatus.innerHTML = '<span class="text-danger">Please connect your wallet first.</span>';
        return;
    }
    voteStatus.innerHTML = '<span class="text-info">Submitting your vote...</span>';
    try {
        const tx = await contract.vote(sessionId, candidateIdx);
        voteStatus.innerHTML = '<span class="text-info">Waiting for confirmation...</span>';
        await tx.wait();
        voteStatus.innerHTML = '<span class="text-success">Your vote has been cast successfully!</span>';
        // Instantly update vote counts and highlight
        await loadCandidates(sessionId, Number(candidateIdx));
    } catch (e) {
        voteStatus.innerHTML = `<span class="text-danger">Failed to cast vote. ${e?.reason || e?.message || ''}</span>`;
    }
}

window.addEventListener('DOMContentLoaded', loadSessions); 