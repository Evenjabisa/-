// ========== إعداد الحالة والـ DOM ==========
const API_BASE = "https://api.quran.com/api/v4/recitations";
let surahs = [];
let currentSurah = null;
let currentAyahIndex = 0;
let isPlayingSequential = false;

let favorites = JSON.parse(localStorage.getItem("quran_favs") || "[]");
let settings = JSON.parse(localStorage.getItem("quran_settings") || "{}");

const surahListEl = document.getElementById("surahList");
const surahCountEl = document.getElementById("surahCount");
const ayahsContainer = document.getElementById("ayahsContainer");
const currentSurahTitle = document.getElementById("currentSurahTitle");
const currentSurahInfo = document.getElementById("currentSurahInfo");
const searchInput = document.getElementById("search");
const clearSearchBtn = document.getElementById("clearSearch");
const favoritesEl = document.getElementById("favorites");
const audioPlayer = document.getElementById("audioPlayer");

const playPauseBtn = document.getElementById("playPauseBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const playSurahBtn = document.getElementById("playSurahBtn");
const downloadJsonBtn = document.getElementById("downloadJson");
const refreshBtn = document.getElementById("refreshBtn");
const reciterSelect = document.getElementById("reciterSelect");
const customReciterInput = document.getElementById("customReciter");
const toggleTheme = document.getElementById("toggleTheme");

// ========== مساعدة صغيرة ==========
function saveFavs() {
  localStorage.setItem("quran_favs", JSON.stringify(favorites));
  renderFavorites();
}
function saveSettings() {
  localStorage.setItem("quran_settings", JSON.stringify(settings));
}
function showError(msg) {
  ayahsContainer.innerHTML =
    '<div style="color:#ffb4a2;padding:12px;background:rgba(255,180,162,0.03);border-radius:8px">' +
    msg +
    "</div>";
}

// ========== ريندر القوائم ==========
function renderSurahList(filter = "") {
  surahListEl.innerHTML = "";
  const term = (filter || "").trim();
  const filtered = surahs.filter((s) => {
    if (!term) return true;
    return (
      s.englishName.toLowerCase().includes(term.toLowerCase()) ||
      s.name.includes(term) ||
      String(s.number).includes(term)
    );
  });
  surahCountEl.textContent = `${filtered.length} / ${surahs.length}`;
  filtered.forEach((s) => {
    const el = document.createElement("div");
    el.className = "surah";
    el.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><strong>${s.englishName} — ${s.name}</strong><div style="font-size:12px;color:var(--muted)">آيات: ${s.numberOfAyahs}</div></div>
            <div style="text-align:left"><small>#${s.number}</small></div>
          </div>`;
    el.onclick = () => loadSurah(s.number);
    surahListEl.appendChild(el);
  });
}

function renderFavorites() {
  favoritesEl.innerHTML = "";
  if (favorites.length === 0) {
    favoritesEl.innerHTML =
      '<small style="color:var(--muted)">لا توجد آيات محفوظة</small>';
    return;
  }
  favorites.forEach((f) => {
    const item = document.createElement("div");
    item.className = "fav-item";
    item.innerHTML = `
          <div style="flex:1">
            <strong>سورة ${f.surahName} — آية ${f.ayahInSurah}</strong>
            <div style="font-size:12px;color:var(--muted)">${f.text.slice(
              0,
              80
            )}${f.text.length > 80 ? "..." : ""}</div>
          </div>
          <div style="margin-left:8px;display:flex;flex-direction:column;gap:6px">
            <button data-action="open">فتح</button>
            <button data-action="del">حذف</button>
          </div>`;
    item.querySelector("[data-action=open]").onclick = () =>
      loadSurah(f.surahNumber, f.ayahInSurah - 1);
    item.querySelector("[data-action=del]").onclick = () => {
      favorites = favorites.filter(
        (x) => !(x.surahNumber === f.surahNumber && x.ayahIndex === f.ayahIndex)
      );
      saveFavs();
    };
    favoritesEl.appendChild(item);
  });
}

// ========== جلب السور والآيات ==========
async function fetchSurahList() {
  surahListEl.innerHTML = '<div style="opacity:0.7">جاري تحميل السور...</div>';
  try {
    const res = await fetch("https://api.quran.com/api/v4/chapters");
    const json = await res.json();
    surahs = json.chapters.map((s) => ({
      number: s.id,
      name: s.name_arabic,
      englishName: s.name_simple,
      numberOfAyahs: s.verses_count,
      revelationType: s.revelation_place,
    }));
    renderSurahList();
  } catch (err) {
    surahListEl.innerHTML =
      '<div style="color:#ffb4a2">فشل تحميل السور. تأكد من الاتصال أو CORS.</div>';
    console.error(err);
  }
}

async function loadSurah(num, jumpToIndex = 0) {
  currentSurahTitle.textContent = "جاري التحميل...";
  ayahsContainer.innerHTML =
    '<div style="opacity:0.7">جاري تحميل آيات السورة...</div>';
  try {
    const res = await fetch(
      `https://api.quran.com/api/v4/quran/verses?chapter_number=${num}`
    );
    const json = await res.json();
    const verses = json.verses;
    currentSurah = {
      number: num,
      name: surahs.find((s) => s.number === num)?.name || "",
      englishName: surahs.find((s) => s.number === num)?.englishName || "",
      numberOfAyahs: verses.length,
      ayahs: verses.map((v) => ({
        number: v.id,
        numberInSurah: v.verse_number,
        text: v.text_uthmani,
      })),
    };
    currentAyahIndex = jumpToIndex || 0;
    currentSurahTitle.textContent = `${currentSurah.englishName} — ${currentSurah.name}`;
    currentSurahInfo.textContent = `آيات: ${currentSurah.numberOfAyahs}`;
    renderAyahs(currentSurah.ayahs, jumpToIndex);
  } catch (err) {
    showError("حدث خطأ أثناء تحميل السورة. راجع Console.");
    console.error(err);
  }
}

function renderAyahs(ayahs, jumpToIndex = 0) {
  ayahsContainer.innerHTML = "";
  ayahs.forEach((a, idx) => {
    const el = document.createElement("div");
    el.className = "ayah";
    el.innerHTML = `
          <div class="text">
            <div style="font-size:20px;direction:rtl;text-align:right">${a.text}</div>
            <small>آية ${a.numberInSurah} — رقم عالمي: ${a.number}</small>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:center">
            <button data-action="play" data-idx="${idx}">▶</button>
            <button data-action="fav" data-idx="${idx}">❤</button>
          </div>`;
    el.querySelector("[data-action=play]").onclick = (e) => {
      const i = Number(e.currentTarget.dataset.idx);
      playSingleAyahByIndex(i);
    };
    el.querySelector("[data-action=fav]").onclick = (e) => {
      const i = Number(e.currentTarget.dataset.idx);
      const aobj = currentSurah.ayahs[i];
      toggleFav(aobj, currentSurah.number, i);
    };
    ayahsContainer.appendChild(el);
  });
  setTimeout(() => {
    const node = ayahsContainer.querySelectorAll(".ayah")[jumpToIndex];
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 120);
}

// ========== المفضلات ==========
function toggleFav(ayahObj, surahNumber, ayahIndex) {
  const exists = favorites.find(
    (f) => f.surahNumber === surahNumber && f.ayahIndex === ayahIndex
  );
  if (exists) {
    favorites = favorites.filter(
      (f) => !(f.surahNumber === surahNumber && f.ayahIndex === ayahIndex)
    );
  } else {
    favorites.push({
      surahNumber,
      ayahIndex,
      ayahInSurah: ayahObj.numberInSurah,
      surahName: currentSurah?.name || "",
      text: ayahObj.text,
      globalNumber: ayahObj.number,
    });
  }
  saveFavs();
}

// ========== مشغل الصوت: اختيار القارئ ==========
function getSelectedReciterId() {
  const sel = reciterSelect.value;
  if (sel === "__custom__") {
    return (customReciterInput.value || "").trim() || "ar.alafasy";
  }
  return sel || "ar.alafasy";
}

// إظهار/إخفاء خانة المعرّف المخصص
reciterSelect.onchange = () => {
  if (reciterSelect.value === "__custom__")
    customReciterInput.style.display = "block";
  else customReciterInput.style.display = "none";
  settings.reciter = getSelectedReciterId();
  saveSettings();
};
customReciterInput.onchange = () => {
  settings.reciter = getSelectedReciterId();
  saveSettings();
};

// استعادة الإعدادات المحفوظة (إن وُجدت)
if (settings.reciter) {
  // إذا كانت القيمة مساوية لأحد الخيارات، اخترها؛ وإلا اختر custom وأظهر الحقل
  const found = Array.from(reciterSelect.options).some(
    (opt) => opt.value === settings.reciter
  );
  if (found) reciterSelect.value = settings.reciter;
  else {
    reciterSelect.value = "__custom__";
    customReciterInput.style.display = "block";
    customReciterInput.value = settings.reciter;
  }
}

// ========== تشغيل آية واحدة بالاعتماد على المعرّف ==========
async function playSingleAyahByIndex(idx) {
  if (!currentSurah) return;
  const ayah = currentSurah.ayahs[idx];
  currentAyahIndex = idx;
  await playAyahByGlobalNumber(ayah.number);
}

async function playAyahByGlobalNumber(globalAyahNumber) {
  try {
    const reciterId = getSelectedReciterId();
    // AlQuran Cloud: /ayah/{number}/{edition} حيث edition قد يكون ar.alafasy
    const res = await fetch(
      `https://api.quran.com/api/v4/recitations/${reciterId}/by_ayah/${globalAyahNumber}`
    );
    const json = await res.json();
    if (json?.code !== 200 || !json?.data) {
      showError("لا يتوفر صوت لهذه الآية بواسطة هذا القارئ.");
      return;
    }
    // بعض الردود تقدم data.audio
    const audioUrl =
      json.data.audio ||
      json.data.audioSecondary ||
      json.data.audioSecondary ||
      null;
    if (!audioUrl) {
      showError("لا يوجد رابط صوتي لهذه الآية عبر الـ API لهذه الإعدادات.");
      return;
    }
    audioPlayer.src = audioUrl;
    await audioPlayer.play();
    playPauseBtn.textContent = "⏸";
  } catch (err) {
    console.error(err);
    showError(
      "فشل في تشغيل الصوت — قد يكون سببها CORS أو أن المعرّف غير صحيح."
    );
  }
}

// ========== تشغيل متسلسل داخل السورة ==========
let sequentialAbort = false;
async function playSurahSequential() {
  if (!currentSurah) return alert("اختر سورة أولاً");
  isPlayingSequential = true;
  playSurahBtn.disabled = true;
  sequentialAbort = false;
  for (let i = currentAyahIndex; i < currentSurah.ayahs.length; i++) {
    if (sequentialAbort) break;
    const ayah = currentSurah.ayahs[i];
    await playAyahByGlobalNumber(ayah.number);
    // انتظر انتهاء الصوت أو إنهاء متعمد
    await new Promise((res) => {
      const onEnded = () => {
        audioPlayer.removeEventListener("ended", onEnded);
        res();
      };
      const onError = () => {
        audioPlayer.removeEventListener("error", onError);
        res();
      };
      audioPlayer.addEventListener("ended", onEnded);
      audioPlayer.addEventListener("error", onError);
    });
    currentAyahIndex = i + 1;
  }
  isPlayingSequential = false;
  playSurahBtn.disabled = false;
  playPauseBtn.textContent = "▶";
}

// ========== أزرار تحكم (تشغيل/إيقاف/سابق/التالي) ==========
playPauseBtn.onclick = () => {
  if (audioPlayer.paused) {
    // إذا كان هناك ملف مصدر
    if (!audioPlayer.src) {
      // شغّل الآية الحالية إن وُجدت
      if (
        currentSurah &&
        currentSurah.ayahs &&
        currentSurah.ayahs[currentAyahIndex]
      ) {
        playSingleAyahByIndex(currentAyahIndex);
      } else {
        return alert("لا توجد آية لتشغيلها الآن.");
      }
    } else {
      audioPlayer.play();
      playPauseBtn.textContent = "⏸";
    }
  } else {
    audioPlayer.pause();
    playPauseBtn.textContent = "▶";
  }
};

prevBtn.onclick = () => {
  if (!currentSurah) return;
  currentAyahIndex = Math.max(0, currentAyahIndex - 1);
  playSingleAyahByIndex(currentAyahIndex);
};

nextBtn.onclick = () => {
  if (!currentSurah) return;
  currentAyahIndex = Math.min(
    currentSurah.ayahs.length - 1,
    currentAyahIndex + 1
  );
  playSingleAyahByIndex(currentAyahIndex);
};

playSurahBtn.onclick = () => {
  // بدء التشغيل المتسلسل من الآية الحالية
  if (isPlayingSequential) {
    // إذا كان يعمل، أوقفه
    sequentialAbort = true;
    isPlayingSequential = false;
    playSurahBtn.textContent = "تشغيل متسلسل";
  } else {
    playSurahBtn.textContent = "إيقاف التشغيل";
    playSurahSequential();
  }
};

// عندما ينتهي الصوت تغيّر زر التشغيل
audioPlayer.onended = () => {
  playPauseBtn.textContent = "▶";
};
audioPlayer.onplay = () => {
  playPauseBtn.textContent = "⏸";
};
audioPlayer.onpause = () => {
  playPauseBtn.textContent = "▶";
};

// ========== تنزيل JSON للسورة الحالية ==========
function downloadCurrentSurahJson() {
  if (!currentSurah) return alert("اختر سورة أولاً");
  const blob = new Blob([JSON.stringify(currentSurah, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `surah-${currentSurah.number}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ========== واجهة المستخدم: البحث والتحديث والمفضلات ==========
searchInput.oninput = (e) => renderSurahList(e.target.value);
clearSearchBtn.onclick = () => {
  searchInput.value = "";
  renderSurahList();
};
downloadJsonBtn.onclick = downloadCurrentSurahJson;
refreshBtn.onclick = fetchSurahList;

// ========== Theme (وضع النهار) ==========
toggleTheme.onchange = (e) => {
  if (e.target.checked) {
    document.body.style.background = "linear-gradient(180deg,#ffffff,#f1f5f9)";
    document.body.style.color = "#062018";
  } else {
    document.body.style.background = "linear-gradient(180deg,#071023,#071827)";
    document.body.style.color = "";
  }
};

// ========== Init ==========
(function init() {
  fetchSurahList();
  renderFavorites();
  // إعادة تحميل الإعدادات الأساسية
  if (settings.reciter) {
    /* تم التعامل معه أعلاه */
  }
})();

// Expose for debugging
window._qApp = {
  loadSurah,
  playSingleAyahByIndex,
  playSurahSequential,
  surahs,
};
