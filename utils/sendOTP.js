import twilio from "twilio";
import axios from "axios";

// ─── Choose your provider ─────────────────────────────────────────────────────
// Set PROVIDER to "twilio" | "msg91" | "console" (dev only)
const PROVIDER = process.env.NODE_ENV === "production" ? "msg91" : "console";

// ─── Twilio ───────────────────────────────────────────────────────────────────
const sendViaTwilio = async (phone, otp) => {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN,
  );

  await client.messages.create({
    body: `Your Adda Cafe OTP is ${otp}. Valid for 5 minutes. Do not share it with anyone.`,
    from: process.env.TWILIO_PHONE,
    to: `+91${phone}`,
  });

  console.log(`✅ Twilio OTP sent to +91${phone}`);
};

// ─── MSG91 (popular in India, cheaper than Twilio) ────────────────────────────
const sendViaMSG91 = async (phone, otp) => {
  const payload = {
    flow_id: process.env.MSG91_TEMPLATE_ID,
    sender: process.env.MSG91_SENDER_ID,
    mobiles: `91${phone}`,
    otp,
  };

  const { data } = await axios.post(
    "https://control.msg91.com/api/v5/flow/",
    payload,
    {
      headers: {
        authkey: process.env.MSG91_AUTH_KEY,
        "content-type": "application/json",
      },
    },
  );

  if (data.type !== "success")
    throw new Error("MSG91 failed: " + JSON.stringify(data));
  console.log(`✅ MSG91 OTP sent to 91${phone}`);
};

// ─── Console (development fallback) ───────────────────────────────────────────
const sendViaConsole = async (phone, otp) => {
  console.log("─────────────────────────────────────");
  console.log(`📱 DEV MODE — OTP for ${phone}: ${otp}`);
  console.log("─────────────────────────────────────");
};

// ─── Main export ──────────────────────────────────────────────────────────────
const sendOTP = async (phone, otp) => {
  try {
    if (PROVIDER === "twilio") return await sendViaTwilio(phone, otp);
    if (PROVIDER === "msg91") return await sendViaMSG91(phone, otp);
    return await sendViaConsole(phone, otp); // default: dev
  } catch (err) {
    console.error(`❌ OTP send failed [${PROVIDER}]:`, err.message);
    throw new Error("Failed to send OTP. Please try again.");
  }
};

export default sendOTP;
