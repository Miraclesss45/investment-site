import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useState } from "react";

import { EmptyTable, MemberLayout, MemberPanel } from "@/components/member-chrome";

export const Route = createFileRoute("/transactions")({
  head: () => ({ meta: [
    { title: "Transactions | Legacy Pro Alliance" },
    { name: "description", content: "Filter and review every deposit, earning, bonus and withdrawal on your Legacy Pro Alliance account." },
    { property: "og:title", content: "Transactions | Legacy Pro Alliance" },
    { property: "og:description", content: "Filter and review your account transactions." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const [note, setNote] = useState("");
  const filter = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setNote("No transactions match this filter."); };
  return (
    <MemberLayout title="Transactions" crumb="All account activity">
      <MemberPanel title="Filter Transactions">
        <form className="member-filter" onSubmit={filter}>
          <label className="member-field"><span>Type</span>
            <select name="type" defaultValue="All">
              {["All", "Deposit", "Earning", "Referral Bonus", "Withdrawal"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="member-field"><span>From</span><input type="date" name="from" /></label>
          <label className="member-field"><span>To</span><input type="date" name="to" /></label>
          <button type="submit" className="member-button">Go</button>
        </form>
        {note && <p className="member-status" role="status">{note}</p>}
      </MemberPanel>
      <MemberPanel title="History">
        <EmptyTable columns={["Type", "Amount", "Date", "Status"]} message="No transactions found" />
      </MemberPanel>
    </MemberLayout>
  );
}
