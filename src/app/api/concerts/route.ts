import { getConcertList } from "@/lib/concerts";
import { apiData } from "@/lib/api";

export async function GET() {
  const concerts = await getConcertList();

  return apiData({
    concerts,
  });
}

