import type { Metadata } from "next";
import QueueDisplayClient from "./queue-display-client";

export const metadata: Metadata = {
  title: "Voter queue display | PhALGA",
  description: "Live queue numbers for verified voters",
};

export default function QueueDisplayPage() {
  return <QueueDisplayClient />;
}
