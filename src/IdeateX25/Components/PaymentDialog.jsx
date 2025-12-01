import { X, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";

// Razorpay payment dialog - creates order on backend and opens Razorpay checkout
export default function PaymentDialog({ isOpen, onClose, onSubmit, formData, paymentSuccess, amount = 100 }) {
  const [teamName, setTeamName] = useState(formData?.teamName || "");
  // screenshot removed per request
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  const API_BASE = import.meta.env.VITE_IDEATEX_API_BASE_URL;

  useEffect(() => {
    if (isOpen) {
      setTeamName(formData?.teamName || "");
      setError("");
    }
  }, [isOpen, formData]);

  // removed file handling

  // Load Razorpay script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (document.getElementById("razorpay-script")) return resolve(true);
      const script = document.createElement("script");
      script.id = "razorpay-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const createOrder = async (amountToUse = amount * 100) => {
    // amountToUse in paise. default uses `amount` prop (in rupees) * 100.
    const teamId = localStorage.getItem("ideatex_teamID") || null;
    if (!teamId) {
      // If backend requires teamId we should surface this clearly to the user
      throw new Error("teamId_missing");
    }
    const url = `${API_BASE}/api/v1/payment/create-order`;
    const payload = { teamId, amount: amountToUse };
    const res = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("ideatex_token")}`,
      },
    });
    return res.data;
  };

  const verifyPayment = async (verifyPayload) => {
    const url = `${API_BASE}/api/v1/payment/verify-payment`;
    const res = await axios.post(url, verifyPayload, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("ideatex_token")}`,
      },
    });
    return res.data;
  };

  const handlePayWithRazorpay = async () => {
    if (!teamName) {
      setError("Please provide a team name before proceeding.");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const ok = await loadRazorpayScript();
      if (!ok) {
        setError("Failed to load payment gateway. Try again later.");
        setIsProcessing(false);
        return;
      }

      const orderResp = await createOrder();
      if (!orderResp.success || !orderResp.data) {
        setError(orderResp.message || "Failed to create payment order");
        setIsProcessing(false);
        return;
      }

      const data = orderResp.data; // { orderId, razorpayOrderId, amount, currency, key }

      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency || "INR",
        name: "IdeateX 2025",
        description: `Team registration - ${teamName}`,
        order_id: data.razorpayOrderId,
        handler: async function (response) {
          // response: { razorpay_payment_id, razorpay_order_id, razorpay_signature }
          try {
            const verifyPayload = {
              orderId: data.orderId || data.razorpayOrderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            };

            const verifyResp = await verifyPayment(verifyPayload);
            if (verifyResp.success) {
              // Call parent onSubmit so the app can save team and redirect
              await onSubmit({
                transactionId: response.razorpay_payment_id,
                teamName,
                paymentVerified: true,
                backendResponse: verifyResp,
              });
              setIsProcessing(false);
              // leave dialog open while parent handles navigation or close here
            } else {
              setError(verifyResp.message || "Payment verification failed");
              setIsProcessing(false);
            }
          } catch (err) {
            console.error("Verify error", err);
            setError(err.response?.data?.message || "Payment verification failed");
            setIsProcessing(false);
          }
        },
        prefill: {
          name: formData?.name || "",
          email: formData?.email || "",
          contact: formData?.contact || "",
        },
        theme: { color: "#9700d1" },
      };

      // eslint-disable-next-line no-undef
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      if (err.message === "teamId_missing") {
        setError("teamId and amount are required — please create or select a team before paying.");
      } else if (err.response?.data?.message) {
        // Map backend error messages
        setError(err.response.data.message || "Payment failed to start. Try again.");
      } else {
        setError("Payment failed to start. Try again.");
      }
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative sm:max-w-lg w-full bg-[#1a1a1a] border border-gray-800 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-2xl text-gray-100 font-semibold">Complete Payment</h2>
          <button type="button" onClick={onClose} className="text-gray-400">
            <X className="h-6 w-6" />
          </button>
        </div>

        {paymentSuccess && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mt-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-green-400 font-medium">Payment successful!</span>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm text-gray-400">Team Name</label>
            <input
              value={teamName}
              disabled
              onChange={(e) => setTeamName(e.target.value)}
              className="block w-full px-4 py-3.5 mt-2 bg-[#2a2a2a] border border-gray-700 rounded-xl text-gray-100"
              placeholder="Team name"
            />
          </div>

          {/* Screenshot removed per request */}

          {error && <div className="text-sm text-red-400">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handlePayWithRazorpay}
              disabled={isProcessing}
              className="w-full py-3 bg-[#9700d1] hover:bg-[#b800ff] text-white font-semibold rounded-full"
            >
              {isProcessing ? "Processing..." : "Pay with Razorpay"}
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
              }}
              className="w-full py-3 bg-gray-700 text-white rounded-full"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
