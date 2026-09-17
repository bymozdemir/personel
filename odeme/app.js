/* =========================================================
   ÖDEME VE BÜTÇE TAKİP - ANA JAVASCRIPT
   ========================================================= */

const STORAGE_KEY = "odemeTakipVerileri";
const AY_ISIMLERI = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

let veriler = {
    ayarlar: {
        gelirBasliklari: [],
        basliklar: []
    },
    aylar: {},
    sonGuncelleme: null
};

let aktifTarih = new Date();
let aktifBaslikId = null;
let aktifGelirBaslikId = null;
let duzenlenenSablonId = null;
let duzenlenenGelirSablonId = null;
let ozetYili = new Date().getFullYear();


/* =========================================================
   BAŞLANGIÇ
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    temaYukle();
    verileriYukle();
    bugununAyiniKontrolEt();

    window.addEventListener("popstate", routerKontrolu);

    if (!history.state) {
        history.replaceState({ sayfa: "anasayfa" }, "", "#anasayfa");
    }
    routerKontrolu();

    const pastaCanvas = document.getElementById("pastaCanvas");
    if (pastaCanvas) {
        pastaCanvas.addEventListener("click", pastaTiklama);
        pastaCanvas.addEventListener("touchstart", (e) => { e.preventDefault(); pastaTiklama(e); }, { passive: false });
    }

    const promptInputEl = document.getElementById("promptInput");
    if (promptInputEl) {
        promptInputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                ozelPromptKapat(true);
            } else if (e.key === "Escape") {
                e.preventDefault();
                ozelPromptKapat(false);
            }
        });
    }
});


/* =========================================================
   TEMA (KARANLIK MOD)
   ========================================================= */

function temaYukle() {
    const dark = localStorage.getItem("tema") === "dark";
    document.body.classList.toggle("dark-mode", dark);
    temaButonEtiketiGuncelle();
}

function temaDegistir() {
    const isDark = document.body.classList.toggle("dark-mode");
    localStorage.setItem("tema", isDark ? "dark" : "light");
    temaButonEtiketiGuncelle();
}

function temaButonEtiketiGuncelle() {
    const btn = document.getElementById("temaBtn");
    if (!btn) return;
    const isDark = document.body.classList.contains("dark-mode");
    btn.textContent = isDark ? "Aydınlık Mod" : "Karanlık Mod";
}


/* =========================================================
   ROUTER / SAYFA GEÇİŞLERİ
   ========================================================= */

const SAYFA_ELEMAN = {
    "anasayfa": "anasayfa",
    "ayarlar": "ayarlarSayfasi",
    "yillik-ozet": "yillikOzetSayfasi",
    "sablonlar": "sablonSayfasi",
    "gelir-sablonlar": "gelirSablonSayfasi",
    "sablon-duzenle": "sablonDuzenleSayfasi",
    "gelir-sablon-duzenle": "gelirSablonDuzenleSayfasi"
};

const TUM_SAYFALAR = Object.values(SAYFA_ELEMAN);

function sayfaDegistir(sayfaAdi, ekVeri = {}) {
    const stateObj = { sayfa: sayfaAdi, ...ekVeri };
    history.pushState(stateObj, "", `#${sayfaAdi}`);
    routerKontrolu();
}

function tumSayfalariGizle() {
    TUM_SAYFALAR.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("gizli");
    });
}

function routerKontrolu(event) {
    tumSayfalariGizle();

    const state = event && event.state ? event.state : (history.state || null);
    const hash = window.location.hash.replace("#", "");
    let hedefSayfa = state ? state.sayfa : (hash || "anasayfa");

    if (!SAYFA_ELEMAN[hedefSayfa]) hedefSayfa = "anasayfa";

    if (state && state.baslikId) {
        aktifBaslikId = state.baslikId;
        localStorage.setItem("aktifBaslikId", aktifBaslikId);
    } else if (hedefSayfa === "sablonlar" && !aktifBaslikId) {
        aktifBaslikId = localStorage.getItem("aktifBaslikId");
    }

    if (state && state.gelirBaslikId) {
        aktifGelirBaslikId = state.gelirBaslikId;
        localStorage.setItem("aktifGelirBaslikId", aktifGelirBaslikId);
    } else if (hedefSayfa === "gelir-sablonlar" && !aktifGelirBaslikId) {
        aktifGelirBaslikId = localStorage.getItem("aktifGelirBaslikId");
    }

    const hedefElement = document.getElementById(SAYFA_ELEMAN[hedefSayfa]);
    if (hedefElement) hedefElement.classList.remove("gizli");

    if (hedefSayfa === "ayarlar") {
        ayarlariGuncelle();
        temaButonEtiketiGuncelle();
    } else if (hedefSayfa === "yillik-ozet") {
        ozetYili = aktifTarih.getFullYear();
        yillikOzetiGuncelle();
    } else if (hedefSayfa === "sablonlar") {
        const baslik = aktifBaslikId ? baslikBul(aktifBaslikId) : null;
        if (baslik) {
            const baslikEl = document.getElementById("sablonSayfasiBaslik");
            if (baslikEl) baslikEl.textContent = baslik.adi;
            sablonlariGuncelle();
        } else {
            sayfaDegistir("ayarlar");
        }
    } else if (hedefSayfa === "gelir-sablonlar") {
        const baslik = aktifGelirBaslikId ? gelirBaslikBul(aktifGelirBaslikId) : null;
        if (baslik) {
            const baslikEl = document.getElementById("gelirSablonSayfasiBaslik");
            if (baslikEl) baslikEl.textContent = baslik.adi;
            gelirSablonlariGuncelle();
        } else {
            sayfaDegistir("ayarlar");
        }
    } else {
        ekraniGuncelle();
    }
}

function ayarlarAc() { sayfaDegistir("ayarlar"); }
function yillikOzetAc() { sayfaDegistir("yillik-ozet"); }

function aktifSayfaAdi() {
    for (const [ad, id] of Object.entries(SAYFA_ELEMAN)) {
        const el = document.getElementById(id);
        if (el && !el.classList.contains("gizli")) return ad;
    }
    return "anasayfa";
}

function geriGit() {
    const suanki = aktifSayfaAdi();
    let hedefSayfa = "anasayfa";
    let ekVeri = {};

    if (suanki === "sablon-duzenle") {
        hedefSayfa = "sablonlar";
        if (aktifBaslikId) ekVeri.baslikId = aktifBaslikId;
    } else if (suanki === "gelir-sablon-duzenle") {
        hedefSayfa = "gelir-sablonlar";
        if (aktifGelirBaslikId) ekVeri.gelirBaslikId = aktifGelirBaslikId;
    } else if (suanki === "sablonlar" || suanki === "gelir-sablonlar") {
        hedefSayfa = "ayarlar";
    } else {
        hedefSayfa = "anasayfa";
    }

    const stateObj = { sayfa: hedefSayfa, ...ekVeri };
    history.replaceState(stateObj, "", `#${hedefSayfa}`);
    routerKontrolu({ state: stateObj });
}


/* =========================================================
   TARİH YARDIMCILARI
   ========================================================= */

function ayAnahtari(tarih) {
    return `${tarih.getFullYear()}-${String(tarih.getMonth() + 1).padStart(2, "0")}`;
}

function ayBasligi(tarih) {
    return `${AY_ISIMLERI[tarih.getMonth()]} ${tarih.getFullYear()}`;
}

function bugununAyiniKontrolEt() {
    const kaydedilenAy = localStorage.getItem("aktifTarihAnahtar");
    if (kaydedilenAy) {
        const [yil, ay] = kaydedilenAy.split("-");
        aktifTarih = new Date(parseInt(yil), parseInt(ay) - 1, 1);
    } else {
        aktifTarih = new Date();
    }
    ozetYili = aktifTarih.getFullYear();
    aktifAyiOlustur();
}

function aktifAyiOlustur() {
    const anahtar = ayAnahtari(aktifTarih);
    if (!veriler.aylar[anahtar]) {
        veriler.aylar[anahtar] = { gelirler: {}, odemeler: {}, olusturulmaTarihi: new Date().toISOString() };
        kaydet();
    }
    if (!veriler.aylar[anahtar].gelirler) veriler.aylar[anahtar].gelirler = {};
    if (!veriler.aylar[anahtar].odemeler) veriler.aylar[anahtar].odemeler = {};
}


/* =========================================================
   LOCALSTORAGE & VERİ YÖNETİMİ
   ========================================================= */

function verileriYukle() {
    try {
        const kayit = localStorage.getItem(STORAGE_KEY);
        if (kayit) {
            const parsed = JSON.parse(kayit);
            if (parsed && typeof parsed === "object") veriler = parsed;
        }
        const kaydedilenBaslikId = localStorage.getItem("aktifBaslikId");
        if (kaydedilenBaslikId) aktifBaslikId = kaydedilenBaslikId;

        const kaydedilenGelirBaslikId = localStorage.getItem("aktifGelirBaslikId");
        if (kaydedilenGelirBaslikId) aktifGelirBaslikId = kaydedilenGelirBaslikId;
    } catch (hata) {
        console.error("Veriler yüklenemedi:", hata);
    }
    if (!veriler.aylar) veriler.aylar = {};
    if (!veriler.ayarlar) veriler.ayarlar = { gelirBasliklari: [], basliklar: [] };
    if (!Array.isArray(veriler.ayarlar.gelirBasliklari)) veriler.ayarlar.gelirBasliklari = [];
    if (!Array.isArray(veriler.ayarlar.basliklar)) veriler.ayarlar.basliklar = [];
}

function kaydet() {
    try {
        veriler.sonGuncelleme = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(veriler));
        if (aktifBaslikId) localStorage.setItem("aktifBaslikId", aktifBaslikId);
        if (aktifGelirBaslikId) localStorage.setItem("aktifGelirBaslikId", aktifGelirBaslikId);
    } catch (hata) {
        console.error("Kayıt yapılamadı:", hata);
    }
}


/* =========================================================
   FORMATLAMA VE YARDIMCILAR
   ========================================================= */

function parseSayi(deger) {
    if (deger === undefined || deger === null || deger === "") return 0;
    let metin = String(deger).trim();

    if (metin.includes(".") && metin.includes(",")) {
        metin = metin.replace(/\./g, "").replace(",", ".");
    } else if (metin.includes(",")) {
        metin = metin.replace(",", ".");
    } else if (metin.includes(".")) {
        const parcalar = metin.split(".");
        if (parcalar.length === 2 && parcalar[1].length === 3 && parcalar[0].length <= 3) {
            metin = metin.replace(/\./g, "");
        } else if (parcalar.length > 2) {
            metin = metin.replace(/\./g, "");
        }
    }

    const sayi = parseFloat(metin);
    return isNaN(sayi) ? 0 : sayi;
}

function paraFormatla(deger) {
    return parseSayi(deger).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
}

function guvenliMetin(metin) {
    if (!metin) return "";
    return String(metin)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function benzersizId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function baslikBul(id) {
    return veriler.ayarlar.basliklar.find(b => b.id === id);
}

function gelirBaslikBul(id) {
    return veriler.ayarlar.gelirBasliklari.find(b => b.id === id);
}

function aktifAyVerisi() {
    const anahtar = ayAnahtari(aktifTarih);
    if (!veriler.aylar[anahtar]) {
        veriler.aylar[anahtar] = { gelirler: {}, odemeler: {}, olusturulmaTarihi: new Date().toISOString() };
    }
    if (!veriler.aylar[anahtar].gelirler) veriler.aylar[anahtar].gelirler = {};
    if (!veriler.aylar[anahtar].odemeler) veriler.aylar[anahtar].odemeler = {};
    return veriler.aylar[anahtar];
}

function gelirVerisiniGetir(sablonId) {
    const ay = aktifAyVerisi();
    return parseSayi(ay.gelirler[sablonId]);
}

function odemeVerisiniGetir(sablonId) {
    const ay = aktifAyVerisi();
    if (!ay.odemeler[sablonId]) ay.odemeler[sablonId] = {};
    return ay.odemeler[sablonId];
}

function odemeTutariGetir(sablonId) {
    const odeme = odemeVerisiniGetir(sablonId);
    return parseSayi(odeme.odeme);
}


/* =========================================================
   TAKSİT HESAPLAMA MANTIĞI
   ========================================================= */

function taksitliGosterilmeliMi(sablonId, hedefTarih = aktifTarih) {
    const sonuc = giderSablonBilgisiniBul(sablonId);
    if (!sonuc) return true;
    return taksitAktifMi(sonuc.sablon, hedefTarih);
}


/* =========================================================
   AKORDEON
   ========================================================= */

function kategoriToggle(baslikEl) {
    const kart = baslikEl.closest(".kategori-karti");
    if (kart) kart.classList.toggle("kapali");
}


/* =========================================================
   ANA EKRAN
   ========================================================= */

function ekraniGuncelle() {
    aktifAyiOlustur();
    const ayBaslikEl = document.getElementById("ayBasligi");
    if (ayBaslikEl) ayBaslikEl.textContent = ayBasligi(aktifTarih);

    gelirleriOlustur();
    odemeleriOlustur();
    genelToplamiHesapla();
    kalanBorclariGuncelle();
}

function gelirleriOlustur() {
    const alan = document.getElementById("gelirListesi");
    if (!alan) return;
    alan.innerHTML = "";

    const gelirBasliklari = veriler.ayarlar.gelirBasliklari;
    if (gelirBasliklari.length === 0) return;

    gelirBasliklari.forEach(baslik => {
        if (!baslik.sablonlar || baslik.sablonlar.length === 0) return;

        const aktifSablonlar = [...baslik.sablonlar].sort((a, b) => a.adi.localeCompare(b.adi, "tr", { sensitivity: "base" }));
        const toplam = aktifSablonlar.reduce((acc, s) => acc + gelirVerisiniGetir(s.id), 0);

        const kart = document.createElement("section");
        kart.className = "kategori-karti gelir-karti kapali";
        kart.innerHTML = `
            <div class="kategori-baslik" onclick="kategoriToggle(this)">
                <div class="kategori-baslik-isim">${guvenliMetin(baslik.adi)}</div>
                <div class="kategori-baslik-sag">
                    <div class="kategori-toplam" id="gelir-kategori-toplam-${baslik.id}">${paraFormatla(toplam)}</div>
                    <span class="kategori-ok">▼</span>
                </div>
            </div>
            <div class="kategori-icerik" id="gelir-kategori-${baslik.id}"></div>
        `;
        alan.appendChild(kart);

        const satirAlani = kart.querySelector(`#gelir-kategori-${baslik.id}`);
        aktifSablonlar.forEach(sablon => satirAlani.appendChild(gelirSatiriOlustur(sablon)));
    });
}

function gelirSatiriOlustur(sablon) {
    const satir = document.createElement("div");
    satir.className = "kalem-satiri gelir";

    const tutar = gelirVerisiniGetir(sablon.id);
    const val = (d) => guvenliMetin(d !== undefined && d !== null && d !== 0 ? d : "");

    satir.innerHTML = `
        <div class="kalem-ust">
            <span class="kalem-adi">${guvenliMetin(sablon.adi)} <span class="kalem-etiket">/ Gelir</span></span>
        </div>
        <div class="kalem-alanlari">
            <div class="para-kutu">
                <input type="text" inputmode="decimal" value="${val(tutar)}" oninput="gelirGuncelle('${sablon.id}', this.value)" placeholder="Bu Ay Gelir">
                <span class="birim">₺</span>
            </div>
        </div>
    `;
    return satir;
}

function gelirGuncelle(sablonId, deger) {
    const ay = aktifAyVerisi();
    if (!ay.gelirler) ay.gelirler = {};
    ay.gelirler[sablonId] = deger;
    kaydet();
    genelToplamiHesapla();
    gelirKategoriToplamlariniGuncelle();
}

function gelirKategoriToplamlariniGuncelle() {
    veriler.ayarlar.gelirBasliklari.forEach(baslik => {
        if (!baslik.sablonlar) return;
        const toplam = baslik.sablonlar.reduce((acc, s) => acc + gelirVerisiniGetir(s.id), 0);
        const etiket = document.getElementById(`gelir-kategori-toplam-${baslik.id}`);
        if (etiket) etiket.textContent = paraFormatla(toplam);
    });
}

function odemeleriOlustur() {
    const alan = document.getElementById("odemeListesi");
    if (!alan) return;
    alan.innerHTML = "";

    const basliklar = veriler.ayarlar.basliklar;
    if (basliklar.length === 0 && veriler.ayarlar.gelirBasliklari.length === 0) {
        alan.innerHTML = `<div class="bos-mesaj">Henüz başlık yok. Ayarlar bölümünden gelir ve ödeme başlıkları oluşturun.</div>`;
        return;
    }

    basliklar.forEach(baslik => {
        if (!baslik.sablonlar || baslik.sablonlar.length === 0) return;

        const aktifSablonlar = baslik.sablonlar
            .filter(s => !(s.tur === "taksitli" && !taksitliGosterilmeliMi(s.id)))
            .sort((a, b) => a.adi.localeCompare(b.adi, "tr", { sensitivity: "base" }));

        if (aktifSablonlar.length === 0) return;

        const toplam = aktifSablonlar.reduce((acc, s) => acc + odemeTutariGetir(s.id), 0);

        const kart = document.createElement("section");
        kart.className = "kategori-karti gider-karti kapali";
        kart.innerHTML = `
            <div class="kategori-baslik" onclick="kategoriToggle(this)">
                <div class="kategori-baslik-isim">${guvenliMetin(baslik.adi)}</div>
                <div class="kategori-baslik-sag">
                    <div class="kategori-toplam" id="kategori-toplam-${baslik.id}">${paraFormatla(toplam)}</div>
                    <span class="kategori-ok">▼</span>
                </div>
            </div>
            <div class="kategori-icerik" id="kategori-${baslik.id}"></div>
        `;
        alan.appendChild(kart);

        const satirAlani = kart.querySelector(`#kategori-${baslik.id}`);
        aktifSablonlar.forEach(sablon => satirAlani.appendChild(odemeSatiriOlustur(sablon)));
    });
}

function odemeSatiriOlustur(sablon) {
    const satir = document.createElement("div");
    satir.className = "kalem-satiri gider";

    const odeme = odemeVerisiniGetir(sablon.id);
    const val = (d) => guvenliMetin(d !== undefined && d !== null ? d : "");

    let alanlar = "";

    if (sablon.tur === "normal") {
        alanlar = `
            <div class="para-kutu">
                <input type="text" inputmode="decimal" value="${val(odeme.odeme)}" oninput="odemeGuncelle('${sablon.id}', 'odeme', this.value)" placeholder="Bu Ay Ödeme">
                <span class="birim">₺</span>
            </div>`;
    } else if (sablon.tur === "taksitli") {
        const hedefAnahtar = ayAnahtari(aktifTarih);
        let yapilanOdemeSayisi = 0;
        for (const anahtar in veriler.aylar) {
            if (anahtar > hedefAnahtar) continue; // ileriki aylardaki ödemeler bu ayın sayacını etkilemez
            const aVeri = veriler.aylar[anahtar];
            if (parseSayi(aVeri?.odemeler?.[sablon.id]?.odeme) > 0) {
                yapilanOdemeSayisi++;
            }
        }
        
        let kalanTaksitGosterge = (sablon.toplamTaksitSayisi || 0) - yapilanOdemeSayisi;
        if (kalanTaksitGosterge < 0) kalanTaksitGosterge = 0;

        let kalanNetBorc = kalanBorcHesapla(sablon);
        
        let etiketBilgi = `Kalan Taksit: <input type="text" id="taksit-input-${sablon.id}" value="${kalanTaksitGosterge}" style="width:40px; text-align:center; border:none; background:transparent; font-weight:bold;" readonly>`;
        if (kalanTaksitGosterge === 0 && kalanNetBorc > 0) {
            etiketBilgi = `<span style="color:var(--gider); font-weight:bold;">Taksit bitti ama ${paraFormatla(kalanNetBorc)} borç var!</span>`;
        } else if (kalanNetBorc <= 0) {
            etiketBilgi = `<span style="color:green; font-weight:bold;">Borç Bitti 🎉</span>`;
        }

        alanlar = `
            <div class="para-kutu">
                <input type="text" inputmode="decimal" value="${val(odeme.odeme)}" oninput="odemeGuncelle('${sablon.id}', 'odeme', this.value)" placeholder="Örn: ${sablon.taksitTutari || 0} ₺">
                <span class="birim">₺</span>
            </div>
            <div class="para-kutu taksit-kutu" style="display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.03); padding: 0 10px; border-radius: 8px; font-size: 13px;">
                <span>${etiketBilgi}</span>
            </div>`;
    } else if (sablon.tur === "kredikarti") {
        alanlar = `
            <div class="para-kutu">
                <input type="text" inputmode="decimal" value="${val(odeme.odeme)}" oninput="odemeGuncelle('${sablon.id}', 'odeme', this.value)" placeholder="Ödeme">
                <span class="birim">₺</span>
            </div>
            <div class="para-kutu">
                <input type="text" inputmode="decimal" value="${val(odeme.kalanBorc)}" oninput="odemeGuncelle('${sablon.id}', 'kalanBorc', this.value)" placeholder="Kalan Borç">
                <span class="birim">₺</span>
            </div>`;
    }

    satir.innerHTML = `
        <div class="kalem-ust">
            <span class="kalem-adi">${guvenliMetin(sablon.adi)} <span class="kalem-etiket">/ ${sablonTuruAdi(sablon.tur)}</span></span>
        </div>
        <div class="kalem-alanlari">${alanlar}</div>
    `;
    return satir;
}

function taksitAktifMi(sablon, tarih = aktifTarih) {
    if (sablon.tur !== "taksitli") return true;
    if (!sablon.baslangicAy || !sablon.toplamTaksitSayisi) return true;

    const [yil, ay] = sablon.baslangicAy.split("-").map(Number);
    const baslangicZaman = new Date(yil, ay - 1, 1);
    const hedefZaman = new Date(tarih.getFullYear(), tarih.getMonth(), 1);

    const ayFarki = (hedefZaman.getFullYear() - baslangicZaman.getFullYear()) * 12 + (hedefZaman.getMonth() - baslangicZaman.getMonth());

    if (ayFarki < 0) return false;

    if (ayFarki >= sablon.toplamTaksitSayisi) {
        let kalanNetBorc = kalanBorcHesapla(sablon, tarih);
        if (kalanNetBorc <= 0) return false;
    }

    return true;
}

function odemeGuncelle(sablonId, alan, deger) {
    const ay = aktifAyVerisi();
    if (!ay.odemeler[sablonId]) ay.odemeler[sablonId] = {};

    ay.odemeler[sablonId][alan] = deger;

    if (alan === 'odeme') {
        let sablon = giderSablonBilgisiniBul(sablonId);
        if (sablon && sablon.sablon && sablon.sablon.tur === "taksitli") {
            const hedefAnahtar = ayAnahtari(aktifTarih);
            let yapilanOdemeSayisi = 0;
            for (const anahtar in veriler.aylar) {
                if (anahtar > hedefAnahtar) continue; // ileriki aylardaki ödemeler bu ayın sayacını etkilemez
                const aVeri = veriler.aylar[anahtar];
                if (aVeri?.odemeler?.[sablonId]?.odeme !== undefined && String(aVeri.odemeler[sablonId].odeme).trim() !== "" && parseSayi(aVeri.odemeler[sablonId].odeme) > 0) {
                    yapilanOdemeSayisi++;
                }
            }
            
            let toplamTaksit = Number(sablon.sablon.toplamTaksitSayisi) || 0;
            let kalanTaksit = toplamTaksit - yapilanOdemeSayisi;
            if (kalanTaksit < 0) kalanTaksit = 0;

            ay.odemeler[sablonId].kalanTaksit = kalanTaksit;

            const taksitInput = document.getElementById(`taksit-input-${sablonId}`);
            if (taksitInput) {
                taksitInput.value = kalanTaksit;
            }
        }
    }

    kaydet();
    genelToplamiHesapla();
    kalanBorclariGuncelle();
    kategoriToplamlariniGuncelle();
}

function kategoriToplamlariniGuncelle() {
    veriler.ayarlar.basliklar.forEach(baslik => {
        if (!baslik.sablonlar) return;
        const aktifSablonlar = baslik.sablonlar.filter(s => !(s.tur === "taksitli" && !taksitliGosterilmeliMi(s.id)));
        const toplam = aktifSablonlar.reduce((acc, s) => acc + odemeTutariGetir(s.id), 0);
        const etiket = document.getElementById(`kategori-toplam-${baslik.id}`);
        if (etiket) etiket.textContent = paraFormatla(toplam);
    });
}

function genelToplamiHesapla() {
    let toplamGelir = 0;
    veriler.ayarlar.gelirBasliklari.forEach(b => {
        (b.sablonlar || []).forEach(s => { toplamGelir += gelirVerisiniGetir(s.id); });
    });

    let toplamGider = 0;
    veriler.ayarlar.basliklar.forEach(b => {
        (b.sablonlar || []).forEach(s => {
            if (s.tur === "taksitli" && !taksitliGosterilmeliMi(s.id)) return;
            toplamGider += odemeTutariGetir(s.id);
        });
    });

    const netBakiye = toplamGelir - toplamGider;
    const genelToplamEl = document.getElementById("genelToplam");
    if (genelToplamEl) {
        genelToplamEl.innerHTML = `
            <div class="ozet-satir gelir-satir"><span>Gelir</span><span>${paraFormatla(toplamGelir)}</span></div>
            <div class="ozet-satir gider-satir"><span>Gider</span><span>${paraFormatla(toplamGider)}</span></div>
            <div class="ozet-satir net-satir"><span>Net</span><span>${paraFormatla(netBakiye)}</span></div>
        `;
    }
}

function kalanBorcHesapla(sablon, hedefTarih = aktifTarih) {
    if (sablon.tur === "taksitli") {
        const toplamBorc = sablon.toplamBaslangicBorcu || (sablon.taksitTutari * sablon.toplamTaksitSayisi);
        const hedefAnahtar = ayAnahtari(hedefTarih);

        let yapilanToplamOdeme = 0;
        for (const anahtar in veriler.aylar) {
            if (anahtar > hedefAnahtar) continue; // ileriki aylardaki ödemeler bu ayın bakiyesini etkilemez
            const ayVerisi = veriler.aylar[anahtar];
            if (ayVerisi && ayVerisi.odemeler && ayVerisi.odemeler[sablon.id]) {
                yapilanToplamOdeme += parseSayi(ayVerisi.odemeler[sablon.id].odeme);
            }
        }

        const kalanNetBorc = toplamBorc - yapilanToplamOdeme;
        return kalanNetBorc > 0 ? kalanNetBorc : 0;
    }
    
    if (sablon.tur === "kredikarti") {
        const odeme = odemeVerisiniGetir(sablon.id);
        return parseSayi(odeme.kalanBorc);
    }
    return 0;
}

function kalanBorclariGuncelle() {
    const alan = document.getElementById("kalanBorclarListesi");
    if (!alan) return;
    alan.innerHTML = "";
    let toplam = 0;
    let borcVar = false;

    veriler.ayarlar.basliklar.forEach(b => {
        const siraliSablonlar = [...(b.sablonlar || [])].sort((a, b) => a.adi.localeCompare(b.adi, "tr", { sensitivity: "base" }));
        siraliSablonlar.forEach(s => {
            if (s.tur === "taksitli" && !taksitliGosterilmeliMi(s.id)) return;
            const borc = kalanBorcHesapla(s);
            if (borc > 0) {
                borcVar = true;
                toplam += borc;
                const satir = document.createElement("div");
                satir.className = "borc-satiri";
                satir.innerHTML = `<span class="borc-adi">${guvenliMetin(s.adi)}</span><strong class="borc-miktari">${paraFormatla(borc)}</strong>`;
                alan.appendChild(satir);
            }
        });
    });

    if (!borcVar) {
        alan.innerHTML = `<div class="bos-mesaj">Kayıtlı kalan borç bulunmuyor.</div>`;
    }
    const toplamKalanBorcEl = document.getElementById("toplamKalanBorc");
    if (toplamKalanBorcEl) toplamKalanBorcEl.textContent = paraFormatla(toplam);
}


/* =========================================================
   AY DEĞİŞTİRME
   ========================================================= */

function sonrakiAyaGit() {
    aktifTarih.setDate(1);
    aktifTarih.setMonth(aktifTarih.getMonth() + 1);
    localStorage.setItem("aktifTarihAnahtar", ayAnahtari(aktifTarih));
    ekraniGuncelle();
}

function oncekiAyaGit() {
    aktifTarih.setDate(1);
    aktifTarih.setMonth(aktifTarih.getMonth() - 1);
    localStorage.setItem("aktifTarihAnahtar", ayAnahtari(aktifTarih));
    ekraniGuncelle();
}

function buAyaGit() {
    aktifTarih = new Date();
    localStorage.setItem("aktifTarihAnahtar", ayAnahtari(aktifTarih));
    ozetYili = aktifTarih.getFullYear();
    aktifAyiOlustur();
    ekraniGuncelle();
}


/* =========================================================
   AYARLAR VE BAŞLIK YÖNETİMİ
   ========================================================= */

function ayarlariGuncelle() {
    const alan = document.getElementById("basliklarListesi");
    if (!alan) return;
    alan.innerHTML = "";

    const gelirBasliklari = veriler.ayarlar.gelirBasliklari;
    const giderBasliklari = veriler.ayarlar.basliklar;

    let html = `
        <div class="grup-baslik">
            <h3 class="gelir-h">Gelir Başlıkları</h3>
            <button class="mini-ekle gelir-bg" onclick="gelirBaslikEkle()" aria-label="Gelir başlığı ekle">＋</button>
        </div>
    `;

    if (gelirBasliklari.length === 0) {
        html += `<div class="bos-mesaj gelir">Henüz gelir başlığı oluşturulmadı.</div>`;
    } else {
        gelirBasliklari.forEach(b => {
            const sayi = b.sablonlar ? b.sablonlar.length : 0;
            html += `
                <div class="baslik-satiri gelir">
                    <div class="baslik-bilgi">
                        <div class="baslik-adi">${guvenliMetin(b.adi)}</div>
                        <div class="baslik-sablon-sayisi">${sayi} gelir kalemi</div>
                    </div>
                    <div class="satir-butonlari">
                        <button class="kucuk-btn" onclick="gelirSablonSayfasiniAc('${b.id}')" aria-label="Kalemleri yönet">⚙</button>
                        <button class="kucuk-btn" onclick="gelirBaslikDuzenle('${b.id}')" aria-label="Düzenle">✎</button>
                        <button class="kucuk-btn sil" onclick="gelirBaslikSil('${b.id}')" aria-label="Sil">🗑</button>
                    </div>
                </div>
            `;
        });
    }

    html += `
        <div class="grup-baslik" style="margin-top:20px;">
            <h3 class="gider-h">Gider Başlıkları</h3>
            <button class="mini-ekle gider-bg" onclick="baslikEkle()" aria-label="Gider başlığı ekle">＋</button>
        </div>
    `;

    if (giderBasliklari.length === 0) {
        html += `<div class="bos-mesaj gider">Henüz ödeme başlığı bulunmuyor.</div>`;
    } else {
        giderBasliklari.forEach(b => {
            const sayi = b.sablonlar ? b.sablonlar.length : 0;
            html += `
                <div class="baslik-satiri gider">
                    <div class="baslik-bilgi">
                        <div class="baslik-adi">${guvenliMetin(b.adi)}</div>
                        <div class="baslik-sablon-sayisi">${sayi} ödeme kalemi</div>
                    </div>
                    <div class="satir-butonlari">
                        <button class="kucuk-btn" onclick="sablonSayfasiniAc('${b.id}')" aria-label="Kalemleri yönet">⚙</button>
                        <button class="kucuk-btn" onclick="baslikDuzenle('${b.id}')" aria-label="Düzenle">✎</button>
                        <button class="kucuk-btn sil" onclick="baslikSil('${b.id}')" aria-label="Sil">🗑</button>
                    </div>
                </div>
            `;
        });
    }

    alan.innerHTML = html;
}

function gelirBaslikEkle() {
    gosterOzelPrompt("Yeni Gelir Başlığı:", "", (ad) => {
        if (!ad || !ad.trim()) return;
        veriler.ayarlar.gelirBasliklari.push({ id: benzersizId(), adi: ad.trim(), sablonlar: [] });
        kaydet();
        ayarlariGuncelle();
    });
}

function gelirBaslikDuzenle(id) {
    const baslik = gelirBaslikBul(id);
    if (!baslik) return;
    gosterOzelPrompt("Gelir başlık adını değiştirin:", baslik.adi, (yeniAd) => {
        if (!yeniAd || !yeniAd.trim()) return;
        baslik.adi = yeniAd.trim();
        kaydet();
        ayarlariGuncelle();
    });
}

function gelirBaslikSil(id) {
    const baslik = gelirBaslikBul(id);
    if (!baslik) return;
    if (!confirm(`"${baslik.adi}" gelir başlığını ve içindeki tüm kalemleri silmek istediğinize emin misiniz?`)) return;
    veriler.ayarlar.gelirBasliklari = veriler.ayarlar.gelirBasliklari.filter(b => b.id !== id);
    if (aktifGelirBaslikId === id) aktifGelirBaslikId = null;
    kaydet();
    ayarlariGuncelle();
}

function baslikEkle() {
    gosterOzelPrompt("Yeni Gider Başlığı:", "", (ad) => {
        if (!ad || !ad.trim()) return;
        veriler.ayarlar.basliklar.push({ id: benzersizId(), adi: ad.trim(), sablonlar: [] });
        kaydet();
        ayarlariGuncelle();
    });
}

function baslikDuzenle(id) {
    const baslik = baslikBul(id);
    if (!baslik) return;
    gosterOzelPrompt("Başlık adını değiştirin:", baslik.adi, (yeniAd) => {
        if (!yeniAd || !yeniAd.trim()) return;
        baslik.adi = yeniAd.trim();
        kaydet();
        ayarlariGuncelle();
    });
}

function baslikSil(id) {
    const baslik = baslikBul(id);
    if (!baslik) return;
    if (!confirm(`"${baslik.adi}" başlığını ve içindeki tüm kalemleri silmek istediğinize emin misiniz?`)) return;
    veriler.ayarlar.basliklar = veriler.ayarlar.basliklar.filter(b => b.id !== id);
    if (aktifBaslikId === id) aktifBaslikId = null;
    kaydet();
    ayarlariGuncelle();
}


/* =========================================================
   GİDER ŞABLON YÖNETİMİ
   ========================================================= */

function sablonSayfasiniAc(baslikId) {
    const baslik = baslikBul(baslikId);
    if (!baslik) return;
    aktifBaslikId = baslikId;
    localStorage.setItem("aktifBaslikId", baslikId);
    sayfaDegistir("sablonlar", { baslikId });
}

function sablonlariGuncelle() {
    const alan = document.getElementById("sablonlarListesi");
    if (!alan) return;
    alan.innerHTML = "";
    const baslik = baslikBul(aktifBaslikId);
    if (!baslik || !baslik.sablonlar || baslik.sablonlar.length === 0) {
        alan.innerHTML = `<div class="bos-mesaj">Henüz ödeme kalemi oluşturulmadı.<br>＋ düğmesine basarak ekleyebilirsiniz.</div>`;
        return;
    }

    const siraliSablonlar = [...baslik.sablonlar].sort((a, b) => a.adi.localeCompare(b.adi, "tr", { sensitivity: "base" }));
    siraliSablonlar.forEach(s => {
        const satir = document.createElement("div");
        satir.className = "sablon-satiri";
        satir.innerHTML = `
            <div class="baslik-bilgi">
                <div class="sablon-adi">${guvenliMetin(s.adi)}</div>
                <div class="sablon-turu">${sablonTuruAdi(s.tur)}</div>
            </div>
            <div class="satir-butonlari">
                <button class="kucuk-btn" onclick="sablonDuzenle('${s.id}')" aria-label="Düzenle">✎</button>
                <button class="kucuk-btn sil" onclick="sablonSil('${s.id}')" aria-label="Sil">🗑</button>
            </div>
        `;
        alan.appendChild(satir);
    });
}

function sablonEkle() {
    duzenlenenSablonId = null;
    const inputEl = document.getElementById("sablonAdiInput");
    if (inputEl) inputEl.value = "";
    const turEl = document.getElementById("sablonTuruInput");
    if (turEl) turEl.value = "normal";
    sayfaDegistir("sablon-duzenle");
}

function sablonDuzenle(sablonId) {
    const baslik = baslikBul(aktifBaslikId);
    if (!baslik) return;
    const sablon = baslik.sablonlar.find(s => s.id === sablonId);
    if (!sablon) return;

    duzenlenenSablonId = sablonId;
    const inputEl = document.getElementById("sablonAdiInput");
    if (inputEl) inputEl.value = sablon.adi;
    const turEl = document.getElementById("sablonTuruInput");
    if (turEl) turEl.value = sablon.tur;
    sayfaDegistir("sablon-duzenle");
}

function sablonKaydet() {
    const baslik = baslikBul(aktifBaslikId);
    if (!baslik) return;
    const inputEl = document.getElementById("sablonAdiInput");
    const turEl = document.getElementById("sablonTuruInput");
    if (!inputEl) return;
    const ad = inputEl.value.trim();
    const tur = turEl ? turEl.value : "normal";

    if (!ad) {
        alert("Lütfen şablon adını yazın.");
        return;
    }

    // Düzenleme modundaysak ve kalem zaten taksitliyse, mevcut kayıtlı
    // değerleri varsayılan olarak kullan; böylece sadece ismi/türü
    // değiştirmek isteyen kullanıcı taksit bilgilerini kaybetmez.
    const mevcutSablon = duzenlenenSablonId ? baslik.sablonlar.find(s => s.id === duzenlenenSablonId) : null;
    const mevcutTaksitli = mevcutSablon && mevcutSablon.tur === "taksitli" ? mevcutSablon : null;

    let ekBilgiler = {};
    if (tur === "taksitli") {
        const varsayilanBaslangicAy = mevcutTaksitli?.baslangicAy || ayAnahtari(aktifTarih);
        const varsayilanTutar = mevcutTaksitli?.taksitTutari !== undefined ? String(mevcutTaksitli.taksitTutari) : "10000";
        const varsayilanSayi = mevcutTaksitli?.toplamTaksitSayisi !== undefined ? String(mevcutTaksitli.toplamTaksitSayisi) : "6";

        gosterOzelPrompt("Hangi aydan başlıyor? (Örn: 2026-08):", varsayilanBaslangicAy, (baslangicAyInput) => {
            if (!baslangicAyInput) return;

            const baslangicAyTemiz = baslangicAyInput.trim();
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(baslangicAyTemiz)) {
                alert("Lütfen ayı YYYY-AA formatında girin. Örn: 2026-08");
                return;
            }

            setTimeout(() => {
                gosterOzelPrompt("Aylık taksit tutarı ne kadar?:", varsayilanTutar, (taksitTutariInput) => {
                    if (!taksitTutariInput) return;

                    setTimeout(() => {
                        gosterOzelPrompt("Toplam taksit sayısı kaç?:", varsayilanSayi, (taksitSayisiInput) => {
                            if (!taksitSayisiInput) return;

                            const aylikTutar = parseSayi(taksitTutariInput);
                            const toplamTaksit = parseInt(taksitSayisiInput);

                            if (aylikTutar <= 0 || isNaN(toplamTaksit) || toplamTaksit <= 0) {
                                alert("Lütfen geçerli bir taksit tutarı ve sayısı girin.");
                                return;
                            }

                            ekBilgiler = {
                                baslangicAy: baslangicAyTemiz,
                                taksitTutari: aylikTutar,
                                toplamTaksitSayisi: toplamTaksit,
                                toplamBaslangicBorcu: aylikTutar * toplamTaksit
                            };

                            sablonKaydetDevam(baslik, ad, tur, ekBilgiler);
                        });
                    }, 100);
                });
            }, 100);
        });
        return;
    }

    sablonKaydetDevam(baslik, ad, tur, ekBilgiler);
}

function sablonKaydetDevam(baslik, ad, tur, ekBilgiler) {
    if (!baslik.sablonlar) baslik.sablonlar = [];

    if (!duzenlenenSablonId) {
        baslik.sablonlar.push({ id: benzersizId(), adi: ad, tur: tur, ...ekBilgiler });
    } else {
        const sablon = baslik.sablonlar.find(s => s.id === duzenlenenSablonId);
        if (sablon) {
            sablon.adi = ad;
            sablon.tur = tur;
            if (tur === "taksitli") {
                Object.assign(sablon, ekBilgiler);
            } else {
                delete sablon.baslangicAy;
                delete sablon.taksitTutari;
                delete sablon.toplamTaksitSayisi;
                delete sablon.toplamBaslangicBorcu;
            }
        }
    }

    kaydet();
    duzenlenenSablonId = null;
    geriGit();
}

function sablonSil(sablonId) {
    const baslik = baslikBul(aktifBaslikId);
    if (!baslik) return;
    const sablon = baslik.sablonlar.find(s => s.id === sablonId);
    if (!sablon || !confirm(`"${sablon.adi}" ödeme kalemini silmek istediğinize emin misiniz?`)) return;

    baslik.sablonlar = baslik.sablonlar.filter(s => s.id !== sablonId);
    kaydet();
    sablonlariGuncelle();
}

function sablonTuruAdi(tur) {
    if (tur === "taksitli") return "Taksitli Borç";
    if (tur === "kredikarti") return "Kredi Kartı";
    return "Normal Ödeme";
}


/* =========================================================
   GELİR ŞABLON YÖNETİMİ
   ========================================================= */

function gelirSablonSayfasiniAc(baslikId) {
    const baslik = gelirBaslikBul(baslikId);
    if (!baslik) return;
    aktifGelirBaslikId = baslikId;
    localStorage.setItem("aktifGelirBaslikId", baslikId);
    sayfaDegistir("gelir-sablonlar", { gelirBaslikId: baslikId });
}

function gelirSablonlariGuncelle() {
    const alan = document.getElementById("gelirSablonlarListesi");
    if (!alan) return;
    alan.innerHTML = "";
    const baslik = gelirBaslikBul(aktifGelirBaslikId);
    if (!baslik || !baslik.sablonlar || baslik.sablonlar.length === 0) {
        alan.innerHTML = `<div class="bos-mesaj">Henüz gelir kalemi oluşturulmadı.<br>＋ düğmesine basarak ekleyebilirsiniz.</div>`;
        return;
    }

    const siraliSablonlar = [...baslik.sablonlar].sort((a, b) => a.adi.localeCompare(b.adi, "tr", { sensitivity: "base" }));
    siraliSablonlar.forEach(s => {
        const satir = document.createElement("div");
        satir.className = "sablon-satiri";
        satir.innerHTML = `
            <div class="baslik-bilgi">
                <div class="sablon-adi">${guvenliMetin(s.adi)}</div>
                <div class="sablon-turu gelir">Gelir Kalemi</div>
            </div>
            <div class="satir-butonlari">
                <button class="kucuk-btn" onclick="gelirSablonDuzenle('${s.id}')" aria-label="Düzenle">✎</button>
                <button class="kucuk-btn sil" onclick="gelirSablonSil('${s.id}')" aria-label="Sil">🗑</button>
            </div>
        `;
        alan.appendChild(satir);
    });
}

function gelirSablonEkle() {
    duzenlenenGelirSablonId = null;
    const inputEl = document.getElementById("gelirSablonAdiInput");
    if (inputEl) inputEl.value = "";
    sayfaDegistir("gelir-sablon-duzenle");
}

function gelirSablonDuzenle(sablonId) {
    const baslik = gelirBaslikBul(aktifGelirBaslikId);
    if (!baslik) return;
    const sablon = baslik.sablonlar.find(s => s.id === sablonId);
    if (!sablon) return;

    duzenlenenGelirSablonId = sablonId;
    const inputEl = document.getElementById("gelirSablonAdiInput");
    if (inputEl) inputEl.value = sablon.adi;
    sayfaDegistir("gelir-sablon-duzenle");
}

function gelirSablonKaydet() {
    const baslik = gelirBaslikBul(aktifGelirBaslikId);
    if (!baslik) return;
    const inputEl = document.getElementById("gelirSablonAdiInput");
    if (!inputEl) return;
    const ad = inputEl.value.trim();

    if (!ad) {
        alert("Lütfen gelir kalemi adını yazın.");
        return;
    }

    if (!baslik.sablonlar) baslik.sablonlar = [];

    if (!duzenlenenGelirSablonId) {
        baslik.sablonlar.push({ id: benzersizId(), adi: ad });
    } else {
        const sablon = baslik.sablonlar.find(s => s.id === duzenlenenGelirSablonId);
        if (sablon) sablon.adi = ad;
    }

    kaydet();
    duzenlenenGelirSablonId = null;
    geriGit();
}

function gelirSablonSil(sablonId) {
    const baslik = gelirBaslikBul(aktifGelirBaslikId);
    if (!baslik) return;
    const sablon = baslik.sablonlar.find(s => s.id === sablonId);
    if (!sablon || !confirm(`"${sablon.adi}" gelir kalemini silmek istediğinize emin misiniz?`)) return;

    baslik.sablonlar = baslik.sablonlar.filter(s => s.id !== sablonId);
    kaydet();
    gelirSablonlariGuncelle();
}


/* =========================================================
   YEDEKLEME VE VERİ YÖNETİMİ
   ========================================================= */

function jsonDisariAktar() {
    kaydet();
    const blob = new Blob([JSON.stringify(veriler, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ButceTakip_Yedek_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function jsonIceriAktarAc() {
    document.getElementById("jsonFileInput")?.click();
}

function jsonYapisiGecerliMi(v) {
    if (!v || typeof v !== "object" || Array.isArray(v)) return false;
    if (!v.aylar || typeof v.aylar !== "object" || Array.isArray(v.aylar)) return false;

    for (const anahtar in v.aylar) {
        const ay = v.aylar[anahtar];
        if (!ay || typeof ay !== "object" || Array.isArray(ay)) return false;
        if (ay.gelirler !== undefined && (typeof ay.gelirler !== "object" || Array.isArray(ay.gelirler))) return false;
        if (ay.odemeler !== undefined && (typeof ay.odemeler !== "object" || Array.isArray(ay.odemeler))) return false;
    }

    if (v.ayarlar !== undefined) {
        if (typeof v.ayarlar !== "object" || Array.isArray(v.ayarlar)) return false;
        if (v.ayarlar.gelirBasliklari !== undefined && !Array.isArray(v.ayarlar.gelirBasliklari)) return false;
        if (v.ayarlar.basliklar !== undefined && !Array.isArray(v.ayarlar.basliklar)) return false;
    }

    return true;
}

function jsonIceriAktar(event) {
    const dosya = event.target.files[0];
    if (!dosya) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const yeniVeriler = JSON.parse(e.target.result);
            if (!jsonYapisiGecerliMi(yeniVeriler)) {
                throw new Error("Geçersiz dosya yapısı");
            }

            if (confirm("Mevcut verilerinizin üzerine yedek dosyasındaki veriler yüklenecek. Devam etmek istiyor musunuz?")) {
                const oncekiVeriler = veriler;
                const oncekiAktifBaslikId = aktifBaslikId;
                const oncekiAktifGelirBaslikId = aktifGelirBaslikId;
                try {
                    veriler = yeniVeriler;
                    if (!veriler.aylar) veriler.aylar = {};
                    if (!veriler.ayarlar) veriler.ayarlar = { gelirBasliklari: [], basliklar: [] };
                    if (!veriler.ayarlar.gelirBasliklari) veriler.ayarlar.gelirBasliklari = [];
                    if (!veriler.ayarlar.basliklar) veriler.ayarlar.basliklar = [];

                    localStorage.removeItem("aktifBaslikId");
                    localStorage.removeItem("aktifGelirBaslikId");
                    aktifBaslikId = null;
                    aktifGelirBaslikId = null;
                    kaydet();
                    aktifTarih = new Date();
                    sayfaDegistir("anasayfa");
                    alert("Veriler başarıyla geri yüklendi.");
                } catch (uygulamaHatasi) {
                    console.error("Yedek uygulanırken hata:", uygulamaHatasi);
                    veriler = oncekiVeriler;
                    aktifBaslikId = oncekiAktifBaslikId;
                    aktifGelirBaslikId = oncekiAktifGelirBaslikId;
                    kaydet();
                    try { sayfaDegistir("anasayfa"); } catch (_) { /* ekran önceki durumda kalır */ }
                    alert("Yedek dosyası uygulanırken bir sorun oluştu. Önceki verileriniz korundu, hiçbir şey değişmedi.");
                }
            }
        } catch {
            alert("JSON dosyası geçersiz veya bozuk.");
        }
        event.target.value = "";
    };
    reader.readAsText(dosya, "UTF-8");
}

function tumVerileriSil() {
    if (!confirm("DİKKAT!\n\nBütün gelir-gider başlıkları, şablonlar ve geçmiş veriler silinecek. Devam etmek istiyor musunuz?")) return;
    if (!confirm("Bu işlem geri alınamaz. Emin misiniz?")) return;

    veriler = { ayarlar: { gelirBasliklari: [], basliklar: [] }, aylar: {}, sonGuncelleme: null };
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("aktifBaslikId");
    localStorage.removeItem("aktifGelirBaslikId");
    aktifTarih = new Date();
    aktifBaslikId = null;
    aktifGelirBaslikId = null;
    duzenlenenSablonId = null;
    duzenlenenGelirSablonId = null;
    kaydet();
    sayfaDegistir("anasayfa");
}


/* =========================================================
   YILLIK ÖZET VE PASTA GRAFİK
   ========================================================= */

function yillikOzetiGuncelle() {
    const ozetYiliEl = document.getElementById("ozetYili");
    if (ozetYiliEl) ozetYiliEl.textContent = ozetYili;
    const aylikAlan = document.getElementById("aylikOzetListesi");
    const kategoriAlan = document.getElementById("kategoriOzetListesi");
    if (!aylikAlan || !kategoriAlan) return;
    aylikAlan.innerHTML = "";
    kategoriAlan.innerHTML = "";

    let yillikToplamGider = 0;
    let yillikToplamGelir = 0;
    const kategoriToplamlari = {};

    for (let ay = 0; ay < 12; ay++) {
        const anahtar = `${ozetYili}-${String(ay + 1).padStart(2, "0")}`;
        const ayVerisi = veriler.aylar[anahtar];
        let aylikGider = 0;
        let aylikGelir = 0;

        if (ayVerisi) {
            Object.keys(ayVerisi.odemeler || {}).forEach(sablonId => {
                const bilgi = giderSablonBilgisiniBul(sablonId);
                if (!bilgi) return;
                const tutar = parseSayi(ayVerisi.odemeler[sablonId]?.odeme);
                aylikGider += tutar;
                kategoriToplamlari[bilgi.baslik.adi] = (kategoriToplamlari[bilgi.baslik.adi] || 0) + tutar;
            });

            Object.keys(ayVerisi.gelirler || {}).forEach(sablonId => {
                aylikGelir += parseSayi(ayVerisi.gelirler[sablonId]);
            });
        }

        yillikToplamGider += aylikGider;
        yillikToplamGelir += aylikGelir;

        const netAy = aylikGelir - aylikGider;
        const satir = document.createElement("div");
        satir.className = "ozet-ay-satiri";
        satir.innerHTML = `<span class="ozet-ay-adi">${AY_ISIMLERI[ay]}</span><strong class="ozet-ay-tutari" style="color:${netAy >= 0 ? "var(--gelir)" : "var(--gider)"}">${paraFormatla(netAy)}</strong>`;
        aylikAlan.appendChild(satir);
    }

    const yillikToplamEl = document.getElementById("yillikToplam");
    if (yillikToplamEl) {
        yillikToplamEl.innerHTML = `
            <span style="font-size:13px; color:var(--gelir);">Gelir: ${paraFormatla(yillikToplamGelir)}</span> &nbsp;|&nbsp;
            <span style="font-size:13px; color:var(--gider);">Gider: ${paraFormatla(yillikToplamGider)}</span>
        `;
    }

    const kategoriler = Object.keys(kategoriToplamlari);
    if (kategoriler.length === 0) {
        kategoriAlan.innerHTML = `<div class="bos-mesaj">Bu yıl henüz gider kaydı bulunmuyor.</div>`;
    } else {
        kategoriler.forEach(kategori => {
            const satir = document.createElement("div");
            satir.className = "kategori-ozet-satiri";
            satir.innerHTML = `<span class="kategori-ozet-adi">${guvenliMetin(kategori)}</span><strong class="kategori-ozet-tutari">${paraFormatla(kategoriToplamlari[kategori])}</strong>`;
            kategoriAlan.appendChild(satir);
        });
    }

    pastaGrafikCiz(kategoriToplamlari);
}

function pastaGrafikCiz(kategoriToplamlari) {
    const canvas = document.getElementById("pastaCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const entries = Object.entries(kategoriToplamlari).filter(([, v]) => v > 0);
    const total = entries.reduce((sum, [, val]) => sum + val, 0);

    const detayEl = document.getElementById("grafikDetay");

    if (total === 0) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Bu yıl veri yok", canvas.width / 2, canvas.height / 2);
        window.pastaDilimleri = [];
        if (detayEl) detayEl.textContent = "Grafikteki bir dilime dokunarak detayı görebilirsiniz.";
        return;
    }

    let startAngle = -Math.PI / 2;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 75;

    window.pastaDilimleri = [];
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

    entries.forEach(([kategori, deger], index) => {
        const sliceAngle = (deger / total) * (Math.PI * 2);
        const endAngle = startAngle + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();

        const color = colors[index % colors.length];
        ctx.fillStyle = color;
        ctx.fill();

        window.pastaDilimleri.push({
            kategori, deger,
            yuzde: ((deger / total) * 100).toFixed(1),
            startAngle, endAngle, color
        });

        startAngle = endAngle;
    });
}

function pastaTiklama(e) {
    const canvas = document.getElementById("pastaCanvas");
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const olcekX = canvas.width / rect.width;
    const olcekY = canvas.height / rect.height;

    const point = e.touches ? e.touches[0] : e;
    const x = (point.clientX - rect.left) * olcekX - canvas.width / 2;
    const y = (point.clientY - rect.top) * olcekY - canvas.height / 2;

    const distance = Math.sqrt(x * x + y * y);
    if (distance > 75) return;

    let angle = Math.atan2(y, x);
    const normalize = (a) => { while (a < -Math.PI / 2) a += Math.PI * 2; while (a >= Math.PI * 1.5) a -= Math.PI * 2; return a; };
    angle = normalize(angle);

    const clickedSlice = (window.pastaDilimleri || []).find(s => angle >= s.startAngle && angle <= s.endAngle);
    const detayEl = document.getElementById("grafikDetay");

    if (clickedSlice && detayEl) {
        detayEl.innerHTML = `<span style="color:${clickedSlice.color};">■</span> ${guvenliMetin(clickedSlice.kategori)}: <strong>${paraFormatla(clickedSlice.deger)}</strong> (Toplamın %${clickedSlice.yuzde}'i)`;
    }
}

function giderSablonBilgisiniBul(sablonId) {
    for (const baslik of veriler.ayarlar.basliklar) {
        if (!baslik.sablonlar) continue;
        const sablon = baslik.sablonlar.find(s => s.id === sablonId);
        if (sablon) return { baslik, sablon };
    }
    return null;
}

function ozetYilAzalt() {
    ozetYili--;
    yillikOzetiGuncelle();
}

function ozetYilArtir() {
    ozetYili++;
    yillikOzetiGuncelle();
}

let aktifPromptCallback = null;

function gosterOzelPrompt(baslikText, varsayilanDeger = "", callback) {
    const modal = document.getElementById("ozelPromptModal");
    const baslikEl = document.getElementById("promptBaslik");
    const inputEl = document.getElementById("promptInput");
    
    if (!modal || !inputEl) {
        callback(prompt(baslikText, varsayilanDeger));
        return;
    }

    baslikEl.textContent = baslikText;
    inputEl.value = varsayilanDeger;
    modal.classList.remove("gizli");
    
    setTimeout(() => {
        inputEl.focus();
        inputEl.select();
    }, 50);

    aktifPromptCallback = callback;
}

function ozelPromptKapat(onaylandi) {
    const modal = document.getElementById("ozelPromptModal");
    const inputEl = document.getElementById("promptInput");
    
    modal.classList.add("gizli");
    
    const cb = aktifPromptCallback;
    aktifPromptCallback = null;
    
    if (onaylandi && cb) {
        cb(inputEl.value);
    }
}


/* =========================================================
   OTOMATİK AY KONTROLÜ
   ========================================================= */

function otomatikAyKontrolu() {
    const gercekTarih = new Date();
    const kaydedilenAy = localStorage.getItem("aktifTarihAnahtar");

    if (!kaydedilenAy || kaydedilenAy === ayAnahtari(gercekTarih)) {
        if (ayAnahtari(aktifTarih) !== ayAnahtari(gercekTarih)) {
            aktifTarih = gercekTarih;
            aktifAyiOlustur();
            if (aktifSayfaAdi() === "anasayfa") ekraniGuncelle();
        }
    }
}

setInterval(otomatikAyKontrolu, 60 * 1000);
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") otomatikAyKontrolu();
});
