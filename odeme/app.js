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

function anaSayfayaDon() { sayfaDegistir("anasayfa"); }
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
    const ayAnahtarStr = ayAnahtari(hedefTarih);
    const ayVerisi = veriler.aylar[ayAnahtarStr];

    if (ayVerisi && ayVerisi.odemeler && ayVerisi.odemeler[sablonId] && ayVerisi.odemeler[sablonId].kalanTaksit !== undefined && ayVerisi.odemeler[sablonId].kalanTaksit !== "" && ayVerisi.odemeler[sablonId].kalanTaksit !== null) {
        return true;
    }

    let hicGecmisYok = true;
    for (const anahtar in veriler.aylar) {
        const ayD = veriler.aylar[anahtar];
        if (ayD && ayD.odemeler && ayD.odemeler[sablonId] && ayD.odemeler[sablonId].kalanTaksit !== undefined && ayD.odemeler[sablonId].kalanTaksit !== "" && ayD.odemeler[sablonId].kalanTaksit !== null) {
            hicGecmisYok = false;
            break;
        }
    }
    if (hicGecmisYok) return true;

    let tarihObj = new Date(hedefTarih.getFullYear(), hedefTarih.getMonth(), 1);
    for (let i = 1; i <= 120; i++) {
        tarihObj.setMonth(tarihObj.getMonth() - 1);
        const prevAnahtarStr = ayAnahtari(tarihObj);
        const prevAyVerisi = veriler.aylar[prevAnahtarStr];

        if (prevAyVerisi && prevAyVerisi.odemeler && prevAyVerisi.odemeler[sablonId] && prevAyVerisi.odemeler[sablonId].kalanTaksit !== undefined && prevAyVerisi.odemeler[sablonId].kalanTaksit !== "" && prevAyVerisi.odemeler[sablonId].kalanTaksit !== null) {
            const baseVal = parseSayi(prevAyVerisi.odemeler[sablonId].kalanTaksit);
            return i <= baseVal;
        }
    }
    return false;
}

function etkinKalanTaksitGetir(sablonId, tarih = aktifTarih) {
    const hedefZaman = new Date(tarih.getFullYear(), tarih.getMonth(), 1);
    const ayAnahtarStr = ayAnahtari(hedefZaman);
    const ayVerisi = veriler.aylar[ayAnahtarStr];

    if (ayVerisi && ayVerisi.odemeler && ayVerisi.odemeler[sablonId] && ayVerisi.odemeler[sablonId].kalanTaksit !== undefined && ayVerisi.odemeler[sablonId].kalanTaksit !== "" && ayVerisi.odemeler[sablonId].kalanTaksit !== null) {
        return parseSayi(ayVerisi.odemeler[sablonId].kalanTaksit);
    }

    let tarihObj = new Date(hedefZaman.getFullYear(), hedefZaman.getMonth(), 1);
    let gecenAySayisi = 0;

    for (let i = 1; i <= 120; i++) {
        tarihObj.setMonth(tarihObj.getMonth() - 1);
        gecenAySayisi++;
        const prevAnahtarStr = ayAnahtari(tarihObj);
        const prevAyVerisi = veriler.aylar[prevAnahtarStr];

        if (prevAyVerisi && prevAyVerisi.odemeler && prevAyVerisi.odemeler[sablonId] && prevAyVerisi.odemeler[sablonId].kalanTaksit !== undefined && prevAyVerisi.odemeler[sablonId].kalanTaksit !== "" && prevAyVerisi.odemeler[sablonId].kalanTaksit !== null) {
            const baseVal = parseSayi(prevAyVerisi.odemeler[sablonId].kalanTaksit);
            const hesaplananTaksit = baseVal - gecenAySayisi;
            return hesaplananTaksit >= 0 ? hesaplananTaksit : 0;
        }
    }
    return 0;
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
    const val = (d) => (d !== undefined && d !== null && d !== 0 ? d : "");

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
    const val = (d) => (d !== undefined && d !== null ? d : "");

    let alanlar = "";

    if (sablon.tur === "normal") {
        alanlar = `
            <div class="para-kutu">
                <input type="text" inputmode="decimal" value="${val(odeme.odeme)}" oninput="odemeGuncelle('${sablon.id}', 'odeme', this.value)" placeholder="Bu Ay Ödeme">
                <span class="birim">₺</span>
            </div>`;
    } else if (sablon.tur === "taksitli") {
        let gosterilecekTaksit = odeme.kalanTaksit;
        if (gosterilecekTaksit === undefined || gosterilecekTaksit === "" || gosterilecekTaksit === null) {
            let hasHistory = false;
            for (const anahtar in veriler.aylar) {
                const ayVerisi = veriler.aylar[anahtar];
                if (ayVerisi && ayVerisi.odemeler && ayVerisi.odemeler[sablon.id] && ayVerisi.odemeler[sablon.id].kalanTaksit !== undefined && ayVerisi.odemeler[sablon.id].kalanTaksit !== "" && ayVerisi.odemeler[sablon.id].kalanTaksit !== null) {
                    hasHistory = true;
                    break;
                }
            }
            gosterilecekTaksit = hasHistory ? etkinKalanTaksitGetir(sablon.id) : "";
        }
        alanlar = `
            <div class="para-kutu">
                <input type="text" inputmode="decimal" value="${val(odeme.odeme)}" oninput="odemeGuncelle('${sablon.id}', 'odeme', this.value)" placeholder="Taksit Tutarı">
                <span class="birim">₺</span>
            </div>
            <div class="para-kutu taksit-kutu">
                <input type="text" inputmode="decimal" value="${val(gosterilecekTaksit)}" oninput="odemeGuncelle('${sablon.id}', 'kalanTaksit', this.value)" placeholder="Kalan Taksit">
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

function odemeGuncelle(sablonId, alan, deger) {
    const ay = aktifAyVerisi();
    if (!ay.odemeler[sablonId]) ay.odemeler[sablonId] = {};
    ay.odemeler[sablonId][alan] = deger;
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

function gecmisTaksitTutariniBul(sablonId) {
    for (const anahtar in veriler.aylar) {
        const ay = veriler.aylar[anahtar];
        if (ay?.odemeler?.[sablonId]?.odeme) {
            const tutar = parseSayi(ay.odemeler[sablonId].odeme);
            if (tutar > 0) return tutar;
        }
    }
    return 0;
}

function kalanBorcHesapla(sablon) {
    const odeme = odemeVerisiniGetir(sablon.id);
    if (sablon.tur === "taksitli") {
        const kalanTaksit = etkinKalanTaksitGetir(sablon.id);
        if (kalanTaksit <= 0) return 0;
        let taksitTutari = parseSayi(odeme.odeme);
        if (taksitTutari === 0) taksitTutari = gecmisTaksitTutariniBul(sablon.id);
        return kalanTaksit * taksitTutari;
    }
    if (sablon.tur === "kredikarti") {
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
    const ad = prompt("Yeni gelir başlığı (Örn: Maaşlar, Ek Gelir):");
    if (!ad || !ad.trim()) return;
    veriler.ayarlar.gelirBasliklari.push({ id: benzersizId(), adi: ad.trim(), sablonlar: [] });
    kaydet();
    ayarlariGuncelle();
}

function gelirBaslikDuzenle(id) {
    const baslik = gelirBaslikBul(id);
    if (!baslik) return;
    const yeniAd = prompt("Gelir başlık adını değiştirin:", baslik.adi);
    if (yeniAd === null || !yeniAd.trim()) return;
    baslik.adi = yeniAd.trim();
    kaydet();
    ayarlariGuncelle();
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
    const ad = prompt("Yeni gider başlığı (Örn: Faturalar, Harcamalar):");
    if (!ad || !ad.trim()) return;
    veriler.ayarlar.basliklar.push({ id: benzersizId(), adi: ad.trim(), sablonlar: [] });
    kaydet();
    ayarlariGuncelle();
}

function baslikDuzenle(id) {
    const baslik = baslikBul(id);
    if (!baslik) return;
    const yeniAd = prompt("Başlık adını değiştirin:", baslik.adi);
    if (yeniAd === null || !yeniAd.trim()) return;
    baslik.adi = yeniAd.trim();
    kaydet();
    ayarlariGuncelle();
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

    if (!baslik.sablonlar) baslik.sablonlar = [];

    if (!duzenlenenSablonId) {
        baslik.sablonlar.push({ id: benzersizId(), adi: ad, tur: tur });
    } else {
        const sablon = baslik.sablonlar.find(s => s.id === duzenlenenSablonId);
        if (sablon) {
            sablon.adi = ad;
            sablon.tur = tur;
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

function jsonIceriAktar(event) {
    const dosya = event.target.files[0];
    if (!dosya) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const yeniVeriler = JSON.parse(e.target.result);
            if (!yeniVeriler || typeof yeniVeriler !== "object" || !yeniVeriler.ayarlar || !yeniVeriler.aylar) {
                throw new Error("Geçersiz dosya yapısı");
            }

            if (confirm("Mevcut verilerinizin üzerine yedek dosyasındaki veriler yüklenecek. Devam etmek istiyor musunuz?")) {
                veriler = yeniVeriler;
                if (!veriler.aylar) veriler.aylar = {};
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

document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("pastaCanvas");
    if (canvas) {
        canvas.addEventListener("click", pastaTiklama);
        canvas.addEventListener("touchstart", (e) => { e.preventDefault(); pastaTiklama(e); }, { passive: false });
    }
});

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
