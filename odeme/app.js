/* =========================================================
   ÖDEME VE BÜTÇE TAKİP - TEK DOSYA ANA JAVASCRIPT (GÜNCELLENMİŞ)
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
   BAŞLANGIÇ VE GÜVENLİK KONTROLLERİ
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    verileriYukle();
    bugununAyiniKontrolEt();
    fazlalikButonlariTemizle();
    
    window.addEventListener("popstate", routerKontrolu);
    
    if (!history.state) {
        history.replaceState({ sayfa: "anasayfa" }, "", "#anasayfa");
    }
    routerKontrolu();
});

function fazlalikButonlariTemizle() {
    // İstenmeyen ödeme ekleme veya mor butonları gizle
    const butonlar = document.querySelectorAll("button, .purple-btn, [class*='purple']");
    butonlar.forEach(btn => {
        const bg = window.getComputedStyle(btn).backgroundColor;
        if ((btn.innerText.includes("+") && !btn.classList.contains("kucuk-btn")) || 
            bg.includes("rgb(147, 51") || bg.includes("rgb(126, 34") || bg.includes("purple")) {
            const onclickAttr = btn.getAttribute("onclick") || "";
            if (!onclickAttr.toLowerCase().includes("baslikekle") && !onclickAttr.includes("Ekle")) {
                btn.style.display = "none";
            }
        }
    });
}

function sayfaDegistir(sayfaAdi, ekVeri = {}) {
    const stateObj = { sayfa: sayfaAdi, ...ekVeri };
    history.pushState(stateObj, "", `#${sayfaAdi}`);
    routerKontrolu();
}

function routerKontrolu(event) {
    tumSayfalariGizle();
    const state = event && event.state ? event.state : (history.state || null);
    const hash = window.location.hash.replace("#", "");
    
    let hedefSayfa = state ? state.sayfa : (hash || "anasayfa");

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

    let hedefElement = document.getElementById(
        hedefSayfa === "ayarlar" ? "ayarlarSayfasi" :
        hedefSayfa === "yillik-ozet" ? "yillikOzetSayfasi" :
        hedefSayfa === "sablonlar" ? "sablonSayfasi" :
        hedefSayfa === "gelir-sablonlar" ? "gelirSablonSayfasi" :
        hedefSayfa === "sablon-duzenle" ? "sablonDuzenleSayfasi" :
        hedefSayfa === "gelir-sablon-duzenle" ? "gelirSablonDuzenleSayfasi" : "anasayfa"
    );

    if (!hedefElement && hedefSayfa !== "anasayfa") {
        hedefElement = document.createElement("div");
        hedefElement.id = (
            hedefSayfa === "ayarlar" ? "ayarlarSayfasi" :
            hedefSayfa === "yillik-ozet" ? "yillikOzetSayfasi" :
            hedefSayfa === "sablonlar" ? "sablonSayfasi" :
            hedefSayfa === "gelir-sablonlar" ? "gelirSablonSayfasi" :
            hedefSayfa === "sablon-duzenle" ? "sablonDuzenleSayfasi" :
            hedefSayfa === "gelir-sablon-duzenle" ? "gelirSablonDuzenleSayfasi" : "dinamikSayfa"
        );
        hedefElement.style.cssText = "padding: 16px; background: #fff; min-height: 100vh; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 9999; overflow-y: auto;";
        
        if (hedefSayfa === "gelir-sablonlar") {
            hedefElement.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                    <button onclick="geriGit()" style="background:#f3f4f6; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:600;">← Geri</button>
                    <h2 id="gelirSablonSayfasiBaslik" style="font-size: 16px; margin:0; color:#065f46;">Gelir Kalemleri</h2>
                    <button onclick="gelirSablonEkle()" style="background:#10b981; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:600;">+ Yeni</button>
                </div>
                <div id="gelirSablonlarListesi"></div>
            `;
        } else if (hedefSayfa === "gelir-sablon-duzenle") {
            hedefElement.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                    <button onclick="geriGit()" style="background:#f3f4f6; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:600;">← Geri</button>
                    <h2 style="font-size: 16px; margin:0; color:#065f46;">Gelir Kalemi Düzenle</h2>
                    <div></div>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px; max-width: 400px; margin: 0 auto;">
                    <label style="font-size:13px; font-weight:600; color:#374151;">Gelir Kalemi Adı</label>
                    <input id="gelirSablonAdiInput" type="text" style="padding:10px; border:1px solid #d1d5db; border-radius:6px; font-size:14px;" placeholder="Örn: Ek İş, Kira">
                    <button onclick="gelirSablonKaydet()" style="background:#10b981; color:#fff; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer; margin-top:8px;">Kaydet</button>
                </div>
            `;
        } else if (hedefSayfa === "sablonlar") {
            hedefElement.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                    <button onclick="geriGit()" style="background:#f3f4f6; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:600;">← Geri</button>
                    <h2 id="sablonSayfasiBaslik" style="font-size: 16px; margin:0;">Ödeme Kalemleri</h2>
                    <button onclick="sablonEkle()" style="background:#3b82f6; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:600;">+ Yeni</button>
                </div>
                <div id="sablonlarListesi"></div>
            `;
        } else if (hedefSayfa === "sablon-duzenle") {
            hedefElement.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                    <button onclick="geriGit()" style="background:#f3f4f6; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:600;">← Geri</button>
                    <h2 style="font-size: 16px; margin:0;">Ödeme Kalemi Düzenle</h2>
                    <div></div>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px; max-width: 400px; margin: 0 auto;">
                    <label style="font-size:13px; font-weight:600; color:#374151;">Kalem Adı</label>
                    <input id="sablonAdiInput" type="text" style="padding:10px; border:1px solid #d1d5db; border-radius:6px; font-size:14px;" placeholder="Örn: Elektrik">
                    <label style="font-size:13px; font-weight:600; color:#374151;">Ödeme Türü</label>
                    <select id="sablonTuruInput" style="padding:10px; border:1px solid #d1d5db; border-radius:6px; font-size:14px;">
                        <option value="normal">Normal Ödeme</option>
                        <option value="taksitli">Taksitli Borç</option>
                        <option value="kredikarti">Kredi Kartı</option>
                    </select>
                    <button onclick="sablonKaydet()" style="background:#3b82f6; color:#fff; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer; margin-top:8px;">Kaydet</button>
                </div>
            `;
        }
        document.body.appendChild(hedefElement);
    }

    if (hedefElement) {
        hedefElement.classList.remove("gizli");
        hedefElement.style.display = "block";
    }

    if (hedefSayfa === "ayarlar") {
        ayarlariGuncelle();
    } else if (hedefSayfa === "yillik-ozet") {
        ozetYili = aktifTarih.getFullYear();
        yillikOzetiGuncelle();
    } else if (hedefSayfa === "sablonlar") {
        if (aktifBaslikId) {
            const baslik = baslikBul(aktifBaslikId);
            if (baslik) {
                const baslikEl = document.getElementById("sablonSayfasiBaslik");
                if (baslikEl) baslikEl.textContent = baslik.adi;
                sablonlariGuncelle();
            } else {
                sayfaDegistir("ayarlar");
            }
        } else {
            sayfaDegistir("ayarlar");
        }
    } else if (hedefSayfa === "gelir-sablonlar") {
        if (aktifGelirBaslikId) {
            const baslik = gelirBaslikBul(aktifGelirBaslikId);
            if (baslik) {
                const baslikEl = document.getElementById("gelirSablonSayfasiBaslik");
                if (baslikEl) baslikEl.textContent = baslik.adi;
                gelirSablonlariGuncelle();
            } else {
                sayfaDegistir("ayarlar");
            }
        } else {
            sayfaDegistir("ayarlar");
        }
    } else {
        ekraniGuncelle();
    }
}

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
   SAYFA GEÇİŞLERİ VE GERİ DÖNÜŞ
   ========================================================= */

function tumSayfalariGizle() {
    ["anasayfa", "ayarlarSayfasi", "sablonSayfasi", "gelirSablonSayfasi", "sablonDuzenleSayfasi", "gelirSablonDuzenleSayfasi", "yillikOzetSayfasi"]
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.add("gizli");
                if (id !== "anasayfa" && el.style.position === "fixed") {
                    el.style.display = "none";
                }
            }
        });
}

function anaSayfayaDon() {
    sayfaDegistir("anasayfa");
}

function ayarlarAc() {
    sayfaDegistir("ayarlar");
}

function yillikOzetAc() {
    sayfaDegistir("yillik-ozet");
}

function geriGit() {
    const sablonDuzenle = document.getElementById("sablonDuzenleSayfasi");
    const gelirSablonDuzenle = document.getElementById("gelirSablonDuzenleSayfasi");
    const sablonSayfasi = document.getElementById("sablonSayfasi");
    const gelirSablonSayfasi = document.getElementById("gelirSablonSayfasi");
    const ayarlarSayfasi = document.getElementById("ayarlarSayfasi");
    const yillikOzetSayfasi = document.getElementById("yillikOzetSayfasi");

    let hedefSayfa = "anasayfa";
    let ekVeri = {};

    if (sablonDuzenle && !sablonDuzenle.classList.contains("gizli") && sablonDuzenle.style.display !== "none") {
        hedefSayfa = "sablonlar";
        if (aktifBaslikId) ekVeri.baslikId = aktifBaslikId;
    } else if (gelirSablonDuzenle && !gelirSablonDuzenle.classList.contains("gizli") && gelirSablonDuzenle.style.display !== "none") {
        hedefSayfa = "gelir-sablonlar";
        if (aktifGelirBaslikId) ekVeri.gelirBaslikId = aktifGelirBaslikId;
    } else if (sablonSayfasi && !sablonSayfasi.classList.contains("gizli") && sablonSayfasi.style.display !== "none") {
        hedefSayfa = "ayarlar";
    } else if (gelirSablonSayfasi && !gelirSablonSayfasi.classList.contains("gizli") && gelirSablonSayfasi.style.display !== "none") {
        hedefSayfa = "ayarlar";
    } else if (ayarlarSayfasi && !ayarlarSayfasi.classList.contains("gizli") && ayarlarSayfasi.style.display !== "none") {
        hedefSayfa = "anasayfa";
    } else if (yillikOzetSayfasi && !yillikOzetSayfasi.classList.contains("gizli") && yillikOzetSayfasi.style.display !== "none") {
        hedefSayfa = "anasayfa";
    }

    const stateObj = { sayfa: hedefSayfa, ...ekVeri };
    history.replaceState(stateObj, "", `#${hedefSayfa}`);
    routerKontrolu({ state: stateObj });
}

/* =========================================================
   FORMATLAMA VE YARDIMCILAR
   ========================================================= */

function parseSayi(deger) {
    if (deger === undefined || deger === null || deger === "") return 0;
    let sayi = parseFloat(String(deger).replace(",", "."));
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
    return parseSayi(odeme.odeme) || parseSayi(odeme.kalanBorc);
}

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
    const ayAnahtarStr = ayAnahtari(tarih);
    const ayVerisi = veriler.aylar[ayAnahtarStr];
    
    if (ayVerisi && ayVerisi.odemeler && ayVerisi.odemeler[sablonId] && ayVerisi.odemeler[sablonId].kalanTaksit !== undefined && ayVerisi.odemeler[sablonId].kalanTaksit !== "" && ayVerisi.odemeler[sablonId].kalanTaksit !== null) {
        return parseSayi(ayVerisi.odemeler[sablonId].kalanTaksit);
    }

    let tarihObj = new Date(tarih.getFullYear(), tarih.getMonth(), 1);
    for (let i = 1; i <= 120; i++) {
        tarihObj.setMonth(tarihObj.getMonth() - 1);
        const prevAnahtarStr = ayAnahtari(tarihObj);
        const prevAyVerisi = veriler.aylar[prevAnahtarStr];
        
        if (prevAyVerisi && prevAyVerisi.odemeler && prevAyVerisi.odemeler[sablonId] && prevAyVerisi.odemeler[sablonId].kalanTaksit !== undefined && prevAyVerisi.odemeler[sablonId].kalanTaksit !== "" && prevAyVerisi.odemeler[sablonId].kalanTaksit !== null) {
            const baseVal = parseSayi(prevAyVerisi.odemeler[sablonId].kalanTaksit);
            const calcVal = baseVal - i;
            return calcVal >= 0 ? calcVal : 0;
        }
    }
    return 0;
}

/* =========================================================
   ANA EKRAN VE GÜNCELLEME
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

/* --- GELİR LİSTESİ OLUŞTURMA --- */
function gelirleriOlustur() {
    const alan = document.getElementById("gelirListesi") || gelirListesiKutusuOlustur();
    if (!alan) return;
    alan.innerHTML = "";
    const gelirBasliklari = veriler.ayarlar.gelirBasliklari;

    if (gelirBasliklari.length === 0) {
        alan.innerHTML = `<div class="ayar-karti" style="padding:10px; background:#f0fdf4; border-radius:6px; text-align:center; color:#047857; margin-bottom:10px;">Henüz gelir başlığı bulunmuyor</div>`;
        return;
    }

    gelirBasliklari.forEach(baslik => {
        if (!baslik.sablonlar || baslik.sablonlar.length === 0) return;

        const aktifSablonlar = [...baslik.sablonlar].sort((a, b) => a.adi.localeCompare(b.adi, 'tr', { sensitivity: 'base' }));
        let toplam = aktifSablonlar.reduce((acc, s) => acc + gelirVerisiniGetir(s.id), 0);

        const kart = document.createElement("section");
        kart.className = "kategori-karti";
        kart.style.cssText = "border-left: 4px solid #10b981; background:#fff; padding:10px; border-radius:6px; margin-bottom:10px; box-shadow:0 1px 2px rgba(0,0,0,0.04);";
        kart.innerHTML = `
            <div class="kategori-baslik" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div class="kategori-baslik-isim" style="color: #065f46; font-weight:bold;">🟢 ${guvenliMetin(baslik.adi)}</div>
                <div class="kategori-toplam" id="gelir-kategori-toplam-${baslik.id}" style="color: #059669; font-weight:bold;">${paraFormatla(toplam)}</div>
            </div>
            <div id="gelir-kategori-${baslik.id}"></div>
        `;
        alan.appendChild(kart);

        const satirAlani = kart.querySelector(`#gelir-kategori-${baslik.id}`);
        aktifSablonlar.forEach(sablon => {
            satirAlani.appendChild(gelirSatiriOlustur(sablon));
        });
    });
}

function gelirListesiKutusuOlustur() {
    const odemeListesi = document.getElementById("odemeListesi");
    if (!odemeListesi || !odemeListesi.parentNode) return null;
    
    let gelirKutusu = document.getElementById("gelirListesi");
    if (!gelirKutusu) {
        gelirKutusu = document.createElement("div");
        gelirKutusu.id = "gelirListesi";
        odemeListesi.parentNode.insertBefore(gelirKutusu, odemeListesi);
    }
    return gelirKutusu;
}

function gelirSatiriOlustur(sablon) {
    const satir = document.createElement("div");
    satir.className = "odeme-satiri";
    satir.style.cssText = "background: #f0fdf4; padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; border: 1px solid #d1fae5;";
    
    const tutar = gelirVerisiniGetir(sablon.id);
    const val = (d) => (d !== undefined && d !== null && d !== 0 ? d : "");

    satir.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 13px;">
            <span style="font-weight: 600; color: #065f46;">${guvenliMetin(sablon.adi)} <span style="font-weight: normal; color: #047857; font-size: 11px;">/ Gelir</span></span>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
            <div style="flex: 1; display: flex; align-items: center; background: #fff; border: 1px solid #a7f3d0; border-radius: 4px; padding: 2px 6px;">
                <input style="border: none; background: transparent; width: 100%; outline: none; font-size: 13px;" type="text" inputmode="decimal" value="${val(tutar)}" oninput="gelirGuncelle('${sablon.id}', this.value)" placeholder="Bu Ay Gelir">
                <span style="color: #059669; font-size: 12px; margin-left: 4px;">₺</span>
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
        const aktifSablonlar = [...baslik.sablonlar].sort((a, b) => a.adi.localeCompare(b.adi, 'tr', { sensitivity: 'base' }));
        let toplam = aktifSablonlar.reduce((acc, s) => acc + gelirVerisiniGetir(s.id), 0);
        const etiket = document.getElementById(`gelir-kategori-toplam-${baslik.id}`);
        if (etiket) etiket.textContent = paraFormatla(toplam);
    });
}

/* --- ÖDEME LİSTESİ OLUŞTURMA --- */
function odemeleriOlustur() {
    const alan = document.getElementById("odemeListesi");
    if (!alan) return;
    alan.innerHTML = "";
    const basliklar = veriler.ayarlar.basliklar;

    if (basliklar.length === 0) {
        alan.innerHTML = `<div class="ayar-karti" style="padding:10px; background:#fef2f2; border-radius:6px; text-align:center; color:#b91c1c;">Henüz ödeme başlığı bulunmuyor.</div>`;
        return;
    }

    basliklar.forEach(baslik => {
        if (!baslik.sablonlar || baslik.sablonlar.length === 0) return;

        const aktifSablonlar = baslik.sablonlar.filter(s => {
            if (s.tur === "taksitli" && !taksitliGosterilmeliMi(s.id)) return false;
            return true;
        }).sort((a, b) => a.adi.localeCompare(b.adi, 'tr', { sensitivity: 'base' }));

        if (aktifSablonlar.length === 0) return;

        let toplam = aktifSablonlar.reduce((acc, s) => acc + odemeTutariGetir(s.id), 0);
        const kart = document.createElement("section");
        kart.className = "kategori-karti";
        kart.style.cssText = "background:#fff; padding:10px; border-radius:6px; margin-bottom:10px; box-shadow:0 1px 2px rgba(0,0,0,0.04); border-left:4px solid #ef4444;";
        kart.innerHTML = `
            <div class="kategori-baslik" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div class="kategori-baslik-isim" style="color:#b91c1c; font-weight:bold;">🔴 ${guvenliMetin(baslik.adi)}</div>
                <div class="kategori-toplam" id="kategori-toplam-${baslik.id}" style="color:#b91c1c; font-weight:bold;">${paraFormatla(toplam)}</div>
            </div>
            <div id="kategori-${baslik.id}"></div>
        `;
        alan.appendChild(kart);

        const satirAlani = kart.querySelector(`#kategori-${baslik.id}`);
        aktifSablonlar.forEach(sablon => {
            satirAlani.appendChild(odemeSatiriOlustur(sablon));
        });
    });
}

function odemeSatiriOlustur(sablon) {
    const satir = document.createElement("div");
    satir.className = "odeme-satiri";
    satir.style.cssText = "background: #f9fafb; padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; border:1px solid #e5e7eb;";
    
    const odeme = odemeVerisiniGetir(sablon.id);
    const val = (d) => (d !== undefined && d !== null ? d : "");

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 13px;">
            <span style="font-weight: 600; color: #333;">${guvenliMetin(sablon.adi)} <span style="font-weight: normal; color: #777; font-size: 11px;">/ ${sablonTuruAdi(sablon.tur)}</span></span>
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
    `;

    if (sablon.tur === "normal") {
        html += `
            <div style="flex: 1; display: flex; align-items: center; background: #fff; border: 1px solid #ddd; border-radius: 4px; padding: 2px 6px;">
                <input style="border: none; background: transparent; width: 100%; outline: none; font-size: 13px;" type="text" inputmode="decimal" value="${val(odeme.odeme)}" oninput="odemeGuncelle('${sablon.id}', 'odeme', this.value)" placeholder="Bu Ay Ödeme">
                <span style="color: #888; font-size: 12px; margin-left: 4px;">₺</span>
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
        html += `
            <div style="flex: 1; display: flex; align-items: center; background: #fff; border: 1px solid #ddd; border-radius: 4px; padding: 2px 6px;">
                <input style="border: none; background: transparent; width: 100%; outline: none; font-size: 13px;" type="text" inputmode="decimal" value="${val(odeme.odeme)}" oninput="odemeGuncelle('${sablon.id}', 'odeme', this.value)" placeholder="Bu Ay Ödeme">
                <span style="color: #888; font-size: 12px; margin-left: 4px;">₺</span>
            </div>
            <div style="width: 100px; display: flex; align-items: center; background: #fff; border: 1px solid #ddd; border-radius: 4px; padding: 2px 6px;">
                <input style="border: none; background: transparent; width: 100%; outline: none; font-size: 13px; text-align: center;" type="text" inputmode="decimal" value="${val(gosterilecekTaksit)}" oninput="odemeGuncelle('${sablon.id}', 'kalanTaksit', this.value)" placeholder="Kalan Taksit">
            </div>`;
    } else if (sablon.tur === "kredikarti") {
        html += `
            <div style="flex: 1; display: flex; align-items: center; background: #fff; border: 1px solid #ddd; border-radius: 4px; padding: 2px 6px;">
                <input style="border: none; background: transparent; width: 100%; outline: none; font-size: 13px;" type="text" inputmode="decimal" value="${val(odeme.odeme)}" oninput="odemeGuncelle('${sablon.id}', 'odeme', this.value)" placeholder="Bu Ay Ödeme">
                <span style="color: #888; font-size: 12px; margin-left: 4px;">₺</span>
            </div>
            <div style="flex: 1; display: flex; align-items: center; background: #fff; border: 1px solid #ddd; border-radius: 4px; padding: 2px 6px;">
                <input style="border: none; background: transparent; width: 100%; outline: none; font-size: 13px;" type="text" inputmode="decimal" value="${val(odeme.kalanBorc)}" oninput="odemeGuncelle('${sablon.id}', 'kalanBorc', this.value)" placeholder="Kalan Borç">
                <span style="color: #888; font-size: 12px; margin-left: 4px;">₺</span>
            </div>`;
    }

    html += `</div>`;
    satir.innerHTML = html;
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
        const aktifSablonlar = baslik.sablonlar.filter(s => {
            if (s.tur === "taksitli" && !taksitliGosterilmeliMi(s.id)) return false;
            return true;
        }).sort((a, b) => a.adi.localeCompare(b.adi, 'tr', { sensitivity: 'base' }));
        let toplam = aktifSablonlar.reduce((acc, s) => acc + odemeTutariGetir(s.id), 0);
        const etiket = document.getElementById(`kategori-toplam-${baslik.id}`);
        if (etiket) etiket.textContent = paraFormatla(toplam);
    });
}

function genelToplamiHesapla() {
    let toplamGelir = 0;
    veriler.ayarlar.gelirBasliklari.forEach(b => {
        (b.sablonlar || []).forEach(s => {
            toplamGelir += gelirVerisiniGetir(s.id);
        });
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
            <div style="font-size: 12px; color: #10b981; font-weight: 600;">Gelir: ${paraFormatla(toplamGelir)}</div>
            <div style="font-size: 12px; color: #ef4444; font-weight: 600;">Gider: ${paraFormatla(toplamGider)}</div>
            <div style="font-size: 14px; color: ${netBakiye >= 0 ? '#10b981' : '#ef4444'}; font-weight: bold; margin-top: 2px; border-top: 1px dashed #ddd; padding-top: 2px;">Net: ${paraFormatla(netBakiye)}</div>
        `;
    }
}

function kalanBorcHesapla(sablon) {
    const odeme = odemeVerisiniGetir(sablon.id);
    if (sablon.tur === "taksitli") {
        const kalanTaksit = etkinKalanTaksitGetir(sablon.id);
        if (kalanTaksit <= 0) return 0;
        return kalanTaksit * parseSayi(odeme.odeme);
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
        const siraliSablonlar = [...(b.sablonlar || [])].sort((a, b) => a.adi.localeCompare(b.adi, 'tr', { sensitivity: 'base' }));
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

function oncekiAyaGit() {
    aktifTarih.setMonth(aktifTarih.getMonth() - 1);
    localStorage.setItem("aktifTarihAnahtar", ayAnahtari(aktifTarih));
    aktifAyiOlustur();
    ekraniGuncelle();
}

function sonrakiAyaGit() {
    aktifTarih.setMonth(aktifTarih.getMonth() + 1);
    localStorage.setItem("aktifTarihAnahtar", ayAnahtari(aktifTarih));
    aktifAyiOlustur();
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
   AYARLAR VE BAŞLIK YÖNETİMİ (GELİR + GİDER)
   ========================================================= */

function ayarlariGuncelle() {
    const alan = document.getElementById("basliklarListesi");
    if (!alan) return;
    alan.innerHTML = "";

    const gelirBasliklari = veriler.ayarlar.gelirBasliklari;
    const giderBasliklari = veriler.ayarlar.basliklar;

    let html = `
        <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h3 style="font-size: 15px; color: #10b981; margin: 0;">🟢 Gelir Başlıkları</h3>
                <button class="kucuk-btn" onclick="gelirBaslikEkle()" style="background: #10b981; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight:bold;">+</button>
            </div>
    `;

    if (gelirBasliklari.length === 0) {
        html += `<div class="bos-mesaj" style="padding: 10px; background: #f0fdf4; border-radius: 6px; text-align: center; color: #047857; font-size: 13px;">Henüz gelir başlığı oluşturulmadı.</div>`;
    } else {
        gelirBasliklari.forEach(b => {
            const sayi = b.sablonlar ? b.sablonlar.length : 0;
            html += `
                <div class="baslik-ayarlari-satiri" style="display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; border-left: 4px solid #10b981; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
                    <div class="baslik-bilgi">
                        <div class="baslik-adi" style="font-weight: 600; font-size: 13px; color: #065f46;">${guvenliMetin(b.adi)}</div>
                        <div class="baslik-sablon-sayisi" style="font-size: 11px; color: #047857;">${sayi} gelir kalemi</div>
                    </div>
                    <div class="satir-butonlari" style="display: flex; gap: 4px;">
                        <button class="kucuk-btn" onclick="gelirSablonSayfasiniAc('${b.id}')" style="background:#f3f4f6; border:1px solid #d1d5db; padding:4px 8px; border-radius:4px; cursor:pointer;">⚙️</button>
                        <button class="kucuk-btn" onclick="gelirBaslikDuzenle('${b.id}')" style="background:#f3f4f6; border:1px solid #d1d5db; padding:4px 8px; border-radius:4px; cursor:pointer;">✏️</button>
                        <button class="kucuk-btn sil" onclick="gelirBaslikSil('${b.id}')" style="background:#fee2e2; border:1px solid #fecaca; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑️</button>
                    </div>
                </div>
            `;
        });
    }
    html += `</div>`;

    html += `
        <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h3 style="font-size: 15px; color: #374151; margin: 0;">🔴 Ödeme (Gider) Başlıkları</h3>
                <button class="kucuk-btn" onclick="baslikEkle()" style="background: #ef4444; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight:bold;">+</button>
            </div>
    `;

    if (giderBasliklari.length === 0) {
        html += `<div class="bos-mesaj" style="padding: 10px; background: #fef2f2; border-radius: 6px; text-align: center; color: #b91c1c; font-size: 13px;">Henüz ödeme başlığı bulunmuyor.</div>`;
    } else {
        giderBasliklari.forEach(b => {
            const sayi = b.sablonlar ? b.sablonlar.length : 0;
            html += `
                <div class="baslik-ayarlari-satiri" style="display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; border-left: 4px solid #ef4444; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
                    <div class="baslik-bilgi">
                        <div class="baslik-adi" style="font-weight: 600; font-size: 13px; color: #1f2937;">${guvenliMetin(b.adi)}</div>
                        <div class="baslik-sablon-sayisi" style="font-size: 11px; color: #6b7280;">${sayi} ödeme kalemi</div>
                    </div>
                    <div class="satir-butonlari" style="display: flex; gap: 4px;">
                        <button class="kucuk-btn" onclick="sablonSayfasiniAc('${b.id}')" style="background:#f3f4f6; border:1px solid #d1d5db; padding:4px 8px; border-radius:4px; cursor:pointer;">⚙️</button>
                        <button class="kucuk-btn" onclick="baslikDuzenle('${b.id}')" style="background:#f3f4f6; border:1px solid #d1d5db; padding:4px 8px; border-radius:4px; cursor:pointer;">✏️</button>
                        <button class="kucuk-btn sil" onclick="baslikSil('${b.id}')" style="background:#fee2e2; border:1px solid #fecaca; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑️</button>
                    </div>
                </div>
            `;
        });
    }
    html += `</div>`;

    alan.innerHTML = html;
}

/* Gelir Başlık İşlemleri */
function gelirBaslikEkle() {
    const ad = prompt("Yeni gelir başlığının adını yazın (Örn: Maaşlar, Ek Gelir):");
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

/* Gider Başlık İşlemleri */
function baslikEkle() {
    const ad = prompt("Yeni ödeme (gider) başlığının adını yazın (Örn: Faturalar, Harcamalar):");
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
   ŞABLON YÖNETİMİ (GİDER)
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
        alan.innerHTML = `<div class="bos-mesaj" style="padding:15px; text-align:center; color:#6b7280;">Henüz ödeme kalemi oluşturulmadı.<br>＋ düğmesine basarak ekleyebilirsiniz.</div>`;
        return;
    }

    const siraliSablonlar = [...baslik.sablonlar].sort((a, b) => a.adi.localeCompare(b.adi, 'tr', { sensitivity: 'base' }));

    siraliSablonlar.forEach(s => {
        const satir = document.createElement("div");
        satir.className = "sablon-satiri";
        satir.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#fff; padding:10px; border-radius:6px; margin-bottom:8px; border:1px solid #e5e7eb;";
        satir.innerHTML = `
            <div class="sablon-bilgi">
                <div class="sablon-adi" style="font-weight:600; color:#1f2937;">${guvenliMetin(s.adi)}</div>
                <div class="sablon-turu" style="font-size:11px; color:#6b7280;">${sablonTuruAdi(s.tur)}</div>
            </div>
            <div class="satir-butonlari" style="display:flex; gap:4px;">
                <button class="kucuk-btn" onclick="sablonDuzenle('${s.id}')" style="background:#f3f4f6; border:1px solid #d1d5db; padding:4px 8px; border-radius:4px; cursor:pointer;">✏️</button>
                <button class="kucuk-btn sil" onclick="sablonSil('${s.id}')" style="background:#fee2e2; border:1px solid #fecaca; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑️</button>
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
        alan.innerHTML = `<div class="bos-mesaj" style="padding:15px; text-align:center; color:#6b7280;">Henüz gelir kalemi oluşturulmadı.<br>＋ düğmesine basarak ekleyebilirsiniz.</div>`;
        return;
    }

    const siraliSablonlar = [...baslik.sablonlar].sort((a, b) => a.adi.localeCompare(b.adi, 'tr', { sensitivity: 'base' }));

    siraliSablonlar.forEach(s => {
        const satir = document.createElement("div");
        satir.className = "sablon-satiri";
        satir.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#fff; padding:10px; border-radius:6px; margin-bottom:8px; border:1px solid #e5e7eb;";
        satir.innerHTML = `
            <div class="sablon-bilgi">
                <div class="sablon-adi" style="font-weight:600; color:#1f2937;">${guvenliMetin(s.adi)}</div>
                <div class="sablon-turu" style="color: #10b981; font-size:11px;">Gelir Kalemi</div>
            </div>
            <div class="satir-butonlari" style="display:flex; gap:4px;">
                <button class="kucuk-btn" onclick="gelirSablonDuzenle('${s.id}')" style="background:#f3f4f6; border:1px solid #d1d5db; padding:4px 8px; border-radius:4px; cursor:pointer;">✏️</button>
                <button class="kucuk-btn sil" onclick="gelirSablonSil('${s.id}')" style="background:#fee2e2; border:1px solid #fecaca; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑️</button>
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
        if (sablon) {
            sablon.adi = ad;
        }
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
            if (!yeniVeriler || !yeniVeriler.ayarlar) throw new Error();

            if (confirm("Mevcut verilerinizin üzerine yedek dosyasındaki veriler yüklenecek. Devam etmek istiyor musunuz?")) {
                veriler = yeniVeriler;
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

                const odemeKayiari = ayVerisi.odemeler[sablonId];
                const tutar = parseSayi(odemeKayiari?.odeme) || parseSayi(odemeKayiari?.kalanBorc);
                aylikGider += tutar;
                kategoriToplamlari[bilgi.baslik.adi] = (kategoriToplamlari[bilgi.baslik.adi] || 0) + tutar;
            });

            Object.keys(ayVerisi.gelirler || {}).forEach(sablonId => {
                const tutar = parseSayi(ayVerisi.gelirler[sablonId]);
                aylikGelir += tutar;
            });
        }

        yillikToplamGider += aylikGider;
        yillikToplamGelir += aylikGelir;

        const satir = document.createElement("div");
        satir.className = "ozet-ay-satiri";
        satir.innerHTML = `<span class="ozet-ay-adi">${AY_ISIMLERI[ay]}</span><strong class="ozet-ay-tutari" style="color: ${aylikGelir - aylikGider >= 0 ? '#10b981' : '#ef4444'}">${paraFormatla(aylikGelir - aylikGider)}</strong>`;
        aylikAlan.appendChild(satir);
    }

    const yillikToplamEl = document.getElementById("yillikToplam");
    if (yillikToplamEl) {
        yillikToplamEl.innerHTML = `
            <span style="font-size: 13px; color: #10b981;">Gelir: ${paraFormatla(yillikToplamGelir)}</span> | 
            <span style="font-size: 13px; color: #ef4444;">Gider: ${paraFormatla(yillikToplamGider)}</span>
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

    const entries = Object.entries(kategoriToplamlari);
    const total = entries.reduce((sum, [_, val]) => sum + val, 0);

    if (total === 0) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Bu yıl veri yok", canvas.width / 2, canvas.height / 2);
        return;
    }

    let startAngle = 0;
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
            kategori,
            deger,
            yuzde: ((deger / total) * 100).toFixed(1),
            startAngle,
            endAngle,
            color
        });

        startAngle = endAngle;
    });
}

document.addEventListener("click", function(e) {
    const canvas = document.getElementById("pastaCanvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;

    const x = e.clientX - rect.left - canvas.width / 2;
    const y = e.clientY - rect.top - canvas.height / 2;
    
    const distance = Math.sqrt(x * x + y * y);
    if (distance > 75) return;

    let angle = Math.atan2(y, x);
    if (angle < 0) angle += Math.PI * 2;

    const clickedSlice = (window.pastaDilimleri || []).find(s => angle >= s.startAngle && angle <= s.endAngle);
    const detayEl = document.getElementById("grafikDetay");

    if (clickedSlice && detayEl) {
        detayEl.innerHTML = `<span style="color: ${clickedSlice.color};">■</span> ${clickedSlice.kategori}: <strong>${paraFormatla(clickedSlice.deger)}</strong> (Toplamın %${clickedSlice.yuzde}'i)`;
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
    if (ayAnahtari(aktifTarih) !== ayAnahtari(gercekTarih)) {
        aktifTarih = gercekTarih;
        aktifAyiOlustur();
        ekraniGuncelle();
    }
}

setInterval(otomatikAyKontrolu, 60 * 1000);
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") otomatikAyKontrolu();
});
