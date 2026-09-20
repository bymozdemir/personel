// GÜVENLİ BAŞLANGIÇ YÜKLEME: localStorage'daki JSON bir şekilde bozulmuşsa
// (kullanıcı devtools'tan elle değiştirmiş, yarım kalmış yazma vb.) try/catch
// olmadan yapılan bir JSON.parse burada, script'in en başında, DOMContentLoaded
// tetiklenmeden ÖNCE çalışacağı için sayfayı anında "uncaught exception" ile
// çökertip beyaz ekrana düşürüyordu. Artık her anahtar kendi try/catch'i
// içinde okunuyor; bozuk bir anahtar bulunursa sadece O anahtar sıfırlanır,
// diğer veriler (varsa) etkilenmez ve uygulama açılmaya devam eder.
function guvenliJSONYukle(anahtar, varsayilan) {
  try {
    const ham = localStorage.getItem(anahtar);
    if (ham === null) return varsayilan;
    return JSON.parse(ham);
  } catch (e) {
    console.error(`localStorage["${anahtar}"] bozuk, varsayılana dönülüyor:`, e);
    return varsayilan;
  }
}

let personeller = guvenliJSONYukle('personeller', []);
let sablon = guvenliJSONYukle('sablon', {});
// Anasayfadaki açılır menüyü besleyen Grup / Tim yapısı: { "1. Grup": ["1. Tim", "2. Tim"], ... }
let grupTimYapisi = guvenliJSONYukle('grupTimYapisi', {});
// Anasayfada o an seçili olan grup/tim filtresi. Boş string ("") = "Tümünü Göster".
// Format: "GrupAdi||TimAdi"
let aktifGrupTimFiltre = localStorage.getItem('secilenGrupTim') || "";
// Anasayfadaki arama kutusunun (searchInput) o anki metni. Sayfa yenilense
// veya Ayarlar > Personel Listesi sekmesine geçilse bile yapılan arama
// kaybolmasın diye aktifGrupTimFiltre ile aynı mantıkla kalıcı saklanır.
let aktifAramaMetni = localStorage.getItem('aktifAramaMetni') || "";

// ------------------------------------------------------------------------
// Ayarlar > Personel Listesi sekmesinin KENDİ grup/tim filtresi, arama
// metni ve sayfalaması. Anasayfadakinden (yukarıdaki aktifGrupTimFiltre /
// aktifAramaMetni) TAMAMEN BAĞIMSIZDIR: anasayfada yapılan arama/filtre
// Ayarlar'daki aramayı etkilemez, Ayarlar'daki de anasayfayı etkilemez.
// ------------------------------------------------------------------------
let ayarlarAktifGrupTimFiltre = localStorage.getItem('ayarlarSecilenGrupTim') || "";
let ayarlarAramaMetni = localStorage.getItem('ayarlarAramaMetni') || "";
const AYARLAR_PERSONEL_LISTE_SAYFA_BOYUTU = 50;
let ayarlarPersonelListeGosterilenSayisi = AYARLAR_PERSONEL_LISTE_SAYFA_BOYUTU;
let ayarlarPersonelListeSonFiltreAnahtari = null;
let seciliPersonelIds = new Set();
// Ayarlar sayfasındaki "Personeli Grup/Tim'e Ata" bölümünde çoklu seçim için kullanılır.
let ataSeciliPersonelIds = new Set();

// Anasayfa personel listesinde performans için sayfalama (pagination).
// Filtreye uyan TÜM kayıtları DOM'a basmak yerine önce sadece ilk N tanesi
// gösterilir; "Daha Fazla Göster" butonuyla bir sonraki grup eklenir. Bu
// sayede personel sayısı binlere çıksa bile anasayfa akıcı kalır.
const ANA_LISTE_SAYFA_BOYUTU = 50;
let anaListeGosterilenSayisi = ANA_LISTE_SAYFA_BOYUTU;
let anaListeSonFiltreAnahtari = null;
let aktifPersonelId = null;
let aktifAnaKategori = null;
let aktifAltKategori = null;
// Anasayfa listesinin sıralama tercihi: 'sicil' | 'ad_az' | 'ad_za' | 'grup' | 'son_eklenen'
let aktifSiralama = localStorage.getItem('aktifSiralama') || 'sicil';

// --- GÜVENLİ METİN YARDIMCILARI ---
// innerHTML içine yazılan metin (isim, kategori adı, alan değeri vb.) HTML/script
// olarak yorumlanmasın diye kaçış (escape) işlemi yapar. Bu olmadan bir isim ya da
// alan içinde "<" ">" gibi karakterler olması ekranı bozabilir veya kod çalıştırabilir.
function guvenliMetin(str) {
  if (str === null || str === undefined) return "";
  // & önce, sonra diğerleri: hem HTML metin içeriği hem de HTML özniteliği (value="...", data-field="..." vb.)
  // içinde güvenli olacak şekilde kaçış yapar.
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// onclick="fonksiyon('...')" gibi tek tırnaklı bir HTML olay özniteliğinin İÇİNE
// gömülen değerleri güvenli hale getirir. Değerde tek tırnak (') varsa (Türkçe
// isimlerde/kategori adlarında sıkça olur, örn. "Şb. Md.'ü") bu tırnak olmadan
// kaçış yapılırsa üretilen HTML/JS bozulur ve ilgili buton çalışmaz hale gelir.
function oncTemizle(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================================================
// KLAVYE AÇILINCA MODALLARIN ALTTA/GİZLİ KALMASINI ÖNLEYEN GLOBAL DÜZELTME
// ----------------------------------------------------------------------------
// Sorun: Modallar "position:fixed; height:100%; align-items:center" ile tüm
// ekranı kaplayıp içeriği ortalıyor. Mobilde bir input'a dokunulup klavye
// açıldığında, tarayıcı "görünür alanı" (visualViewport) küçültür ama
// position:fixed öğeler eski tam ekran yüksekliğinde ortalanmaya devam eder;
// bu da modalın (özellikle içindeki input'un) klavyenin arkasında/altında
// kalmasına yol açar.
//
// Çözüm: window.visualViewport API'siyle klavye her açılıp kapandığında,
// data-klavye-uyumlu="1" ile işaretlenmiş TÜM modal katmanlarının height ve
// top değerlerini o an gerçekten görünen alana (visualViewport) göre yeniden
// hesaplıyoruz. Böylece modal her zaman klavyenin ÜSTÜNDE kalan görünür
// alanın içinde ortalanır. visualViewport desteklemeyen eski tarayıcılarda
// bu fonksiyon sessizce çalışmaz, önceki (CSS tabanlı) davranış devam eder.
// ============================================================================
function klavyeIcinModallariAyarla() {
  if (!window.visualViewport) return;
  let vv = window.visualViewport;
  document.querySelectorAll('[data-klavye-uyumlu="1"]').forEach(katman => {
    // Kapalı (display:none) katmanlarla uğraşmaya gerek yok.
    let gorunurMu = window.getComputedStyle(katman).display !== 'none';
    if (!gorunurMu) return;
    katman.style.height = vv.height + 'px';
    katman.style.top = vv.offsetTop + 'px';
  });
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', klavyeIcinModallariAyarla);
  window.visualViewport.addEventListener('scroll', klavyeIcinModallariAyarla);
}

function ozelBildirimGoster(mesaj) {
  // Art arda hızlı tetiklenen bildirimlerin üst üste yığılmasını önlemek için
  // (ör. bir hata mesajından hemen sonra başka bir uyarı tetiklenirse) önceki
  // bildirim penceresi varsa önce o kaldırılır.
  document.querySelectorAll('.ozel-bildirim-modal').forEach(el => el.remove());

  let modal = document.createElement('div');
  modal.setAttribute('data-klavye-uyumlu', '1'); // Klavye açılınca konumunu/boyunu ayarlayan global dinleyici bu işaretle modalı bulur (bkz. klavyeIcinModallariAyarla).
  modal.className = 'ozel-bildirim-modal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; align-items: center;
    justify-content: center; z-index: 10001;
  `;
  modal.innerHTML = `
    <div style="background: white; padding: 20px; border-radius: 12px; max-width: 80%; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
      <p style="margin-top:0; font-size: 15px; color: #333; line-height: 1.4; white-space: pre-wrap;">${guvenliMetin(mesaj)}</p>
      <button onclick="this.parentElement.parentElement.remove()" style="background: #1e88e5; color: white; border: none; padding: 8px 20px; border-radius: 6px; font-weight: bold; cursor: pointer;">Tamam</button>
    </div>
  `;
  document.body.appendChild(modal);
}

// --- AĞIR (UZUN SÜREN) İŞLEMLER İÇİN İLERLEME GÖSTERGESİ VE PARÇALI İŞLEME ---
// Excel/JSON yedek geri yükleme gibi işlemler yüzlerce/binlerce satırı senkron
// (tek seferde, döngüyle) işlediğinde tarayıcı/WebView ana iş parçacığı uzun süre
// bloke olur; bazı cihazlarda bu, işlem bitene kadar ekranın "kara" veya tepkisiz
// görünmesine yol açar. Kullanıcı raporu: "Excelden verileri geri yüklerken bazen
// siyah ekranda takılı kalıyor. Programı kapatıp yeniden açınca yedek geri alma
// yapılmış oluyor." — yani işlem aslında TAMAMLANIYOR ama arayüz donuyor.
// Çözüm: (1) işe başlamadan önce bir ilerleme göstergesi çizip tarayıcıya bunu
// ekrana basması için bir "nefes payı" (setTimeout ile) vermek, (2) satırları TEK
// seferde değil küçük parçalar (chunk) halinde, aralarına setTimeout(...,0) koyarak
// işlemek. Bu sayede ana iş parçacığı periyodik olarak boşa çıkar, ekran donmaz.
function agirIslemGostergesiGoster(mesaj) {
  agirIslemGostergesiGizle();
  let overlay = document.createElement('div');
  overlay.setAttribute('data-klavye-uyumlu', '1'); // Klavye açılınca konumunu/boyunu ayarlayan global dinleyici bu işaretle modalı bulur (bkz. klavyeIcinModallariAyarla).
  overlay.className = 'agir-islem-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(255,255,255,0.9); display: flex; flex-direction: column;
    align-items: center; justify-content: center; z-index: 10000; gap: 14px;
  `;
  overlay.innerHTML = `
    <div style="width:42px; height:42px; border:4px solid #e0e0e0; border-top-color:#1e88e5; border-radius:50%; animation: agirIslemSpin 0.8s linear infinite;"></div>
    <div id="agirIslemMetni" style="font-size:14px; color:#333; font-weight:600; text-align:center; padding:0 20px;">${guvenliMetin(mesaj || 'İşleniyor...')}</div>
  `;
  document.body.appendChild(overlay);
}
function agirIslemMetniGuncelle(mesaj) {
  let el = document.getElementById('agirIslemMetni');
  if (el) el.innerText = mesaj;
}
function agirIslemGostergesiGizle() {
  document.querySelectorAll('.agir-islem-overlay').forEach(el => el.remove());
}

// Bir diziyi, ana iş parçacığını kilitlemeden küçük parçalar (chunk) halinde işler.
// isleFn(eleman, index) her bir kayıt için çağrılır; tüm dizi bitince bitFn() çağrılır.
// ilerlemeFn(islenenSayisi, toplamSayisi) her parçadan sonra (isteğe bağlı) çağrılır.
function parcalarHalindeIsle(dizi, parcaBoyutu, isleFn, bitFn, ilerlemeFn) {
  let i = 0;
  const toplam = dizi.length;
  function adim() {
    let sonIndex = Math.min(i + parcaBoyutu, toplam);
    for (; i < sonIndex; i++) {
      isleFn(dizi[i], i);
    }
    if (ilerlemeFn) ilerlemeFn(i, toplam);
    if (i < toplam) {
      setTimeout(adim, 0);
    } else {
      bitFn();
    }
  }
  if (toplam === 0) { bitFn(); return; }
  adim();
}

document.addEventListener("DOMContentLoaded", () => {
  // NOT: personeller / sablon / grupTimYapisi artık dosyanın en başında
  // guvenliJSONYukle() ile TEK SEFERDE ve güvenli şekilde okunuyor; burada
  // tekrar okumaya gerek yok (aksi halde aynı veri iki kez parse edilir).

  bilgiNotunuGuncelleVeGoster();

  // Arama kutularını, sayfa yenilense bile kaybolmayan son aramalarla
  // doldurur (bkz. aktifAramaMetni / ayarlarAramaMetni). Anasayfa ve
  // Ayarlar > Personel Listesi sekmesi TAMAMEN BAĞIMSIZ arama durumlarına
  // sahiptir; her biri kendi kayıtlı metniyle doldurulur.
  let searchInputEl = document.getElementById('searchInput');
  if (searchInputEl) searchInputEl.value = aktifAramaMetni;
  let ayarlarSearchInputEl = document.getElementById('ayarlarPersonelAramaInput');
  if (ayarlarSearchInputEl) ayarlarSearchInputEl.value = ayarlarAramaMetni;

  // Sıralama seçicisini kayıtlı tercihe göre senkronize eder.
  let siralamaSecici = document.getElementById('siralamaSecici');
  if (siralamaSecici) siralamaSecici.value = aktifSiralama;

  // Bildirim butonunun mevcut izin/durum durumuna göre metnini günceller.
  bildirimDurumunuGuncelle();

      let aktifSayfa = sessionStorage.getItem('aktifSayfa');
  if (aktifSayfa === 'ayarlar') {
    let vMain = document.getElementById('viewMain');
    if (vMain) vMain.style.display = 'none';
    
    let vAyarlar = document.getElementById('viewAyarlar');
    if (vAyarlar) vAyarlar.style.display = 'flex';
    
    let cHeader = document.getElementById('cardHeader');
    if (cHeader) cHeader.style.display = 'none';

    ayarlarSekmeGoster(sessionStorage.getItem('aktifAyarlarSekmesi') || 'personel');
    ayarlarGrupTimSeciciGuncelle();
    if (ayarlarSearchInputEl && ayarlarSearchInputEl.value.trim() !== "") {
      ayarlarPersonelAra();
    } else {
      ayarlarPersonelListesiniCiz();
    }
    ayarlarModuluYukle(() => {
      sablonListesiniCiz();
      grupTimListesiniCiz();
      pinDurumunuGoster();
    });
    return;
  } else {
    // Ana sayfadaysa cardHeader orijinal görünümüne döner
    let cHeader = document.getElementById('cardHeader');
    if (cHeader) cHeader.style.display = '';
  }


  if (!history.state) {
    history.replaceState({ ekran: 'main' }, "");
  }

  let savedState = sessionStorage.getItem('appState');
  if (savedState) {
    try {
      let stateData = JSON.parse(savedState);
      if (stateData.ekran === 'categories' && stateData.personelId) {
        aktifPersonelId = stateData.personelId;
        gorselKategoriEkraniGoster(false);
        personelDetayAc(aktifPersonelId, true);
      } else if (stateData.ekran === 'form' && stateData.personelId && stateData.k1 && stateData.k2) {
        aktifPersonelId = stateData.personelId;
        gorselKategoriEkraniGoster(false);
        personelDetayAc(aktifPersonelId, true);
        formEkraniAc(stateData.k1, stateData.k2, true);
      } else {
        gorselAnaSayfaGoster(false);
      }
    } catch(err) {
      gorselAnaSayfaGoster(false);
    }
  } else {
    gorselAnaSayfaGoster(false);
  }
});

// Geri tuşu (Fiziksel donanım) history/geçmiş yönetimi
window.addEventListener('popstate', (event) => {
  let viewAyarlarEl = document.getElementById('viewAyarlar');
  let viewAyarlar = viewAyarlarEl && viewAyarlarEl.style.display === 'flex';

  let viewFormEl = document.getElementById('viewForm');
  let viewForm = viewFormEl && viewFormEl.style.display === 'flex';

  let viewCategoriesEl = document.getElementById('viewCategories');
  let viewCategories = viewCategoriesEl && viewCategoriesEl.style.display === 'flex';

  if (viewAyarlar) {
    sessionStorage.removeItem('aktifSayfa');
    if (viewAyarlarEl) viewAyarlarEl.style.display = 'none';
    let vMain = document.getElementById('viewMain');
    if (vMain) vMain.style.display = 'flex';
    gorselAnaSayfaGoster(false);
    bilgiNotunuGuncelleVeGoster();
  } else if (viewForm) {
    if (viewFormEl) viewFormEl.style.display = 'none';
    if (viewCategoriesEl) viewCategoriesEl.style.display = 'flex';

    // Not: Başlık/rütbe/kalem-ikonu mantığı gorselKategoriEkraniGoster() içinde tek
    // yerde toplu tutulur; burada tekrar elle kopyalamak yerine doğrudan o fonksiyon
    // çağrılır (pushHistory=false, çünkü zaten bir popstate olayındayız).
    gorselKategoriEkraniGoster(false);
  } else if (viewCategories) {
    // KAPANMA SORUNUNU ÇÖZEN SATIR: Geri giderken yeni kayıt atmamak için "false" geçildi
    gorselAnaSayfaGoster(false);
  } else {
    // Ana sayfada cihaz geri tuşuna basıldıysa varsayılan davranışıyla app kapanır
  }
});

function kaydetLocal() {
  try {
    personeller.sort((a, b) => {
      let idA = Number(a.id) || 0;
      let idB = Number(b.id) || 0;
      return idA - idB;
    });
    localStorage.setItem('personeller', JSON.stringify(personeller));
    localStorage.setItem('sablon', JSON.stringify(sablon));
    localStorage.setItem('grupTimYapisi', JSON.stringify(grupTimYapisi));
  } catch (e) {
    ozelBildirimGoster("Kayıt başarısız! Hafıza dolu olabilir.");
  }
}

function jsonVeritabaninaKaydet() {
  kaydetLocal();
  ozelBildirimGoster("Tüm veriler cihaz hafızasına kaydedildi.");
}

function dosyaSeciciAc() {
  const input = document.getElementById('jsonInput');
  if(input) {
    input.value = '';
    setTimeout(() => { input.click(); }, 50);
  }
}

// Yedekteki şablonu (kategori/alt kategori/alan yapısını) mevcut şablonla birleştirir.
// Doğrudan üzerine yazmaz: yedekte olup mevcutta olmayan kategori/alan varsa ekler,
// mevcutta olup yedekte olmayanı SİLMEZ. Böylece eski bir yedek geri yüklenirken
// cihazda o sırada var olan daha güncel kategoriler kaybolmaz.
function sablonBirlestir(hedefSablon, kaynakSablon) {
  if (!kaynakSablon || typeof kaynakSablon !== 'object') return;
  Object.keys(kaynakSablon).forEach(k1 => {
    if (!hedefSablon[k1] || typeof hedefSablon[k1] !== 'object') hedefSablon[k1] = {};
    let kaynakAltlar = kaynakSablon[k1];
    if (!kaynakAltlar || typeof kaynakAltlar !== 'object') return;
    Object.keys(kaynakAltlar).forEach(k2 => {
      let kaynakAlanlar = Array.isArray(kaynakAltlar[k2]) ? kaynakAltlar[k2] : [];
      if (!Array.isArray(hedefSablon[k1][k2])) hedefSablon[k1][k2] = [];
      kaynakAlanlar.forEach(alan => {
        if (!hedefSablon[k1][k2].includes(alan)) hedefSablon[k1][k2].push(alan);
      });
    });
  });
}

// Yedekteki grup/tim şablon yapısını (grup adı -> tim listesi) mevcut yapıyla birleştirir.
// sablonBirlestir ile aynı mantık: yedekte olup mevcutta olmayan grup/tim varsa ekler,
// mevcutta olup yedekte olmayanı SİLMEZ.
function grupTimBirlestir(hedefYapi, kaynakYapi) {
  if (!kaynakYapi || typeof kaynakYapi !== 'object') return;
  Object.keys(kaynakYapi).forEach(grup => {
    let kaynakTimler = Array.isArray(kaynakYapi[grup]) ? kaynakYapi[grup] : [];
    if (!Array.isArray(hedefYapi[grup])) hedefYapi[grup] = [];
    kaynakTimler.forEach(tim => {
      if (!hedefYapi[grup].includes(tim)) hedefYapi[grup].push(tim);
    });
  });
}

// Yedekteki bir kişinin verilerini, listede zaten var olan aynı kişinin verileriyle
// birleştirir. Yedekte dolu olan alanlar mevcut kaydı günceller; yedekte olmayan
// veya boş olan alanlar mevcut kayıttaki haliyle korunur (üzerine boş yazılmaz).
// Geriye, en az bir alanın gerçekten değişip değişmediğini döndürür.
function personelVerileriniBirlestir(hedefP, kaynakVeriler) {
  if (!kaynakVeriler || typeof kaynakVeriler !== 'object') return false;
  if (!hedefP.veriler || typeof hedefP.veriler !== 'object') hedefP.veriler = {};
  let degisiklikVarMi = false;
  Object.keys(kaynakVeriler).forEach(mainKey => {
    let kaynakKayitlar = kaynakVeriler[mainKey];
    if (!Array.isArray(kaynakKayitlar) || kaynakKayitlar.length === 0) return;

    if (!Array.isArray(hedefP.veriler[mainKey])) hedefP.veriler[mainKey] = [];
    let hedefKayitlar = hedefP.veriler[mainKey];

    // NOT: Kayıtların kendine özgü bir ID'si olmadığından eşleştirme sıraya (index)
    // göre yapılır. Hedefte o sırada kayıt yoksa doğrudan eklenir; varsa alan bazında
    // birleştirilir (kaynakta dolu olan alanlar günceller, boş olanlar korunur).
    // Hedefte kaynaktan FAZLA kayıt varsa (index kaynak uzunluğunu aşanlar) dokunulmaz.
    kaynakKayitlar.forEach((kaynakKayit, i) => {
      if (!kaynakKayit || typeof kaynakKayit !== 'object') return;

      if (!hedefKayitlar[i] || typeof hedefKayitlar[i] !== 'object') {
        hedefKayitlar[i] = Object.assign({}, kaynakKayit);
        degisiklikVarMi = true;
        return;
      }

      let hedefKayit = hedefKayitlar[i];
      Object.keys(kaynakKayit).forEach(alan => {
        let kaynakDeger = kaynakKayit[alan];
        if (kaynakDeger !== undefined && kaynakDeger !== null && String(kaynakDeger).trim() !== '') {
          if (hedefKayit[alan] !== kaynakDeger) degisiklikVarMi = true;
          hedefKayit[alan] = kaynakDeger;
        }
      });
    });
  });
  return degisiklikVarMi;
}

// Yedekteki bir kişinin temel bilgilerini (Adı Soyadı, Grup, Tim), mevcutta zaten
// var olan aynı kişinin kaydına uygular. Sadece yedekte GERÇEKTEN dolu olan alanlar
// güncellenir; yedekte boş/tanımsızsa mevcut kayıttaki değer korunur. Grup/Tim,
// Ayarlar > Grup/Tim yapısında henüz tanımlı değilse (örn. farklı bir cihazdan
// gelen yedekte varken bu cihazda hiç oluşturulmamışsa) oraya da otomatik eklenir
// (bkz. importExcel'deki aynı mantık) — aksi halde kişi üzerinde görünen ama
// Ayarlar listesinde/filtrede hiç yer almayan "hayalet" bir grup/tim etiketi kalırdı.
// Geriye en az bir alanın gerçekten değişip değişmediğini döndürür.
function personelTemelBilgileriniBirlestir(hedefP, kaynakP) {
  if (!kaynakP || typeof kaynakP !== 'object') return false;
  let degisti = false;

  let yeniAd = kaynakP.adSoyad !== undefined && kaynakP.adSoyad !== null ? String(kaynakP.adSoyad).trim() : '';
  if (yeniAd !== '' && hedefP.adSoyad !== yeniAd) {
    hedefP.adSoyad = yeniAd;
    degisti = true;
  }

  let yeniRutbe = kaynakP.rutbe !== undefined && kaynakP.rutbe !== null ? String(kaynakP.rutbe).trim() : '';
  if (yeniRutbe !== '' && hedefP.rutbe !== yeniRutbe) {
    hedefP.rutbe = yeniRutbe;
    degisti = true;
  }

  let yeniGrup = kaynakP.grup !== undefined && kaynakP.grup !== null ? String(kaynakP.grup).trim() : '';
  let yeniTim = kaynakP.tim !== undefined && kaynakP.tim !== null ? String(kaynakP.tim).trim() : '';
  if (yeniGrup !== '' && (hedefP.grup !== yeniGrup || hedefP.tim !== yeniTim)) {
    hedefP.grup = yeniGrup;
    hedefP.tim = yeniTim;
    if (!Array.isArray(grupTimYapisi[yeniGrup])) grupTimYapisi[yeniGrup] = [];
    if (yeniTim && !grupTimYapisi[yeniGrup].includes(yeniTim)) grupTimYapisi[yeniGrup].push(yeniTim);
    degisti = true;
  }

  return degisti;
}

function jsonDosyasiniIceriAl(event) {
  let file = event.target.files[0];
  if (!file) return;
  let reader = new FileReader();
  reader.onload = function(e) {
    let dosyaIcerigi = e.target.result;
    try {
      let parsedData = JSON.parse(dosyaIcerigi);
      let yuklenecekPersoneller = null;
      if (Array.isArray(parsedData)) {
        yuklenecekPersoneller = parsedData;
      } else if (parsedData && typeof parsedData === 'object') {
        if (Array.isArray(parsedData.personeller)) {
          yuklenecekPersoneller = parsedData.personeller;
        }
        if (parsedData.sablon && typeof parsedData.sablon === 'object') {
          sablonBirlestir(sablon, parsedData.sablon);
        }
        if (parsedData.grupTimYapisi && typeof parsedData.grupTimYapisi === 'object') {
          grupTimBirlestir(grupTimYapisi, parsedData.grupTimYapisi);
          localStorage.setItem('grupTimYapisi', JSON.stringify(grupTimYapisi));
        }
      }
      if (!yuklenecekPersoneller || yuklenecekPersoneller.length === 0) {
        throw new Error("Yedek dosyasında geçerli personel kaydı bulunamadı.");
      }
      let eklenenSayisi = 0;
      let guncellenenSayisi = 0;
      let degismeyenSayisi = 0;

      // ÖNEMLİ DÜZELTME: Binlerce kişilik bir yedek tek seferde (senkron) forEach
      // ile işlenirse ana iş parçacığı uzun süre bloke olup ekranın donmasına/kara
      // görünmesine yol açabiliyordu (bkz. importExcel'deki aynı düzeltme). Artık
      // bu işlem parcalarHalindeIsle() ile küçük parçalar halinde, arada tarayıcıya
      // nefes payı bırakılarak yapılıyor.
      agirIslemGostergesiGoster("Yedek geri yükleniyor...");
      parcalarHalindeIsle(yuklenecekPersoneller, 200, (yedekKisi) => {
        // ÖNCELİK SIRASI: önce sicil no (id) ile eşleştirilir; id ile eşleşme
        // bulunamazsa isim ile eşleştirmeye geçilir. Böylece farklı bir sicil
        // numarasına sahip ama aynı isimdeki başka bir personelle yanlışlıkla
        // birleşme riski azaltılır.
        let mevcutKisi = personeller.find(p => String(p.id) === String(yedekKisi.id));
        if (!mevcutKisi) {
          mevcutKisi = personeller.find(p => p.adSoyad && yedekKisi.adSoyad && p.adSoyad.toLowerCase() === yedekKisi.adSoyad.toLowerCase());
        }
        if (!mevcutKisi) {
          personeller.push(yedekKisi);
          eklenenSayisi++;
        } else {
          let temelDegisti = personelTemelBilgileriniBirlestir(mevcutKisi, yedekKisi);
          let verilerDegisti = personelVerileriniBirlestir(mevcutKisi, yedekKisi.veriler);
          if (temelDegisti || verilerDegisti) guncellenenSayisi++; else degismeyenSayisi++;
        }
      }, () => {
        kaydetLocal();
        tumPersonelListeleriniYenile();
        ozelGunleriKontrolEtVeGoster();
        bilgiNotunuGuncelleVeGoster();
        if (typeof grupTimListesiniCiz === 'function') grupTimListesiniCiz();
        if (typeof sablonListesiniCiz === 'function') sablonListesiniCiz();
        event.target.value = '';
        agirIslemGostergesiGizle();
        ozelBildirimGoster(`Yedek başarıyla birleştirildi!\n• Eklenen Yeni Kişi: ${eklenenSayisi}\n• Güncellenen Mevcut Kişi: ${guncellenenSayisi}\n• Değişiklik Yok: ${degismeyenSayisi}`);
      }, (islenen, toplam) => {
        agirIslemMetniGuncelle(`Yedek geri yükleniyor... (${islenen}/${toplam})`);
      });
    } catch (err) {
      agirIslemGostergesiGizle();
      event.target.value = '';
      ozelBildirimGoster("JSON dosyası okunurken hata oluştu: " + err.message);
    }
  };
  reader.readAsText(file);
}

// Uygulama içi Geri Butonu Yöneticisi
function solButonTiklandi() {
  // Geri butonuna basıldığında tarayıcı geçmişini (history) 1 adım geri alıyoruz.
  // Böylece donanım tuşu ile ekran tuşu aynı davranışı (popstate tetiklenmesi) sergiler.
  window.history.back();
}

// Anasayfa başlığının altındaki alanı, Ayarlar > Grup/Tim Yönetimi bölümünde
// tanımlanan grup/tim listesiyle beslenen bir açılır menüye (dropdown) dönüştürür.
// Bir grup/tim seçildiğinde personel listesi sadece o timdeki kişileri gösterir.
function bilgiNotunuGuncelleVeGoster() {
  const bilgiNotuAlani = document.getElementById('bilgiNotuAlani');
  if (!bilgiNotuAlani) return;
  // Personel detayına girerken gizlenmiş olabilir; anasayfaya her dönüşte tekrar görünür yapılır.
  bilgiNotuAlani.style.display = "";

  let grupAdlari = Object.keys(grupTimYapisi).sort((a, b) => a.localeCompare(b, 'tr'));

  // Kayıtlı filtre artık geçerli değilse (grup/tim silinmişse) sıfırla
  if (aktifGrupTimFiltre) {
    let parcalar = aktifGrupTimFiltre.split('||');
    let grupVar = grupAdlari.includes(parcalar[0]);
    let timVar = grupVar && Array.isArray(grupTimYapisi[parcalar[0]]) && grupTimYapisi[parcalar[0]].includes(parcalar[1]);
    if (!grupVar || !timVar) {
      aktifGrupTimFiltre = "";
      localStorage.setItem('secilenGrupTim', "");
    }
  }

  if (grupAdlari.length === 0) {
    bilgiNotuAlani.innerHTML = "";
    return;
  }

  let secenekler = `<option value="">Tümünü Göster</option>`;
  grupAdlari.forEach(grup => {
    let timler = (grupTimYapisi[grup] || []).slice().sort((a, b) => a.localeCompare(b, 'tr'));
    timler.forEach(tim => {
      let deger = `${grup}||${tim}`;
      let seciliMi = (aktifGrupTimFiltre === deger) ? "selected" : "";
      secenekler += `<option value="${guvenliMetin(deger)}" ${seciliMi}>${guvenliMetin(grup)} - ${guvenliMetin(tim)}</option>`;
    });
  });

  bilgiNotuAlani.style.textAlign = "center";
  bilgiNotuAlani.innerHTML = `
    <select id="grupTimFiltreSecici" onchange="grupTimFiltreDegisti(this.value)"
      style="width: 100%; max-width: 260px; padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 13px; color: inherit; background: transparent;">
      ${secenekler}
    </select>
  `;
}

// Anasayfadaki Grup/Tim açılır menüsünden bir seçim yapıldığında çalışır.
// Seçilen değeri hatırlar (localStorage) ve listeyi anında yeniden çizer.
function grupTimFiltreDegisti(deger) {
  aktifGrupTimFiltre = deger || "";
  localStorage.setItem('secilenGrupTim', aktifGrupTimFiltre);

  let searchInput = document.getElementById('searchInput');
  if (searchInput && searchInput.value.trim() !== "") {
    personelAra();
  } else {
    personelListesiniCiz();
  }
}

// ------------------------------------------------------------------------
// Ayarlar > Personel Listesi sekmesindeki Grup/Tim seçici. Yukarıdaki
// bilgiNotunuGuncelleVeGoster()/grupTimFiltreDegisti() ile AYNI mantığı
// kullanır, ama kendi kutucuğuna (#ayarlarGrupTimSeciciAlani) ve kendi
// filtre değişkenine (ayarlarAktifGrupTimFiltre) yazar; anasayfadaki
// seçimden bağımsızdır.
// ------------------------------------------------------------------------
function ayarlarGrupTimSeciciGuncelle() {
  const alan = document.getElementById('ayarlarGrupTimSeciciAlani');
  if (!alan) return;

  let grupAdlari = Object.keys(grupTimYapisi).sort((a, b) => a.localeCompare(b, 'tr'));

  if (ayarlarAktifGrupTimFiltre) {
    let parcalar = ayarlarAktifGrupTimFiltre.split('||');
    let grupVar = grupAdlari.includes(parcalar[0]);
    let timVar = grupVar && Array.isArray(grupTimYapisi[parcalar[0]]) && grupTimYapisi[parcalar[0]].includes(parcalar[1]);
    if (!grupVar || !timVar) {
      ayarlarAktifGrupTimFiltre = "";
      localStorage.setItem('ayarlarSecilenGrupTim', "");
    }
  }

  if (grupAdlari.length === 0) {
    alan.innerHTML = "";
    return;
  }

  let secenekler = `<option value="">Tümünü Göster</option>`;
  grupAdlari.forEach(grup => {
    let timler = (grupTimYapisi[grup] || []).slice().sort((a, b) => a.localeCompare(b, 'tr'));
    timler.forEach(tim => {
      let deger = `${grup}||${tim}`;
      let seciliMi = (ayarlarAktifGrupTimFiltre === deger) ? "selected" : "";
      secenekler += `<option value="${guvenliMetin(deger)}" ${seciliMi}>${guvenliMetin(grup)} - ${guvenliMetin(tim)}</option>`;
    });
  });

  alan.innerHTML = `
    <select id="ayarlarGrupTimFiltreSecici" onchange="ayarlarGrupTimFiltreDegisti(this.value)"
      style="width: 100%; padding: 8px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px; color: inherit; background: transparent; box-sizing:border-box;">
      ${secenekler}
    </select>
  `;
}

// Ayarlar > Personel Listesi sekmesindeki Grup/Tim seçiciden bir seçim
// yapıldığında çalışır. Sadece kendi listesini (personelListesiAyarlar)
// yeniden çizer; anasayfayı etkilemez.
function ayarlarGrupTimFiltreDegisti(deger) {
  ayarlarAktifGrupTimFiltre = deger || "";
  localStorage.setItem('ayarlarSecilenGrupTim', ayarlarAktifGrupTimFiltre);

  let aramaInput = document.getElementById('ayarlarPersonelAramaInput');
  if (aramaInput && aramaInput.value.trim() !== "") {
    ayarlarPersonelAra();
  } else {
    ayarlarPersonelListesiniCiz();
  }
}

// Bir personelin, anasayfada o an aktif olan grup/tim filtresine uyup uymadığını
// döndürür. Filtre boşsa ("Tümünü Göster") herkes uyumludur.
function personelGrupTimUyumluMu(p) {
  if (!aktifGrupTimFiltre) return true;
  let parcalar = aktifGrupTimFiltre.split('||');
  return (p.grup || "") === parcalar[0] && (p.tim || "") === parcalar[1];
}

// Bir personelde, arama kutusundaki metne uyan İLK kaydı bulur ve arama sonucu
// etiketinde gösterilecek {baslik, deger} bilgisini döndürür. Eşleşme olmazsa null
// döner. ÖNEMLİ: Sadece kayıtlı DEĞERLER değil; alanın kendi ADI (örn. "El Feneri")
// ve içinde bulunduğu kategori/alt kategori adları da arama kapsamına dahildir.
// Böylece "El Feneri" bir şablon alanı/kategorisiyse, o alanı en az bir kez
// doldurmuş (değeri ne olursa olsun) herkes "el feneri" aramasında bulunur —
// önceden sadece GİRİLEN DEĞER metniyle eşleşme aranıyordu, alan/kategori adı
// hiç taranmıyordu.
function personelIcerikEslesmesiBul(p, q) {
  if (!q || !p.veriler) return null;
  for (let mainKey in p.veriler) {
    let kayitlar = p.veriler[mainKey];
    if (!Array.isArray(kayitlar)) continue;

    // 1) Kategori / Alt kategori adı eşleşmesi (mainKey'in ait olduğu k1/k2'yi
    // şablondan buluyoruz; mainKey string'ini "_" ile bölmek k1 veya k2 içinde
    // "_" geçerse yanlış sonuç verebileceğinden şablon üzerinden eşleştiriyoruz).
    for (let k1 in sablon) {
      if (!sablon[k1]) continue;
      for (let k2 in sablon[k1]) {
        if (`${k1}_${k2}` === mainKey && (k1.toLowerCase().includes(q) || k2.toLowerCase().includes(q))) {
          return { baslik: k1, deger: k2 };
        }
      }
    }

    // 2) Alan adı VEYA alanın değeri eşleşmesi
    for (let kayit of kayitlar) {
      for (let alan in kayit) {
        if (alan.toLowerCase().includes(q) || String(kayit[alan] || '').toLowerCase().includes(q)) {
          return { baslik: alan, deger: kayit[alan] || '(boş)' };
        }
      }
    }
  }
  return null;
}

// Bir personelin, arama kutusundaki metne (isim, sicil no, şablon kategori/alt
// kategori/alan adı veya kayıtlı bir alanın değeri) ve aktif grup/tim filtresine
// uyup uymadığını döndürür. personelAra() ile AYNI eşleşme mantığını kullanır;
// bu sayede "Hepsini Seç" ve "N seçili" sayacı, arama kutusu isim dışında bir
// şeyle eşleşme gösterdiğinde de ekrandaki listeyle TUTARLI kalır. q önceden
// küçük harfe çevrilmiş ve boşlukları kırpılmış olmalıdır.
function personelSorguyaUyuyorMu(p, q) {
  if (!personelGrupTimUyumluMu(p)) return false;
  if (!q) return true;
  if ((p.adSoyad || "").toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q)) {
    return true;
  }
  return !!personelIcerikEslesmesiBul(p, q);
}

// ------------------------------------------------------------------------
// Yukarıdaki personelGrupTimUyumluMu / personelSorguyaUyuyorMu'nun Ayarlar
// > Personel Listesi sekmesine ait KENDİ kopyaları. Anasayfadaki
// aktifGrupTimFiltre yerine ayarlarAktifGrupTimFiltre kullanır; böylece iki
// sekme birbirinden tamamen bağımsız filtrelenir.
// ------------------------------------------------------------------------
function ayarlarPersonelGrupTimUyumluMu(p) {
  if (!ayarlarAktifGrupTimFiltre) return true;
  let parcalar = ayarlarAktifGrupTimFiltre.split('||');
  return (p.grup || "") === parcalar[0] && (p.tim || "") === parcalar[1];
}

function ayarlarPersonelSorguyaUyuyorMu(p, q) {
  if (!ayarlarPersonelGrupTimUyumluMu(p)) return false;
  if (!q) return true;
  if ((p.adSoyad || "").toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q)) {
    return true;
  }
  return !!personelIcerikEslesmesiBul(p, q);
}

function gorselAnaSayfaGoster(pushHistory = true) {
  sessionStorage.setItem('appState', JSON.stringify({ ekran: 'main' }));
  
  let vMain = document.getElementById('viewMain');
  if (vMain) vMain.style.display = 'flex';
  
  let vCat = document.getElementById('viewCategories');
  if (vCat) vCat.style.display = 'none';
  
  let vForm = document.getElementById('viewForm');
  if (vForm) vForm.style.display = 'none';

  // Orijinal CSS yerleşiminin (flex/grid vb.) bozulmaması için boş bırakılır
  let cHeader = document.getElementById('cardHeader');
  if (cHeader) cHeader.style.display = '';

  let ht = document.getElementById('headerTitle');
  if (ht) ht.innerText = "Personel Listesi";

  // Personel detayında görünen rütbe satırı anasayfada gizlenir.
  let rutbeAlani = document.getElementById('personelRutbeAlani');
  if (rutbeAlani) { rutbeAlani.style.display = "none"; rutbeAlani.innerText = ""; }

  let btnBack = document.getElementById('btnBack');
  if (btnBack) btnBack.style.visibility = "hidden";
  
  let btnSettings = document.getElementById('btnSettings');
  if (btnSettings) {
    btnSettings.style.visibility = "visible";
    // Personel detayında kalem ikonuna dönüştürülmüş olabilir (bkz.
    // gorselKategoriEkraniGoster); anasayfada ⚙ Ayarlar ikonuna geri döndürülür.
    btnSettings.innerText = "⚙";
    btnSettings.setAttribute('onclick', 'ayarlarSayfasinaGit()');
    btnSettings.title = "";
  }
  
  aktifPersonelId = null;
  // Arama kutusunda hâlâ bir metin varsa (bkz. aktifAramaMetni), anasayfaya
  // dönüldüğünde de listeyi bu filtreyle çizer; boşsa tüm listeyi gösterir.
  let searchInputAna = document.getElementById('searchInput');
  if (searchInputAna && searchInputAna.value.trim() !== "") {
    personelAra();
  } else {
    personelListesiniCiz();
  }
  ozelGunleriKontrolEtVeGoster();
  bilgiNotunuGuncelleVeGoster();
  
  if (pushHistory) {
    history.pushState({ ekran: 'main' }, "");
  }
}


function gorselKategoriEkraniGoster(pushHistory = true) {
  sessionStorage.setItem('appState', JSON.stringify({ ekran: 'categories', personelId: aktifPersonelId }));

  let vMain = document.getElementById('viewMain');
  if (vMain) vMain.style.display = 'none';
  let vCat = document.getElementById('viewCategories');
  if (vCat) vCat.style.display = 'flex';
  let vForm = document.getElementById('viewForm');
  if (vForm) vForm.style.display = 'none';

  let p = personeller.find(x => String(x.id) === String(aktifPersonelId));
  let ht = document.getElementById('headerTitle');
  if (ht) ht.innerText = p ? p.adSoyad : "Personel Detay";

  // İsim başlığının HEMEN ALTINDA, daha küçük punto ile rütbe gösterilir.
  // Rütbe boşsa (henüz girilmemişse) alan tamamen gizlenir.
  let rutbeAlani = document.getElementById('personelRutbeAlani');
  if (rutbeAlani) {
    let rutbeMetni = p && p.rutbe ? String(p.rutbe).trim() : '';
    if (rutbeMetni) {
      rutbeAlani.innerText = rutbeMetni;
      rutbeAlani.style.display = "block";
    } else {
      rutbeAlani.innerText = "";
      rutbeAlani.style.display = "none";
    }
  }

  // Anasayfaya ait Grup/Tim filtre seçicisi personel detayında yanlış izlenime
  // (bu kişinin grup/timini değiştiriyormuş gibi) yol açtığı ve seçim yapılırsa
  // arkadaki anasayfa listesini beklenmedik şekilde değiştirdiği için burada gizlenir.
  let bilgiNotuAlani = document.getElementById('bilgiNotuAlani');
  if (bilgiNotuAlani) bilgiNotuAlani.style.display = "none";

  let btnBack = document.getElementById('btnBack');
  if (btnBack) btnBack.style.visibility = "visible";
  // Ayarlar butonu, personel detayındayken kalem (✏️) ikonuna dönüşüp bu kişinin
  // Adı Soyadı/Sicil No/Rütbe bilgisini düzenleme ekranını açar (bkz. yeniden
  // gorselAnaSayfaGoster'da ⚙ ayarlar ikonuna geri döndürülür).
  let btnSettings = document.getElementById('btnSettings');
  if (btnSettings) {
    btnSettings.style.visibility = "visible";
    btnSettings.innerText = "✏️";
    btnSettings.setAttribute('onclick', 'personelBilgileriniDuzenle()');
    btnSettings.title = "Kişi Bilgilerini Düzenle";
  }

  if (pushHistory) {
    history.pushState({ ekran: 'categories', personelId: aktifPersonelId }, "");
  }
}

// Ham bir telefon değerini (boşluklu, parantezli, başında 0 olan vb.) WhatsApp'ın
// wa.me linkinde kullanılan uluslararası formata (başında 90, sadece rakam) çevirir.
function whatsappNumaraFormatla(tel) {
  let temizTel = tel ? String(tel).replace(/\D/g, '') : '';
  if (!temizTel) return '';
  if (temizTel.startsWith('0') && temizTel.length === 11) {
    temizTel = '90' + temizTel.substring(1);
  } else if (temizTel.length === 10) {
    temizTel = '90' + temizTel;
  }
  return temizTel;
}

function personelAsilTelefonunuBul(p) {
  if (!p || !p.veriler) return "";
  let tel = "";
  Object.keys(p.veriler).forEach(kKey => {
    let kayitListesi = p.veriler[kKey];
    if (Array.isArray(kayitListesi) && kayitListesi[0]) {
      Object.keys(kayitListesi[0]).forEach(field => {
        let fLower = field.toLowerCase();
        if ((fLower.includes('tel') || fLower.includes('telefon')) && !tel) {
          let yasakliKelimeler = ['eş', 'baba', 'anne', 'çocuk', 'cocuk', 'kardeş', 'kardes', 'acil', 'yakın', 'yakin', 'referans', 'veli', 'kayınvalide', 'kayinpeder'];
          let baskasininTeliMi = yasakliKelimeler.some(yasak => fLower.includes(yasak));
          if (!baskasininTeliMi) {
            tel = kayitListesi[0][field];
          }
        }
      });
    }
  });
  return tel;
}

// Özel günün türüne (alan adına bakarak: doğum günü / evlilik yıldönümü / diğer)
// uygun WhatsApp kutlama mesajı üretir.
function ozelGunKutlamaMesajiOlustur(isim, alanAdi) {
  let alanKucuk = (alanAdi || '').toLowerCase();
  if (/evlilik|yıldönüm|yildonum|yıl.?dönümü|yil.?donumu/.test(alanKucuk)) {
    return `Merhaba ${isim}, evlilik yıldönümünüz kutlu olsun! Nice mutlu yıllara.`;
  }
  if (/dogum|doğum|yaş.?günü|yas.?gunu/.test(alanKucuk)) {
    return `Merhaba ${isim}, doğum günün kutlu olsun! Nice mutlu yıllara.`;
  }
  return `Merhaba ${isim}, özel gününüz kutlu olsun! Nice mutlu yıllara.`;
}

function ozelGunleriKontrolEtVeGoster(zorlaBildir = false) {
  const panel = document.getElementById('birthdayPanelContainer');
  if (!panel) return;
  const listContent = document.getElementById('birthdayListContent');
  if (!listContent) return;

  listContent.innerHTML = "";
  let yakinGunler = [];
  let yarin = new Date();
  yarin.setDate(yarin.getDate() + 1);
  let yarinGun = yarin.getDate();
  let yarinAy = yarin.getMonth() + 1;
  // Sadece adından "tarih" içeren bir alan olduğu anlaşılan alanlara bakılır.
  // Aksi halde "3.5" gibi bir oran/ölçü değeri veya IBAN/kod parçası da yanlışlıkla
  // "gün.ay" tarihi sanılıp gereksiz doğum günü/özel gün bildirimi üretebilir.
  let tarihAlaniDesenleri = /tarih|dogum|doğum|yıldönüm|yildonum|yıl.?dönümü|yil.?donumu|evlilik|kutlama|anma|bayram|yaş.?günü|yas.?gunu/i;

  personeller.forEach(p => {
    if (!p.veriler) return;
    let personelTel = personelAsilTelefonunuBul(p);
    Object.keys(p.veriler).forEach(mainKey => {
      let kayitlar = p.veriler[mainKey];
      if (!Array.isArray(kayitlar)) return;
      kayitlar.forEach(kayit => {
        Object.keys(kayit).forEach(alanAdi => {
          if (!tarihAlaniDesenleri.test(alanAdi)) return;
          let deger = kayit[alanAdi];
          if (!deger) return;
          let parsedDate = parseTarih(deger);
          if (parsedDate) {
            if (parsedDate.gun === yarinGun && parsedDate.ay === yarinAy) {
              yakinGunler.push({
                isim: p.adSoyad,
                etkinlik: alanAdi,
                telefon: personelTel,
                metin: `${yarinGun}.${yarinAy} (Yarın) ${p.adSoyad} (${alanAdi})`
              });
            }
          }
        });
      });
    });
  });

  if (yakinGunler.length > 0) {
    panel.style.display = 'block';
    yakinGunler.forEach(item => {
      let li = document.createElement('li');
      li.className = 'birthday-item';
      let temizTel = whatsappNumaraFormatla(item.telefon);
      let waButtonHtml = "";
      if (temizTel) {
        let waMesaj = encodeURIComponent(ozelGunKutlamaMesajiOlustur(item.isim, item.etkinlik));
        waButtonHtml = `<a href="https://wa.me/${temizTel}?text=${waMesaj}" target="_blank" class="btn-wa-mini">💬 Kutla</a>`;
      } else {
        waButtonHtml = `<span style="font-size:11px; color:#999;">Tel yok</span>`;
      }
      li.innerHTML = `
        <span style="font-weight: 500; color: #d84315;">🔔 ${guvenliMetin(item.metin)}</span>
        ${waButtonHtml}
      `;
      listContent.appendChild(li);
    });
  } else {
    panel.style.display = 'none';
  }
  ozelGunBildirimleriniGonder(yakinGunler, zorlaBildir);
}

// ========================================================================
// DOĞUM GÜNÜ / ÖZEL GÜN TARAYICI BİLDİRİMLERİ
// ========================================================================
// Not: Bu bildirimler yalnızca uygulama sekmesi tarayıcıda açıkken (arka
// planda olsa dahi) tetiklenebilir. Uygulama tamamen kapalıyken bildirim
// gönderilmesi için gerçek bir "push" altyapısı (service worker + sunucu)
// gerekir; bu, ileride sunucu tabanlı sürüme geçildiğinde eklenecektir.

// Bildirim butonunun (Ayarlar > Veri) metnini/durumunu güncel izin ve
// kullanıcı tercihine göre günceller.
function bildirimDurumunuGuncelle() {
  let durumEl = document.getElementById('bildirimDurumYazisi');
  let btn = document.getElementById('bildirimToggleBtn');
  if (!durumEl || !btn) return;

  if (typeof Notification === 'undefined') {
    durumEl.innerHTML = "Bu tarayıcı bildirim özelliğini desteklemiyor.";
    btn.style.display = "none";
    return;
  }
  btn.style.display = "block";

  if (Notification.permission === 'denied') {
    durumEl.innerHTML = '🔕 Bildirimlere izin verilmemiş. Tarayıcı site ayarlarından izni açmanız gerekir.';
    btn.innerText = "🔔 Doğum Günü Bildirimlerini Aç";
    btn.disabled = true;
    return;
  }
  btn.disabled = false;

  let aktif = Notification.permission === 'granted' && localStorage.getItem('bildirimAktif') === 'true';
  if (aktif) {
    durumEl.innerHTML = '🔔 Doğum günü/özel gün bildirimleri <b style="color:#15803d;">açık</b>. Yarın özel günü olan biri varsa bu sekme açıkken bildirim alırsınız.';
    btn.innerText = "🔕 Bildirimleri Kapat";
  } else {
    durumEl.innerHTML = '🔕 Doğum günü/özel gün bildirimleri kapalı.';
    btn.innerText = "🔔 Doğum Günü Bildirimlerini Aç";
  }
}

// Bildirim iznini ister (henüz sorulmadıysa) veya açık/kapalı durumunu değiştirir.
function bildirimIzniIsteVeAc() {
  if (typeof Notification === 'undefined') {
    return ozelBildirimGoster("Bu tarayıcı bildirim özelliğini desteklemiyor.");
  }
  if (Notification.permission === 'denied') {
    return ozelBildirimGoster("Bildirimlere izin verilmemiş. Tarayıcı/site ayarlarından izni manuel olarak açmanız gerekiyor.");
  }
  if (Notification.permission === 'granted') {
    let aktif = localStorage.getItem('bildirimAktif') === 'true';
    localStorage.setItem('bildirimAktif', aktif ? 'false' : 'true');
    bildirimDurumunuGuncelle();
    if (!aktif) ozelGunleriKontrolEtVeGoster(true);
    return;
  }
  Notification.requestPermission().then(izin => {
    if (izin === 'granted') {
      localStorage.setItem('bildirimAktif', 'true');
      ozelBildirimGoster("Bildirimler açıldı! Yarın özel günü olan biri varsa bu sekme açıkken bildirim alacaksınız.");
      ozelGunleriKontrolEtVeGoster(true);
    } else {
      ozelBildirimGoster("Bildirim izni verilmedi.");
    }
    bildirimDurumunuGuncelle();
  });
}

// Yarın özel günü olanlar için tarayıcı bildirimi gönderir. Aynı gün içinde
// tekrar tekrar rahatsız etmemek için günde en fazla bir kez gönderilir
// (zorla=true ile bu sınır bilinçli olarak bir kez atlanabilir, örn. kullanıcı
// bildirimleri az önce açtığında hemen bir doğrulama bildirimi göstermek için).
function ozelGunBildirimleriniGonder(yakinGunler, zorla = false) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (localStorage.getItem('bildirimAktif') !== 'true') return;
  if (!yakinGunler || yakinGunler.length === 0) return;

  let bugun = new Date().toDateString();
  if (!zorla && localStorage.getItem('sonBildirimTarihi') === bugun) return;
  localStorage.setItem('sonBildirimTarihi', bugun);

  let baslik = yakinGunler.length === 1
    ? `🎉 Yarın: ${yakinGunler[0].isim}`
    : `🎉 Yarın ${yakinGunler.length} özel gün var`;
  let govde = yakinGunler.map(g => `${g.isim} (${g.etkinlik})`).join(', ');

  try {
    new Notification(baslik, { body: govde });
  } catch (e) {
    // Bazı tarayıcılar/ortamlar sayfa odakta değilken bildirim oluşturmayı
    // engelleyebilir; bu durumda sessizce geçilir, uygulama akışı bozulmaz.
  }
}

function parseTarih(val) {
  if (!val) return null;
  val = val.toString().trim();
  let parts = val.split(/[.\/\\-]/);
  if (parts.length >= 2) {
    let g = parseInt(parts[0], 10);
    let a = parseInt(parts[1], 10);
    if (!isNaN(g) && !isNaN(a) && g >= 1 && g <= 31 && a >= 1 && a <= 12) {
      return { gun: g, ay: a };
    }
  }
  return null;
}

// Sıralama tercihi (aktifSiralama) hem anasayfayı hem Ayarlar > Personel
// Listesi sekmesini etkileyen ORTAK bir tercihtir (arama/grup-tim filtresi
// gibi ikiye ayrılmamıştır); bu yüzden değiştiğinde HER İKİ liste de
// kendi filtresine göre yeniden çizilir.
function siralamaDegisti(deger) {
  aktifSiralama = deger || 'sicil';
  localStorage.setItem('aktifSiralama', aktifSiralama);
  tumPersonelListeleriniYenile();
}

// Verilen personel dizisinin, aktifSiralama tercihine göre sıralanmış YENİ bir
// kopyasını döndürür. Orijinal diziyi (ve dolayısıyla kayıt/depolama sırasını) değiştirmez.
function personelSiraliDizi(liste) {
  let dizi = liste.slice();
  switch (aktifSiralama) {
    case 'ad_az':
      dizi.sort((a, b) => (a.adSoyad || '').localeCompare(b.adSoyad || '', 'tr'));
      break;
    case 'ad_za':
      dizi.sort((a, b) => (b.adSoyad || '').localeCompare(a.adSoyad || '', 'tr'));
      break;
    case 'grup':
      // Grubu/timi olmayanlar listenin en sonuna düşer.
      dizi.sort((a, b) => {
        let gCmp = (a.grup || '\uffff').localeCompare(b.grup || '\uffff', 'tr');
        if (gCmp !== 0) return gCmp;
        let tCmp = (a.tim || '\uffff').localeCompare(b.tim || '\uffff', 'tr');
        if (tCmp !== 0) return tCmp;
        return (a.adSoyad || '').localeCompare(b.adSoyad || '', 'tr');
      });
      break;
    case 'son_eklenen':
      dizi.sort((a, b) => (b.eklenmeTarihi || 0) - (a.eklenmeTarihi || 0));
      break;
    case 'sicil':
    default:
      dizi.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
      break;
  }
  return dizi;
}

// Bir personel için <li> HTML'i üretir. checkboxDahil=true iken (Ayarlar >
// Personel Listesi sekmesi) seçim kutucuğu eklenir; anasayfa listesi artık
// checkbox içermez, sadece görüntüleme/detaya gitme amaçlıdır.
function personelSatiriOlustur(p, checkboxDahil, eslesmeEtiketi = "") {
  let strId = String(p.id);
  let isChecked = seciliPersonelIds.has(strId) ? "checked" : "";
  let grupTimEtiketi = p.grup ? `<span class="grup-tim-etiketi" style="font-size:10px; color:#0284c7; background:#e0f2fe; padding:1px 6px; border-radius:4px; margin-left:6px; white-space:nowrap;">${guvenliMetin(p.grup)}${p.tim ? ' - ' + guvenliMetin(p.tim) : ''}</span>` : '';
  let checkboxHtml = checkboxDahil
    ? `<input type="checkbox" ${isChecked} onclick="event.stopPropagation(); personelSecimToggle('${oncTemizle(strId)}', this)">`
    : '';
  // Seçim listesinde (checkboxDahil) satır tıklaması detaya gitmediği için
  // gezinme okuna gerek yok; sadece anasayfa (tıklayınca detay açılan) liste
  // için gösterilir.
  let okHtml = checkboxDahil ? '' : `<span class="arrow">&gt;</span>`;
  return `
    ${checkboxHtml}
    <div style="flex:1; display:flex; flex-direction:column;">
      <span class="personel-name">${guvenliMetin(p.adSoyad)}${grupTimEtiketi}</span>
      ${eslesmeEtiketi}
    </div>
    ${okHtml}
  `;
}

function personelListesiniCiz(filtre = "") {
  const ul = document.getElementById('personelListesi');
  if (ul) ul.innerHTML = "";

  // Arama metni veya grup/tim filtresi değiştiyse sayfalamayı baştan başlat;
  // aynı filtreyle tekrar çizim yapılıyorsa (ör. "Daha Fazla Göster"),
  // o ana kadar açılmış olan kayıt sayısını korur.
  let filtreAnahtari = filtre.toLowerCase() + '|' + aktifGrupTimFiltre;
  if (anaListeSonFiltreAnahtari !== filtreAnahtari) {
    anaListeGosterilenSayisi = ANA_LISTE_SAYFA_BOYUTU;
    anaListeSonFiltreAnahtari = filtreAnahtari;
  }

  let filtrelenmis = personeller.filter(p =>
    (p.adSoyad || "").toLowerCase().includes(filtre.toLowerCase()) && personelGrupTimUyumluMu(p)
  );
  filtrelenmis = personelSiraliDizi(filtrelenmis);

  filtrelenmis.slice(0, anaListeGosterilenSayisi).forEach(p => {
    let strId = String(p.id);
    if (!ul) return;
    let li = document.createElement('li');
    li.className = "personel-item";
    li.innerHTML = personelSatiriOlustur(p, false);
    li.onclick = () => personelDetayAc(strId);
    ul.appendChild(li);
  });

  anaListeDahaFazlaButonuEkle(ul, filtrelenmis.length);
}

// Filtreye uyan kayıt sayısı o an ekranda gösterilenden fazlaysa, listenin en
// altına "Daha Fazla Göster" satırını ekler.
function anaListeDahaFazlaButonuEkle(ul, toplamFiltrelenmis) {
  if (!ul) return;
  if (toplamFiltrelenmis <= anaListeGosterilenSayisi) return;

  let kalan = toplamFiltrelenmis - anaListeGosterilenSayisi;
  let li = document.createElement('li');
  li.style.cssText = "list-style:none; padding:10px 4px;";
  li.innerHTML = `<button class="daha-fazla-goster-btn" onclick="anaListeDahaFazlaGoster()" style="background:#f1f5f9; color:#1e88e5; border:1px solid #dbeafe; padding:10px 16px; border-radius:10px; font-weight:600; font-size:13px; cursor:pointer; width:100%;">⬇️ Daha Fazla Göster (${kalan} kişi kaldı)</button>`;
  ul.appendChild(li);
}

// "Daha Fazla Göster" butonuna basıldığında bir sayfa daha (varsayılan 50 kişi)
// listeye ekler. Arama kutusu doluysa arama sonucu içinde, boşsa tüm listede
// bir sonraki grubu gösterir.
function anaListeDahaFazlaGoster() {
  anaListeGosterilenSayisi += ANA_LISTE_SAYFA_BOYUTU;
  let searchInput = document.getElementById('searchInput');
  if (searchInput && searchInput.value.trim() !== "") {
    personelAra();
  } else {
    personelListesiniCiz();
  }
}

function personelDetayAc(id, isRestore = false) {
  aktifPersonelId = String(id);
  let p = personeller.find(x => String(x.id) === aktifPersonelId);
  if(!p) return;
  let container = document.getElementById('kategoriListesi');
  if(!container) return;

  container.innerHTML = "";

  if (p.grup) {
    let grupTimBilgi = document.createElement('div');
    grupTimBilgi.className = "grup-tim-etiketi";
    grupTimBilgi.style.cssText = "background:#e0f2fe; color:#0284c7; font-size:12px; font-weight:600; text-align:center; padding:6px 10px; border-radius:8px; margin-bottom:12px;";
    grupTimBilgi.innerText = `👥 ${p.grup}${p.tim ? ' - ' + p.tim : ''}`;
    container.appendChild(grupTimBilgi);
  }

  let anaKategoriler = Object.keys(sablon);
  if (anaKategoriler.length === 0) {
    container.insertAdjacentHTML('beforeend', `
      <div style="text-align:center; color:#666; padding: 30px 10px; background: white; border-radius: 12px; border: 1px dashed #ccc;">
        <p style="margin-bottom: 10px; font-weight: bold;">Henüz tanımlı bir şablon/menü bulunmuyor.</p>
        <small style="color:#888;">Sağ üstteki ⚙️ Ayarlar menüsünden kategori ve alanlar ekleyebilirsiniz.</small>
      </div>
    `);
  } else {
    anaKategoriler.forEach(k1 => {
      let box = document.createElement('div');
      box.style.cssText = "background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 10px; margin-bottom: 12px; padding: 12px; width: 100%;";
      let altHtml = "";
      Object.keys(sablon[k1]).forEach(k2 => {
        altHtml += `
          <div onclick="formEkraniAc('${oncTemizle(k1)}', '${oncTemizle(k2)}')" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; cursor: pointer;">
            <span style="font-size: 14px; color: #495057;">• ${guvenliMetin(k2)}</span>
            <span style="color: #aaa; font-weight: bold;">&gt;</span>
          </div>
        `;
      });
      box.innerHTML = `
        <div style="font-weight: bold; color: #1e88e5; font-size: 15px; margin-bottom: 6px;">📂 ${guvenliMetin(k1)}</div>
        ${altHtml || '<div style="font-size: 12px; color: #999;">Alt başlık yok</div>'}
      `;
      container.appendChild(box);
    });
  }
  if (!isRestore) {
    gorselKategoriEkraniGoster(true);
  }
}

function formEkraniAc(k1, k2, isRestore = false) {
  aktifAnaKategori = k1;
  aktifAltKategori = k2;
  sessionStorage.setItem('appState', JSON.stringify({ ekran: 'form', personelId: aktifPersonelId, k1: k1, k2: k2 }));

  let vCat = document.getElementById('viewCategories');
  if (vCat) vCat.style.display = 'none';
  let vForm = document.getElementById('viewForm');
  if (vForm) vForm.style.display = 'flex';

  let ht = document.getElementById('headerTitle');
  if (ht) ht.innerText = k2;
  // Not: innerText DOM'a metin olarak yazıldığı için burada kaçış işlemine gerek yoktur.
  // Rütbe satırı sadece kişi detay ekranında (isim başlığının altında) anlamlı;
  // form ekranında başlık artık kategori adına döndüğü için burada gizlenir.
  let rutbeAlani = document.getElementById('personelRutbeAlani');
  if (rutbeAlani) rutbeAlani.style.display = "none";

  let btnBack = document.getElementById('btnBack');
  if (btnBack) btnBack.style.visibility = "visible";
  let btnSettings = document.getElementById('btnSettings');
  if (btnSettings) btnSettings.style.visibility = "hidden";

  let alanlar = (sablon[k1] && sablon[k1][k2]) ? sablon[k1][k2] : [];
  let p = personeller.find(x => String(x.id) === String(aktifPersonelId));
  let mainKey = `${k1}_${k2}`;
  let kayitliVeri = (p && p.veriler && p.veriler[mainKey] && p.veriler[mainKey][0]) ? p.veriler[mainKey][0] : {};

  let container = document.getElementById('formContainer');
  if (container) {
    container.innerHTML = "";
    if (alanlar.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; color:#666; padding: 20px 10px;">
          <p style="margin-bottom: 10px;">Bu menünün altında henüz veri alanı bulunmuyor.</p>
          <small style="color:#999;">Ayarlar menüsünden bu kategoriye alanlar ekleyebilirsiniz.</small>
        </div>
      `;
    } else {
      alanlar.forEach(alan => {
        let val = kayitliVeri[alan] || "";
        let placeholderText = "Değer girin...";
        let alanKucuk = alan.toLowerCase();

        if (alanKucuk.includes('telefon') || alanKucuk.includes('tel')) {
          placeholderText = "örn. 05554443322";
        } else if (alanKucuk.includes('tarih') || alanKucuk.includes('dogum')) {
          placeholderText = "örn. 15.08.1990";
        } else if (alanKucuk.includes('tc') || alanKucuk.includes('kimlik')) {
          placeholderText = "örn. 12345678901";
        }

        let group = document.createElement('div');
        group.className = "form-group";
        group.innerHTML = `
          <label>${guvenliMetin(alan)}</label>
          <input type="text" data-field="${guvenliMetin(alan)}" value="${guvenliMetin(val)}" placeholder="${guvenliMetin(placeholderText)}">
        `;
        container.appendChild(group);
      });
    }
  }
  if (!isRestore) {
    history.pushState({ ekran: 'form', personelId: aktifPersonelId, k1: k1, k2: k2 }, "");
  }
}

function verileriKaydet() {
  let p = personeller.find(x => String(x.id) === String(aktifPersonelId));
  if (!p) return;
  if (!p.veriler) p.veriler = {};

  let mainKey = `${aktifAnaKategori}_${aktifAltKategori}`;
  let formData = {};
  let inputs = document.querySelectorAll('#formContainer input');
  if (inputs.length === 0) {
    return ozelBildirimGoster("Kaydedilecek bir veri alanı bulunmuyor.");
  }
  inputs.forEach(inp => {
    formData[inp.getAttribute('data-field')] = inp.value;
  });

  p.veriler[mainKey] = [formData];
  kaydetLocal();
  ozelBildirimGoster("Form verileri cihaz hafızasına kaydedildi.");

  let vForm = document.getElementById('viewForm');
  if (vForm) vForm.style.display = 'none';
  let vCat = document.getElementById('viewCategories');
  if (vCat) vCat.style.display = 'flex';

  let ht = document.getElementById('headerTitle');
  if (ht) ht.innerText = p.adSoyad;

  let btnBack = document.getElementById('btnBack');
  if (btnBack) btnBack.style.visibility = "visible";
  let btnSettings = document.getElementById('btnSettings');
  if (btnSettings) btnSettings.style.visibility = "hidden";

  sessionStorage.setItem('appState', JSON.stringify({ ekran: 'categories', personelId: aktifPersonelId }));
}

function personelAra() {
  let q = "";
  let searchInput = document.getElementById('searchInput');
  if (searchInput) {
    q = searchInput.value.toLowerCase().trim();
    // Arama kutusunun anlık içeriğini sakla (bkz. aktifAramaMetni tanımı):
    // böylece sayfa yenilense veya Ayarlar'a geçilse bile arama kaybolmaz.
    aktifAramaMetni = searchInput.value;
    localStorage.setItem('aktifAramaMetni', aktifAramaMetni);
  }

  const ul = document.getElementById('personelListesi');
  if (ul) ul.innerHTML = "";

  // Arama metni veya grup/tim filtresi değiştiyse sayfalamayı baştan başlat.
  let filtreAnahtari = q + '|' + aktifGrupTimFiltre;
  if (anaListeSonFiltreAnahtari !== filtreAnahtari) {
    anaListeGosterilenSayisi = ANA_LISTE_SAYFA_BOYUTU;
    anaListeSonFiltreAnahtari = filtreAnahtari;
  }

  let filtrelenmis = personeller.filter(p => personelSorguyaUyuyorMu(p, q));
  filtrelenmis = personelSiraliDizi(filtrelenmis);

  filtrelenmis.slice(0, anaListeGosterilenSayisi).forEach(p => {
    let strId = String(p.id);
    if (!ul) return;
    let eslesmeEtiketi = "";
    if (q.length > 0 && !(p.adSoyad || "").toLowerCase().includes(q) && !String(p.id).toLowerCase().includes(q)) {
      let sonuc = personelIcerikEslesmesiBul(p, q);
      if (sonuc) {
        eslesmeEtiketi = `<span class="arama-eslesme-etiketi" style="font-size:11px; color:#1e88e5; background:#e3f2fd; padding:2px 6px; border-radius:4px; margin-left:8px;">${guvenliMetin(sonuc.baslik)}: ${guvenliMetin(sonuc.deger)}</span>`;
      }
    }

    let li = document.createElement('li');
    li.className = "personel-item";
    li.innerHTML = personelSatiriOlustur(p, false, eslesmeEtiketi);
    li.onclick = () => personelDetayAc(strId);
    ul.appendChild(li);
  });

  anaListeDahaFazlaButonuEkle(ul, filtrelenmis.length);
}

// ========================================================================
// AYARLAR > PERSONEL LİSTESİ SEKMESİNE ÖZEL, ANASAYFADAN BAĞIMSIZ LİSTE
// ------------------------------------------------------------------------
// Aşağıdaki üç fonksiyon (ayarlarPersonelListesiniCiz / ayarlarPersonelAra /
// ayarlarListeDahaFazlaGoster), yukarıdaki personelListesiniCiz/personelAra
// ile AYNI mantığı kendi arama kutusu (#ayarlarPersonelAramaInput), kendi
// grup/tim filtresi (ayarlarAktifGrupTimFiltre) ve kendi sayfalamasıyla
// (ayarlarPersonelListeGosterilenSayisi) uygular; #personelListesiAyarlar
// (checkbox'lı seçim listesi) içine çizer. Bu sayede anasayfada yapılan
// arama Ayarlar'daki aramayı, Ayarlar'da yapılan arama da anasayfadaki
// aramayı ETKİLEMEZ.
// ========================================================================

function ayarlarPersonelListesiniCiz(filtre = "") {
  const ulAyarlar = document.getElementById('personelListesiAyarlar');
  if (ulAyarlar) ulAyarlar.innerHTML = "";

  let filtreAnahtari = filtre.toLowerCase() + '|' + ayarlarAktifGrupTimFiltre;
  if (ayarlarPersonelListeSonFiltreAnahtari !== filtreAnahtari) {
    ayarlarPersonelListeGosterilenSayisi = AYARLAR_PERSONEL_LISTE_SAYFA_BOYUTU;
    ayarlarPersonelListeSonFiltreAnahtari = filtreAnahtari;
  }

  let filtrelenmis = personeller.filter(p =>
    (p.adSoyad || "").toLowerCase().includes(filtre.toLowerCase()) && ayarlarPersonelGrupTimUyumluMu(p)
  );
  filtrelenmis = personelSiraliDizi(filtrelenmis);

  filtrelenmis.slice(0, ayarlarPersonelListeGosterilenSayisi).forEach(p => {
    ayarlarPersonelSatiriEkle(ulAyarlar, p);
  });

  ayarlarListeDahaFazlaButonuEkle(ulAyarlar, filtrelenmis.length);
  ayarlarPersonelSayaclariniGuncelle(filtrelenmis.length);
  seciliSayisiniGuncelle();
}

function ayarlarPersonelAra() {
  let aramaInput = document.getElementById('ayarlarPersonelAramaInput');
  let q = "";
  if (aramaInput) {
    q = aramaInput.value.toLowerCase().trim();
    // Ayarlar sekmesinin arama metni de sayfa yenilense bile kaybolmasın
    // diye kalıcı saklanır (anasayfadaki aktifAramaMetni ile aynı mantık,
    // ama TAMAMEN AYRI bir localStorage anahtarında).
    ayarlarAramaMetni = aramaInput.value;
    localStorage.setItem('ayarlarAramaMetni', ayarlarAramaMetni);
  }

  const ulAyarlar = document.getElementById('personelListesiAyarlar');
  if (ulAyarlar) ulAyarlar.innerHTML = "";

  let filtreAnahtari = q + '|' + ayarlarAktifGrupTimFiltre;
  if (ayarlarPersonelListeSonFiltreAnahtari !== filtreAnahtari) {
    ayarlarPersonelListeGosterilenSayisi = AYARLAR_PERSONEL_LISTE_SAYFA_BOYUTU;
    ayarlarPersonelListeSonFiltreAnahtari = filtreAnahtari;
  }

  let filtrelenmis = personeller.filter(p => ayarlarPersonelSorguyaUyuyorMu(p, q));
  filtrelenmis = personelSiraliDizi(filtrelenmis);

  filtrelenmis.slice(0, ayarlarPersonelListeGosterilenSayisi).forEach(p => {
    let eslesmeEtiketi = "";
    if (q.length > 0 && !(p.adSoyad || "").toLowerCase().includes(q) && !String(p.id).toLowerCase().includes(q)) {
      let sonuc = personelIcerikEslesmesiBul(p, q);
      if (sonuc) {
        eslesmeEtiketi = `<span class="arama-eslesme-etiketi" style="font-size:11px; color:#1e88e5; background:#e3f2fd; padding:2px 6px; border-radius:4px; margin-left:8px;">${guvenliMetin(sonuc.baslik)}: ${guvenliMetin(sonuc.deger)}</span>`;
      }
    }
    ayarlarPersonelSatiriEkle(ulAyarlar, p, eslesmeEtiketi);
  });

  ayarlarListeDahaFazlaButonuEkle(ulAyarlar, filtrelenmis.length);
  ayarlarPersonelSayaclariniGuncelle(filtrelenmis.length);
  seciliSayisiniGuncelle();
}

// Tek bir personeli, Ayarlar > Personel Listesi'nin (checkbox'lı) satırı
// olarak listeye ekler. Satırın herhangi bir yerine tıklamak (checkbox'ın
// kendisi dahil) o kişinin seçimini değiştirir; detay ekranına gitmez (bkz.
// personelSatiriOlustur yorumu — geri tuşu akışını bozmaması için).
function ayarlarPersonelSatiriEkle(ulAyarlar, p, eslesmeEtiketi = "") {
  if (!ulAyarlar) return;
  let strId = String(p.id);
  let liA = document.createElement('li');
  liA.className = "personel-item";
  liA.innerHTML = personelSatiriOlustur(p, true, eslesmeEtiketi);
  liA.onclick = () => {
    let cb = liA.querySelector('input[type="checkbox"]');
    if (cb) {
      cb.checked = !cb.checked;
      personelSecimToggle(strId, cb);
    }
  };
  ulAyarlar.appendChild(liA);
}

// Filtreye uyan kayıt sayısı o an ekranda gösterilenden fazlaysa, Ayarlar >
// Personel Listesi'nin en altına "Daha Fazla Göster" satırını ekler
// (anaListeDahaFazlaButonuEkle'nin bu sekmeye özel kopyasıdır).
function ayarlarListeDahaFazlaButonuEkle(ul, toplamFiltrelenmis) {
  if (!ul) return;
  if (toplamFiltrelenmis <= ayarlarPersonelListeGosterilenSayisi) return;

  let kalan = toplamFiltrelenmis - ayarlarPersonelListeGosterilenSayisi;
  let li = document.createElement('li');
  li.style.cssText = "list-style:none; padding:10px 4px;";
  li.innerHTML = `<button class="daha-fazla-goster-btn" onclick="ayarlarListeDahaFazlaGoster()" style="background:#f1f5f9; color:#1e88e5; border:1px solid #dbeafe; padding:10px 16px; border-radius:10px; font-weight:600; font-size:13px; cursor:pointer; width:100%;">⬇️ Daha Fazla Göster (${kalan} kişi kaldı)</button>`;
  ul.appendChild(li);
}

// "Daha Fazla Göster" butonuna basıldığında Ayarlar listesine bir sayfa
// daha ekler. Arama kutusu doluysa arama sonucu içinde, boşsa (grup/tim
// filtresi uygulanmış) tüm listede bir sonraki grubu gösterir.
function ayarlarListeDahaFazlaGoster() {
  ayarlarPersonelListeGosterilenSayisi += AYARLAR_PERSONEL_LISTE_SAYFA_BOYUTU;
  let aramaInput = document.getElementById('ayarlarPersonelAramaInput');
  if (aramaInput && aramaInput.value.trim() !== "") {
    ayarlarPersonelAra();
  } else {
    ayarlarPersonelListesiniCiz();
  }
}

// Ayarlar > Personel Listesi sekmesindeki "Toplam: N Kişi" yazısını
// günceller.
function ayarlarPersonelSayaclariniGuncelle(gosterilenSayisi) {
  let countEl = document.getElementById('toplamPersonelSayisi');
  if (!countEl) return;
  if (ayarlarAktifGrupTimFiltre) {
    countEl.innerText = `Gösterilen: ${gosterilenSayisi} / Toplam: ${personeller.length} Kişi`;
  } else {
    countEl.innerText = `Toplam: ${personeller.length} Kişi`;
  }
}

// Personel verisi değiştiğinde (ekleme/silme/düzenleme/içe aktarma vb.) hem
// anasayfadaki hem de Ayarlar > Personel Listesi sekmesindeki listeyi, HER
// BİRİNİ KENDİ arama/grup-tim filtresine göre ayrı ayrı yeniler.
function tumPersonelListeleriniYenile() {
  let searchInput = document.getElementById('searchInput');
  if (searchInput && searchInput.value.trim() !== "") {
    personelAra();
  } else {
    personelListesiniCiz();
  }

  let ayarlarAramaInput = document.getElementById('ayarlarPersonelAramaInput');
  if (ayarlarAramaInput && ayarlarAramaInput.value.trim() !== "") {
    ayarlarPersonelAra();
  } else {
    ayarlarPersonelListesiniCiz();
  }
}


function personelSecimToggle(id, checkbox) {
  let strId = String(id);
  if (checkbox.checked) {
    seciliPersonelIds.add(strId);
  } else {
    seciliPersonelIds.delete(strId);
  }
  seciliSayisiniGuncelle();
}

function hepsiniSecToggle(checkbox) {
  // "Hepsini Seç" artık sadece Ayarlar > Personel Listesi sekmesinde var,
  // bu yüzden anasayfanın değil bu sekmenin KENDİ arama kutusu ve grup/tim
  // filtresi kullanılır (bkz. ayarlarPersonelSorguyaUyuyorMu).
  let aramaInput = document.getElementById('ayarlarPersonelAramaInput');
  let q = aramaInput ? aramaInput.value.toLowerCase().trim() : "";
  let filtrelenmis = personeller.filter(p => ayarlarPersonelSorguyaUyuyorMu(p, q));
  if (checkbox.checked) {
    filtrelenmis.forEach(p => seciliPersonelIds.add(String(p.id)));
  } else {
    filtrelenmis.forEach(p => seciliPersonelIds.delete(String(p.id)));
  }
  if (q !== "") {
    ayarlarPersonelAra();
  } else {
    ayarlarPersonelListesiniCiz();
  }
}

function seciliSayisiniGuncelle() {
  let ss = document.getElementById('seciliSayisi');
  if (ss) ss.innerText = seciliPersonelIds.size;

  // Bkz. hepsiniSecToggle: "N seçili" ve "Hepsini Seç" kutusunun doğru
  // durumu göstermesi için Ayarlar sekmesinin kendi arama/filtresiyle aynı
  // eşleşme mantığı kullanılır.
  let aramaInput = document.getElementById('ayarlarPersonelAramaInput');
  let q = aramaInput ? aramaInput.value.toLowerCase().trim() : "";
  let filtrelenmis = personeller.filter(p => ayarlarPersonelSorguyaUyuyorMu(p, q));
  let allFilteredSelected = filtrelenmis.length > 0 && filtrelenmis.every(p => seciliPersonelIds.has(String(p.id)));

  let selectAllCb = document.getElementById('selectAllCheckbox');
  if (selectAllCb) selectAllCb.checked = allFilteredSelected;
}

function yeniPersonelEkle() {
  const modal = document.createElement('div');
  modal.setAttribute('data-klavye-uyumlu', '1'); // Klavye açılınca konumunu/boyunu ayarlayan global dinleyici bu işaretle modalı bulur (bkz. klavyeIcinModallariAyarla).
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; align-items: center;
    justify-content: center; z-index: 9999;
  `;
  modal.innerHTML = `
    <div style="background:white; width:85%; max-width:340px; padding:20px; border-radius:14px; box-shadow:0 4px 20px rgba(0,0,0,0.25);">
      <h3 style="margin-top:0; color:#1e88e5;">➕ Yeni Personel</h3>
      <input id="yeniPersonelInput" type="text" placeholder="Adı Soyadı" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:8px; font-size:14px; margin-top:8px; box-sizing: border-box;">
      <input id="yeniSicilInput" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="6 Haneli Sicil No (ID)" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:8px; font-size:14px; margin-top:10px; box-sizing: border-box;">
      <input id="yeniRutbeInput" type="text" placeholder="Rütbe (örn: Polis Memuru)" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:8px; font-size:14px; margin-top:10px; box-sizing: border-box;">
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
        <button id="iptalBtn" style="background:#6b7280; color:white; border:none; padding:10px 16px; border-radius:8px; font-weight:bold; cursor:pointer;">İptal</button>
        <button id="kaydetBtn" style="background:#00897b; color:white; border:none; padding:10px 16px; border-radius:8px; font-weight:bold; cursor:pointer;">Kaydet</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const isimInput = modal.querySelector('#yeniPersonelInput');
  const sicilInput = modal.querySelector('#yeniSicilInput');
  const rutbeInput = modal.querySelector('#yeniRutbeInput');
  isimInput.focus();

  modal.querySelector('#iptalBtn').onclick = () => modal.remove();
  modal.querySelector('#kaydetBtn').onclick = () => {
    const isim = isimInput.value.trim();
    const sicilNo = sicilInput.value.trim();
    const rutbe = rutbeInput.value.trim();
    if (!isim) { isimInput.focus(); return; }
    // ÖNEMLİ DÜZELTME: Önceden "en az 3 haneli rakam" kabul ediliyordu; bu, 7-8
    // haneli veya daha kısa hatalı girişlere de izin veriyordu. Artık sicil no
    // tam olarak 6 haneli bir sayı olmak ZORUNDA (ne az ne fazla).
    if (!/^\d{6}$/.test(sicilNo)) {
      ozelBildirimGoster("Sicil numarası tam olarak 6 haneli bir sayı olmalıdır (harf, boşluk veya özel karakter kullanılamaz).");
      sicilInput.focus();
      return;
    }
    const cakisanPersonel = personeller.find(p => String(p.id) === sicilNo);
    if (cakisanPersonel) {
      ozelBildirimGoster(`Bu sicil numarası zaten "${cakisanPersonel.adSoyad}" adına kayıtlı!`);
      return;
    }
    personeller.push({ id: sicilNo, adSoyad: isim, rutbe: rutbe, veriler: {}, grup: "", tim: "", eklenmeTarihi: Date.now() });
    kaydetLocal();
    tumPersonelListeleriniYenile();
    modal.remove();
    ozelBildirimGoster(`"${isim}" personeli eklendi.`);
  };
}

// Bir personelin Adı Soyadı, Sicil No (ID) ve Rütbe bilgilerini SONRADAN
// düzenlemeyi sağlar. Personel detay ekranındaki (kategoriler ekranı) kalem
// ikonundan açılır (bkz. gorselKategoriEkraniGoster).
function personelBilgileriniDuzenle() {
  let p = personeller.find(x => String(x.id) === String(aktifPersonelId));
  if (!p) return;

  const modal = document.createElement('div');
  modal.setAttribute('data-klavye-uyumlu', '1'); // Klavye açılınca konumunu/boyunu ayarlayan global dinleyici bu işaretle modalı bulur (bkz. klavyeIcinModallariAyarla).
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; align-items: center;
    justify-content: center; z-index: 9999;
  `;
  modal.innerHTML = `
    <div style="background:white; width:85%; max-width:340px; padding:20px; border-radius:14px; box-shadow:0 4px 20px rgba(0,0,0,0.25);">
      <h3 style="margin-top:0; color:#1e88e5;">✏️ Kişi Bilgilerini Düzenle</h3>
      <input id="duzenleIsimInput" type="text" placeholder="Adı Soyadı" value="${guvenliMetin(p.adSoyad || '')}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:8px; font-size:14px; margin-top:8px; box-sizing: border-box;">
      <input id="duzenleSicilInput" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="6 Haneli Sicil No (ID)" value="${guvenliMetin(p.id || '')}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:8px; font-size:14px; margin-top:10px; box-sizing: border-box;">
      <input id="duzenleRutbeInput" type="text" placeholder="Rütbe (örn: Polis Memuru)" value="${guvenliMetin(p.rutbe || '')}" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:8px; font-size:14px; margin-top:10px; box-sizing: border-box;">
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
        <button id="duzenleIptalBtn" style="background:#6b7280; color:white; border:none; padding:10px 16px; border-radius:8px; font-weight:bold; cursor:pointer;">İptal</button>
        <button id="duzenleKaydetBtn" style="background:#00897b; color:white; border:none; padding:10px 16px; border-radius:8px; font-weight:bold; cursor:pointer;">Kaydet</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const isimInput = modal.querySelector('#duzenleIsimInput');
  const sicilInput = modal.querySelector('#duzenleSicilInput');
  const rutbeInput = modal.querySelector('#duzenleRutbeInput');
  isimInput.focus();

  modal.querySelector('#duzenleIptalBtn').onclick = () => modal.remove();
  modal.querySelector('#duzenleKaydetBtn').onclick = () => {
    const isim = isimInput.value.trim();
    const sicilNo = sicilInput.value.trim();
    const rutbe = rutbeInput.value.trim();
    if (!isim) { isimInput.focus(); return; }
    if (!/^\d{6}$/.test(sicilNo)) {
      ozelBildirimGoster("Sicil numarası tam olarak 6 haneli bir sayı olmalıdır (harf, boşluk veya özel karakter kullanılamaz).");
      sicilInput.focus();
      return;
    }
    let eskiId = String(p.id);
    if (sicilNo !== eskiId) {
      const cakisanPersonel = personeller.find(x => String(x.id) === sicilNo);
      if (cakisanPersonel) {
        ozelBildirimGoster(`Bu sicil numarası zaten "${cakisanPersonel.adSoyad}" adına kayıtlı!`);
        return;
      }
    }

    p.adSoyad = isim;
    p.rutbe = rutbe;
    if (sicilNo !== eskiId) {
      p.id = sicilNo;
      aktifPersonelId = sicilNo;
      // Sicil no değiştiğinde, geçmiş nöbet kayıtlarındaki referansların (ve
      // görüntülenen ad-soyad'ın) bu kişiyle bağı kopmasın diye orada da güncellenir.
      if (typeof nobetVerileriniGetir === 'function' && typeof nobetVerileriniKaydet === 'function') {
        try {
          let kayitlar = nobetVerileriniGetir();
          let degisti = false;
          kayitlar.forEach(k => {
            if (String(k.personelId) === eskiId) {
              k.personelId = sicilNo;
              k.adSoyad = isim;
              degisti = true;
            }
          });
          if (degisti) nobetVerileriniKaydet(kayitlar);
        } catch (e) { /* nöbet modülü/verisi yoksa sessizce geç */ }
      }
    }

    kaydetLocal();
    modal.remove();
    // Başlık, rütbe alanı ve personel listesini güncel bilgiyle yeniden çiz.
    gorselKategoriEkraniGoster(false);
    tumPersonelListeleriniYenile();
    ozelBildirimGoster("Kişi bilgileri güncellendi.");
  };
}

function secilileriSil() {
  if (seciliPersonelIds.size === 0) {
    return ozelBildirimGoster("Lütfen silinecek en az bir personel seçin!");
  }
  // Personel silme geri alınamaz bir işlem olduğu için, PIN korumasının bulunduğu
  // ayarlar.js henüz yüklenmemiş olsa bile (kullanıcı bu oturumda hiç Ayarlar
  // sayfasını açmamış olabilir) önce modül yüklenir, ardından PIN kontrolünden geçilir.
  ayarlarModuluYukle(() => {
    pinIleKorunanIslemiCalistir(() => {
      ozelOnayGoster(`${seciliPersonelIds.size} kişiyi silmek istediğinizden emin misiniz?`, (onaylandi) => {
        if (!onaylandi) return;
        personeller = personeller.filter(p => !seciliPersonelIds.has(String(p.id)));
        seciliPersonelIds.clear();
        kaydetLocal();
        tumPersonelListeleriniYenile();
      });
    });
  });
}

function whatsappKonumIste() {
  if (seciliPersonelIds.size === 0) {
    return ozelBildirimGoster("Lütfen konum istemek için en az bir personel seçin!");
  }

  let seciliListe = Array.from(seciliPersonelIds)
    .map(id => personeller.find(x => String(x.id) === String(id)))
    .filter(p => p);

  if (seciliListe.length === 1) {
    let p = seciliListe[0];
    let tel = personelAsilTelefonunuBul(p);
    if (!tel) {
      return ozelBildirimGoster(`${p.adSoyad} isimli personelin şahsi telefon numarası kayıtlarda bulunamadı!`);
    }
    let temizTel = whatsappNumaraFormatla(tel);
    let mesaj = encodeURIComponent(`Merhaba ${p.adSoyad}, lütfen güncel canlı konumunuzu bu sohbet üzerinden paylaşabilir misiniz?`);
    try {
      window.open('https://wa.me/' + temizTel + '?text=' + mesaj, '_blank');
    } catch (e) {
      ozelBildirimGoster("WhatsApp açılamadı. Lütfen tarayıcınızın pop-up engelleyicisini kontrol edin.");
    }
    return;
  }

  // Birden fazla kişi seçiliyse: tarayıcılar art arda açılan pencereleri genelde
  // engellediği için her kişi için tek tek tıklanabilir bir buton listesi gösteriyoruz.
  const modal = document.createElement('div');
  modal.setAttribute('data-klavye-uyumlu', '1'); // Klavye açılınca konumunu/boyunu ayarlayan global dinleyici bu işaretle modalı bulur (bkz. klavyeIcinModallariAyarla).
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; align-items: center;
    justify-content: center; z-index: 9999;
  `;
  let satirlarHtml = '';
  seciliListe.forEach(p => {
    let tel = personelAsilTelefonunuBul(p);
    let temizTel = whatsappNumaraFormatla(tel);
    if (temizTel) {
      let mesaj = encodeURIComponent(`Merhaba ${p.adSoyad}, lütfen güncel canlı konumunuzu bu sohbet üzerinden paylaşabilir misiniz?`);
      satirlarHtml += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #eee;">
          <span style="font-size:13px;">👤 ${guvenliMetin(p.adSoyad)}</span>
          <a href="https://wa.me/${temizTel}?text=${mesaj}" target="_blank" class="btn-wa-mini">💬 Konum İste</a>
        </div>
      `;
    } else {
      satirlarHtml += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #eee;">
          <span style="font-size:13px; color:#999;">👤 ${guvenliMetin(p.adSoyad)}</span>
          <span style="font-size:11px; color:#999;">Tel yok</span>
        </div>
      `;
    }
  });
  modal.innerHTML = `
    <div style="background:white; width:90%; max-width:380px; max-height:80vh; overflow-y:auto; padding:20px; border-radius:14px; box-shadow:0 4px 20px rgba(0,0,0,0.25);">
      <h3 style="margin-top:0; color:#1e88e5; font-size:16px;">📍 Konum İste (${seciliListe.length} kişi seçili)</h3>
      <div style="font-size:12px; color:#666; margin-bottom:10px;">Pop-up engelleyici sorun çıkarmaması için her kişiye ayrı ayrı tıklayın:</div>
      <div style="border:1px solid #eee; border-radius:8px;">${satirlarHtml}</div>
      <button onclick="this.parentElement.parentElement.remove()" style="background:#333; color:white; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; width:100%; margin-top:15px;">Kapat</button>
    </div>
  `;
  document.body.appendChild(modal);
}

function ayarlarSayfasinaGit() {
  let vMain = document.getElementById('viewMain');
  if (vMain) vMain.style.display = 'none';
  
  let vAyarlar = document.getElementById('viewAyarlar');
  if (vAyarlar) vAyarlar.style.display = 'flex';
  
  // Üstteki başlık/bilgi kutusunu tamamen gizler
  let cHeader = document.getElementById('cardHeader');
  if (cHeader) cHeader.style.display = 'none';

  sessionStorage.setItem('aktifSayfa', 'ayarlar');

  // En son açık bırakılan sekmeyi (Personel/Şablon/Grup-Tim/Veri) geri göster.
  ayarlarSekmeGoster(sessionStorage.getItem('aktifAyarlarSekmesi') || 'personel');

  // Ayarlar > Personel Listesi sekmesindeki Grup/Tim seçiciyi ve (checkbox'lı)
  // listeyi günceller. Bu sekmenin arama kutusu ve grup/tim filtresi
  // anasayfadan tamamen bağımsızdır (bkz. ayarlarAktifGrupTimFiltre).
  ayarlarGrupTimSeciciGuncelle();
  let searchInputAyarlar = document.getElementById('ayarlarPersonelAramaInput');
  if (searchInputAyarlar && searchInputAyarlar.value.trim() !== "") {
    ayarlarPersonelAra();
  } else {
    ayarlarPersonelListesiniCiz();
  }

  // Ayarlar'a özel kod (ayarlar.js) sadece burada, ilk kez ihtiyaç duyulduğunda
  // indirilir. Aşağıdaki fonksiyonlar ayarlar.js yüklenince çalışır.
  ayarlarModuluYukle(() => {
    sablonListesiniCiz();
    grupTimListesiniCiz();
    pinDurumunuGoster();
  });
  bildirimDurumunuGuncelle();

  history.pushState({ ekran: 'ayarlar' }, "");
}

function anaSayfayaDon() {
  window.history.back();
}

// ========================================================================
// AYARLAR MODÜLÜNÜN TEMBEL (LAZY) YÜKLENMESİ
// ----------------------------------------------------------------------------
// Şablon/kategori yönetimi ve Grup/Tim yönetimi gibi Ayarlar'a özel kod
// ayarlar.js dosyasında tutulur ve sayfa ilk açıldığında YÜKLENMEZ. Bu sayede
// anasayfa (personel listesi) her açıldığında bu kod indirilip çalıştırılmaz;
// personel sayısı ve şablon alan sayısı büyüdükçe anasayfanın açılış hızı
// bundan etkilenmez. Kod, kullanıcı ⚙️'ye ilk bastığında bir kereye mahsus
// indirilir ve sonraki ziyaretlerde tekrar indirilmez.
// ========================================================================
let ayarlarModuluYuklendi = false;
let ayarlarModuluYukleniyor = false;
let ayarlarModuluBekleyenler = [];

function ayarlarModuluYukle(callback) {
  if (ayarlarModuluYuklendi) {
    callback();
    return;
  }

  ayarlarModuluBekleyenler.push(callback);
  if (ayarlarModuluYukleniyor) return; // Zaten yükleniyor, kuyruğa eklendi, yeterli.

  ayarlarModuluYukleniyor = true;
  let script = document.createElement('script');
  script.src = 'ayarlar.js';
  script.onload = () => {
    ayarlarModuluYuklendi = true;
    ayarlarModuluYukleniyor = false;
    let bekleyenler = ayarlarModuluBekleyenler;
    ayarlarModuluBekleyenler = [];
    bekleyenler.forEach(fn => fn());
  };
  script.onerror = () => {
    ayarlarModuluYukleniyor = false;
    ayarlarModuluBekleyenler = [];
    ozelBildirimGoster("Ayarlar modülü (ayarlar.js) yüklenemedi. Dosyanın index.html ile aynı klasörde olduğundan emin olun.");
  };
  document.head.appendChild(script);
}

// Ayarlar sayfasındaki "Şablon / Grup-Tim / Veri" sekmeleri arasında geçiş yapar.
// Sekme butonları ve içerik kutuları her zaman DOM'da hazır olduğu için (sadece
// gizli/görünür yapılıyor), bu fonksiyon ayarlar.js yüklenmeden de çalışabilir —
// kullanıcı sekmeler arasında gezinirken ayarlar.js'in yüklenmesini beklemez.
function ayarlarSekmeGoster(sekmeAdi) {
  let sekmeler = {
    personel: { icerik: 'ayarlarSekmePersonel', btn: 'sekmeBtnPersonel' },
    sablon: { icerik: 'ayarlarSekmeSablon', btn: 'sekmeBtnSablon' },
    gruptim: { icerik: 'ayarlarSekmeGrupTim', btn: 'sekmeBtnGrupTim' },
    veri: { icerik: 'ayarlarSekmeVeri', btn: 'sekmeBtnVeri' }
  };

  Object.keys(sekmeler).forEach(key => {
    let icerikEl = document.getElementById(sekmeler[key].icerik);
    if (icerikEl) icerikEl.style.display = (key === sekmeAdi) ? 'block' : 'none';

    let btnEl = document.getElementById(sekmeler[key].btn);
    if (btnEl) btnEl.classList.toggle('aktif', key === sekmeAdi);
  });

  sessionStorage.setItem('aktifAyarlarSekmesi', sekmeAdi);
}



function yedekOlustur() {
  try {
    let yedek = {
      personeller: personeller,
      sablon: sablon,
      grupTimYapisi: grupTimYapisi,
      tarih: new Date().toLocaleString("tr-TR"),
      uygulama: "Tim Bilgileri Mobil"
    };
    let json = JSON.stringify(yedek, null, 2);
    let blob = new Blob([json], { type: "application/json" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement("a");
    a.href = url;
    a.download = "tim_bilgileri_yedek.json";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    ozelBildirimGoster("Tam yedek dosyası (Personeller + Şablonlar) başarıyla indirildi.");
  } catch (e) {
    ozelBildirimGoster("Yedek oluşturulurken hata oluştu: " + e.message);
  }
}

function exportExcel() {
  if (typeof XLSX === 'undefined') return ozelBildirimGoster("Excel kütüphanesi yüklenemedi. Lütfen internet bağlantınızı kontrol edin.");
  if (seciliPersonelIds.size === 0) return ozelBildirimGoster("Dışa aktarmak için en az bir personel seçin!");
  let anaKategoriler = Object.keys(sablon);
  if (anaKategoriler.length === 0) {
    return ozelBildirimGoster("Dışa aktarılacak kategori bulunmuyor.");
  }

  const modal = document.createElement('div');
  modal.setAttribute('data-klavye-uyumlu', '1'); // Klavye açılınca konumunu/boyunu ayarlayan global dinleyici bu işaretle modalı bulur (bkz. klavyeIcinModallariAyarla).
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; align-items: center;
    justify-content: center; z-index: 9999;
  `;
  let kategoriCheckboxHtml = '';
  anaKategoriler.forEach(k1 => {
    kategoriCheckboxHtml += `<div style="font-weight: bold; color: #1e88e5; margin-top: 10px;">📂 ${guvenliMetin(k1)}</div>`;
    Object.keys(sablon[k1]).forEach(k2 => {
      let mainKey = `${k1}_${k2}`;
      kategoriCheckboxHtml += `
        <label style="display: flex; align-items: center; gap: 8px; margin-left: 15px; margin-top: 5px; font-size: 13px; cursor: pointer;">
          <input type="checkbox" class="excel-kategori-cb" value="${guvenliMetin(mainKey)}" checked style="cursor: pointer;">
          ${guvenliMetin(k2)}
        </label>
      `;
    });
  });

  modal.innerHTML = `
    <div style="background:white; width:90%; max-width:380px; max-height:80vh; overflow-y:auto; padding:20px; border-radius:14px; box-shadow:0 4px 20px rgba(0,0,0,0.25);">
      <h3 style="margin-top:0; color:#1e88e5; font-size:16px;">📊 Excel'e Aktarılacak Alanlar</h3>
      <div style="font-size:12px; color:#666; margin-bottom:10px;">Excel'de görünmesini istediğiniz kategorileri seçin:</div>
      <div style="border: 1px solid #eee; padding: 10px; border-radius: 8px; background: #fafafa; margin-bottom: 15px; text-align: left;">
        ${kategoriCheckboxHtml}
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button id="excelIptalBtn" style="background:#6b7280; color:white; border:none; padding:8px 14px; border-radius:8px; font-weight:bold; cursor:pointer;">İptal</button>
        <button id="excelOnayBtn" style="background:#00897b; color:white; border:none; padding:8px 14px; border-radius:8px; font-weight:bold; cursor:pointer;">Excel İndir</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#excelIptalBtn').onclick = () => modal.remove();
  modal.querySelector('#excelOnayBtn').onclick = () => {
    let secilenMainKeyler = new Set();
    modal.querySelectorAll('.excel-kategori-cb:checked').forEach(cb => {
      secilenMainKeyler.add(cb.value);
    });
    if (secilenMainKeyler.size === 0) {
      ozelBildirimGoster("Lütfen en az bir kategori seçin!");
      return;
    }
    modal.remove();
    gercekExcelAktariminiYap(secilenMainKeyler);
  };
}

function gercekExcelAktariminiYap(secilenMainKeyler) {
  let maxKayitSayilari = {};
  Object.keys(sablon).forEach(k1 => {
    Object.keys(sablon[k1]).forEach(k2 => {
      let mainKey = `${k1}_${k2}`;
      if (!secilenMainKeyler.has(mainKey)) return;
      let maxCount = 1;
      personeller.forEach(p => {
        if (seciliPersonelIds.has(String(p.id)) && p.veriler && p.veriler[mainKey]) {
          if (p.veriler[mainKey].length > maxCount) maxCount = p.veriler[mainKey].length;
        }
      });
      maxKayitSayilari[mainKey] = maxCount;
    });
  });

  let sutunHaritasi = [
    { header: 'Sicil No', isStatic: true, key: 'id' },
    { header: 'Adı Soyadı', isStatic: true, key: 'adSoyad' },
    { header: 'Rütbe', isStatic: true, key: 'rutbe' },
    { header: 'Grup', isStatic: true, key: 'grup' },
    { header: 'Tim', isStatic: true, key: 'tim' }
  ];
  Object.keys(sablon).forEach(k1 => {
    Object.keys(sablon[k1]).forEach(k2 => {
      let mainKey = `${k1}_${k2}`;
      if (!secilenMainKeyler.has(mainKey)) return;
      let alanlar = sablon[k1][k2] || [];
      let tekrarSayisi = maxKayitSayilari[mainKey] || 1;
      for (let i = 0; i < tekrarSayisi; i++) {
        alanlar.forEach(alan => {
          let baslikSuffix = tekrarSayisi > 1 ? ` ${i + 1}` : '';
          sutunHaritasi.push({ header: `${alan}${baslikSuffix} (${k1} > ${k2})`, mainKey: mainKey, index: i, alan: alan });
        });
      }
    });
  });

  let excelMatris = [];
  excelMatris.push(sutunHaritasi.map(s => s.header));

  personeller.forEach(p => {
    if (seciliPersonelIds.has(String(p.id))) {
      let satir = [];
      sutunHaritasi.forEach(s => {
        if (s.isStatic) {
          let val = p[s.key];
          satir.push(val !== undefined && val !== null ? val : '');
        } else {
          let kayitListesi = p.veriler ? p.veriler[s.mainKey] : null;
          if (kayitListesi && kayitListesi[s.index] && kayitListesi[s.index][s.alan] !== undefined) {
            let val = kayitListesi[s.index][s.alan];
            if (Array.isArray(val)) {
              satir.push(val.join(', '));
            } else if (typeof val === 'object' && val !== null) {
              satir.push(val.ad || val.isim || JSON.stringify(val));
            } else {
              satir.push(val);
            }
          } else {
            satir.push('');
          }
        }
      });
      excelMatris.push(satir);
    }
  });

  let ws = XLSX.utils.aoa_to_sheet(excelMatris);
  ws['!cols'] = sutunHaritasi.map(s => {
      if (s.isStatic) {
          return { wch: s.key === 'id' ? 12 : 22 }; 
      }
      let baslikUzunlugu = s.header ? s.header.length : 15;
      return { wch: Math.min(Math.max(baslikUzunlugu + 2, 15), 28) };
  });

  let wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Personel Listesi");

  // ÖNEMLİ DÜZELTME: "Personel Listesi" sayfası Grup/Tim bilgisini sadece o gruba/tim'e
  // ATANMIŞ personel satırları üzerinden taşır. Ayarlar > Grup/Tim Yönetimi'nde
  // tanımlanmış ama hiçbir personele atanmamış grup/tim'ler (örn. henüz boş yeni
  // kurulan bir tim) bu yüzden Excel'e hiç yansımıyordu — oysa aynı senaryoda JSON
  // yedeği (yedekOlustur) grupTimYapisi'ni doğrudan ve TAMAMEN kopyaladığı için
  // sorun yaşamıyordu. Excel yedeğini JSON yedeğiyle tutarlı hale getirmek için
  // burada, atanmış olsun olmasın TÜM grup/tim yapısını ayrı bir sayfaya yazıyoruz.
  // Bu sayfa importExcel() tarafından okunup grupTimYapisi'ne geri birleştiriliyor.
  let grupTimMatris = [['Grup', 'Tim']];
  Object.keys(grupTimYapisi).forEach(grup => {
    let timler = Array.isArray(grupTimYapisi[grup]) ? grupTimYapisi[grup] : [];
    if (timler.length === 0) {
      grupTimMatris.push([grup, '']);
    } else {
      timler.forEach(tim => grupTimMatris.push([grup, tim]));
    }
  });
  let wsGrupTim = XLSX.utils.aoa_to_sheet(grupTimMatris);
  wsGrupTim['!cols'] = [{ wch: 22 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsGrupTim, "Grup_Tim_Yapisi");

  try {
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'Personel_Secmeli_Liste.xlsx';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    ozelBildirimGoster('Seçilen kategoriler ile Excel dosyası indirildi.');
  } catch(e) {
    ozelBildirimGoster('Dışa aktarma hatası: ' + e.message);
  }
}

function importExcel(event) {
  if (typeof XLSX === 'undefined') {
    event.target.value = '';
    return ozelBildirimGoster("Excel kütüphanesi yüklenemedi.");
  }
  let file = event.target.files[0];
  if (!file) return;
  let reader = new FileReader();
  reader.onload = function(e) {
    try {
      let data = new Uint8Array(e.target.result);
      let workbook = XLSX.read(data, { type: 'array' });
      let firstSheetName = workbook.SheetNames[0];
      let worksheet = workbook.Sheets[firstSheetName];
      let json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (json.length < 2) {
        event.target.value = '';
        return ozelBildirimGoster("Dosya boş veya geçersiz format.");
      }

      let basliklar = json[0];
      let eklenenSayisi = 0;
      let guncellenenSayisi = 0;
      let adSoyadIndex = basliklar.findIndex(b => b && b.toString().trim().toLowerCase().includes('ad'));
      let idIndex = basliklar.findIndex(b => b && (['id', 'sicil no', 'personel kodu'].includes(b.toString().trim().toLowerCase())));
      let rutbeIndex = basliklar.findIndex(b => b && b.toString().trim().toLowerCase() === 'rütbe');
      let grupIndex = basliklar.findIndex(b => b && b.toString().trim().toLowerCase() === 'grup');
      let timIndex = basliklar.findIndex(b => b && b.toString().trim().toLowerCase() === 'tim');

      if (adSoyadIndex === -1) adSoyadIndex = 1;

      basliklar.forEach((baslik, colIdx) => {
        if (colIdx === idIndex || colIdx === adSoyadIndex || colIdx === rutbeIndex || colIdx === grupIndex || colIdx === timIndex || !baslik) return;
        let match = baslik.toString().match(/(.*)\((.*)\)/);
        if (match) {
          let hamAlanAdi = match[1].trim();
          let icerik = match[2].trim();
          let alanAdi = hamAlanAdi.replace(/\s+\d+$/, '').trim();
          let anaKat = null;
          let altKat = null;
          if (icerik.includes('>')) {
            let parcalar = icerik.split('>');
            anaKat = parcalar[0].trim();
            altKat = parcalar[1].trim();
          } else {
            altKat = icerik;
            Object.keys(sablon).forEach(k1 => { if (sablon[k1][altKat]) anaKat = k1; });
            if (!anaKat) {
              if (!sablon['Genel Bilgiler']) sablon['Genel Bilgiler'] = {};
              anaKat = 'Genel Bilgiler';
            }
          }
          if (!sablon[anaKat]) sablon[anaKat] = {};
          if (!sablon[anaKat][altKat]) sablon[anaKat][altKat] = [];
          if (!sablon[anaKat][altKat].includes(alanAdi)) sablon[anaKat][altKat].push(alanAdi);
        }
      });

      // ÖNEMLİ DÜZELTME: Satırlar önceden TEK bir senkron for-döngüsünde işleniyordu.
      // Büyük bir Excel dosyasında (yüzlerce/binlerce personel) bu döngü ana iş
      // parçacığını uzun süre kilitleyip kullanıcı raporundaki "siyah ekranda
      // takılı kalma" görüntüsüne yol açabiliyordu — işlem aslında arka planda
      // TAMAMLANIYOR (uygulama kapatılıp açılınca geri yükleme yapılmış görünüyor)
      // ama arayüz tepkisiz kaldığı için kullanıcıya donmuş gibi görünüyordu.
      // Artık satırlar agirIslemGostergesiGoster() ile bir ilerleme göstergesi
      // gösterilerek ve parcalarHalindeIsle() ile küçük parçalar halinde, arada
      // tarayıcıya nefes payı bırakılarak işleniyor.
      let satirlar = json.slice(1);
      agirIslemGostergesiGoster("Excel dosyası okunuyor...");
      parcalarHalindeIsle(satirlar, 150, (satir, sIdx) => {
        let i = sIdx + 1; // orijinal json satır indeksiyle (id çakışması fallback'i için) tutarlılık
        if (!satir || satir.length === 0) return;
        let adSoyadVal = satir[adSoyadIndex] ? satir[adSoyadIndex].toString().trim() : '';
        if (!adSoyadVal) return;
        let excelId = (idIndex !== -1 && satir[idIndex]) ? String(satir[idIndex]) : null;

        // ÖNEMLİ DÜZELTME: Önceden burada sadece isim eşleştirmesi yapılıyordu; sicil no
        // (id) sütunu var olsa bile hiç kontrol edilmiyordu. Bu, JSON yedekten geri
        // yüklemedeki mantıkla (önce id, sonra isim eşleşmesi) TUTARSIZDI ve aynı isme
        // sahip iki farklı personelin (örn. iki tane "Ahmet Yılmaz") yanlışlıkla tek
        // kayıtta birleşmesine yol açabiliyordu. Artık önce sicil no ile, o da yoksa
        // isimle eşleştirme yapılıyor.
        // ÖNCELİK SIRASI: önce sicil no (id) ile, bulunamazsa isimle eşleştirilir
        // (bkz. jsonDosyasiniIceriAl'daki aynı mantık).
        let mevcutPersonel = excelId ? personeller.find(p => String(p.id) === excelId) : null;
        if (!mevcutPersonel) {
          mevcutPersonel = personeller.find(p => (p.adSoyad || '').toLowerCase() === adSoyadVal.toLowerCase());
        }
        if (!mevcutPersonel) {
          let idCakismasiVarMi = excelId && personeller.some(p => String(p.id) === excelId);
          let atanacakId = (excelId && !idCakismasiVarMi) ? excelId : String(Date.now() + i);
          mevcutPersonel = { id: atanacakId, adSoyad: adSoyadVal, veriler: {}, grup: "", tim: "", eklenmeTarihi: Date.now() };
          personeller.push(mevcutPersonel);
          eklenenSayisi++;
        } else {
          // ÖNEMLİ DÜZELTME: Eşleşen mevcut kişinin adı-soyadı önceden hiç
          // güncellenmiyordu (sadece grup/tim güncelleniyordu). Artık Excel'deki
          // ad-soyad da (boş değilse) mevcut kayda yazılıyor.
          if (adSoyadVal && mevcutPersonel.adSoyad !== adSoyadVal) {
            mevcutPersonel.adSoyad = adSoyadVal;
          }
          guncellenenSayisi++;
        }

        let excelGrup = (grupIndex !== -1 && satir[grupIndex]) ? satir[grupIndex].toString().trim() : '';
        let excelTim = (timIndex !== -1 && satir[timIndex]) ? satir[timIndex].toString().trim() : '';
        if (excelGrup) {
          mevcutPersonel.grup = excelGrup;
          mevcutPersonel.tim = excelTim;
          if (!Array.isArray(grupTimYapisi[excelGrup])) grupTimYapisi[excelGrup] = [];
          if (excelTim && !grupTimYapisi[excelGrup].includes(excelTim)) grupTimYapisi[excelGrup].push(excelTim);
        }

        if (rutbeIndex !== -1 && satir[rutbeIndex] !== undefined && satir[rutbeIndex] !== null) {
          let excelRutbe = satir[rutbeIndex].toString().trim();
          if (excelRutbe) mevcutPersonel.rutbe = excelRutbe;
        }

        basliklar.forEach((baslik, colIdx) => {
          if (colIdx === idIndex || colIdx === adSoyadIndex || colIdx === rutbeIndex || colIdx === grupIndex || colIdx === timIndex || !baslik) return;
          let val = satir[colIdx] !== undefined ? satir[colIdx].toString().trim() : '';
          if (!val) return;
          let match = baslik.toString().match(/(.*)\((.*)\)/);
          if (match) {
            let hamAlanAdi = match[1].trim();
            let icerik = match[2].trim();
            // Export bir kategoride birden fazla kayıt varsa başlığın sonuna " 2", " 3"
            // gibi bir kayıt numarası ekler (bkz. gercekExcelAktariminiYap > baslikSuffix).
            // Geri alırken bu numarayı kayıt indeksine çeviriyoruz; yoksa 1. kayıt (index 0)
            // kabul ediliyor. Böylece "Ad 2" sütunu artık 1. kaydın üzerine yazmak yerine
            // kendi kaydına (2. kayıt) yazılır.
            let sonekEslesme = hamAlanAdi.match(/\s+(\d+)$/);
            let kayitIndex = 0;
            if (sonekEslesme) {
              let sira = parseInt(sonekEslesme[1], 10);
              if (!isNaN(sira) && sira >= 1) kayitIndex = sira - 1;
            }
            let alanAdi = hamAlanAdi.replace(/\s+\d+$/, '').trim();
            let anaKat = null;
            let altKat = null;
            if (icerik.includes('>')) {
              let parcalar = icerik.split('>');
              anaKat = parcalar[0].trim();
              altKat = parcalar[1].trim();
            } else {
              altKat = icerik;
              Object.keys(sablon).forEach(k1 => { if (sablon[k1][altKat]) anaKat = k1; });
              if (!anaKat) anaKat = 'Genel Bilgiler';
            }
            if (sablon[anaKat] && sablon[anaKat][altKat]) {
              let mainKey = `${anaKat}_${altKat}`;
              if (!mevcutPersonel.veriler) mevcutPersonel.veriler = {};
              if (!Array.isArray(mevcutPersonel.veriler[mainKey])) mevcutPersonel.veriler[mainKey] = [];
              if (!mevcutPersonel.veriler[mainKey][kayitIndex] || typeof mevcutPersonel.veriler[mainKey][kayitIndex] !== 'object') {
                mevcutPersonel.veriler[mainKey][kayitIndex] = {};
              }
              mevcutPersonel.veriler[mainKey][kayitIndex][alanAdi] = val;
            }
          }
        });
      }, () => {
        // ÖNEMLİ DÜZELTME: "Grup_Tim_Yapisi" sayfası (bkz. gercekExcelAktariminiYap),
        // hiçbir personele atanmamış (boş) grup/tim'leri de içerir. Önceden Excel'den
        // geri yüklerken grup/tim bilgisi SADECE personel satırlarındaki Grup/Tim
        // sütunlarından okunuyordu; bu yüzden boş bir grup/tim atanmış kimse yoksa
        // hiç geri yüklenmiyordu. Bu sayfa varsa burada grupTimYapisi'ne (mevcutta
        // olanı SİLMEDEN, sadece eksikleri ekleyerek) birleştirilir.
        if (workbook.SheetNames.includes('Grup_Tim_Yapisi')) {
          let gtSheet = workbook.Sheets['Grup_Tim_Yapisi'];
          let gtJson = XLSX.utils.sheet_to_json(gtSheet, { header: 1 });
          for (let gi = 1; gi < gtJson.length; gi++) {
            let gRow = gtJson[gi];
            if (!gRow || !gRow[0]) continue;
            let grupAdi = gRow[0].toString().trim();
            if (!grupAdi) continue;
            let timAdi = (gRow[1] !== undefined && gRow[1] !== null) ? gRow[1].toString().trim() : '';
            if (!Array.isArray(grupTimYapisi[grupAdi])) grupTimYapisi[grupAdi] = [];
            if (timAdi && !grupTimYapisi[grupAdi].includes(timAdi)) grupTimYapisi[grupAdi].push(timAdi);
          }
        }

        kaydetLocal();
        tumPersonelListeleriniYenile();
        ozelGunleriKontrolEtVeGoster();
        bilgiNotunuGuncelleVeGoster();
        if (typeof grupTimListesiniCiz === 'function') grupTimListesiniCiz();
        if (typeof sablonListesiniCiz === 'function') sablonListesiniCiz();
        event.target.value = '';
        agirIslemGostergesiGizle();
        ozelBildirimGoster(`${eklenenSayisi} yeni personel eklendi, ${guncellenenSayisi} personel güncellendi.\nKategoriler, Rütbe ve Grup/Tim bilgileri (boş grup/tim'ler dahil) Excel'den başarıyla geri yüklendi.`);
      }, (islenen, toplam) => {
        agirIslemMetniGuncelle(`Excel içe aktarılıyor... (${islenen}/${toplam})`);
      });
    } catch (err) {
      // ÖNEMLİ DÜZELTME: value sıfırlanmadan hata alınırsa, kullanıcı dosyayı
      // düzeltip AYNI dosya adıyla tekrar seçtiğinde tarayıcı "değişiklik yok"
      // sayıp onchange olayını hiç tetiklemiyor, yani "hiçbir şey olmuyormuş"
      // gibi görünüyordu. Artık hata durumunda da input sıfırlanıyor.
      agirIslemGostergesiGizle();
      event.target.value = '';
      ozelBildirimGoster("Excel işlenirken hata oluştu: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function zimmetTakipPaneliAc() {
  const modal = document.createElement('div');
  modal.setAttribute('data-klavye-uyumlu', '1'); // Klavye açılınca konumunu/boyunu ayarlayan global dinleyici bu işaretle modalı bulur (bkz. klavyeIcinModallariAyarla).
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; align-items: center;
    justify-content: center; z-index: 9999;
  `;
  let kategoriSecenekleri = '';
  Object.keys(sablon).forEach(k1 => {
    Object.keys(sablon[k1]).forEach(k2 => {
      // Not: değer olarak "k1_k2" gibi birleştirilmiş bir metin yerine ayrı ayrı
      // data-* öznitelikleri kullanıyoruz. Aksi halde kategori adının içinde "_"
      // karakteri geçtiğinde (örn. "İzin_Devamsızlık") hangi kategoriye ait olduğu
      // yanlış anlaşılabilirdi.
      kategoriSecenekleri += `<option value="${guvenliMetin(`${k1}_${k2}`)}" data-k1="${guvenliMetin(k1)}" data-k2="${guvenliMetin(k2)}">${guvenliMetin(k1)} > ${guvenliMetin(k2)}</option>`;
    });
  });
  modal.innerHTML = `
    <div style="background:white; width:95%; max-width:480px; max-height:85vh; overflow-y:auto; padding:20px; border-radius:14px; box-shadow:0 4px 20px rgba(0,0,0,0.25);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0; color:#1e88e5; font-size:16px;">📦 Kapsamlı Zimmet ve Takip Paneli</h3>
        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background:none; border:none; font-size:18px; cursor:pointer;">✕</button>
      </div>

      <div style="display:flex; gap:6px; margin-bottom:14px; border-bottom:1px solid #eee;">
        <button id="zimmetSekmeBtnKategori" onclick="zimmetSekmeGoster('kategori')" style="flex:1; background:none; border:none; border-bottom:2px solid #1e88e5; color:#1e88e5; font-weight:bold; padding:8px 4px; cursor:pointer; font-size:13px;">📋 Kategori Takibi</button>
        <button id="zimmetSekmeBtnDoluluk" onclick="zimmetSekmeGoster('doluluk')" style="flex:1; background:none; border:none; border-bottom:2px solid transparent; color:#666; font-weight:bold; padding:8px 4px; cursor:pointer; font-size:13px;">📈 Doluluk Oranı</button>
      </div>

      <div id="zimmetSekmeKategori">
        <div style="font-size:12px; color:#666; margin-bottom:8px;">Takip etmek istediğiniz şablon alt kategorisini seçin:</div>
        <div style="display:flex; gap:6px; margin-bottom:12px;">
          <select id="takipKategoriSecici" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:6px; font-size:13px;">
            ${kategoriSecenekleri || '<option>Önce şablon oluşturun</option>'}
          </select>
          <button onclick="zimmetRaporuGetir()" style="background:#1e88e5; color:white; border:none; padding:8px 12px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:13px;">Listele</button>
        </div>
        <div id="zimmetRaporSonuc" style="border:1px solid #eee; background:#fafafa; padding:10px; border-radius:8px; max-height:300px; overflow-y:auto; font-size:13px;">
          <div style="text-align:center; color:#888; padding:20px;">Lütfen bir kategori seçip Listele butonuna basın.</div>
        </div>
      </div>

      <div id="zimmetSekmeDoluluk" style="display:none;">
        <div style="font-size:12px; color:#666; margin-bottom:8px;">Her personelin, tanımlı şablona göre bilgilerinin ne kadarını doldurduğunu gösterir. Eksiği en fazla olanlar en üstte listelenir.</div>
        <div id="dolulukRaporSonuc" style="border:1px solid #eee; background:#fafafa; padding:10px; border-radius:8px; max-height:340px; overflow-y:auto; font-size:13px;">
          <div style="text-align:center; color:#888; padding:20px;">Yükleniyor...</div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:15px;">
        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background:#333; color:white; border:none; padding:8px 16px; border-radius:8px; font-weight:bold; cursor:pointer;">Kapat</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  doluOranRaporuGetir();
}

// Zimmet panelindeki iki sekme (Kategori Takibi / Doluluk Oranı) arasında geçiş yapar.
function zimmetSekmeGoster(sekme) {
  let elKategori = document.getElementById('zimmetSekmeKategori');
  let elDoluluk = document.getElementById('zimmetSekmeDoluluk');
  let btnKategori = document.getElementById('zimmetSekmeBtnKategori');
  let btnDoluluk = document.getElementById('zimmetSekmeBtnDoluluk');
  if (!elKategori || !elDoluluk || !btnKategori || !btnDoluluk) return;

  let aktifStil = "flex:1; background:none; border:none; border-bottom:2px solid #1e88e5; color:#1e88e5; font-weight:bold; padding:8px 4px; cursor:pointer; font-size:13px;";
  let pasifStil = "flex:1; background:none; border:none; border-bottom:2px solid transparent; color:#666; font-weight:bold; padding:8px 4px; cursor:pointer; font-size:13px;";

  if (sekme === 'doluluk') {
    elKategori.style.display = 'none';
    elDoluluk.style.display = 'block';
    btnKategori.style.cssText = pasifStil;
    btnDoluluk.style.cssText = aktifStil;
  } else {
    elKategori.style.display = 'block';
    elDoluluk.style.display = 'none';
    btnKategori.style.cssText = aktifStil;
    btnDoluluk.style.cssText = pasifStil;
  }
}

function zimmetRaporuGetir() {
  let select = document.getElementById('takipKategoriSecici');
  let sonucContainer = document.getElementById('zimmetRaporSonuc');
  if (!select || !sonucContainer) return;
  let secilenOption = select.selectedOptions && select.selectedOptions[0];
  if (!secilenOption || !secilenOption.dataset.k1) return;
  let k1 = secilenOption.dataset.k1;
  let k2 = secilenOption.dataset.k2;
  let mainKey = `${k1}_${k2}`;
  let alanlar = (sablon[k1] && sablon[k1][k2]) ? sablon[k1][k2] : [];
  let listeHtml = '';
  let kayitSayisi = 0;

  personeller.forEach(p => {
    if (p.veriler && p.veriler[mainKey] && Array.isArray(p.veriler[mainKey])) {
      p.veriler[mainKey].forEach(kayit => {
        let doluMu = Object.values(kayit).some(val => val && val.toString().trim() !== '');
        if (doluMu) {
          kayitSayisi++;
          let detaylar = alanlar.map(alan => `<b>${guvenliMetin(alan)}:</b> ${guvenliMetin(kayit[alan] || '-')}`).join(' | ');
          listeHtml += `
            <div style="padding:8px; border-bottom:1px solid #eee; background:white; border-radius:6px; margin-bottom:6px;">
              <div style="font-weight:bold; color:#333; margin-bottom:2px;">👤 ${guvenliMetin(p.adSoyad)} <span style="font-size:11px; color:#666;">(Sicil: ${guvenliMetin(p.id)})</span></div>
              <div style="font-size:12px; color:#555;">${detaylar}</div>
            </div>
          `;
        }
      });
    }
  });
  if (kayitSayisi === 0) {
    sonucContainer.innerHTML = `<div style="text-align:center; color:#888; padding:20px;">Bu kategoride henüz kayıt girilmiş bir veri bulunmuyor.</div>`;
  } else {
    sonucContainer.innerHTML = `<div style="font-size:12px; color:#444; margin-bottom:8px; font-weight:bold;">Toplam ${kayitSayisi} kayıt bulundu:</div>` + listeHtml;
  }
}

// Mevcut şablondaki (kategori > alt kategori > alan) tüm alanların toplam
// sayısını döndürür. Sadece şablonda AN OLARAK tanımlı alanlar sayılır; bir
// kategori/alan sonradan şablondan silinmişse artık sayılmaz.
function sablonToplamAlanSayisi() {
  let toplam = 0;
  Object.keys(sablon).forEach(k1 => {
    Object.keys(sablon[k1]).forEach(k2 => {
      let alanlar = sablon[k1][k2];
      if (Array.isArray(alanlar)) toplam += alanlar.length;
    });
  });
  return toplam;
}

// Bir personelin, mevcut şablona göre doldurduğu alan sayısını döndürür.
// Birden fazla kayıt girilmiş alt kategorilerde sadece ilk kayıt (kayit[0])
// dikkate alınır; amaç "temel bilgiler ne kadar tam" sorusuna cevap vermektir.
function personelDoluAlanSayisi(p) {
  let dolu = 0;
  if (!p.veriler) return 0;
  Object.keys(sablon).forEach(k1 => {
    Object.keys(sablon[k1]).forEach(k2 => {
      let alanlar = sablon[k1][k2];
      if (!Array.isArray(alanlar)) return;
      let mainKey = `${k1}_${k2}`;
      let kayitlar = p.veriler[mainKey];
      let ilkKayit = (Array.isArray(kayitlar) && kayitlar.length > 0) ? kayitlar[0] : null;
      if (!ilkKayit) return;
      alanlar.forEach(alan => {
        let deger = ilkKayit[alan];
        if (deger !== undefined && deger !== null && String(deger).trim() !== '') dolu++;
      });
    });
  });
  return dolu;
}

// "Doluluk Oranı" sekmesini, doluluk yüzdesi en düşük (yani eksiği en fazla)
// personel en üstte olacak şekilde doldurur.
function doluOranRaporuGetir() {
  let sonucContainer = document.getElementById('dolulukRaporSonuc');
  if (!sonucContainer) return;

  let toplamAlan = sablonToplamAlanSayisi();
  if (toplamAlan === 0) {
    sonucContainer.innerHTML = `<div style="text-align:center; color:#888; padding:20px;">Henüz bir şablon tanımlı değil, bu yüzden doluluk oranı hesaplanamıyor.</div>`;
    return;
  }
  if (personeller.length === 0) {
    sonucContainer.innerHTML = `<div style="text-align:center; color:#888; padding:20px;">Henüz kayıtlı personel yok.</div>`;
    return;
  }

  let sonuclar = personeller.map(p => {
    let dolu = personelDoluAlanSayisi(p);
    let yuzde = Math.round((dolu / toplamAlan) * 100);
    return { p, dolu, yuzde };
  });

  sonuclar.sort((a, b) => a.yuzde - b.yuzde);

  let toplamYuzde = Math.round(sonuclar.reduce((acc, s) => acc + s.yuzde, 0) / sonuclar.length);

  let satirlarHtml = sonuclar.map(s => {
    let renk = s.yuzde < 50 ? '#dc2626' : (s.yuzde < 80 ? '#b45309' : '#15803d');
    return `
      <div style="padding:8px; border-bottom:1px solid #eee; background:white; border-radius:6px; margin-bottom:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-weight:bold; color:#333; font-size:12.5px;">👤 ${guvenliMetin(s.p.adSoyad)} <span style="font-size:11px; color:#666; font-weight:normal;">(Sicil: ${guvenliMetin(s.p.id)})</span></span>
          <span style="font-weight:bold; font-size:12.5px; color:${renk};">%${s.yuzde}</span>
        </div>
        <div class="dolum-cubugu-track" style="background:#eee; border-radius:4px; height:6px; overflow:hidden;">
          <div style="background:${renk}; width:${s.yuzde}%; height:100%;"></div>
        </div>
      </div>
    `;
  }).join('');

  sonucContainer.innerHTML = `
    <div style="font-size:12px; color:#444; margin-bottom:8px; font-weight:bold;">Ortalama doluluk: %${toplamYuzde} (${sonuclar.length} personel)</div>
    ${satirlarHtml}
  `;
}

// --- NÖBET VE İSTATİSTİK MODÜLÜ ---
// Not: Eskiden Excel içe aktarma sırasında ID sütunu yanlışlıkla bilimsel
// gösterime yuvarlanabiliyordu (bkz. nobetExcelYedekIceriAl'daki açıklama);
// bu yüzden bazı cihazlarda localStorage'da birden fazla kayıt AYNI id'yi
// paylaşıyor olabilir. Böyle bir durumda tek bir kaydı silmek, o id'yi
// paylaşan diğer kayıtları da silerdi. Burada veriler her okunduğunda
// çakışan id'ler tespit edilip sessizce ayrıştırılır (çakışan kayıtlara
// yeni benzersiz id verilir), böylece geçmişte oluşmuş bozuk veri de
// kendiliğinden onarılır.
function nobetVerileriniGetir() {
  let kayitlar;
  try { kayitlar = JSON.parse(localStorage.getItem('nobetKayitlari')) || []; }
  catch (e) { return []; }

  let gorulenIdler = new Set();
  let duzeltildiMi = false;
  kayitlar.forEach((k, index) => {
    let idStr = String(k.id);
    if (k.id === undefined || k.id === null || gorulenIdler.has(idStr)) {
      k.id = Date.now() + index;
      duzeltildiMi = true;
    }
    gorulenIdler.add(String(k.id));
  });
  if (duzeltildiMi) {
    localStorage.setItem('nobetKayitlari', JSON.stringify(kayitlar));
  }
  return kayitlar;
}

function nobetVerileriniKaydet(kayitlar) {
  localStorage.setItem('nobetKayitlari', JSON.stringify(kayitlar));
}

// ============================================================================
// NÖBET TÜRÜ / GÖREV YERİ ŞABLONLARI
// ----------------------------------------------------------------------------
// "Nizamiyet", "Devriye" gibi görev yerleri genelde sınırlı sayıda tekrar
// eder. Kullanıcı bir nöbet kaydederken yazdığı tür daha önce kaydedilmemişse
// otomatik olarak bu listeye eklenir (bkz. nobetEkleModalAc); böylece bir
// sonraki seferde elle yazmak yerine etiketlerden (chip) seçilebilir.
// ============================================================================
function nobetTurSablonlariniGetir() {
  try { return JSON.parse(localStorage.getItem('nobetTurSablonlari')) || []; }
  catch (e) { return []; }
}

function nobetTurSablonlariniKaydet(sablonlar) {
  localStorage.setItem('nobetTurSablonlari', JSON.stringify(sablonlar));
}

// Verilen türü (büyük/küçük harf duyarsız olarak) şablonda yoksa ekler.
function nobetTuruSablonaEkle(tur) {
  let temiz = (tur || "").trim();
  if (!temiz) return;
  let sablonlar = nobetTurSablonlariniGetir();
  let zatenVarMi = sablonlar.some(s => s.toLowerCase() === temiz.toLowerCase());
  if (!zatenVarMi) {
    sablonlar.push(temiz);
    nobetTurSablonlariniKaydet(sablonlar);
  }
}

function nobetTuruSablondanSil(tur) {
  let sablonlar = nobetTurSablonlariniGetir().filter(s => s !== tur);
  nobetTurSablonlariniKaydet(sablonlar);
}

// ============================================================================
// GÜNDÜZ / GECE HAZIR SAAT ARALIKLARI
// ----------------------------------------------------------------------------
// Gündüz: 08.00'dan başlayıp 2'şer saat artarak 18.00'a kadar 5 dilim.
// Gece: 18.00'dan başlayıp ertesi gün 08.00'a kadar 2'şer saat artan 7 dilim
// (gece yarısını geçen 22.00-00.00 dilimi dahil).
// ============================================================================
function saatIkiHaneliFormat(saat) {
  return String(((saat % 24) + 24) % 24).padStart(2, '0') + '.00';
}

function nobetSaatSablonlariniOlustur(mod) {
  let baslangicSaatleri = (mod === 'gece')
    ? [18, 20, 22, 0, 2, 4, 6]
    : [8, 10, 12, 14, 16];
  return baslangicSaatleri.map(s => ({
    baslangic: saatIkiHaneliFormat(s),
    bitis: saatIkiHaneliFormat(s + 2)
  }));
}

function parseSaatAraligi(aralikStr) {
  if (!aralikStr || !aralikStr.includes('-')) return { startMin: 0, endMin: 0 };
  let parcalar = aralikStr.split('-');
  let baslangic = parcalar[0].trim().replace('.', ':');
  let bitis = parcalar[1].trim().replace('.', ':');
  let [basSaat, basDakika] = baslangic.split(':').map(Number);
  let [bitSaat, bitDakika] = bitis.split(':').map(Number);
  let startMin = ((basSaat || 0) * 60) + (basDakika || 0);
  let endMin = ((bitSaat || 0) * 60) + (bitDakika || 0);
  if (endMin < startMin) endMin += 24 * 60;
  return { startMin, endMin };
}

function saatAraliginiHesapla(aralikStr) {
  let intv = parseSaatAraligi(aralikStr);
  let farkDakika = intv.endMin - intv.startMin;
  if (farkDakika < 0) farkDakika += 24 * 60;
  return farkDakika / 60;
}

// Bir nöbet kaydının (tarih + saat aralığı) gerçek başlangıç/bitiş zaman damgasını hesaplar.
// Gece yarısını geçen (örn. 22.00 - 06.00) nöbetler burada gerçek saat olarak modellenir.
function saatAraliginiZamanaCevir(tarihStr, aralikStr) {
  let intv = parseSaatAraligi(aralikStr);
  let parcalar = (tarihStr || '').split('-').map(Number);
  let yil = parcalar[0] || 1970, ay = parcalar[1] || 1, gun = parcalar[2] || 1;
  let gunBaslangici = new Date(yil, ay - 1, gun, 0, 0, 0, 0).getTime();
  return { baslangic: gunBaslangici + intv.startMin * 60000, bitis: gunBaslangici + intv.endMin * 60000 };
}

function saatlerCisiyorMu(yeniTarih, yeniAralik, personelId, mevcutKayitlar) {
  // Not: Sadece aynı "tarih" etiketli kayıtlarla değil, o personelin TÜM nöbetleriyle
  // gerçek zaman bazında karşılaştırma yapılır. Aksi halde gece yarısını geçen bir
  // nöbet (örn. 22.00-06.00), ertesi güne ait başka bir nöbetle çakışsa bile fark edilmezdi.
  let yeniZaman = saatAraliginiZamanaCevir(yeniTarih, yeniAralik);
  for (let k of mevcutKayitlar) {
    if (String(k.personelId) !== String(personelId)) continue;
    let varolanZaman = saatAraliginiZamanaCevir(k.tarih, k.saatAraligi);
    if (yeniZaman.baslangic < varolanZaman.bitis && varolanZaman.baslangic < yeniZaman.bitis) {
      return true;
    }
  }
  return false;
}

function nobetleriSirala(kayitlar) {
  return [...kayitlar].sort((a, b) => {
    if (a.tarih !== b.tarih) return a.tarih.localeCompare(b.tarih);
    let idA = Number(a.personelId) || 0;
    let idB = Number(b.personelId) || 0;
    if (idA !== idB) return idA - idB;
    let intA = parseSaatAraligi(a.saatAraligi);
    let intB = parseSaatAraligi(b.saatAraligi);
    return intA.startMin - intB.startMin;
  });
}

function formatSaatGoster(toplamSaat) {
  let saat = Math.floor(toplamSaat);
  let dakika = Math.round((toplamSaat - saat) * 60);
  if (dakika === 60) { saat += 1; dakika = 0; }
  if (saat > 0 && dakika > 0) return `${saat} saat ${dakika} dk`;
  if (saat > 0) return `${saat} saat`;
  return `${dakika} dk`;
}

function nobetPaneliAc() {
  const modal = document.createElement('div');
  modal.setAttribute('data-klavye-uyumlu', '1'); // Klavye açılınca konumunu/boyunu ayarlayan global dinleyici bu işaretle modalı bulur (bkz. klavyeIcinModallariAyarla).
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; align-items: center;
    justify-content: center; z-index: 9999;
  `;
  modal.innerHTML = `
    <div style="background:white; width:95%; max-width:450px; max-height:85vh; overflow-y:auto; padding:20px; border-radius:14px; box-shadow:0 4px 20px rgba(0,0,0,0.25);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
        <h3 style="margin:0; color:#e91e63; font-size:16px;">🌙 Nöbet Yönetim Paneli</h3>
        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background:none; border:none; font-size:20px; cursor:pointer;">✕</button>
      </div>
      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px;">
        <button onclick="nobetEkleModalAc()" style="background:#00897b; color:white; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px;">➕ Saat Aralıklı Nöbet Ekle</button>
        <div style="display:flex; gap:10px;">
          <button onclick="nobetIstatistikGoster()" style="flex:1; background:#1e88e5; color:white; border:none; padding:10px 6px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:12px;">📊 Nöbet Süre İstatistikleri</button>
          <button onclick="nobetYedeklemeModalAc()" style="flex:1; background:#6d4c41; color:white; border:none; padding:10px 6px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:12px;">💾 Nöbet Verisi Yedekleme</button>
        </div>
      </div>
      <div style="font-weight:bold; font-size:13px; color:#444; margin-bottom:5px;">Nöbet Çizelgesi:</div>
      <div id="nobetListeContainer" style="border:1px solid #eee; background:#fafafa; padding:8px; border-radius:8px; max-height:200px; overflow-y:auto; font-size:12px;"></div>
      <button onclick="this.parentElement.parentElement.remove()" style="background:#333; color:white; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; width:100%; margin-top:15px;">Kapat</button>
    </div>
  `;
  document.body.appendChild(modal);
  nobetGecmisiListele();
}

// ============================================================================
// NÖBET VERİSİ YEDEKLEME (JSON + EXCEL)
// ----------------------------------------------------------------------------
// Amaç: nöbet kayıtlarını (nobetKayitlari) telefonu sıfırlama, başka bir
// telefona geçme veya yanlışlıkla veri kaybı gibi durumlara karşı ayrı,
// tam ve GERİ YÜKLENEBİLİR şekilde yedekleyip geri getirebilmek. Bu, personel
// verisinden tamamen bağımsız çalışır ve mevcut "Düzenli Çizelgeyi Excel'e
// Aktar" (nobetExcelAktar) fonksiyonundan farklıdır: o bir RAPOR'dur (nöbet
// noktasına göre gruplu, tarihsiz, geri yüklenmesi amaçlanmaz), bu ise ham
// veriyi olduğu gibi taşıyan bir YEDEKTİR.
// ============================================================================
function nobetYedeklemeModalAc() {
  const modal = document.createElement('div');
  modal.setAttribute('data-klavye-uyumlu', '1'); // Klavye açılınca konumunu/boyunu ayarlayan global dinleyici bu işaretle modalı bulur (bkz. klavyeIcinModallariAyarla).
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); display: flex; align-items: center;
    justify-content: center; z-index: 10000;
  `;
  modal.innerHTML = `
    <div style="background:white; width:92%; max-width:400px; max-height:88vh; overflow-y:auto; padding:20px; border-radius:14px; box-shadow:0 4px 20px rgba(0,0,0,0.25); box-sizing:border-box;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; border-bottom:1px solid #eee; padding-bottom:10px;">
        <h3 style="margin:0; color:#6d4c41; font-size:15px;">💾 Nöbet Verisi Yedekleme</h3>
        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background:none; border:none; font-size:20px; cursor:pointer;">✕</button>
      </div>
      <div style="font-size:11px; color:#888; margin-bottom:14px;">Sıfırlama öncesi yedek almak veya kayıtları başka bir telefona taşımak için kullanın. JSON, en güvenilir ve tam yedek biçimidir.</div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:6px;">
        <button onclick="nobetJsonDisariVer()" style="background:#00897b; color:white; border:none; padding:12px 6px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:12px;">📤 JSON<br>Dışarı Ver</button>
        <button onclick="document.getElementById('nobetJsonInput').click()" style="background:#26a69a; color:white; border:none; padding:12px 6px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:12px;">📥 JSON'dan<br>İçeri Al</button>
        <button onclick="nobetExcelYedekDisariVer()" style="background:#1e88e5; color:white; border:none; padding:12px 6px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:12px;">📊 Excel<br>Dışarı Ver</button>
        <button onclick="document.getElementById('nobetExcelYedekInput').click()" style="background:#42a5f5; color:white; border:none; padding:12px 6px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:12px;">📊 Excel'den<br>İçeri Al</button>
      </div>

      <input type="file" id="nobetJsonInput" accept=".json,application/json" style="display:none" onchange="nobetJsonIceriAl(event)">
      <input type="file" id="nobetExcelYedekInput" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" style="display:none" onchange="nobetExcelYedekIceriAl(event)">

      <div style="border-top:1px solid #eee; margin-top:14px; padding-top:12px;">
        <button onclick="nobetExcelAktar()" style="width:100%; background:none; border:1px solid #d1d5db; color:#555; padding:9px; border-radius:8px; cursor:pointer; font-size:11px;">📄 Nöbet Noktası Raporu</button>
      </div>

      <button onclick="this.parentElement.parentElement.remove()" style="background:#333; color:white; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; width:100%; margin-top:12px;">Kapat</button>
    </div>
  `;
  document.body.appendChild(modal);
}

// ---- JSON Dışarı Ver ----
function nobetJsonDisariVer() {
  let kayitlar = nobetVerileriniGetir();
  if (kayitlar.length === 0) {
    return ozelBildirimGoster("Dışa aktarılacak nöbet kaydı bulunmuyor.");
  }
  let jsonMetni = JSON.stringify({ nobetKayitlari: kayitlar }, null, 2);
  let blob = new Blob([jsonMetni], { type: 'application/json' });
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = 'Nobet_Yedek.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  ozelBildirimGoster("Nöbet verileri JSON yedeği olarak indirildi.");
}

// ---- JSON İçeri Al ----
// Kayıtlar 'id' alanına göre eşleştirilir: aynı id zaten varsa atlanır (aynı
// yedek yanlışlıkla iki kez içeri alınırsa kayıt ikilenmez), yoksa eklenir.
function nobetJsonIceriAl(event) {
  let file = event.target.files[0];
  if (!file) return;
  let reader = new FileReader();
  reader.onload = function(e) {
    try {
      let parsed = JSON.parse(e.target.result);
      let yeniKayitlar = null;
      if (Array.isArray(parsed)) {
        yeniKayitlar = parsed;
      } else if (parsed && Array.isArray(parsed.nobetKayitlari)) {
        yeniKayitlar = parsed.nobetKayitlari;
      }
      if (!yeniKayitlar || yeniKayitlar.length === 0) {
        throw new Error("Yedek dosyasında geçerli nöbet kaydı bulunamadı.");
      }

      let mevcutKayitlar = nobetVerileriniGetir();
      let eklenenSayisi = 0;
      let atlananSayisi = 0;
      yeniKayitlar.forEach(yk => {
        if (!yk || !yk.personelId || !yk.tarih) return;
        let zatenVarMi = mevcutKayitlar.some(mk => String(mk.id) === String(yk.id));
        if (zatenVarMi) { atlananSayisi++; return; }
        mevcutKayitlar.push(yk);
        eklenenSayisi++;
      });

      nobetVerileriniKaydet(mevcutKayitlar);
      event.target.value = '';
      nobetGecmisiListele();
      ozelBildirimGoster(`Nöbet yedeği geri yüklendi!\n• Eklenen: ${eklenenSayisi}\n• Zaten mevcut (atlanan): ${atlananSayisi}`);
    } catch (err) {
      event.target.value = '';
      ozelBildirimGoster("JSON dosyası okunurken hata oluştu: " + err.message);
    }
  };
  reader.readAsText(file);
}

// ---- Excel Dışarı Ver ----
// DİKKAT: Bu, nöbet noktası bazlı, biçimlendirilmiş RAPORDAN (nobetExcelAktar)
// FARKLIDIR. Burada amaç geri yüklenebilirlik olduğu için sade, tek satır =
// tek kayıt şeklinde, ID dahil TÜM alanları içeren düz bir tablo üretilir.
function nobetExcelYedekDisariVer() {
  if (typeof XLSX === 'undefined') {
    return ozelBildirimGoster("Excel kütüphanesi (SheetJS) yüklenemedi.");
  }
  let kayitlar = nobetVerileriniGetir();
  if (kayitlar.length === 0) {
    return ozelBildirimGoster("Dışa aktarılacak nöbet kaydı bulunmuyor.");
  }

  let excelMatris = [
    ["ID", "Tarih", "Sicil No", "Ad Soyad", "Saat Aralığı", "Nöbet Türü / Görev Yeri"]
  ];
  kayitlar.forEach(k => {
    // ID METİN olarak yazılır (String(...)). Aksi halde Excel, 13 haneli
    // Date.now() tabanlı ID'leri "Genel" sayı biçiminde otomatik olarak
    // bilimsel gösterime (ör. 1,78989E+12) yuvarlar; bu sadece görsel bir
    // yuvarlama olsa da kafa karıştırır ve biri değeri o haliyle kopyalayıp
    // elle düzenlerse gerçek veri kaybı riski oluşturur. Metin olarak
    // yazıldığında Excel değeri olduğu gibi, tam haliyle gösterir.
    excelMatris.push([String(k.id), k.tarih, k.personelId, k.adSoyad, k.saatAraligi || '-', k.tur || '']);
  });

  let ws = XLSX.utils.aoa_to_sheet(excelMatris);
  ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 16 }, { wch: 20 }];
  // ID sütunundaki her hücreye açıkça "metin" hücre biçimi (@) verilir; bazı
  // Excel sürümleri, içeriği sayısal görünen metin hücrelerini yine de
  // otomatik biçimlendirmeye çalışabiliyor. Bu, ekstra bir güvenlik katmanı.
  for (let r = 1; r <= kayitlar.length; r++) {
    let hucreAdresi = XLSX.utils.encode_cell({ r: r, c: 0 });
    if (ws[hucreAdresi]) ws[hucreAdresi].z = '@';
  }
  let wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Nöbet Yedek");
  try {
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'Nobet_Yedek.xlsx';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    ozelBildirimGoster("Nöbet verileri Excel yedeği olarak indirildi.");
  } catch (e) {
    ozelBildirimGoster("Excel oluşturulurken hata: " + e.message);
  }
}

// ---- Excel İçeri Al ----
// nobetExcelYedekDisariVer() ile üretilen dosyayı (ID, Tarih, Sicil No, Ad
// Soyad, Saat Aralığı, Tür sütunları) okur. ID sütunu varsa onunla, yoksa
// (elle düzenlenmiş bir dosyaysa) yeni bir id üretilerek eklenir.
// raw:false + dateNF kullanılır: Excel'de tarih hücresi olarak algılanıp
// yeniden biçimlenmiş olabilecek "Tarih" sütununu güvenle metne çevirir.
function nobetExcelYedekIceriAl(event) {
  if (typeof XLSX === 'undefined') {
    event.target.value = '';
    return ozelBildirimGoster("Excel kütüphanesi (SheetJS) yüklenemedi.");
  }
  let file = event.target.files[0];
  if (!file) return;
  let reader = new FileReader();
  reader.onload = function(e) {
    try {
      let data = new Uint8Array(e.target.result);
      let workbook = XLSX.read(data, { type: 'array' });
      let firstSheetName = workbook.SheetNames[0];
      let worksheet = workbook.Sheets[firstSheetName];
      // ÖNEMLİ: raw:false KULLANILMAZ. raw:false tüm hücreleri (ID sütunu dahil)
      // Excel'in "genel" gösterim biçimine göre metne çeviriyordu; ID'ler
      // Date.now() tabanlı 13 haneli büyük sayılar olduğu için bu biçimlendirme
      // onları bilimsel gösterime yuvarlıyordu (örn. 1737369600123 ve
      // 1737369600456 ikisi de "1.7374E+12" olabiliyordu). Sonuç: farklı
      // kayıtlar aynı id'ye sahip oluyor, bir kaydı silmek o id'yi paylaşan
      // TÜM kayıtları siliyordu. raw:true ile ID'ler hiç yuvarlanmadan, ham
      // sayı olarak okunur; Tarih sütunu ise aşağıda ayrıca güvenle metne
      // çevrilir.
      let json = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });
      if (json.length < 2) {
        event.target.value = '';
        return ozelBildirimGoster("Dosya boş veya geçersiz format.");
      }

      let mevcutKayitlar = nobetVerileriniGetir();
      let eklenenSayisi = 0;
      let atlananSayisi = 0;
      let hataliSatirSayisi = 0;

      for (let i = 1; i < json.length; i++) {
        let satir = json[i];
        if (!satir || satir.length === 0) continue;
        let [id, tarih, personelId, adSoyad, saatAraligi, tur] = satir;
        if (!tarih || !personelId) { hataliSatirSayisi++; continue; }

        // Tarih hücresi (raw:true sayesinde) gerçek bir Excel tarihi olarak
        // gelmişse sayısal seri numarası (veya Date nesnesi) olur; bunu
        // yyyy-mm-dd metnine çeviriyoruz. Zaten metin olarak gelmişse
        // (aoa_to_sheet ile üretilen kendi yedeğimizde olduğu gibi) olduğu
        // gibi bırakılır.
        let tarihMetni;
        if (tarih instanceof Date) {
          tarihMetni = tarih.toISOString().slice(0, 10);
        } else if (typeof tarih === 'number' && typeof XLSX.SSF !== 'undefined') {
          tarihMetni = XLSX.SSF.format('yyyy-mm-dd', tarih);
        } else {
          tarihMetni = String(tarih);
        }

        // ID sütunu boşsa yeni id üret; doluysa raw haliyle (sayı ise sayı,
        // metin ise metin olarak) hiçbir yuvarlama yapılmadan kullanılır.
        let kayitId = (id !== undefined && id !== null && id !== '') ? id : (Date.now() + i);
        let zatenVarMi = mevcutKayitlar.some(mk => String(mk.id) === String(kayitId));
        if (zatenVarMi) { atlananSayisi++; continue; }

        mevcutKayitlar.push({
          id: isNaN(Number(kayitId)) ? kayitId : Number(kayitId),
          tarih: tarihMetni,
          saatAraligi: saatAraligi || '',
          tur: tur || '',
          personelId: personelId,
          adSoyad: adSoyad || ''
        });
        eklenenSayisi++;
      }

      nobetVerileriniKaydet(mevcutKayitlar);
      event.target.value = '';
      nobetGecmisiListele();
      ozelBildirimGoster(`Nöbet Excel yedeği geri yüklendi!\n• Eklenen: ${eklenenSayisi}\n• Zaten mevcut (atlanan): ${atlananSayisi}${hataliSatirSayisi > 0 ? `\n• Eksik/hatalı satır: ${hataliSatirSayisi}` : ''}`);
    } catch (err) {
      event.target.value = '';
      ozelBildirimGoster("Excel dosyası okunurken hata oluştu: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function saatFormatGecerliMi(str) {
  return /^([0-1]?[0-9]|2[0-3])[.:]([0-5][0-9])$/.test((str || '').trim());
}

function nobetEkleModalAc() {
  if (personeller.length === 0) {
    return ozelBildirimGoster("Önce ana listeye personel eklemelisiniz!");
  }
  const modal = document.createElement('div');
  modal.setAttribute('data-klavye-uyumlu', '1'); // Klavye açılınca konumunu/boyunu ayarlayan global dinleyici bu işaretle modalı bulur (bkz. klavyeIcinModallariAyarla).
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); display: flex; align-items: center;
    justify-content: center; z-index: 10000;
  `;
  let bugunTarih = new Date().toISOString().split('T')[0];
  modal.innerHTML = `
    <div style="background:white; width:90%; max-width:360px; padding:20px; border-radius:14px; box-shadow:0 4px 20px rgba(0,0,0,0.25); max-height:88vh; overflow-y:auto; box-sizing:border-box;">
      <h3 style="margin-top:0; color:#00897b; font-size:15px;">➕ Saat Aralıklı Nöbet Atama</h3>
      <div style="margin-bottom:10px;">
        <label style="font-size:12px; font-weight:bold; color:#555;">Nöbet Tarihi:</label>
        <input type="date" id="nobetTarihInput" value="${bugunTarih}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; margin-top:4px; box-sizing:border-box;">
      </div>
      <div style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-size:12px; font-weight:bold; color:#555;">Başlangıç ve Bitiş Saati:</span>
          <button type="button" id="nobetVardiyaToggleBtn" style="background:#fff3e0; color:#e65100; border:1px solid #ffcc80; padding:4px 10px; border-radius:12px; font-size:11px; font-weight:bold; cursor:pointer; white-space:nowrap;">☀️ Gündüz</button>
        </div>
        <div style="display:flex; gap:8px;">
          <div style="flex:1;">
            <input type="text" id="nobetBaslangicSaat" value="08.00" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">
          </div>
          <div style="flex:1;">
            <input type="text" id="nobetBitisSaat" value="10.00" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">
          </div>
        </div>
        <div id="nobetSaatSablonListesi" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;"></div>
        <div style="font-size:10px; color:#999; margin-top:4px;">Hazır dilimlerden seçebilir veya saatleri kutulara elle yazabilirsiniz.</div>
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:12px; font-weight:bold; color:#555;">Nöbet Türü / Görev Yeri:</label>
        <input type="text" id="nobetTurInput" placeholder="Örn: Nizamiyet / Devriye" autocomplete="off" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; margin-top:4px; box-sizing:border-box;">
        <div id="nobetTurSablonListesi" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;"></div>
      </div>
      <div style="margin-bottom:15px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:8px;">
          <label style="font-size:12px; font-weight:bold; color:#555; white-space:nowrap;">Personel Seç:</label>
          <select id="nobetGrupTimFiltre" style="flex:1; max-width:60%; padding:4px 6px; border:1px solid #d1d5db; border-radius:8px; font-size:11px; color:#444; background:#f9fafb;">
            <option value="">Tüm Grup/Timler</option>
          </select>
        </div>
        <input type="text" id="nobetPersonelAramaInput" placeholder="İsim veya Sicil No ile ara..." autocomplete="off" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; margin-top:4px; box-sizing:border-box;">
        <div id="nobetPersonelSeciliGosterge" style="font-size:12px; color:#00897b; font-weight:bold; margin-top:6px; display:none;"></div>
        <div id="nobetPersonelListesi" style="max-height:170px; overflow-y:auto; border:1px solid #e5e7eb; border-radius:6px; margin-top:6px;"></div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background:#6b7280; color:white; border:none; padding:8px 12px; border-radius:6px; font-weight:bold; cursor:pointer;">Kapat</button>
        <button id="nobetKaydetOnayBtn" style="background:#00897b; color:white; border:none; padding:8px 12px; border-radius:6px; font-weight:bold; cursor:pointer;">Kaydet</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // ---- Başlangıç/Bitiş Saati: Gündüz (08.00-18.00, 2'şer saat) / Gece
  // (18.00 - ertesi gün 08.00, 2'şer saat) hazır dilimleri. Üstteki buton
  // modu değiştirir, dilimlerden birine tıklamak her iki kutuyu da doldurur;
  // kutular yine de elle değiştirilebilir kalır. ----
  const baslangicSaatInput = modal.querySelector('#nobetBaslangicSaat');
  const bitisSaatInput = modal.querySelector('#nobetBitisSaat');
  const vardiyaToggleBtn = modal.querySelector('#nobetVardiyaToggleBtn');
  const saatSablonListesi = modal.querySelector('#nobetSaatSablonListesi');
  let nobetVardiyaModu = 'gunduz';

  function nobetSaatSablonlariniCiz() {
    vardiyaToggleBtn.innerText = (nobetVardiyaModu === 'gece') ? '🌙 Gece' : '☀️ Gündüz';
    let dilimler = nobetSaatSablonlariniOlustur(nobetVardiyaModu);
    saatSablonListesi.innerHTML = "";
    dilimler.forEach(d => {
      let seciliMi = baslangicSaatInput.value.trim() === d.baslangic && bitisSaatInput.value.trim() === d.bitis;
      let chip = document.createElement('span');
      chip.style.cssText = `display:inline-flex; align-items:center; padding:5px 9px; border-radius:14px; font-size:12px; cursor:pointer; border:1px solid ${seciliMi ? '#00897b' : '#d1d5db'}; background:${seciliMi ? '#e0f2f1' : '#f9fafb'}; color:${seciliMi ? '#00695c' : '#444'};`;
      chip.innerText = `${d.baslangic} - ${d.bitis}`;
      chip.onclick = () => {
        baslangicSaatInput.value = d.baslangic;
        bitisSaatInput.value = d.bitis;
        nobetSaatSablonlariniCiz();
      };
      saatSablonListesi.appendChild(chip);
    });
  }

  vardiyaToggleBtn.onclick = () => {
    nobetVardiyaModu = (nobetVardiyaModu === 'gece') ? 'gunduz' : 'gece';
    nobetSaatSablonlariniCiz();
  };
  baslangicSaatInput.addEventListener('input', nobetSaatSablonlariniCiz);
  bitisSaatInput.addEventListener('input', nobetSaatSablonlariniCiz);
  nobetSaatSablonlariniCiz();

  // ---- Personel Seç: "Personel Ara..." ile aynı mantık (arama kutusu +
  // yazdıkça daralan, tıklanınca seçilen liste). Tüm personeli tek seferde
  // gösteren <select> yerine kullanılıyor; büyük listelerde performans için
  // en fazla NOBET_PERSONEL_LISTE_LIMIT sonuç render edilir. Yanındaki
  // Grup/Tim seçici, aynı gruptaki personeli bulmayı hızlandırmak için arama
  // sonucunu ek olarak daraltır (aramayla birlikte kullanılabilir). ----
  const NOBET_PERSONEL_LISTE_LIMIT = 50;
  let nobetSeciliPersonelId = null;

  const aramaInput = modal.querySelector('#nobetPersonelAramaInput');
  const listeEl = modal.querySelector('#nobetPersonelListesi');
  const secildiGosterge = modal.querySelector('#nobetPersonelSeciliGosterge');
  const grupTimFiltreSecici = modal.querySelector('#nobetGrupTimFiltre');

  // Grup/Tim seçiciyi doldurur (grupTimYapisi: { grup: [tim1, tim2, ...] }).
  Object.keys(grupTimYapisi).sort((a, b) => a.localeCompare(b, 'tr')).forEach(grup => {
    (grupTimYapisi[grup] || []).slice().sort((a, b) => a.localeCompare(b, 'tr')).forEach(tim => {
      let opt = document.createElement('option');
      opt.value = `${grup}||${tim}`;
      opt.innerText = `${grup} - ${tim}`;
      grupTimFiltreSecici.appendChild(opt);
    });
  });

  function nobetPersonelListesiniCiz() {
    let q = (aramaInput.value || "").toLowerCase().trim();
    let grupTimSecim = grupTimFiltreSecici.value;
    let filtrelenmis = personeller
      .filter(p => (p.adSoyad || "").toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q))
      .filter(p => {
        if (!grupTimSecim) return true;
        let parcalar = grupTimSecim.split('||');
        return (p.grup || "") === parcalar[0] && (p.tim || "") === parcalar[1];
      })
      .slice()
      .sort((a, b) => (a.adSoyad || "").localeCompare(b.adSoyad || "", 'tr'));

    listeEl.innerHTML = "";
    if (filtrelenmis.length === 0) {
      listeEl.innerHTML = '<div style="color:#999; font-size:12px; text-align:center; padding:10px;">Personel bulunamadı.</div>';
      return;
    }

    filtrelenmis.slice(0, NOBET_PERSONEL_LISTE_LIMIT).forEach(p => {
      let strId = String(p.id);
      let seciliMi = nobetSeciliPersonelId === strId;
      let satir = document.createElement('div');
      satir.style.cssText = `display:flex; justify-content:space-between; align-items:center; gap:8px; padding:8px 10px; font-size:13px; cursor:pointer; border-bottom:1px solid #f0f0f0; ${seciliMi ? 'background:#e0f2fe; color:#0284c7; font-weight:bold;' : 'color:#333;'}`;
      satir.innerHTML = `<span>${seciliMi ? '✓ ' : ''}${guvenliMetin(p.adSoyad)}</span><span style="color:#999; font-size:11px; white-space:nowrap;">Sicil: ${guvenliMetin(strId)}</span>`;
      satir.onclick = () => {
        nobetSeciliPersonelId = strId;
        secildiGosterge.style.display = 'block';
        secildiGosterge.innerText = `✓ Seçili: ${p.adSoyad} (Sicil: ${strId})`;
        nobetPersonelListesiniCiz();
      };
      listeEl.appendChild(satir);
    });

    if (filtrelenmis.length > NOBET_PERSONEL_LISTE_LIMIT) {
      let bilgi = document.createElement('div');
      bilgi.style.cssText = "text-align:center; color:#999; font-size:11px; padding:6px;";
      bilgi.innerText = `+${filtrelenmis.length - NOBET_PERSONEL_LISTE_LIMIT} sonuç daha var, aramayı daraltın`;
      listeEl.appendChild(bilgi);
    }
  }

  aramaInput.addEventListener('input', nobetPersonelListesiniCiz);
  grupTimFiltreSecici.addEventListener('change', nobetPersonelListesiniCiz);
  nobetPersonelListesiniCiz();

  // ---- Nöbet Türü / Görev Yeri şablonları: daha önce kullanılmış türler
  // etiket (chip) olarak gösterilir. Bir etikete tıklamak metin kutusunu
  // doldurur; ✕'e tıklamak o türü şablondan siler. Kaydedilirken kutudaki
  // metin şablonda yoksa otomatik eklenir (bkz. nobetTuruSablonaEkle). ----
  const turInput = modal.querySelector('#nobetTurInput');
  const turSablonListesi = modal.querySelector('#nobetTurSablonListesi');

  function nobetTurSablonlariniCiz() {
    let sablonlar = nobetTurSablonlariniGetir().slice().sort((a, b) => a.localeCompare(b, 'tr'));
    turSablonListesi.innerHTML = "";
    if (sablonlar.length === 0) return;

    sablonlar.forEach(tur => {
      let seciliMi = turInput.value.trim().toLowerCase() === tur.toLowerCase();
      let chip = document.createElement('span');
      chip.style.cssText = `display:inline-flex; align-items:center; gap:5px; padding:5px 9px; border-radius:14px; font-size:12px; cursor:pointer; border:1px solid ${seciliMi ? '#00897b' : '#d1d5db'}; background:${seciliMi ? '#e0f2f1' : '#f9fafb'}; color:${seciliMi ? '#00695c' : '#444'};`;
      chip.innerHTML = `<span>${guvenliMetin(tur)}</span><span class="nobet-tur-sil" style="color:#999; font-weight:bold; padding:0 2px;">✕</span>`;
      chip.onclick = () => {
        turInput.value = tur;
        nobetTurSablonlariniCiz();
      };
      chip.querySelector('.nobet-tur-sil').onclick = (e) => {
        e.stopPropagation();
        nobetTuruSablondanSil(tur);
        nobetTurSablonlariniCiz();
      };
      turSablonListesi.appendChild(chip);
    });
  }

  turInput.addEventListener('input', nobetTurSablonlariniCiz);
  nobetTurSablonlariniCiz();

  modal.querySelector('#nobetKaydetOnayBtn').onclick = () => {
    let tarih = document.getElementById('nobetTarihInput').value;
    let basSaat = document.getElementById('nobetBaslangicSaat').value.trim();
    let bitSaat = document.getElementById('nobetBitisSaat').value.trim();
    let tur = document.getElementById('nobetTurInput').value.trim();
    let personelId = nobetSeciliPersonelId;

    if (!personelId) {
      return ozelBildirimGoster("Lütfen listeden bir personel seçin!");
    }
    if (!tur || !basSaat || !bitSaat) {
      return ozelBildirimGoster("Lütfen saatleri ve nöbet türünü eksiksiz doldurun!");
    }
    if (!saatFormatGecerliMi(basSaat) || !saatFormatGecerliMi(bitSaat)) {
      return ozelBildirimGoster("Lütfen saatleri geçerli bir formatta girin (örn: 08.00 veya 22:30).");
    }
    if (!tarih) {
      return ozelBildirimGoster("Lütfen bir nöbet tarihi seçin.");
    }

    let p = personeller.find(x => String(x.id) === String(personelId));
    if (!p) return;
    let saatAraligi = `${basSaat} - ${bitSaat}`;
    let kayitlar = nobetVerileriniGetir();

    if (saatlerCisiyorMu(tarih, saatAraligi, p.id, kayitlar)) {
      // Not: alert() yerine uygulamanın kendi bildirim penceresi kullanılıyor (bkz. ozelBildirimGoster).
      return ozelBildirimGoster(`⚠️ Çakışma Uyarısı: "${p.adSoyad}" adlı personelin ${tarih} tarihinde bu saat aralığıyla kesişen başka bir nöbeti bulunuyor!`);
    }

    kayitlar.push({
      id: Date.now(),
      tarih: tarih,
      saatAraligi: saatAraligi,
      tur: tur,
      personelId: p.id,
      adSoyad: p.adSoyad
    });

    nobetVerileriniKaydet(kayitlar);
    nobetTuruSablonaEkle(tur);
    nobetTurSablonlariniCiz();
    ozelBildirimGoster(`"${p.adSoyad}" için nöbet eklendi. Başka personel ekleyebilirsiniz.`);
    nobetGecmisiListele();

    // Modal KAPANMAZ: tarih/saat/tür aynı kalır (aynı vardiyaya art arda
    // personel eklemek kolaylaşsın diye), sadece personel seçimi ve arama
    // kutusu sıfırlanır ki yanlışlıkla aynı kişi tekrar eklenmesin.
    nobetSeciliPersonelId = null;
    aramaInput.value = "";
    secildiGosterge.style.display = 'none';
    nobetPersonelListesiniCiz();
    aramaInput.focus();
  };
}

function nobetGecmisiListele() {
  let container = document.getElementById('nobetListeContainer');
  if (!container) return;
  let kayitlar = nobetVerileriniGetir();
  if (kayitlar.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#888; padding:10px;">Henüz kayıtlı nöbet yok.</div>`;
    return;
  }
  let siraliKayitlar = nobetleriSirala(kayitlar);
  let html = '';
  siraliKayitlar.forEach((k) => {
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:6px; border-bottom:1px solid #eee; background:white; border-radius:4px; margin-bottom:4px;">
        <div>
          <b style="color:#333;">📅 ${guvenliMetin(k.tarih)} | [Sicil: ${guvenliMetin(k.personelId)}] ${guvenliMetin(k.adSoyad)}</b> <span style="color:#666;">(${guvenliMetin(k.tur)})</span>
          <div style="font-size:10px; color:#888;">⏰ <b>${guvenliMetin(k.saatAraligi || 'Tüm Gün')}</b></div>
        </div>
        <button onclick="nobetKayitSil(${k.id})" style="background:#e53935; color:white; border:none; padding:3px 6px; border-radius:4px; font-size:10px; cursor:pointer;">Sil</button>
      </div>
    `;
  });
  container.innerHTML = html;
}

function nobetKayitSil(id) {
  // secilileriSil() ile aynı desen: nöbet paneli sadece Ayarlar sayfası
  // içinden açılabildiği için ayarlar.js normalde zaten yüklenmiş olur, ama
  // her ihtimale karşı ayarlarModuluYukle ile garanti altına alınıyor.
  ayarlarModuluYukle(() => {
    pinIleKorunanIslemiCalistir(() => {
      ozelOnayGoster("Bu nöbet kaydını silmek istediğinize emin misiniz?", (onaylandi) => {
        if (!onaylandi) return;
        let kayitlar = nobetVerileriniGetir();
        kayitlar = kayitlar.filter(k => k.id !== id);
        nobetVerileriniKaydet(kayitlar);
        nobetGecmisiListele();
      });
    });
  });
}

function nobetIstatistikGoster() {
  let kayitlar = nobetVerileriniGetir();
  if (kayitlar.length === 0) {
    return ozelBildirimGoster("İstatistik oluşturulacak nöbet kaydı bulunmuyor.");
  }

  const modal = document.createElement('div');
  modal.setAttribute('data-klavye-uyumlu', '1'); // Klavye açılınca konumunu/boyunu ayarlayan global dinleyici bu işaretle modalı bulur (bkz. klavyeIcinModallariAyarla).
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.6); display: flex; align-items: center;
    justify-content: center; z-index: 10000;
  `;
  let bugunYilAy = new Date().toISOString().slice(0, 7);
  let bugunTarih = new Date().toISOString().split('T')[0];

  modal.innerHTML = `
    <div style="background:white; width:92%; max-width:440px; max-height:85vh; overflow-y:auto; padding:20px; border-radius:14px; box-shadow:0 4px 20px rgba(0,0,0,0.25);">
      <h3 style="margin-top:0; color:#1e88e5; font-size:16px;">📊 Personel Nöbet Süre İstatistikleri</h3>

      <div style="display:flex; gap:8px; margin-bottom:10px;">
        <div style="flex:1;">
          <label style="font-size:11px; font-weight:bold; color:#555;">Filtre Türü:</label>
          <select id="istatistikFiltreTuru" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:6px; margin-top:3px; font-size:12px;">
            <option value="tum">Tüm Zamanlar</option>
            <option value="aylik" selected>Aylık</option>
            <option value="gunluk">Günlük</option>
          </select>
        </div>
        <div style="flex:1;">
          <label style="font-size:11px; font-weight:bold; color:#555;" id="istatistikLabel">Ay Seçin:</label>
          <input type="month" id="istatistikAyInput" value="${bugunYilAy}" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:6px; margin-top:3px; font-size:12px; box-sizing:border-box;">
          <input type="date" id="istatistikGunInput" value="${bugunTarih}" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:6px; margin-top:3px; font-size:12px; box-sizing:border-box; display:none;">
        </div>
      </div>
      <div id="istatistikIcerikContainer" style="border:1px solid #eee; background:#fafafa; padding:8px; border-radius:8px; max-height:260px; overflow-y:auto;"></div>
      <button onclick="this.parentElement.parentElement.remove()" style="background:#333; color:white; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; width:100%; margin-top:15px;">Kapat</button>
    </div>
  `;
  document.body.appendChild(modal);

  let turSelect = modal.querySelector('#istatistikFiltreTuru');
  let ayInput = modal.querySelector('#istatistikAyInput');
  let gunInput = modal.querySelector('#istatistikGunInput');
  let label = modal.querySelector('#istatistikLabel');

  function guncelleIstatistikListesi() {
    let secim = turSelect.value;
    let filtrelenmisKayitlar = [...kayitlar];
    if (secim === 'aylik') {
      let secilenAy = ayInput.value;
      if (secilenAy) filtrelenmisKayitlar = kayitlar.filter(k => k.tarih && k.tarih.startsWith(secilenAy));
    } else if (secim === 'gunluk') {
      let secilenGun = gunInput.value;
      if (secilenGun) filtrelenmisKayitlar = kayitlar.filter(k => k.tarih === secilenGun);
    }

    let container = modal.querySelector('#istatistikIcerikContainer');
    if (filtrelenmisKayitlar.length === 0) {
      container.innerHTML = `<div style="text-align:center; color:#888; padding:15px; font-size:12px;">Seçilen kriterlere uygun nöbet kaydı bulunamadı.</div>`;
      return;
    }

    let istatistikMap = {};
    filtrelenmisKayitlar.forEach(k => {
      if (!istatistikMap[k.adSoyad]) istatistikMap[k.adSoyad] = { toplamSaat: 0, detaylar: {} };
      let saatMiktari = saatAraliginiHesapla(k.saatAraligi);
      istatistikMap[k.adSoyad].toplamSaat += saatMiktari;
      if (!istatistikMap[k.adSoyad].detaylar[k.tur]) istatistikMap[k.adSoyad].detaylar[k.tur] = 0;
      istatistikMap[k.adSoyad].detaylar[k.tur] += saatMiktari;
    });

    let listeHtml = '';
    Object.keys(istatistikMap).forEach(isim => {
      let veri = istatistikMap[isim];
      let genelSureStr = formatSaatGoster(veri.toplamSaat);
      let detayStr = Object.keys(veri.detaylar).map(tur => `${guvenliMetin(tur)}: ${formatSaatGoster(veri.detaylar[tur])}`).join(' | ');
      listeHtml += `
        <div style="padding:8px; border-bottom:1px solid #eee; background:white; border-radius:6px; margin-bottom:6px;">
          <div style="display:flex; justify-content:space-between; font-weight:bold; color:#1e88e5; font-size:12px;">
            <span>👤 ${guvenliMetin(isim)}</span>
            <span class="arama-eslesme-etiketi" style="background:#e3f2fd; color:#1e88e5; padding:2px 6px; border-radius:4px; font-size:11px;">Toplam: ${genelSureStr}</span>
          </div>
          <div style="font-size:11px; color:#666; margin-top:3px;">${detayStr}</div>
        </div>
      `;
    });
    container.innerHTML = listeHtml;
  }

  turSelect.onchange = () => {
    if (turSelect.value === 'tum') {
      ayInput.style.display = 'none';
      gunInput.style.display = 'none';
      label.style.display = 'none';
    } else if (turSelect.value === 'aylik') {
      ayInput.style.display = 'block';
      gunInput.style.display = 'none';
      label.style.display = 'block';
      label.innerText = 'Ay Seçin:';
    } else if (turSelect.value === 'gunluk') {
      ayInput.style.display = 'none';
      gunInput.style.display = 'block';
      label.style.display = 'block';
      label.innerText = 'Gün Seçin:';
    }
    guncelleIstatistikListesi();
  };
  ayInput.onchange = guncelleIstatistikListesi;
  gunInput.onchange = guncelleIstatistikListesi;
  guncelleIstatistikListesi();
}

function ozelPromptGoster(baslik, mevcutDeger, callback) {
  const modal = document.getElementById('customPromptModal');
  const title = document.getElementById('customPromptTitle');
  const input = document.getElementById('customPromptInput');
  const btnOk = document.getElementById('customPromptOk');
  const btnCancel = document.getElementById('customPromptCancel');

  if (title) title.innerText = baslik;
  if (input) input.value = mevcutDeger || '';
  if (modal) modal.style.display = 'flex';

  setTimeout(() => {
    if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);

  if (btnOk && btnCancel) {
      const yeniBtnOk = btnOk.cloneNode(true);
      const yeniBtnCancel = btnCancel.cloneNode(true);
      btnOk.parentNode.replaceChild(yeniBtnOk, btnOk);
      btnCancel.parentNode.replaceChild(yeniBtnCancel, btnCancel);

      document.getElementById('customPromptOk').addEventListener('click', () => {
        const deger = document.getElementById('customPromptInput').value;
        if (modal) modal.style.display = 'none';
        if (callback) callback(deger);
      });

      document.getElementById('customPromptCancel').addEventListener('click', () => {
        if (modal) modal.style.display = 'none';
        if (callback) callback(null);
      });
  }
}

function ozelOnayGoster(mesaj, callback) {
  const modal = document.getElementById('customConfirmModal');
  const msgEl = document.getElementById('customConfirmMessage');
  const btnOk = document.getElementById('customConfirmOk');
  const btnCancel = document.getElementById('customConfirmCancel');

  if (msgEl) msgEl.innerText = mesaj;
  // Not: innerText kullanıldığı için burada ayrıca kaçış (escape) işlemine gerek yoktur.
  if (modal) modal.style.display = 'flex';

  if (btnOk && btnCancel) {
    const yeniBtnOk = btnOk.cloneNode(true);
    const yeniBtnCancel = btnCancel.cloneNode(true);
    btnOk.parentNode.replaceChild(yeniBtnOk, btnOk);
    btnCancel.parentNode.replaceChild(yeniBtnCancel, btnCancel);

    document.getElementById('customConfirmOk').addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
      if (callback) callback(true);
    });

    document.getElementById('customConfirmCancel').addEventListener('click', () => {
      if (modal) modal.style.display = 'none';
      if (callback) callback(false);
    });
  }
}

// ============================================================================
// NÖBET NOKTASI BAZLI EXCEL ÇİZELGESİ
// ----------------------------------------------------------------------------
// Her nöbet noktası (tur) için: 7 sütunu birleştirip ortalanmış şekilde
// noktanın adını yazan BİR başlık satırı, hemen altında sırasıyla
// [Sıra, Sicil, Rütbe, Ad Soyad, Telefon, Açıklama(boş), Nöbet Saatleri]
// sütunlarından oluşan veri satırları. Standart blok 14 satırdır (1 başlık +
// 13 veri satırı); bir noktada 13'ten fazla kayıt varsa blok o kadar
// büyür, azsa kalan satırlar önceden numaralanmış boş satır olarak kalır
// (elle doldurulabilecek şekilde). O noktanın altındaki sıralama SADECE
// saate göredir - tarih ya da personel farkı gözetilmez (tüm kayıtlı
// nöbetler, tarihten bağımsız olarak tek çizelgede birleşir).
// ============================================================================
function nobetExcelAktar() {
  if (typeof ExcelJS === 'undefined') {
    return ozelBildirimGoster("Excel kütüphanesi (ExcelJS) yüklenemedi. İnternet bağlantınızı kontrol edin.");
  }
  let kayitlar = nobetVerileriniGetir();
  if (kayitlar.length === 0) {
    return ozelBildirimGoster("Dışa aktarılacak nöbet kaydı bulunmuyor.");
  }

  const SUTUN_SAYISI = 7;
  const BLOK_MIN_VERI_SATIRI = 13; // başlık hariç; standart blok = 1 + 13 = 14 satır

  // Kayıtları nöbet noktasına (tur) göre grupla.
  let noktaGruplari = {};
  kayitlar.forEach(k => {
    let noktaAdi = (k.tur || "").trim() || "Belirtilmemiş";
    if (!noktaGruplari[noktaAdi]) noktaGruplari[noktaAdi] = [];
    noktaGruplari[noktaAdi].push(k);
  });
  let noktaAdlari = Object.keys(noktaGruplari).sort((a, b) => a.localeCompare(b, 'tr'));

  let excelMatris = [];
  let baslikSatirlari = []; // stil (kalın + ortalı + dolgu) uygulanacak satır indexleri (0 tabanlı)

  noktaAdlari.forEach(nokta => {
    // O noktaya ait kayıtlar SADECE saate göre sıralanır (tarih/personel etkisiz).
    let noktaKayitlari = noktaGruplari[nokta].slice().sort((a, b) => {
      let intA = parseSaatAraligi(a.saatAraligi);
      let intB = parseSaatAraligi(b.saatAraligi);
      return intA.startMin - intB.startMin;
    });

    // 1) Nöbet noktası başlığı: 7 sütun birleşik.
    let baslikSatirIndex = excelMatris.length;
    excelMatris.push([nokta, "", "", "", "", "", ""]);
    baslikSatirlari.push(baslikSatirIndex);

    // 2) Veri satırları: en az BLOK_MIN_VERI_SATIRI kadar; kayıt fazlaysa
    // blok kendiliğinden büyür, azsa kalanlar önceden numaralanmış boş satır olur.
    let satirSayisi = Math.max(noktaKayitlari.length, BLOK_MIN_VERI_SATIRI);
    for (let i = 0; i < satirSayisi; i++) {
      let k = noktaKayitlari[i];
      if (k) {
        let p = personeller.find(x => String(x.id) === String(k.personelId));
        let rutbe = p ? (p.rutbe || "") : "";
        let telefon = p ? personelAsilTelefonunuBul(p) : "";
        excelMatris.push([i + 1, k.personelId, rutbe, k.adSoyad, telefon, "", k.saatAraligi || "-"]);
      } else {
        excelMatris.push([i + 1, "", "", "", "", "", ""]);
      }
    }
  });

  // ---- ExcelJS ile sayfayı oluştur (SheetJS'in ücretsiz sürümünün aksine,
  // ExcelJS hücre stilini -ortalama, kalın yazı, dolgu rengi- gerçekten
  // .xlsx dosyasına yazabiliyor). ----
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Nöbet Noktası Çizelgesi');

  worksheet.columns = [
    { width: 6 },   // 1. Sıra
    { width: 11 },  // 2. Sicil
    { width: 15 },  // 3. Rütbe
    { width: 26 },  // 4. Ad Soyad
    { width: 15 },  // 5. Telefon
    { width: 22 },  // 6. Açıklama
    { width: 18 }   // 7. Nöbet Saatleri
  ];

  excelMatris.forEach(satir => worksheet.addRow(satir));

  // Tüm hücreleri (veri satırları dahil) yatay/dikey ortalar VE metni
  // kaydırır (wrapText). Sütun genişliği ne olursa olsun, sığmayan metin
  // artık kesilmek yerine hücre içinde alt satıra geçer; Excel bu tür
  // hücrelerde satır yüksekliğini kendiliğinden ayarlar.
  worksheet.eachRow({ includeEmpty: true }, row => {
    row.eachCell({ includeEmpty: true }, cell => {
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
  });

  // Nöbet noktası başlık satırlarını birleştirir; kalın, ortalanmış ve hafif
  // renkli yapar (ExcelJS satır/sütun numaralarını 1'den başlatır).
  baslikSatirlari.forEach(r => {
    let excelSatirNo = r + 1;
    worksheet.mergeCells(excelSatirNo, 1, excelSatirNo, SUTUN_SAYISI);
    let hucre = worksheet.getCell(excelSatirNo, 1);
    hucre.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    hucre.font = { bold: true, size: 12 };
    hucre.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
  });

  workbook.xlsx.writeBuffer().then(buffer => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'Nobet_Noktasi_Cizelgesi.xlsx';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    ozelBildirimGoster("Nöbet noktası çizelgesi Excel dosyası olarak indirildi.");
  }).catch(e => {
    ozelBildirimGoster("Excel oluşturulurken hata: " + e.message);
  });
}
