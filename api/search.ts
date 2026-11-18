import type { IncomingMessage, ServerResponse } from "node:http";

interface NominatimPlace {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  category: string;
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  for (const [name, value] of Object.entries(headers)) {
    response.setHeader(name, value);
  }
  response.end(JSON.stringify(body));
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "지원하지 않는 요청입니다." });
    return;
  }

  const requestUrl = new URL(request.url ?? "/", "http://localhost");
  const query = requestUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 200) {
    sendJson(response, 400, { error: "장소 이름을 2자 이상 입력해 주세요." });
    return;
  }

  const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
  nominatimUrl.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "5",
    addressdetails: "1",
    "accept-language": "ko,en",
  }).toString();

  try {
    const nominatimResponse = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "apimap-distance/1.0 (OpenStreetMap Nominatim search)",
        Accept: "application/json",
      },
    });

    if (!nominatimResponse.ok) {
      sendJson(
        response,
        502,
        { error: "장소 검색 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      );
      return;
    }

    const places = (await nominatimResponse.json()) as NominatimPlace[];
    const results = places
      .map((place) => ({
        id: place.place_id,
        name: place.display_name,
        latitude: Number(place.lat),
        longitude: Number(place.lon),
        type: place.type,
        category: place.category,
      }))
      .filter(
        (place) =>
          Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
      );

    sendJson(response, 200, results, {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    });
  } catch {
    sendJson(
      response,
      502,
      { error: "장소 검색 중 오류가 발생했습니다. 네트워크를 확인해 주세요." },
    );
  }
}
