interface NominatimPlace {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  category: string;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 405 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 200) {
    return Response.json(
      { error: "장소 이름을 2자 이상 입력해 주세요." },
      { status: 400 },
    );
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
    const response = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "apimap-distance/1.0 (OpenStreetMap Nominatim search)",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return Response.json(
        { error: "장소 검색 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." },
        { status: 502 },
      );
    }

    const places = (await response.json()) as NominatimPlace[];
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

    return Response.json(results, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return Response.json(
      { error: "장소 검색 중 오류가 발생했습니다. 네트워크를 확인해 주세요." },
      { status: 502 },
    );
  }
}
