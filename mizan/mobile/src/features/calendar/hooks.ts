import { useQuery } from "@tanstack/react-query";
import { getCalendar, calendarKeys } from "./api";

export const useCalendarRange = (from: string, to: string, lawyerId?: string) =>
  useQuery({
    queryKey: calendarKeys.range(from, to, lawyerId),
    queryFn: ({ signal }) => getCalendar({ from, to, lawyerId }, signal),
  });
