import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import TeamDetailsPage from "./TeamDetailsPage";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import PaymentDialog from "./PaymentDialog";
import { startTransition } from "react";
import Header from "./Header";

const DUMMY_TEAM = {
  id: "DUMMY123",
  name: "Team Example",
  code: "ABCDEF",
  leader: "Vaibhav",
  createdAt: new Date().toISOString(),
  members: [
    {
      id: "m1",
      name: "Vaibhav",
      year: "3rd",
      role: "Team Lead",
      contact: "+91-90000-00001",
    },
    {
      id: "m2",
      name: "Anant",
      year: "2nd",
      role: "Member",
      contact: "+91-90000-00002",
    },
    {
      id: "m3",
      name: "Arpit",
      year: "4th",
      role: "Member",
      contact: "+91-90000-00003",
    },
  ],
};

export default function TeamDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const [teamData, setTeamData] = useState(
    location.state?.teamData || DUMMY_TEAM
  );
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true); // ← NEW FIX
  const [error, setError] = useState("");
  const [hasTeam, setHasTeam] = useState(false);
  const [showJoinPopup, setShowJoinPopup] = useState(false);
  const [teamCode, setTeamCode] = useState("");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [creatingTeamName, setCreatingTeamName] = useState("");

  const fetchTeamMembers = async () => {
    const teamId = localStorage.getItem("ideatex_teamID");

    setLoading(true);
    try {
      if (!teamId) {
        setHasTeam(false);
        return;
      }

      const response = await axios.post(
        `${import.meta.env.VITE_IDEATEX_API_BASE_URL}/api/v1/team/members`,
        { teamId },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("ideatex_token")}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        const apiMembers = response.data.data.members || [];
        const leaderMember =
          apiMembers.find((m) => m.role === "LEADER") || apiMembers[0];

        const membersWithDetails = await Promise.all(
          apiMembers.map(async (member) => {
            try {
              const userResponse = await axios.get(
                `${import.meta.env.VITE_IDEATEX_API_BASE_URL}/api/v1/user/${member.userId}`,
                {
                  headers: {
                    Authorization: `Bearer ${localStorage.getItem(
                      "ideatex_token"
                    )}`,
                  },
                }
              );

              const userData = userResponse.data.data.user;
              return {
                id: member._id,
                name: userData.name || "Unknown",
                year: "N/A",
                role: member.role,
                contact: userData.phone ? `+91-${userData.phone}` : "N/A",
                libraryId: userData.libId || "N/A",
                gender: userData.gender || "N/A",
                email: userData.email || "N/A",
                rollNo: userData.rollNo || "N/A",
                college: userData.college || "N/A",
              };
            } catch {
              return {
                id: member._id,
                name: "Unknown Member",
                year: "N/A",
                role: member.role,
                contact: "N/A",
                libraryId: "N/A",
                gender: "N/A",
                email: "N/A",
                rollNo: "N/A",
                college: "N/A",
              };
            }
          })
        );

        const leaderDetails =
          membersWithDetails.find((m) => m.role === "LEADER") ||
          membersWithDetails[0];

        const transformedTeamData = {
          id: leaderMember?.teamId,
          name: leaderMember?.teamName,
          code: leaderMember?.teamCode,
          leader: {
            name: leaderDetails?.name,
            year: leaderDetails?.year,
            libraryId: leaderDetails?.libraryId,
            gender: leaderDetails?.gender,
          },
          createdAt: new Date().toISOString(),
          members: membersWithDetails,
        };

        setTeamData(transformedTeamData);
        setHasTeam(true);
      } else {
        setHasTeam(false);
      }
    } catch (err) {
      setHasTeam(false);
    } finally {
      setLoading(false);
      setInitializing(false); // ← finish loading
    }
  };

  useEffect(() => {
    startTransition(() => {
      if (!isAuthenticated) {
        navigate("/ideatex/login");
        return;
      }
      fetchTeamMembers();
    });
  }, [isAuthenticated, navigate]);

  const handleRemoveMember = (memberId) => {
    setTeamData((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.id !== memberId),
    }));
  };

  const handleProfileUpdate = async () => {
    await fetchTeamMembers();
  };

  const handleTeamCodeChange = (code) => {
    setTeamCode(code.toUpperCase());
    // Team name fetching logic removed for now
  };

  const handleJoinSubmit = async () => {
    if (!teamCode.trim()) {
      setError("Team code is required");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_IDEATEX_API_BASE_URL}/api/v1/joinTeam`,
        { teamCode },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("ideatex_token")}`,
          },
        }
      );

      if (response.data.success) {
        localStorage.setItem("ideatex_teamID", response.data.data.team._id);
        localStorage.setItem("ideatex_userID", response.data.data.userId);
        setTimeout(() => {
          window.location.href = "/ideatex/dashboard";
        }, 2000);
        setShowJoinPopup(false);
        await fetchTeamMembers();
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to join team");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (paymentData) => {
    try {
      if (paymentData.paymentVerified && paymentData.backendResponse?.success) {
        const team = paymentData.backendResponse.data.team;
        const teamId = team._id || team.teamId || team.id;
        const leaderId = team.leaderId || team.leader || paymentData.backendResponse.data.team.leaderId;
        if (teamId) localStorage.setItem("ideatex_teamID", teamId);
        if (leaderId) localStorage.setItem("ideatex_userID", leaderId);
        setShowPaymentDialog(false);
        await fetchTeamMembers();
      } else {
        setError(paymentData.backendResponse?.message || "Failed to create team");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create team");
    }
  };

  const API_BASE = import.meta.env.VITE_IDEATEX_API_BASE_URL;

  const handleCreateTeamRequest = async (teamName) => {
    if (!teamName || !teamName.trim()) {
      setError("Team name is required");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE}/api/v1/addTeam`,
        { teamName },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("ideatex_token")}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data?.success) {
        const team = response.data.data.team;
        localStorage.setItem("ideatex_teamID", team._id || team.teamId || team.id);
        localStorage.setItem("ideatex_userID", response.data.data.team.leaderId || localStorage.getItem("ideatex_userID"));
        setShowCreateTeamModal(false);
        setShowPaymentDialog(true);
      } else {
        setError(response.data?.message || "Failed to create team");
      }
    } catch (err) {
      console.error("Create team error:", err);
      setError(err.response?.data?.message || "Failed to create team.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToHome = () => {
    navigate("/");
  };

  // ⛔ FIX: DO NOT SHOW ANY UI UNTIL FIRST FETCH IS DONE
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  // If user has no team after initialization
  if (!hasTeam) {
    return (
      <div className="relative bg-gradient-to-r from-[#211E3F] to-black text-white overflow-hidden min-h-screen">
        <Header />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-purple-900/30 via-purple-950/10 to-transparent pointer-events-none"></div>

        {/* Success Popup for users without team */}
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border-2 border-purple-500/50 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-bold text-gray-100 text-center">
              Welcome to IdeateX 2025!
            </h3>
            <p className="text-sm text-gray-400 text-center">
              You don&apos;t have a team yet. Choose how you&apos;d like to
              proceed.
            </p>

            <div className="flex gap-3 pt-2">
              <motion.button
                onClick={() => {
                  // Open create-team modal which only asks for team name, then shows payment dialog
                  setShowCreateTeamModal(true);
                }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-3 bg-[#9700d1] hover:bg-[#b800ff] text-white font-semibold rounded-xl shadow-lg transition-all"
              >
                Create Team
              </motion.button>
              <motion.button
                onClick={() => {
                  setShowJoinPopup(true);
                  setError(""); // Clear any previous errors
                }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-3 bg-white hover:bg-[#b800ff] text-black hover:text-white font-semibold rounded-xl shadow-lg transition-all"
              >
                Join Team
              </motion.button>
            </div>
          </div>
        </div>

        {/* Join Popup */}
        {showJoinPopup && (
          <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            {/* <Header /> */}

            <div className="bg-[#1a1a1a] border-2 border-purple-500/50 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-xl font-bold text-gray-100">Join Team</h3>
              <input
                type="text"
                value={teamCode}
                onChange={(e) => handleTeamCodeChange(e.target.value)}
                placeholder="Enter Team Code"
                className="w-full px-4 py-3 text-gray-100 bg-[#2a2a2a] border border-gray-700 rounded-lg text-center uppercase"
                maxLength={6}
              />

              {/* {fetchedTeamName && (
                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg space-y-2">
                  <p className="text-base font-semibold text-purple-300">
                    {fetchedTeamName}
                  </p>
                  <p className="text-sm text-gray-300">{fetchedTeamLeader}</p>
                </div>
              )} */}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <motion.button
                  onClick={() => {
                    setShowJoinPopup(false);
                    setError(""); // Clear error when closing
                  }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-3 bg-white text-black rounded-xl"
                >
                  Cancel
                </motion.button>

                <motion.button
                  onClick={handleJoinSubmit}
                  disabled={teamCode.length !== 6 || loading}
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-3 bg-[#9700d1] text-white rounded-xl disabled:opacity-50"
                >
                  {loading ? "Joining..." : "Join"}
                </motion.button>
              </div>
            </div>
          </div>
        )}

        {/* Create Team Modal (asks only for team name, then opens PaymentDialog) */}
        {showCreateTeamModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] border-2 border-purple-500/50 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-xl font-bold text-gray-100">Create Team</h3>
              <p className="text-sm text-gray-400">Enter a team name. No payment required right now.</p>
              <input
                type="text"
                value={creatingTeamName}
                onChange={(e) => setCreatingTeamName(e.target.value)}
                placeholder="Team Name"
                className="w-full px-4 py-3 text-gray-100 bg-[#2a2a2a] border border-gray-700 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
              />
              {error && <div className="p-2 text-sm text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2">
                <motion.button
                  onClick={() => setShowCreateTeamModal(false)}
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-3 bg-white hover:bg-[#b800ff] text-black hover:text-white  font-semibold rounded-xl shadow-lg transition-all"
                >
                  Cancel
                </motion.button>

                <motion.button
                  onClick={() => handleCreateTeamRequest(creatingTeamName)}
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-3 bg-[#9700d1] hover:bg-[#b800ff] text-white  font-semibold rounded-xl shadow-lg transition-all"
                >
                  Create
                </motion.button>
              </div>
            </div>
          </div>
        )}

        <PaymentDialog
          isOpen={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          onSubmit={handlePaymentSubmit}
          amount={1} // ₹1 for testing
          formData={{ teamName: creatingTeamName }}
          paymentSuccess={false}
        />
      </div>
    );
  }

  // If team exists → show dashboard or payment prompt when payment pending
  const paymentPending = (() => {
    const t = teamData || {};

    if (t.isPendingPayment === true ) return true;
    return false;
  })();

  if (paymentPending) {
    return (
      <div className="relative bg-gradient-to-r from-[#211E3F] to-black text-white overflow-hidden min-h-screen">
        <Header />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-purple-900/30 via-purple-950/10 to-transparent pointer-events-none"></div>

        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border-2 border-purple-500/50 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-xl font-bold text-gray-100 text-center">Team Payment Pending</h3>
            <p className="text-sm text-gray-400 text-center">Your team needs a completed payment to be activated. Complete payment below to activate your team.</p>

            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg text-center">
              <div className="text-xs text-gray-400">Team Code</div>
              <div className="text-2xl font-semibold text-purple-300">{teamData?.code || teamData?.id || 'N/A'}</div>
            </div>

            <div className="flex gap-3 pt-2">
              <motion.button
                onClick={() => setShowPaymentDialog(true)}
                whileTap={{ scale: 0.95 }}
                className="w-full py-3 bg-[#9700d1] hover:bg-[#b800ff] text-white font-semibold rounded-xl shadow-lg"
              >
                Complete Payment
              </motion.button>

              <motion.button
                onClick={() => navigate('/')}
                whileTap={{ scale: 0.95 }}
                className="w-full py-3 bg-white hover:bg-[#b800ff] text-black hover:text-white font-semibold rounded-xl shadow-lg"
              >
                Back to Home
              </motion.button>
            </div>
          </div>
        </div>

        <PaymentDialog
          isOpen={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          onSubmit={handlePaymentSubmit}
          amount={1}
          formData={{ teamName: teamData?.name }}
          paymentSuccess={false}
        />
      </div>
    );
  }

  // Default: show full team dashboard
  return (
    <TeamDetailsPage
      teamData={teamData}
      onBackToHome={handleBackToHome}
      onRemoveMember={handleRemoveMember}
      onProfileUpdate={handleProfileUpdate}
      loading={loading}
      error={error}
    />
  );
}
