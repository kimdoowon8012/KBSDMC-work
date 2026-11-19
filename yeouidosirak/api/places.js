// 흑석도시락 — 잇플(eat.pl) 맛집 데이터 중계 함수 (Vercel Serverless)
// k-skill bccard-eatpl-search 스킬의 공개 프록시를 흑석동 도로명별로 호출해
// 합치고, 중앙대 / 흑석역·현충로 / 서달로·한강 으로 나눠 화면에 필요한 값만 돌려준다.

import proj4 from 'proj4';

const PROXY = process.env.KSKILL_PROXY_BASE_URL || 'https://k-skill-proxy.nomadamas.org';

// 잇플 좌표(TM128/KATEC) → 지도용 위경도(WGS84)
const KATEC = '+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43 +no_defs';
function toLatLng(x, y) {
  const X = Number(x), Y = Number(y);
  if (!Number.isFinite(X) || !Number.isFinite(Y) || X === 0 || Y === 0) return [null, null];
  const [lng, lat] = proj4(KATEC, 'EPSG:4326', [X, Y]);
  return [Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6];
}

// 프록시는 주소 텍스트 부분일치 + 매출 상위 최대 100건이라, 도로를 나눠 여러 번 묻는다.
const AREA = '서울 동작구 ';
const DONG = /흑석동/;
const ROADS = [
  '흑석동', '흑석로', '서달로', '현충로', '흑석한강로',
  '흑석로6길', '흑석로9길', '흑석로13길', '서달로12길', '서달로14길', '서달로14나길', '서달로15길'
];

// 흑석동을 세 구역으로 나눈다. 좌표는 데이터의 TM128 값.
//  - cau: 중앙대 캠퍼스·정문 앞 (서쪽)
//  - station: 흑석역·현충로 (동쪽 북편)
//  - hill: 서달로·한강 쪽 (동쪽 남편)
function regionOf(item) {
  const x = Number(item.xaxsVal);
  const y = Number(item.yaxsVal);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0 || y === 0) return 'station';
  if (x < 308336) return 'cau';
  return y >= 545575 ? 'station' : 'hill';
}

function kindOf(cat) {
  if (/카페|베이커리|디저트|아이스크림|도넛|빙수|제과|커피|차$/.test(cat)) return 'cafe';
  if (/주점|호프|이자카야|와인|바\(bar\)|^바$|포차|맥주|칵테일/.test(cat)) return 'bar';
  return 'meal';
}

// 업종으로 짐작한 1인 가격대 (데이터에 가격이 없어서 '추정'이다)
//  1: 1만원 이하 / 2: 1~2만원 / 3: 2만원 이상
const PRICE_1 = /분식|김밥|떡볶이|샌드위치|토스트|도시락|죽|국수|면|만두|버거|푸드코트|전\/부침개/;
const PRICE_3 = /고기|구이|곱창|족발|보쌈|횟집|회|스시|초밥|해산물|뷔페|양꼬치|이자카야|호프|주점|기타일식|와인/;
function priceOf(cat, kind) {
  if (kind === 'cafe') return 1;
  if (kind === 'bar') return 3;
  if (PRICE_3.test(cat)) return 3;
  if (PRICE_1.test(cat)) return 1;
  return 2;
}

// 위탁급식·구내식당 운영사 (일반 손님이 이용하기 어려운 곳이 많아 목록에서 뺀다)
const CATERER = /현대그린푸드|그린푸드|아워홈|웰스토리|프레시웨이|신세계푸드|풀무원푸드앤컬처|동원홈푸드|한화푸드테크|푸드테크|사업본부|구내식당|직원식당|사내식당|단체급식/;
// 법인 접미사
const CORP_TAIL = /(코퍼레이션|코퍼레이|홀딩스|컴퍼니|코리아|에프앤비|F&B|에프엔비|푸즈서비스|푸즈|푸드|산업|상사|유통|인터내셔널|글로벌)$/i;
const FOOD_WORD = /커피|카페|베이커리|빵|치킨|피자|김밥|국밥|분식|떡볶이|스시|초밥|고기|갈비|면|탕|순대|버거|샐러드|다이닝|키친|식당|반점|횟집|포차|호프|주점|비어|와인|라멘|돈까스|돈가스|쌀국수|찌개|곰탕|설렁탕|냉면|족발|보쌈|만두|우동|소바|타코|커리|카레|도시락|죽|토스트|샌드위치|베이글|도넛|디저트|아이스크림|빙수|티|차/;

// 결제 가맹점명 → 사람이 아는 가게 이름. 알아볼 수 없는 법인명만 남으면 null.
function cleanName(raw) {
  let n = (raw || '')
    .replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|\(사\)|\(재\)|사단법인|재단법인/g, ' ')
    .replace(/\s+/g, ' ').trim();
  // "브랜드/ 운영법인" → 브랜드
  if (n.includes('/')) n = n.split('/')[0].trim() || n.replace('/', ' ').trim();
  // 법인명이 매장명 앞에 붙어 있는 경우: "씨앤코컴퍼니카페블루포트…" → "카페블루포트…"
  n = n.replace(/^\S+?(코퍼레이션|컴퍼니|홀딩스)(?=\S)/, '');
  let parts = n.split(' ').filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 1) {
    const t = parts[0].replace(/(\S)코리아(?=\S*점$)/, '$1 ');
    if (t.includes(' ')) return t;
    if (!CORP_TAIL.test(t)) return t;
    const stem = t.replace(CORP_TAIL, '');
    return FOOD_WORD.test(stem) && stem.length >= 2 ? stem : null;
  }
  // 맨 앞 토큰이 법인명: "커피빈코리아 ○○점" → "커피빈 ○○점", "재욱다이닝컴퍼니 호앙비엣" → "호앙비엣"
  if (CORP_TAIL.test(parts[0])) {
    const stem = parts[0].replace(CORP_TAIL, '');
    if (/코리아$/.test(parts[0]) && stem.length >= 2) parts[0] = stem;
    else parts = parts.slice(1);
  }
  // 맨 뒤 토큰이 법인 표기: "단디만 육당당 F&B" → "단디만 육당당"
  if (parts.length > 1 && (/^(F&B|에프앤비|에프엔비)$/i.test(parts[parts.length - 1]) || (CORP_TAIL.test(parts[parts.length - 1]) && !FOOD_WORD.test(parts[parts.length - 1].replace(CORP_TAIL, ''))))) {
    parts = parts.slice(0, -1);
  }
  n = parts.join(' ').replace(/(\S)코리아(?=\S*점$)/, '$1 ').replace(/\s+/g, ' ').trim();
  return n || null;
}

// 한 달 동안의 첫·마지막 결제 시각이라 실제 영업시간과 어긋날 수 있다. 가장 가까운 30분 단위로 다듬는다.
// (10:15 → 10:30, 09:52 → 10:00, 20:08 → 20:00)
function roundHalfHour(v) {
  if (!v || !/^\d{4}$/.test(v)) return null;
  let m = Number(v.slice(0, 2)) * 60 + Number(v.slice(2));
  m = Math.floor((m + 15) / 30) * 30;
  m %= 24 * 60;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

function normalize(i, name) {
  const start = i.srtTime && /^\d{4}$/.test(i.srtTime) ? Number(i.srtTime) : null;
  const end = i.endTime && /^\d{4}$/.test(i.endTime) ? Number(i.endTime) : null;
  const overnight = start !== null && end !== null && end < start;
  const s = roundHalfHour(i.srtTime);
  const e = roundHalfHour(i.endTime);
  const cat = i.merTpbuzNm || '';
  const [lat, lng] = toLatLng(i.xaxsVal, i.yaxsVal);
  const customers = i.vistCstmrRnkList ? Object.keys(i.vistCstmrRnkList).sort().map((k) => i.vistCstmrRnkList[k]).filter(Boolean) : [];
  return {
    id: i.merUrl.split('/').pop(),
    name,
    addr: (i.merAddr || '').replace(/^서울 동작구 /, ''),
    cat,
    kind: kindOf(cat),
    price: priceOf(cat, kindOf(cat)),
    region: regionOf(i),
    lat,
    lng,
    nat: i.allSaleRnk,
    loc: i.ccgSaleRnk,
    url: i.merUrl,
    hours: s && e ? `${s} – ${overnight || e === '0:00' ? '익일 ' : ''}${e}` : null,
    lunch: start !== null && start <= 1130 && (overnight || (end !== null && end >= 1330)),
    late: overnight || (end !== null && end >= 2200),
    team: !!i.empyVsitYn,
    foreign: !!i.frnrVsitYn,
    local: !!i.loclPrsnPpltYn,
    busyDay: i.congestionDwk || null,
    busyTime: i.congestionTizn || null,
    customers
  };
}

async function fetchRoad(road) {
  const url = `${PROXY}/v1/bccard-eatpl/search?location=${encodeURIComponent(AREA + road)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j.items) ? j.items : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

let memo = null; // 같은 인스턴스가 살아 있는 동안 재사용
const MEMO_MS = 60 * 60 * 1000;

export async function loadPlaces() {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.data;
  const lists = await Promise.all(ROADS.map(fetchRoad));
  const byId = new Map();
  for (const items of lists) {
    for (const i of items) {
      if (!i || typeof i.merUrl !== 'string' || !i.merUrl.startsWith('https://web.paybooc.ai/')) continue;
      if (!DONG.test(i.merAddr || '')) continue;
      if (/소매|편의점|마트|슈퍼|주류판매|반찬|매점/.test(i.merTpbuzNm || '')) continue;
      if (CATERER.test(i.merNm || '')) continue;
      const name = cleanName(i.merNm);
      if (!name) continue;
      const p = normalize(i, name);
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
  }
  const data = [...byId.values()].sort((a, b) => (a.loc ?? 999) - (b.loc ?? 999) || (a.nat ?? 999) - (b.nat ?? 999));
  if (data.length) memo = { at: Date.now(), data };
  return data;
}

export default async function handler(req, res) {
  try {
    const places = await loadPlaces();
    if (!places.length) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({ places: [], message: '지금은 맛집 정보를 불러오지 못했어요.' });
    }
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({
      updatedAt: new Date().toISOString(),
      attribution: 'eat.pl 잇플 · BC카드 결제 데이터 기반',
      places
    });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ places: [], message: '지금은 맛집 정보를 불러오지 못했어요.' });
  }
}
export { priceOf, cleanName, roundHalfHour, CATERER };
