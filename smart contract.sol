// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MultiSessionVoting {
    // Represents a single candidate with a name and vote count
    struct Candidate {
        string name;
        uint256 voteCount;
    }

    // Represents a voting session created by an admin
    struct VotingSession {
        address creator;                // Address of the session creator (admin)
        uint256 endDate;               // Deadline timestamp for the session
        bool active;                   // Flag to check if session is active
        Candidate[] candidates;        // Dynamic list of candidates
        mapping(address => bool) voted; // Tracks whether an address has voted
        uint256 totalVotes;           // Total number of votes cast
    }

    mapping(string => VotingSession) private sessions; // Maps session ID to voting session
    string[] private sessionIds;                       // Stores all session IDs

    //  Creates a new voting session with candidates and a deadline
    function createSession(
        string memory id,
        uint256 endDate,
        string[] calldata names
    ) external {
        require(sessions[id].creator == address(0), "Session ID exists");
        sessions[id].creator = msg.sender;
        sessions[id].endDate = endDate;
        sessions[id].active = true;
        for (uint i = 0; i < names.length; i++) {
            sessions[id].candidates.push(Candidate(names[i], 0));
        }
        sessionIds.push(id);
    }

    // Adds a candidate to an existing session (only by creator before end date)
    function addCandidate(string memory id, string memory name) external {
        VotingSession storage sess = sessions[id];
        require(msg.sender == sess.creator, "Only creator");
        require(block.timestamp <= sess.endDate, "Voting ended");
        sess.candidates.push(Candidate(name, 0));
    }

    //  Allows a user to vote for a candidate in a session
    function vote(string memory id, uint256 candidateIndex) external {
        VotingSession storage sess = sessions[id];
        require(sess.creator != address(0), "No such session");
        require(block.timestamp <= sess.endDate, "Voting closed");
        require(!sess.voted[msg.sender], "Already voted");
        sess.voted[msg.sender] = true;
        sess.candidates[candidateIndex].voteCount += 1;
        sess.totalVotes += 1;
    }

    //  Checks if a user has already voted in a session
    function hasVoted(string memory id, address user) external view returns (bool) {
        return sessions[id].voted[user];
    }

    //  Returns total candidates and end date of a given session
    function getSessionInfo(string memory id) external view returns (uint256, uint256) {
        VotingSession storage sess = sessions[id];
        require(sess.creator != address(0), "No such session");
        return (sess.candidates.length, sess.endDate);
    }

    //  Retrieves candidate names and vote counts of a session
    function getCandidates(string memory id) 
        external view returns (string[] memory names, uint256[] memory votes) 
    {
        VotingSession storage sess = sessions[id];
        uint len = sess.candidates.length;
        names = new string[](len);
        votes = new uint256[](len);
        for (uint i = 0; i < len; i++) {
            names[i] = sess.candidates[i].name;
            votes[i] = sess.candidates[i].voteCount;
        }
    }

    //  Deletes a candidate from a session if they have zero votes (only by creator)
    function deleteCandidate(string memory id, uint256 index) external {
        VotingSession storage sess = sessions[id];
        require(msg.sender == sess.creator, "Only creator");
        require(sess.candidates[index].voteCount == 0, "Candidate has votes");
        uint256 last = sess.candidates.length - 1;
        sess.candidates[index] = sess.candidates[last];
        sess.candidates.pop();
    }

    //  Deletes an entire session if no votes have been cast (only by creator)
    function deleteSession(string memory id) external {
        VotingSession storage sess = sessions[id];
        require(msg.sender == sess.creator, "Only creator");
        require(sess.totalVotes == 0, "Votes have been cast");
        for (uint i = 0; i < sessionIds.length; i++) {
            if (keccak256(bytes(sessionIds[i])) == keccak256(bytes(id))) {
                sessionIds[i] = sessionIds[sessionIds.length - 1];
                sessionIds.pop();
                break;
            }
        }
        delete sessions[id];
    }

    //  Returns a list of all session IDs (can include expired sessions)
    function getActiveSessions() external view returns (string[] memory) {
        return sessionIds;
    }
}
