import DayPage from "@/components/DayPage";
import { todayIso } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default function TodayPage() {
  return <DayPage date={todayIso()} />;
}
