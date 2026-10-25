import { redirect } from "next/navigation";
import DayPage from "@/components/DayPage";
import { isIsoDate, todayIso } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function DayRoute({ params }: PageProps<"/day/[date]">) {
  const { date } = await params;
  if (!isIsoDate(date)) redirect("/");
  if (date === todayIso()) redirect("/");
  return <DayPage date={date} />;
}
