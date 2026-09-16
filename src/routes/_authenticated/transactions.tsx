import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useState } from "react";

import { DataTable, MemberLayout, MemberPanel } from "@/components/member-chrome";
import { useTransactions } from "@/lib/account";
import { money, shortDate } from "@/lib/member-data";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [
    { title: "Transactions | MeridianVest" },
    { name: "description", content: "Filter and review every deposit, earning, bonus and withdrawal on your MeridianVest account." },
    { property: "og:title", content: "Transactions | MeridianVest" },
    { property: "og:description", content: "Filter and review your account transactions." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: TransactionsPage,
});

const types = ["All", "deposit", "earning", "referral bonus", "withdrawal"];

function TransactionsPage() {
  const { data: transactions = [] } = useTransactions();
  const [filters, setFilters] = useState({ type: "All", from: "", to: "" });

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFilters({ type: String(data.get("type")), from: String(data.get("from")), to: String(data.get("to")) });
  };

  const rows = transactions.filter((item) => {
    if (filters.type !== "All" && item.type !== filters.type) return false;
    const date = new Date(item.created_at).getTime();
    if (filters.from && date < new Date(filters.from).getTime()) return false;
    if (filters.to && date > new Date(filters.to).getTime() + 86_400_000) return false;
    return true;
  });

  return (
    <MemberLayout title="Transactions" crumb="All account activity">
      <MemberPanel title="Filter Transactions">
        <form className="member-filter" onSubmit={apply}>
          <label className="member-field"><span>Type</span>
            <select name="type" defaultValue="All">
              {types.map((type) => <option key={type} value={type}>{type === "All" ? "All transactions" : type}</option>)}
            </select>
          </label>
          <label className="member-field"><span>From</span><input type="date" name="from" /></label>
          <label className="member-field"><span>To</span><input type="date" name="to" /></label>
          <button type="submit" className="member-button">Go</button>
        </form>
      </MemberPanel>
      <MemberPanel title="History">
        <DataTable
          columns={["Type", "Amount", "Date", "Status"]}
          empty="No transactions found"
          rows={rows.map((item) => [
            <span className="member-capitalise">{item.type}</span>,
            money(Number(item.amount)),
            shortDate(item.created_at),
            <span className={`member-badge ${item.status}`}>{item.status}</span>,
          ])}
        />
      </MemberPanel>
    </MemberLayout>
  );
}
