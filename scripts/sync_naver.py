#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""12V STORY - 네이버 블로그 -> 홈페이지 작업갤러리 무료 자동연동.

외부 AI/API 키 없이 공개 RSS와 공개 포스팅 HTML만 사용합니다.
최근 RSS 항목을 읽고 기존 naver-works.json과 병합하기 때문에
RSS에서 오래된 글이 빠져도 이미 수집된 작업은 홈페이지에 남습니다.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
DATA_JSON = ASSETS / "naver-works.json"
DATA_JS = ASSETS / "works-data.js"

BLOG_ID = "uh2816"
RSS_URL = f"https://rss.blog.naver.com/{BLOG_ID}.xml"
MAX_IMAGES_PER_POST = 6
MAX_HISTORY = 300
SEOUL = ZoneInfo("Asia/Seoul")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": f"https://blog.naver.com/{BLOG_ID}",
}

CATEGORY_RULES = [
    ("옵틱글래스", ["옵틱글래스", "옵틱 글래스", "광각미러", "광각 미러", "디밍", "미러글래스"]),
    ("사이드미러", ["사이드미러", "사이드 미러", "폴딩", "리피터", "미러 수리"]),
    ("블랙박스", ["블랙박스", "파인뷰", "아이나비", "qxd", "lxq", "lx9"]),
    ("후방카메라", ["후방카메라", "후방 카메라", "리어카메라", "리어 카메라"]),
    ("올인원·카플레이", ["안드로이드 올인원", "안드로이드올인원", "카플레이", "안드로이드오토", "안드로이드 오토", "올인원"]),
    ("순정옵션", ["순정옵션", "순정 옵션", "옵션 시공", "오토라이트", "sbr"]),
    ("전장수리", ["비상등", "스위치", "인터페이스", "모니터 화면", "화면불량", "모듈 수리"]),
]

KNOWN_CARS = [
    "로체이노베이션", "아반떼HD 하이브리드", "아반테XD스포츠", "테슬라 사이버트럭",
    "그랜드 스타렉스", "제네시스 G80", "제네시스 DH", "제네시스 BH", "니로 하이브리드",
    "로체 이노베이션", "더뉴쏘렌토", "미니쿠퍼 R56", "벤츠 GLC350e", "BMW 320d e90",
    "도요타 FJ크루져", "폴스타4", "볼트EV", "넥스트 스파크", "그랜저HG", "YF쏘나타",
    "DN8쏘나타", "DN8 소나타", "BMW 118", "벤츠 GLC300", "카마로", "팰리세이드",
    "스타리아", "스팅어", "모하비", "GV80", "G80", "G70", "K9", "K5", "니로",
    "포르테", "CLA", "폭스바겐", "폴스타 4", "볼트 EV",
]

POINTS = {
    "옵틱글래스": ["차종과 순정 미러 사양 확인", "기존 미러 탈거 후 차종 전용 제품 장착", "장착 후 좌우 시야와 관련 기능 최종 확인"],
    "사이드미러": ["폴딩 불량 증상과 작동 상태 확인", "내부 모터·기어 등 원인 부품 점검 및 부분수리", "조립 후 접힘·펼침 동작 반복 확인"],
    "블랙박스": ["차량 전원 특성과 장착 위치 확인", "배선 노출을 줄여 순정 느낌으로 정리", "전·후방 영상과 주차녹화 동작 확인"],
    "후방카메라": ["기존 영상불량 원인과 모니터 입력 확인", "순정 위치를 활용해 카메라 교체 및 배선 정리", "후진 연동과 실제 화면 화질 최종 확인"],
    "올인원·카플레이": ["차종별 순정 오디오·모니터 구성 확인", "마감재와 인터페이스를 맞춰 기능 연동", "카플레이·안드로이드오토 및 순정 기능 확인"],
    "순정옵션": ["차량 연식과 옵션 사양 확인", "순정 방식에 맞춰 부품·배선 작업", "시공 후 기능 작동과 오류 여부 확인"],
    "전장수리": ["불량 증상 재현 후 원인 구간 확인", "필요 부품 또는 회로를 부분수리", "조립 후 기능을 반복 테스트해 마무리"],
    "기타작업": ["차종과 요청 작업 사전 확인", "차량 상태에 맞춰 작업 진행", "완료 후 관련 기능을 최종 확인"],
}

ACTION_WORDS = [
    "사이드미러", "사이드 미러", "옵틱글래스", "옵틱 글래스", "광각미러", "블랙박스",
    "후방카메라", "후방 카메라", "안드로이드", "카플레이", "순정옵션", "비상등", "스위치",
    "인터페이스", "전조등", "led", "수리", "교체", "장착", "시공",
]

session = requests.Session()
session.headers.update(HEADERS)


def get(url: str, *, timeout: int = 20, tries: int = 3) -> requests.Response:
    last = None
    for n in range(tries):
        try:
            r = session.get(url, timeout=timeout, allow_redirects=True)
            r.raise_for_status()
            return r
        except Exception as exc:  # pragma: no cover - network dependent
            last = exc
            if n + 1 < tries:
                time.sleep(1.2 * (n + 1))
    raise RuntimeError(f"요청 실패: {url} ({last})")


def clean_text(value: str) -> str:
    if not value:
        return ""
    value = html.unescape(value)
    value = BeautifulSoup(value, "html.parser").get_text(" ", strip=True)
    value = value.replace("\u200b", " ").replace("\ufeff", " ")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def clip(value: str, limit: int) -> str:
    value = clean_text(value)
    if len(value) <= limit:
        return value
    cut = value[: limit + 1]
    for mark in [". ", "! ", "? ", "다. ", "요. "]:
        pos = cut.rfind(mark)
        if pos >= int(limit * 0.55):
            return cut[: pos + len(mark.strip())].strip()
    return cut[:limit].rstrip() + "…"


def meaningful_text(raw: str, title: str) -> str:
    text = clean_text(raw)
    if not text:
        return ""
    text = text.replace(clean_text(title), " ")
    # 흔한 인사말은 홈페이지의 짧은 설명에서는 생략
    text = re.sub(r"^(안녕하세요[.! ]*)?(일산[^.]{0,35})?(12볼트스토리|12V STORY)[^.!?]{0,45}[.!?]?\s*", "", text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_image_url(url: str) -> str:
    if not url:
        return ""
    url = html.unescape(url).strip()
    if url.startswith("//"):
        url = "https:" + url
    if not url.startswith(("http://", "https://")):
        return ""
    p = urlparse(url)
    # 저화질 blur 파라미터는 제거. 원본 CDN 경로는 유지한다.
    query = p.query
    if "type=w80_blur" in query or "type=w1" in query:
        query = ""
    return urlunparse((p.scheme, p.netloc, p.path, p.params, query, ""))


def is_content_image(url: str) -> bool:
    u = url.lower()
    if not u:
        return False
    if not any(h in u for h in ["pstatic.net", "naver.net", "naver.com"]):
        return False
    blocked = ["profile", "blogpf", "sticker", "emoticon", "icon", "favicon", "banner", "map", "logo"]
    if any(x in u for x in blocked):
        return False
    if u.endswith(".svg"):
        return False
    return True


def extract_images_from_html(raw_html: str) -> list[str]:
    soup = BeautifulSoup(raw_html or "", "html.parser")
    urls: list[str] = []
    for img in soup.find_all("img"):
        for attr in ("data-lazy-src", "data-src", "src"):
            u = normalize_image_url(img.get(attr, ""))
            if is_content_image(u) and u not in urls:
                urls.append(u)
                break
    return urls


def parse_log_no(link: str) -> str:
    m = re.search(r"/(\d{8,})/?(?:\?|$)", link or "")
    if m:
        return m.group(1)
    m = re.search(r"[?&]logNo=(\d+)", link or "")
    return m.group(1) if m else ""


def fetch_post_details(link: str, rss_description: str) -> tuple[str, list[str]]:
    """본문 텍스트와 최대 6장의 대표 작업사진을 얻는다.
    모바일 글 페이지가 막히면 RSS description만으로 안전하게 폴백한다.
    """
    fallback_text = meaningful_text(rss_description, "")
    fallback_images = extract_images_from_html(rss_description)
    log_no = parse_log_no(link)
    candidates = []
    if log_no:
        candidates.append(f"https://m.blog.naver.com/{BLOG_ID}/{log_no}")
        candidates.append(f"https://blog.naver.com/PostView.naver?blogId={BLOG_ID}&logNo={log_no}")
    candidates.append(link)

    for url in candidates:
        try:
            r = get(url, timeout=18, tries=2)
            soup = BeautifulSoup(r.text, "html.parser")
            container = (
                soup.select_one(".se-main-container")
                or soup.select_one("#postViewArea")
                or soup.select_one(".se_component_wrap")
                or soup.select_one("article")
            )
            if not container:
                continue
            text = clean_text(container.get_text(" ", strip=True))
            imgs: list[str] = []
            for img in container.find_all("img"):
                for attr in ("data-lazy-src", "data-src", "src"):
                    u = normalize_image_url(img.get(attr, ""))
                    if is_content_image(u) and u not in imgs:
                        imgs.append(u)
                        break
            if not imgs:
                og = soup.find("meta", attrs={"property": "og:image"})
                if og:
                    u = normalize_image_url(og.get("content", ""))
                    if is_content_image(u):
                        imgs.append(u)
            return text or fallback_text, (imgs or fallback_images)[:MAX_IMAGES_PER_POST]
        except Exception as exc:  # pragma: no cover - network dependent
            print(f"[warn] 포스트 상세 읽기 실패 {url}: {exc}", file=sys.stderr)
            continue
    return fallback_text, fallback_images[:MAX_IMAGES_PER_POST]


def classify(title: str, body: str) -> str:
    hay = f"{title} {body}".lower()
    for category, words in CATEGORY_RULES:
        if any(w.lower() in hay for w in words):
            return category
    return "기타작업"


def extract_car(title: str) -> str:
    t = clean_text(title)
    tl = t.lower().replace(" ", "")
    for car in sorted(KNOWN_CARS, key=len, reverse=True):
        if car.lower().replace(" ", "") in tl:
            return car
    positions = [t.lower().find(w.lower()) for w in ACTION_WORDS if t.lower().find(w.lower()) > 0]
    if positions:
        prefix = re.sub(r"^[\[\(【].*?[\]\)】]\s*", "", t[: min(positions)]).strip(" -|:/·")
        prefix = re.sub(r"^(일산|고양|파주|김포)\s+", "", prefix)
        if 1 < len(prefix) <= 24:
            return prefix
    return t[:20].strip() or "작업차량"


def build_summary(title: str, body: str, category: str) -> tuple[str, str]:
    body = meaningful_text(body, title)
    if body:
        summary = clip(body, 145)
        description = clip(body, 420)
    else:
        summary = f"{title} 작업사례입니다. 차종과 차량 상태를 확인한 뒤 필요한 작업을 진행했습니다."
        description = f"네이버 블로그에 등록된 {title} 작업을 홈페이지에서 보기 편하게 정리했습니다. 자세한 사진과 전체 작업 과정은 아래 네이버 블로그 원문에서 확인할 수 있습니다."
    if len(summary) < 35:
        summary = f"{title} 작업사례입니다. {category} 작업 전후 상태와 주요 과정을 간단하게 확인할 수 있습니다."
    return summary, description


def rss_items(xml_text: str) -> list[dict]:
    root = ET.fromstring(xml_text)
    result = []
    for item in root.findall("./channel/item"):
        def val(tag: str) -> str:
            node = item.find(tag)
            return (node.text or "").strip() if node is not None and node.text else ""
        result.append({
            "title": clean_text(val("title")),
            "link": val("link") or val("guid"),
            "description": val("description"),
            "pubDate": val("pubDate"),
            "category": clean_text(val("category")),
            "tags": [clean_text(x.text or "") for x in item.findall("tag") if clean_text(x.text or "")],
        })
    return result


def date_iso(pubdate: str) -> str:
    try:
        dt = parsedate_to_datetime(pubdate)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=SEOUL)
        return dt.astimezone(SEOUL).date().isoformat()
    except Exception:
        return datetime.now(SEOUL).date().isoformat()


def make_id(link: str) -> str:
    log_no = parse_log_no(link)
    if log_no:
        return f"naver-{log_no}"
    return "naver-" + hashlib.sha1(link.encode("utf-8")).hexdigest()[:14]


def load_history() -> list[dict]:
    if not DATA_JSON.exists():
        return []
    try:
        data = json.loads(DATA_JSON.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def create_work(item: dict) -> dict:
    title = item["title"] or "12V STORY 작업사례"
    link = item["link"]
    body, images = fetch_post_details(link, item.get("description", ""))
    category = classify(title, body)
    summary, description = build_summary(title, body, category)
    car = extract_car(title)
    tags = []
    for t in [car, category, *item.get("tags", [])]:
        t = clean_text(t).lstrip("#")
        if t and t not in tags:
            tags.append(t)
    return {
        "id": make_id(link),
        "date": date_iso(item.get("pubDate", "")),
        "category": category,
        "car": car,
        "title": title,
        "summary": summary,
        "description": description,
        "points": POINTS.get(category, POINTS["기타작업"]),
        "images": images,
        "captions": [f"{car} · {title} 작업사진 {i+1}" for i in range(len(images))],
        "blog": link,
        "tags": tags[:8],
        "source": "naver",
    }


def merge_history(old: list[dict], fresh: list[dict]) -> list[dict]:
    merged = {w.get("id"): w for w in old if w.get("id")}
    for w in fresh:
        old_w = merged.get(w["id"], {})
        # 상세페이지 일시 차단 등으로 이번 수집에서 사진/본문이 비면 기존 값을 보존
        if not w.get("images") and old_w.get("images"):
            w["images"] = old_w["images"]
            w["captions"] = old_w.get("captions", [])
        if (not w.get("description") or len(w.get("description", "")) < 30) and old_w.get("description"):
            w["description"] = old_w["description"]
            w["summary"] = old_w.get("summary", w.get("summary", ""))
        merged[w["id"]] = w
    works = list(merged.values())
    works.sort(key=lambda x: (x.get("date", ""), x.get("id", "")), reverse=True)
    return works[:MAX_HISTORY]


def write_outputs(works: list[dict]) -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    DATA_JSON.write_text(json.dumps(works, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    now = datetime.now(SEOUL).strftime("%Y-%m-%d %H:%M")
    sync = {"updatedAt": now, "count": len(works), "source": "NAVER BLOG RSS", "blogId": BLOG_ID}
    js = (
        "/* 자동 생성 파일입니다. scripts/sync_naver.py가 갱신합니다. */\n"
        f"window.WORKS_SYNC = {json.dumps(sync, ensure_ascii=False)};\n"
        f"window.WORKS_DATA = {json.dumps(works, ensure_ascii=False, indent=2)};\n"
    )
    DATA_JS.write_text(js, encoding="utf-8")


def main() -> int:
    print(f"[12V STORY] RSS 확인: {RSS_URL}")
    r = get(RSS_URL, timeout=25, tries=3)
    # requests가 RSS 인코딩을 잘못 추측하는 경우를 피함
    xml_text = r.content.decode("utf-8", errors="replace")
    items = rss_items(xml_text)
    if not items:
        raise RuntimeError("RSS에서 게시글을 찾지 못했습니다. 네이버 RSS 공개 설정을 확인해주세요.")
    print(f"[12V STORY] RSS 최근 글 {len(items)}건 발견")
    fresh = []
    for idx, item in enumerate(items, 1):
        if not item.get("link"):
            continue
        print(f"  {idx:02d}. {item.get('title','')}")
        fresh.append(create_work(item))
        time.sleep(0.25)
    works = merge_history(load_history(), fresh)
    write_outputs(works)
    print(f"[12V STORY] 완료: 홈페이지 작업 {len(works)}건 / {DATA_JS.relative_to(ROOT)} 갱신")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
