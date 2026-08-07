(function(){
  const works = (window.WORKS_DATA || []).slice().sort((a,b) => (b.date || '').localeCompare(a.date || ''));

  function esc(v=''){
    return String(v).replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s]));
  }
  function fmtDate(v=''){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    return m ? `${m[1]}.${m[2]}.${m[3]}` : v;
  }
  function imageUrl(work){
    return Array.isArray(work.images) && work.images.length ? work.images[0] : '';
  }
  function visualHtml(work){
    const img = imageUrl(work);
    if(!img) return `<div class="visual"><b>${esc(work.car || work.category)}</b></div>`;
    return `<div class="visual has-image"><img src="${esc(img)}" alt="${esc(work.title)}" loading="lazy" referrerpolicy="no-referrer"><b>${esc(work.car)}</b></div>`;
  }
  function card(work){
    const source = work.source === 'naver' ? ' · NAVER 자동연동' : '';
    return `<a class="work-card gallery-item" data-category="${esc(work.category)}" href="work.html?id=${encodeURIComponent(work.id)}">${visualHtml(work)}<div class="body"><small>${esc(work.category)} · ${esc(fmtDate(work.date))}${source}</small><h3>${esc(work.title)}</h3><p>${esc(work.summary || '')}</p></div></a>`;
  }

  document.querySelectorAll('[data-sync-status]').forEach(el => {
    const s = window.WORKS_SYNC || {};
    const count = Number.isFinite(Number(s.count)) ? ` · 누적 ${Number(s.count)}건` : '';
    el.textContent = `네이버 블로그 자동연동 · 마지막 확인 ${s.updatedAt || '준비 중'}${count}`;
  });

  const recent = document.querySelector('[data-recent-works]');
  if(recent){
    recent.innerHTML = works.length ? works.slice(0,8).map(card).join('') : '<div class="gallery-empty">첫 자동동기화 후 네이버 블로그의 최근 작업이 이곳에 표시됩니다.</div>';
  }

  const grid = document.querySelector('[data-gallery-grid]');
  const filters = document.querySelector('[data-gallery-filters]');
  const empty = document.querySelector('[data-gallery-empty]');
  if(grid){
    grid.innerHTML = works.map(card).join('');
    const categories = ['전체', ...new Set(works.map(w=>w.category).filter(Boolean))];
    if(filters){
      filters.innerHTML = categories.map((c,i)=>`<button type="button" class="filter-btn${i===0?' active':''}" data-filter="${esc(c)}">${esc(c)}</button>`).join('');
      filters.addEventListener('click', e => {
        const btn = e.target.closest('[data-filter]');
        if(!btn) return;
        filters.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active'));
        btn.classList.add('active');
        const f = btn.dataset.filter;
        let shown = 0;
        grid.querySelectorAll('.gallery-item').forEach(item => {
          const ok = f === '전체' || item.dataset.category === f;
          item.hidden = !ok;
          if(ok) shown++;
        });
        if(empty) empty.hidden = shown !== 0;
      });
    }
  }

  const detail = document.querySelector('[data-work-detail]');
  if(detail){
    const id = new URLSearchParams(location.search).get('id');
    const work = works.find(w => w.id === id);
    if(!work){
      detail.innerHTML = `<div class="content-panel not-found"><h2>작업을 찾을 수 없습니다.</h2><p>작업갤러리에서 다시 선택해주세요.</p><div class="actions" style="justify-content:flex-start"><a class="btn dark" href="works.html">작업갤러리로</a></div></div>`;
      return;
    }
    document.title = `${work.title} | 12V STORY`;
    const imgs = (work.images || []).map((src,i)=>{
      const cap = (work.captions || [])[i] || `${work.car} · ${work.title} ${i+1}`;
      return `<figure><img src="${esc(src)}" alt="${esc(cap)}" loading="lazy" referrerpolicy="no-referrer"><figcaption>${esc(cap)}</figcaption></figure>`;
    }).join('');
    const tags = (work.tags || []).map(t=>`<span class="chip">#${esc(t)}</span>`).join('');
    const points = (work.points || []).map(p=>`<li>${esc(p)}</li>`).join('');
    detail.innerHTML = `
      <header class="page-hero work-detail-hero"><div class="kicker">${esc(work.category)} · ${esc(fmtDate(work.date))}</div><h1>${esc(work.car)}<br>${esc(work.title)}</h1><p>${esc(work.summary || '')}</p></header>
      <div class="detail-facts">
        <div><small>차종</small><b>${esc(work.car)}</b></div>
        <div><small>작업</small><b>${esc(work.category)}</b></div>
        <div><small>등록일</small><b>${esc(fmtDate(work.date))}</b></div>
      </div>
      <div class="detail-info-grid">
        <article class="content-panel detail-copy"><h2>작업 내용</h2><p>${esc(work.description || work.summary || '')}</p>${points?`<h3>작업 포인트</h3><ul class="point-list">${points}</ul>`:''}${tags?`<div class="chips detail-tags">${tags}</div>`:''}</article>
        <aside class="content-panel detail-contact"><h2>상담 안내</h2><p>같은 차종이라도 연식과 옵션에 따라 작업 방식이 달라질 수 있습니다. 차종·연식·작업 내용을 함께 보내주시면 확인 후 안내드립니다.</p><div class="actions" style="justify-content:flex-start"><a class="btn talk" href="http://talk.naver.com/WC6P8L" target="_blank" rel="noopener">네이버 톡톡</a><a class="btn dark" href="tel:031-912-8812">전화 문의</a></div></aside>
      </div>
      ${imgs?`<section class="detail-gallery"><div class="detail-gallery-inner"><div class="section-head"><div><div class="kicker">Work Photos</div><h2>대표 작업사진</h2><p class="gallery-intro">홈페이지에서는 대표사진을 최대 6장만 보기 좋게 보여주고, 전체 작업과정은 네이버 블로그에서 확인할 수 있습니다.</p></div></div><div class="photo-grid">${imgs}</div></div></section>`:`<div class="photo-placeholder">네이버 글에서 대표 이미지를 확인하지 못했습니다. 아래 원문 보기에서 전체 사진을 확인해주세요.</div>`}
      <div class="detail-bottom"><a class="btn dark" href="works.html">← 작업갤러리</a>${work.blog?`<a class="btn talk" href="${esc(work.blog)}" target="_blank" rel="noopener">네이버 블로그 전체 작업 보기 →</a>`:''}</div>`;
  }
})();
