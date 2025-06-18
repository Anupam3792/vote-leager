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

/**
 * Extracts the session ID from the URL query parameters.
 * @returns {string|null} The session ID if present, otherwise null.
 * Used to determine which voting session's results to display.
 */
function getSessionIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('session');
}

/**
 * Loads candidates and their vote counts for the selected session, determines the winner, and updates the UI.
 * No parameters.
 * @returns {Promise<void>} No return value. Updates the DOM with candidate cards and winner info.
 * Used to display live voting results and declare the winner in VoteLedger.
 */
async function loadCandidatesAndWinner() {
    const sessionId = getSessionIdFromUrl();
    if (!sessionId) {
        document.getElementById("candidatesList").innerHTML = `<div class='alert alert-danger'>No session selected. Please access this page from the voting list.</div>`;
        document.getElementById("winnerContent").innerHTML = "";
        return;
    }
    const provider = new ethers.providers.JsonRpcProvider("https://polygon-rpc.com");
    const contract = new ethers.Contract(contractAddress, contractABI, provider);

    try {
        const [names, votes] = await contract.getCandidates(sessionId);
        const candidatesList = document.getElementById("candidatesList");
        candidatesList.innerHTML = "";
        let maxVotes = 0;
        let winners = [];

        names.forEach((name, idx) => {
            const voteCount = Number(votes[idx]);
            const card = document.createElement("div");
            card.className = "card bg-dark text-light h-100 shadow voting-card mb-3 candidate-card";
            card.innerHTML = `
                <div class="card-body d-flex justify-content-between align-items-center">
                    <span class="fs-5 fw-bold">${name}</span>
                    <span class="d-flex align-items-center">
                        <span class="candidate-vote-icon"><i class="fa-solid fa-award"></i></span>
                        <span class="candidate-vote-count">${voteCount}</span>
                        <span class="candidate-vote-label">votes</span>
                    </span>
                </div>
            `;
            candidatesList.appendChild(card);
            if (voteCount > maxVotes) {
                maxVotes = voteCount;
                winners = [name];
            } else if (voteCount === maxVotes) {
                winners.push(name);
            }
        });

        const winnerContent = document.getElementById("winnerContent");
        if (maxVotes === 0) {
            winnerContent.innerHTML = `<span class="text-info">No votes have been cast yet.</span>`;
        } else if (winners.length === 1) {
            winnerContent.innerHTML = `
                <span class="text-success fw-bold fs-3">
                    <i class="fas fa-trophy"></i> ${winners[0]}
                </span>
                <div class="mt-2 text-light">with <span class="fw-bold">${maxVotes}</span> votes</div>
            `;
        } else {
            winnerContent.innerHTML = `
                <span class="text-warning fw-bold fs-3">
                    <i class="fas fa-balance-scale"></i> Tie!
                </span>
                <div class="mt-2 text-light">Candidates: <span class="fw-bold">${winners.join(", ")}</span> (${maxVotes} votes each)</div>
            `;
        }
    } catch (e) {
        document.getElementById("candidatesList").innerHTML = `<div class='alert alert-danger'>Failed to load results.</div>`;
        document.getElementById("winnerContent").innerHTML = "";
    }
}

window.addEventListener('DOMContentLoaded', loadCandidatesAndWinner); 