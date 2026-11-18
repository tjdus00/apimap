import { useRef, useState } from "react";

interface Place {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  type: string;
  category: string;
}

function isPlace(value: unknown): value is Place {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const place = value as Record<string, unknown>;
  return (
    typeof place.id === "number" &&
    typeof place.name === "string" &&
    typeof place.latitude === "number" &&
    place.latitude >= -90 &&
    place.latitude <= 90 &&
    typeof place.longitude === "number" &&
    place.longitude >= -180 &&
    place.longitude <= 180 &&
    typeof place.type === "string" &&
    typeof place.category === "string"
  );
}

let searchQueue = Promise.resolve();
let lastSearchAt = 0;

function waitForSearchSlot() {
  const nextSearch = searchQueue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastSearchAt));
    if (wait > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, wait));
    }
    lastSearchAt = Date.now();
  });
  searchQueue = nextSearch;
  return nextSearch;
}

function LocationPicker({
  title,
  number,
  color,
  place,
  onSelect,
}: {
  title: string;
  number: string;
  color: "green" | "coral";
  place: Place | null;
  onSelect: (place: Place | null) => void;
}) {
  const [query, setQuery] = useState(place?.name ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const activeSearch = useRef(0);

  async function searchPlaces(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const searchTerm = query.trim();
    if (searchTerm.length < 2) {
      setError("장소 이름을 2자 이상 입력해 주세요.");
      return;
    }

    const searchId = ++activeSearch.current;
    setLoading(true);
    setError("");
    setResults([]);
    try {
      await waitForSearchSlot();
      if (searchId !== activeSearch.current) {
        return;
      }
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`);
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new Error(
          "검색 서버에서 올바른 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
      if (searchId !== activeSearch.current) {
        return;
      }
      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "검색에 실패했습니다. 다시 시도해 주세요.";
        throw new Error(message);
      }
      if (!Array.isArray(data)) {
        throw new Error("검색 결과를 불러오지 못했습니다. 다시 시도해 주세요.");
      }
      const places = data.filter(isPlace);
      setResults(places);
      if (places.length === 0) {
        setError("검색 결과가 없습니다. 다른 이름으로 찾아보세요.");
      }
    } catch (searchError) {
      if (searchId !== activeSearch.current) {
        return;
      }
      setError(
        searchError instanceof Error
          ? searchError.message
          : "검색 중 오류가 발생했습니다. 다시 시도해 주세요.",
      );
    } finally {
      if (searchId === activeSearch.current) {
        setLoading(false);
      }
    }
  }

  function updateQuery(value: string) {
    activeSearch.current++;
    setQuery(value);
    setResults([]);
    setError("");
    setLoading(false);
    onSelect(null);
  }

  return (
    <section className="location-card">
      <div className={`location-marker ${color}`} aria-hidden="true">
        {number}
      </div>
      <div className="location-content">
        <label className="field-label" htmlFor={`place-${number}`}>
          {title}
        </label>
        <form className="search-form" onSubmit={searchPlaces}>
          <input
            id={`place-${number}`}
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="장소, 주소 또는 랜드마크"
            autoComplete="off"
          />
          <button type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : "검색"}
          </button>
        </form>
        {error && <p className="search-message">{error}</p>}
        {results.length > 0 && (
          <ul className="results-list" aria-label={`${title} 검색 결과`}>
            {results.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  className="result-option"
                  onClick={() => {
                    setQuery(result.name);
                    setResults([]);
                    setError("");
                    onSelect(result);
                  }}
                >
                  <span className="result-pin" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path
                        d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  </span>
                  <span className="result-name">{result.name}</span>
                  <span className="result-arrow" aria-hidden="true">↗</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {place && (
          <p className="selected-message">
            <span aria-hidden="true">✓</span> 장소가 선택되었습니다
          </p>
        )}
      </div>
    </section>
  );
}

function getDistanceInMeters(start: Place, end: Place) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(end.latitude - start.latitude);
  const longitudeDelta = radians(end.longitude - start.longitude);
  const startLatitude = radians(start.latitude);
  const endLatitude = radians(end.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters).toLocaleString("ko-KR")} m`;
  }
  return `${(meters / 1000).toLocaleString("ko-KR", {
    maximumFractionDigits: 1,
  })} km`;
}

function App() {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const distance =
    origin && destination ? getDistanceInMeters(origin, destination) : null;
  const mapUrl =
    origin && destination
      ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${origin.latitude}%2C${origin.longitude}%3B${destination.latitude}%2C${destination.longitude}`
      : null;

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="거리 한눈에 홈">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 36 36" fill="none">
              <path d="M8 27.5 15 8l7 19.5L28 8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8" cy="27.5" r="3.2" fill="#F18A70" stroke="white" strokeWidth="1.6" />
              <circle cx="28" cy="8" r="3.2" fill="#6BAE91" stroke="white" strokeWidth="1.6" />
            </svg>
          </span>
          <span>거리 한눈에</span>
        </a>
        <span className="topbar-note">
          <span className="status-dot" /> OpenStreetMap 기반
        </span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">PLACE TO PLACE</span>
          <h1>
            두 장소 사이,
            <br />
            <span>얼마나 멀까요?</span>
          </h1>
          <p>출발지와 도착지를 검색하고, 두 장소 사이의 거리를 확인해 보세요.</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <svg className="art-route" viewBox="0 0 260 195" fill="none">
            <path d="M48 143c38-2 37-77 79-74 36 2 20 53 60 50 12-1 20-8 28-17" stroke="#738A78" strokeWidth="2" strokeDasharray="5 6" />
            <circle cx="48" cy="143" r="10" fill="#F18A70" stroke="white" strokeWidth="5" />
            <circle cx="215" cy="102" r="10" fill="#6BAE91" stroke="white" strokeWidth="5" />
            <path d="M131 51v-8m0 16v-3m-7-6h14" stroke="#879287" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div className="art-label label-start">출발</div>
          <div className="art-label label-end">도착</div>
          <div className="art-leaf leaf-one" />
          <div className="art-leaf leaf-two" />
        </div>
      </section>

      <section className="calculator" aria-label="거리 계산">
        <div className="calculator-heading">
          <div>
            <span className="section-kicker">DISTANCE FINDER</span>
            <h2>어디에서 어디까지 갈까요?</h2>
          </div>
          <span className="free-badge">무료 · 회원가입 없이</span>
        </div>

        <div className="location-stack">
          <LocationPicker
            title="출발지"
            number="A"
            color="green"
            place={origin}
            onSelect={setOrigin}
          />
          <div className="connector" aria-hidden="true">
            <span />
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M7 9.5h10M13 5.5l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M17 14.5H7m4 4-4-4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span />
          </div>
          <LocationPicker
            title="도착지"
            number="B"
            color="coral"
            place={destination}
            onSelect={setDestination}
          />
        </div>

        <div className={`distance-result ${distance === null ? "is-empty" : ""}`}>
          {distance === null ? (
            <div className="empty-result">
              <div className="empty-icon" aria-hidden="true">
                <svg viewBox="0 0 40 40" fill="none">
                  <path d="M8 29 15 11l7 18 7-18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="8" cy="29" r="3" fill="white" stroke="currentColor" strokeWidth="2" />
                  <circle cx="29" cy="11" r="3" fill="white" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <span>출발지와 도착지를 선택하면<br className="mobile-break" /> 거리를 알려드릴게요.</span>
            </div>
          ) : (
            <div className="result-content" aria-live="polite">
              <div className="result-copy">
                <span className="section-kicker">두 장소 사이의 직선거리</span>
                <strong>{formatDistance(distance)}</strong>
                <span className="distance-caption">지구 표면을 기준으로 계산했어요</span>
              </div>
              <span className="distance-decoration" aria-hidden="true">
                <svg viewBox="0 0 120 48" fill="none">
                  <path d="M9 34c24-1 24-22 47-22s20 24 43 23" stroke="currentColor" strokeWidth="2" strokeDasharray="4 5" />
                  <circle cx="9" cy="34" r="5" fill="#F18A70" />
                  <circle cx="99" cy="35" r="5" fill="#6BAE91" />
                </svg>
              </span>
            </div>
          )}
        </div>

        {mapUrl && (
          <a className="map-link" href={mapUrl} target="_blank" rel="noreferrer">
            <span className="map-link-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            </span>
            지도에서 보기
            <span className="external-arrow" aria-hidden="true">↗</span>
          </a>
        )}
      </section>

      <footer className="page-footer">
        <p>장소 검색은 OpenStreetMap Nominatim을 사용합니다.</p>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap 기여자
        </a>
        <span className="footer-divider">·</span>
        <span>거리는 직선 기준이며 실제 이동 경로와 다를 수 있어요.</span>
      </footer>
    </main>
  );
}

export default App;
