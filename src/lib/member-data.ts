import btc from "@/assets/coins/btc.png.asset.json";
import eth from "@/assets/coins/eth.png.asset.json";
import ltc from "@/assets/coins/ltc.png.asset.json";
import usdt from "@/assets/coins/usdt.png.asset.json";
import usdtb from "@/assets/coins/usdtb.png.asset.json";
import bnb from "@/assets/coins/bnb.png.asset.json";

/** Sample member data. Replace with real account data once the backend is linked. */
export const member = {
  name: "John Doe",
  username: "johndoe",
  email: "johndoe@example.com",
  phone: "+44 000 000 0000",
  country: "United Kingdom",
  joined: "16 September 2026",
  upline: "N/A (n/a)",
  referralLink: "https://legacyproalliance.org/?a=signup&ref=johndoe",
  wallets: {
    bitcoin: "bc1q0000000000000000000000000000000000",
    usdt: "TA000000000000000000000000000000000",
    ethereum: "0x0000000000000000000000000000000000000000",
    litecoin: "L0000000000000000000000000000000000",
  },
};

export const balances = [
  { label: "Account Balance", value: "$0.00" },
  { label: "Total Deposit", value: "$0.00" },
  { label: "Total Withdrawn", value: "$0.00" },
  { label: "Active Deposits", value: "$0.00" },
  { label: "Total Earnings", value: "$0.00" },
  { label: "Referral Bonus", value: "$0.00" },
];

export const plans = [
  { name: "Starter Plan", rate: "2.5%", range: "$35 - $3,000" },
  { name: "Regular Plan", rate: "10%", range: "$3,001 - $10,000" },
  { name: "Pro Plan", rate: "20%", range: "$10,000 - $20,000" },
  { name: "Premium Plan", rate: "35%", range: "$20,001 - Unlimited" },
];

export const paymentMethods = [
  { id: "btc", name: "Bitcoin (BTC)", icon: btc.url, address: "bc1qlegacyproalliancebtcwalletaddress00" },
  { id: "eth", name: "Ethereum (ETH)", icon: eth.url, address: "0xLegacyProAllianceEthWalletAddress0000" },
  { id: "usdt", name: "USDT (TRC20)", icon: usdt.url, address: "TLegacyProAllianceUsdtTrc20Address000" },
  { id: "usdtb", name: "USDT (BEP20)", icon: usdtb.url, address: "0xLegacyProAllianceUsdtBep20Address000" },
  { id: "ltc", name: "Litecoin (LTC)", icon: ltc.url, address: "LLegacyProAllianceLtcWalletAddress000" },
  { id: "bnb", name: "BNB (BEP20)", icon: bnb.url, address: "0xLegacyProAllianceBnbWalletAddress000" },
];

export type MemberTransaction = { type: string; amount: string; date: string; status: string };

export const transactions: MemberTransaction[] = [];
export const deposits: MemberTransaction[] = [];

export const notices = [
  "Welcome to your Legacy Pro Alliance member area.",
  "Deposits are credited after 3 network confirmations.",
  "Withdrawals are processed within 24 hours on business days.",
];
