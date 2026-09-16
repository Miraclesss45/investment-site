import btc from "@/assets/coins/btc.png.asset.json";
import eth from "@/assets/coins/eth.png.asset.json";
import ltc from "@/assets/coins/ltc.png.asset.json";
import usdt from "@/assets/coins/usdt.png.asset.json";
import usdtb from "@/assets/coins/usdtb.png.asset.json";
import bnb from "@/assets/coins/bnb.png.asset.json";

export const plans = [
  { name: "Starter Plan", rate: 2.5, range: "$35 - $3,000", min: 35, max: 3000 },
  { name: "Regular Plan", rate: 10, range: "$3,001 - $10,000", min: 3001, max: 10000 },
  { name: "Pro Plan", rate: 20, range: "$10,000 - $20,000", min: 10000, max: 20000 },
  { name: "Premium Plan", rate: 35, range: "$20,001 - Unlimited", min: 20001, max: 1000000 },
] as const;

export const paymentMethods = [
  { id: "btc", name: "Bitcoin (BTC)", icon: btc.url, address: "bc1qlegacyproalliancebtcwalletaddress00" },
  { id: "eth", name: "Ethereum (ETH)", icon: eth.url, address: "0xLegacyProAllianceEthWalletAddress0000" },
  { id: "usdt", name: "USDT (TRC20)", icon: usdt.url, address: "TLegacyProAllianceUsdtTrc20Address000" },
  { id: "usdtb", name: "USDT (BEP20)", icon: usdtb.url, address: "0xLegacyProAllianceUsdtBep20Address000" },
  { id: "ltc", name: "Litecoin (LTC)", icon: ltc.url, address: "LLegacyProAllianceLtcWalletAddress000" },
  { id: "bnb", name: "BNB (BEP20)", icon: bnb.url, address: "0xLegacyProAllianceBnbWalletAddress000" },
];

export const notices = [
  "Welcome to your Legacy Pro Alliance member area.",
  "Deposits are credited after 3 network confirmations.",
  "Withdrawals are processed within 24 hours on business days.",
];

export function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
