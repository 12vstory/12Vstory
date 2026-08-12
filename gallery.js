(function(){
  function esc(v=''){
    return String(v).replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s]));
  }
  function fmtDate(v=''){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    return m ? `${m[1]}.${m[2]}.${m[3]}` : v;
  }
  const CAR_PATTERNS = [
    ['쉐보레 볼트EV', /(?:쉐보레\s*)?볼트\s*EV/i],
    ['폴스타4', /폴스타\s*4/i],
    ['아반떼 AD', /아반떼\s*AD/i],
    ['아반떼 HD', /아반떼\s*HD/i],
    ['아반떼 XD', /아반떼\s*XD/i],
    ['그랜드 스타렉스', /그랜드\s*스타렉스/i],
    ['로체 이노베이션', /로체\s*이노베이션/i],
    ['제네시스 G80', /제네시스\s*G80/i],
    ['제네시스 G70', /제네시스\s*G70/i],
    ['제네시스 BH', /제네시스\s*BH/i],
    ['제네시스 DH', /제네시스\s*DH/i],
    ['벤츠 GLC350e', /(?:벤츠\s*)?GLC\s*350e/i],
    ['벤츠 GLC300', /(?:벤츠\s*)?GLC\s*300/i],
    ['BMW 320d E90', /BMW\s*320d\s*E90/i],
    ['BMW 118', /BMW\s*118/i],
    ['미니쿠퍼 R56', /미니쿠퍼\s*R56/i],
    ['도요타 FJ크루저', /(?:도요타\s*)?FJ\s*크루[져저]/i],
    ['넥스트 스파크', /넥스트\s*스파크/i],
    ['YF쏘나타', /YF\s*쏘나타/i],
    ['DN8쏘나타', /DN8\s*(?:쏘나타|소나타)/i],
    ['그랜저 HG', /그랜저\s*HG/i],
    ['GV80', /\bGV80\b/i],
    ['K9', /\bK9\b/i],
    ['K5', /\bK5\b/i],
    ['K3', /\bK3\b/i],
    ['G80', /\bG80\b/i],
    ['G70', /\bG70\b/i],
    ['니로', /니로/i],
    ['스팅어', /스팅어/i],
    ['스타리아', /스타리아/i],
    ['모하비', /모하비/i],
    ['포르테', /포르테/i],
    ['카마로', /카마로/i],
    ['팰리세이드', /팰리세이드/i],
    ['CLA', /\bCLA\b/i],
    ['폭스바겐', /폭스바겐/i]
  ];

  function displayCar(work){
    const raw = `${work.title || ''} ${work.car || ''}`;
    for(const [name, rx] of CAR_PATTERNS){
      if(rx.test(raw)) return name;
    }
    const bad = /^(일산|파주|고양|운정|김포|삼송|일산\s*파주|파주\s*고양)/;
    const car = String(work.car || '').trim();
    return (!car || bad.test(car)) ? '작업차량' : car;
  }

  function workName(work){
    const raw = String(work.title || '').replace(/\s+/g,' ').trim();
    const low = raw.toLowerCase();

    if(/네비게이션|내비게이션|jy-n\d+|아틀란/.test(low)) return '내비게이션 매립';
    if(/크루즈\s*컨트롤|크루즈컨트롤/.test(low)) return '크루즈컨트롤 순정옵션 시공';
    if(/옵틱\s*글래스|옵틱글래스|광각\s*미러|광각미러/.test(low)) return '옵틱글래스 광각미러 장착';
    if(/사이드\s*미러|사이드미러/.test(low) && /폴딩|기어|모터|접히|펴지/.test(low)) return '사이드미러 폴딩불량 수리';
    if(/사이드\s*미러|사이드미러/.test(low)) return '사이드미러 수리';
    if(/블랙\s*박스|블랙박스|파인뷰|아이나비/.test(low)) return '블랙박스 장착';
    if(/후방\s*카메라|후방카메라|리어\s*카메라/.test(low)) return /교체|고장|불량/.test(low) ? '후방카메라 교체' : '후방카메라 장착';
    if(/카플레이/.test(low)) return '카플레이 장착';
    if(/안드로이드\s*올인원|안드로이드올인원|올인원/.test(low)) return '안드로이드 올인원 장착';
    if(/비상등/.test(low)) return '비상등 스위치 수리';
    if(/오토\s*라이트|오토라이트/.test(low)) return '오토라이트 순정옵션 시공';
    if(/\bsbr\b/i.test(raw)) return 'SBR 경고 기능 작업';
    if(/전조등/.test(low) && /led/.test(low)) return 'LED 전조등 교체';

    // SEO 지역명/홍보문구를 없애고 가장 작업명다운 조각만 사용
    let parts = raw
      .replace(/^[\[【(][^\]】)]*(?:일산|파주|고양|운정|김포|삼송)[^\]】)]*[\]】)]\s*/,'')
      .split(/\s*[\/|｜]\s*/)
      .map(x => x.trim())
      .filter(Boolean)
      .filter(x => !/^(일산|파주|고양|운정|김포|삼송)(\s|$)/.test(x))
      .filter(x => !/잘하는\s*곳|전문점|전문\s*장착점|출장|문의|예약/.test(x));

    const action = parts.find(x => /수리|교체|장착|시공|매립|활성화|튜닝/.test(x));
    let picked = action || parts[0] || raw;
    picked = picked
      .replace(/#[^\s]+/g,'')
      .replace(/\s+/g,' ')
      .trim();

    const car = displayCar(work);
    if(car !== '작업차량') picked = picked.replace(new RegExp(car.replace(/\s+/g,'\\s*'), 'i'),'').trim();
    return picked.slice(0,34) || work.category || '자동차 전장 작업';
  }

  function cardTitle(work){
    const car = displayCar(work);
    const task = workName(work);
    return car === '작업차량' ? task : `${car} ${task}`;
  }

  function cleanSummary(work){
    let s = String(work.summary || '')
      .replace(/^\s*\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}\.?\s*/,'')
      .replace(/^\s*\d+\s*년\s*전\s*오늘\s*/,'')
      .replace(/^\s*안녕하세요[.! ]*/,'')
      .replace(/^\s*(?:12볼트스토리|12V\s*STORY)(?:입니다)?[.! ]*/i,'')
      .replace(/\s+/g,' ')
      .trim();
    if(!s || s.length < 12) s = `${displayCar(work)} ${workName(work)} 작업사례입니다.`;
    return s.length > 92 ? s.slice(0,92).trim() + '…' : s;
  }

  function imageUrl(work){
    if(!Array.isArray(work.images) || !work.images.length) return '';
    // 네이버 포스팅의 첫 번째 이미지를 대표 썸네일로 그대로 사용
    return work.images[0];
  }

  function visualHtml(work){
    const img = imageUrl(work);
    if(!img) return `<div class="visual thumb-empty" aria-label="대표사진 없음"></div>`;
    return `<div class="visual has-image"><img src="${esc(img)}" alt="${esc(cardTitle(work))}" loading="lazy" referrerpolicy="no-referrer"></div>`;
  }

  function card(work){
    return `<a class="work-card gallery-item" data-category="${esc(work.category || '기타작업')}" href="work.html?id=${encodeURIComponent(work.id)}">${visualHtml(work)}<div class="body"><small>${esc(work.category || '기타작업')} · ${esc(fmtDate(work.date))}</small><h3>${esc(cardTitle(work))}</h3><p>${esc(cleanSummary(work))}</p></div></a>`;
  }

  function getWorks(){
    return (window.WORKS_DATA || [])
      .slice()
      .sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  function renderRecent(works){
    const recent = document.querySelector('[data-recent-works]');
    if(!recent) return;
    recent.innerHTML = works.length
      ? works.slice(0,8).map(card).join('')
      : '<div class="gallery-empty">등록된 작업사례가 없습니다.</div>';
  }

  function renderGallery(works){
    const grid = document.querySelector('[data-gallery-grid]');
    if(!grid) return;

    const filters = document.querySelector('[data-gallery-filters]');
    const empty = document.querySelector('[data-gallery-empty]');
    const loading = document.querySelector('[data-gallery-loading]');
    const count = document.querySelector('[data-gallery-count]');

    if(count) count.textContent = `전체 ${works.length}건`;
    if(loading) loading.hidden = true;

    grid.innerHTML = works.length ? works.map(card).join('') : '';

    const categories = ['전체', ...new Set(works.map(w => w.category || '기타작업').filter(Boolean))];
    if(filters){
      filters.innerHTML = categories.map((c,i) =>
        `<button type="button" class="filter-btn${i===0?' active':''}" data-filter="${esc(c)}">${esc(c)}</button>`
      ).join('');

      filters.onclick = (e) => {
        const btn = e.target.closest('[data-filter]');
        if(!btn) return;
        filters.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');

        const selected = btn.dataset.filter;
        let shown = 0;
        grid.querySelectorAll('.gallery-item').forEach(item => {
          const ok = selected === '전체' || item.dataset.category === selected;
          item.hidden = !ok;
          if(ok) shown++;
        });
        if(empty) empty.hidden = shown !== 0;
      };
    }

    if(empty) empty.hidden = works.length !== 0;
  }

  function renderDetail(works){
    const detail = document.querySelector('[data-work-detail]');
    if(!detail) return;

    const id = new URLSearchParams(location.search).get('id');
    const work = works.find(w => w.id === id);
    if(!work){
      detail.innerHTML = `<div class="content-panel not-found"><h2>작업을 찾을 수 없습니다.</h2><p>작업갤러리에서 다시 선택해주세요.</p><div class="actions" style="justify-content:flex-start"><a class="btn dark" href="works.html">작업갤러리로</a></div></div>`;
      return;
    }

    document.title = `${cardTitle(work)} | 12V STORY`;

    const imgs = (work.images || []).map((src,i) => {
      const cap = (work.captions || [])[i] || `${displayCar(work)} ${workName(work)} 작업사진 ${i+1}`;
      return `<figure><img src="${esc(src)}" alt="${esc(cap)}" loading="lazy" referrerpolicy="no-referrer"><figcaption>${esc(cap)}</figcaption></figure>`;
    }).join('');

    const tags = (work.tags || []).map(t => `<span class="chip">#${esc(t)}</span>`).join('');
    const points = (work.points || []).map(p => `<li>${esc(p)}</li>`).join('');

    detail.innerHTML = `
      <header class="page-hero work-detail-hero">
        <div class="kicker">${esc(work.category || '작업사례')} · ${esc(fmtDate(work.date))}</div>
        <h1>${esc(displayCar(work))}<br>${esc(workName(work))}</h1>
        <p>${esc(cleanSummary(work))}</p>
      </header>

      <div class="detail-facts">
        <div><small>차종</small><b>${esc(displayCar(work))}</b></div>
        <div><small>작업</small><b>${esc(work.category || '자동차 전장')}</b></div>
        <div><small>등록일</small><b>${esc(fmtDate(work.date))}</b></div>
      </div>

      <div class="detail-info-grid">
        <article class="content-panel detail-copy">
          <h2>작업 내용</h2>
          <p>${esc(work.description || work.summary || '')}</p>
          ${points ? `<h3>작업 포인트</h3><ul class="point-list">${points}</ul>` : ''}
          ${tags ? `<div class="chips detail-tags">${tags}</div>` : ''}
        </article>
        <aside class="content-panel detail-contact">
          <h2>상담 안내</h2>
          <p>같은 차종이라도 연식과 옵션에 따라 작업 방식이 달라질 수 있습니다. 차종·연식·작업 내용을 함께 보내주시면 확인 후 안내드립니다.</p>
          <div class="actions" style="justify-content:flex-start">
            <a class="btn talk" href="http://talk.naver.com/WC6P8L" target="_blank" rel="noopener">네이버 톡톡</a>
            <a class="btn dark" href="tel:031-912-8812">전화 문의</a>
          </div>
        </aside>
      </div>

      ${imgs ? `
      <section class="detail-gallery">
        <div class="detail-gallery-inner">
          <div class="section-head">
            <div>
              <div class="kicker">WORK PHOTOS</div>
              <h2>주요 작업사진</h2>
              <p class="gallery-intro">작업 과정 중 주요 사진을 정리했습니다.</p>
            </div>
          </div>
          <div class="photo-grid">${imgs}</div>
        </div>
      </section>` : `
      <div class="photo-placeholder">대표 이미지를 불러오지 못했습니다.</div>`}

      <div class="detail-bottom">
        <a class="btn dark" href="works.html">← 작업갤러리</a>
        ${work.blog ? `<a class="btn talk" href="${esc(work.blog)}" target="_blank" rel="noopener">네이버 블로그 원문 보기 →</a>` : ''}
      </div>`;
  }

  function init(){
    const works = getWorks();
    renderRecent(works);
    renderGallery(works);
    renderDetail(works);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }

  // GitHub Pages/브라우저 캐시 환경에서 갤러리가 비어 있을 경우 한 번 더 렌더링
  window.addEventListener('load', () => {
    const grid = document.querySelector('[data-gallery-grid]');
    if(grid && grid.children.length === 0 && (window.WORKS_DATA || []).length){
      renderGallery(getWorks());
    }
  }, {once:true});
})();
