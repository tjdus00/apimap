# 거리 한눈에

OpenStreetMap Nominatim에서 출발지와 도착지를 검색하고 두 장소 사이의 직선거리를 계산하는 웹앱입니다. 별도 데이터베이스, Redis, 환경변수 없이 Vercel에 배포할 수 있습니다.

## 실행

```bash
npm install
npm run dev
```

`npm run dev`로 화면과 장소 검색을 모두 테스트할 수 있습니다. 로컬 Vite 서버는 배포 환경과 같은 `api/search.ts` 함수를 실행하므로 Vercel CLI 로그인이나 환경변수가 필요하지 않습니다.

## 빌드

```bash
npm run build
```

## Vercel 배포

GitHub에 저장소를 만든 뒤 Vercel에서 해당 저장소를 Import하면 됩니다. 프레임워크는 Vite, 빌드 명령은 `npm run build`, 출력 디렉터리는 `dist`를 사용합니다. 환경변수를 설정할 필요가 없습니다.

장소 검색 요청은 `api/search.ts`의 Vercel 서버리스 함수가 Nominatim으로 전달합니다. 요청 간격은 브라우저에서 제한하고 응답은 Vercel CDN 캐시를 활용합니다. Nominatim 공개 서버의 이용 정책에 따라 검색은 자동완성 대신 사용자가 직접 검색 버튼을 눌렀을 때만 실행됩니다.

## 거리와 지도

표시 거리는 두 좌표 사이의 지표면 직선거리이며, 실제 도로·도보 이동거리와 다를 수 있습니다. “지도에서 보기”는 선택한 좌표를 OpenStreetMap 경로 화면으로 엽니다.
