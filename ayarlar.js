// ============================================================================
// AYARLAR MODÜLÜ (ayarlar.js)
// ----------------------------------------------------------------------------
// Bu dosya, Ayarlar ekranına özel tüm mantığı içerir: şablon/kategori/alan
// yönetimi, Grup/Tim yönetimi ve "Tüm Verileri Sıfırla".
//
// Bilerek script.js'ten AYRI tutulur ve sayfa ilk açıldığında YÜKLENMEZ.
// Sadece kullanıcı ⚙️ (Ayarlar) butonuna ilk kez bastığında script.js
// içindeki ayarlarModuluYukle() fonksiyonu bu dosyayı dinamik olarak
// <script> etiketiyle sayfaya ekler. Böylece anasayfa (personel listesi)
// açılışında bu kod hiç indirilmez/parse edilmez; personel/şablon verisi
// büyüdükçe (binlerce personel, yüzlerce şablon alanı) anasayfanın açılış
// hızı bundan etkilenmez.
//
// Bu dosyadaki fonksiyonlar, script.js içindeki global değişkenleri
// (personeller, sablon, grupTimYapisi, aktifGrupTimFiltre, ataSeciliPersonelIds)
// ve yardımcı fonksiyonları (guvenliMetin, oncTemizle, kaydetLocal,
// ozelBildirimGoster, ozelPromptGoster, ozelOnayGoster, bilgiNotunuGuncelleVeGoster)
// aynı global kapsamdan (window) kullanır — ayrı bir modül sistemi yoktur,
// script.js her zaman bu dosyadan ÖNCE yüklenmiş olur.
// ============================================================================


// ========================================================================
// ŞABLON / KATEGORİ / ALAN YÖNETİMİ
// ========================================================================

function sablonListesiniCiz() {
  const container = document.getElementById('sablonListesiContainer');
  const select = document.getElementById('anaKategoriSecici');
  if (!container || !select) return;
  container.innerHTML = "";
  select.innerHTML = "";

  let anaKategoriler = Object.keys(sablon);
  if (anaKategoriler.length === 0) {
    select.innerHTML = '<option value="">Önce ana kategori ekleyin</option>';
    container.innerHTML = '<div style="color: #888; font-style: italic; text-align: center; padding: 10px;">Henüz kategori eklenmemiş.</div>';
    return;
  }

  anaKategoriler.forEach(k1 => {
    let opt = document.createElement('option');
    opt.value = k1;
    opt.innerText = k1;
    select.appendChild(opt);

    let catBox = document.createElement('div');
    catBox.style.cssText = "background: #f9f9f9; padding: 8px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #e0e0e0;";
    let altKategorilerHtml = "";

    Object.keys(sablon[k1]).forEach(k2 => {
      let alanlar = sablon[k1][k2] || [];
      let alanlarHtml = alanlar.map(alan => `
        <span style="display:inline-flex; align-items:center; background:#e0e0e0; padding:3px 8px; border-radius:6px; margin-right:4px; margin-bottom:4px; border:1px solid #ccc; font-size: 11px;">
          ${guvenliMetin(alan)}
          <button onclick="alanDuzenle('${oncTemizle(k1)}', '${oncTemizle(k2)}', '${oncTemizle(alan)}')" style="background:none; border:none; color:#1e88e5; cursor:pointer; font-size:12px; margin-left:6px; padding:0;" title="Düzenle">✏️</button>
          <button onclick="alanSil('${oncTemizle(k1)}', '${oncTemizle(k2)}', '${oncTemizle(alan)}')" style="background:none; border:none; color:#e53935; cursor:pointer; font-size:12px; margin-left:6px; padding:0;" title="Sil">❌</button>
        </span>
      `).join("");

      let alanlarText = alanlar.length > 0 ? `<div style="margin-top:4px; display:flex; flex-wrap:wrap;">${alanlarHtml}</div>` : "<div style='color:#999; margin-top:2px; font-size: 11px;'>Alan yok</div>";
      altKategorilerHtml += `
        <div style="margin-left: 10px; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #ddd;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 600; font-size: 13px;">• ${guvenliMetin(k2)}</span>
            <div style="display:flex; gap: 6px;">
              <button onclick="altKategoriDuzenle('${oncTemizle(k1)}', '${oncTemizle(k2)}')" style="background: #1e88e5; border: none; color: white; cursor: pointer; font-size: 10px; padding: 3px 6px; border-radius: 4px;">Düzenle</button>
              <button onclick="altKategoriSil('${oncTemizle(k1)}', '${oncTemizle(k2)}')" style="background: #e53935; border: none; color: white; cursor: pointer; font-size: 10px; padding: 3px 6px; border-radius: 4px;">Sil</button>
            </div>
          </div>
          <div>${alanlarText}</div>
          <button onclick="alanEkle('${oncTemizle(k1)}', '${oncTemizle(k2)}')" style="background: #00897b; color: white; border: none; padding: 3px 10px; border-radius: 4px; font-size: 10px; margin-top: 8px; cursor: pointer;">+ Alan Ekle</button>
        </div>
      `;
    });

    catBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold; color: #1e88e5;">
        <span>📂 ${guvenliMetin(k1)}</span>
        <div style="display:flex; gap: 6px;">
          <button onclick="anaKategoriDuzenle('${oncTemizle(k1)}')" style="background: #1e88e5; border: none; color: white; cursor: pointer; font-size: 11px; padding: 4px 8px; border-radius: 4px;">Düzenle</button>
          <button onclick="anaKategoriSil('${oncTemizle(k1)}')" style="background: #e53935; border: none; color: white; cursor: pointer; font-size: 11px; padding: 4px 8px; border-radius: 4px;">Sil</button>
        </div>
      </div>
      ${altKategorilerHtml}
    `;
    container.appendChild(catBox);
  });
}

function anaKategoriDuzenle(eskiAd) {
  ozelPromptGoster("Yeni ana kategori adını girin:", eskiAd, (girilenDeger) => {
    if (girilenDeger === null) return; // İptal edildi
    let yeniAd = girilenDeger.trim();
    if (yeniAd === "" || yeniAd === eskiAd) return;
    if (!kategoriAdiGecerliMi(yeniAd)) return;
    if (sablon[yeniAd]) return ozelBildirimGoster("Bu isimde bir ana kategori zaten var.");
    sablon[yeniAd] = sablon[eskiAd];
    delete sablon[eskiAd];

    personeller.forEach(p => {
      if (p.veriler) {
        Object.keys(sablon[yeniAd]).forEach(k2 => {
          let eskiKey = `${eskiAd}_${k2}`;
          let yeniKey = `${yeniAd}_${k2}`;
          if (p.veriler[eskiKey]) {
            p.veriler[yeniKey] = p.veriler[eskiKey];
            delete p.veriler[eskiKey];
          }
        });
      }
    });
    kaydetLocal();
    sablonListesiniCiz();
    ozelBildirimGoster("Ana kategori adı başarıyla güncellendi.");
  });
}

function altKategoriDuzenle(k1, eskiAd) {
  ozelPromptGoster("Yeni alt kategori adını girin:", eskiAd, (girilenDeger) => {
    if (girilenDeger === null) return;
    let yeniAd = girilenDeger.trim();
    if (yeniAd === "" || yeniAd === eskiAd) return;
    if (!kategoriAdiGecerliMi(yeniAd)) return;
    if (sablon[k1][yeniAd]) return ozelBildirimGoster("Bu isimde bir alt kategori zaten var.");
    sablon[k1][yeniAd] = sablon[k1][eskiAd];
    delete sablon[k1][eskiAd];

    let eskiKey = `${k1}_${eskiAd}`;
    let yeniKey = `${k1}_${yeniAd}`;
    personeller.forEach(p => {
      if (p.veriler && p.veriler[eskiKey]) {
        p.veriler[yeniKey] = p.veriler[eskiKey];
        delete p.veriler[eskiKey];
      }
    });
    kaydetLocal();
    sablonListesiniCiz();
    ozelBildirimGoster("Alt kategori adı başarıyla güncellendi.");
  });
}

function alanDuzenle(k1, k2, eskiAd) {
  ozelPromptGoster("Yeni alan adını girin:", eskiAd, (girilenDeger) => {
    if (girilenDeger === null) return;
    let yeniAd = girilenDeger.trim();
    if (yeniAd === "" || yeniAd === eskiAd) return;

    let index = sablon[k1][k2].indexOf(eskiAd);
    if (index === -1) return;
    if (sablon[k1][k2].includes(yeniAd)) return ozelBildirimGoster("Bu isimde bir alan zaten var.");

    sablon[k1][k2][index] = yeniAd;
    let mainKey = `${k1}_${k2}`;
    personeller.forEach(p => {
      if (p.veriler && p.veriler[mainKey]) {
        p.veriler[mainKey].forEach(kayit => {
          if (kayit[eskiAd] !== undefined) {
            kayit[yeniAd] = kayit[eskiAd];
            delete kayit[eskiAd];
          }
        });
      }
    });
    kaydetLocal();
    sablonListesiniCiz();
    ozelBildirimGoster("Alan adı başarıyla güncellendi.");
  });
}

function alanSil(k1, k2, alanAd) {
  // ÖNEMLİ DÜZELTME: Bu işlem, alana ait TÜM personellerin verisini kalıcı
  // olarak siliyor (anaKategoriSil/altKategoriSil ile aynı etki), o yüzden
  // onlarla tutarlı olacak şekilde PIN korumasına alındı.
  pinIleKorunanIslemiCalistir(() => {
    ozelOnayGoster(`'${alanAd}' alanını silmek istediğinize emin misiniz?`, (onaylandi) => {
      if (!onaylandi) return;
      sablon[k1][k2] = sablon[k1][k2].filter(a => a !== alanAd);
      let mainKey = `${k1}_${k2}`;
      personeller.forEach(p => {
        if (p.veriler && p.veriler[mainKey]) {
          p.veriler[mainKey].forEach(kayit => {
            if (kayit[alanAd] !== undefined) {
              delete kayit[alanAd];
            }
          });
        }
      });
      kaydetLocal();
      sablonListesiniCiz();
    });
  });
}

// Kategori/alt kategori adları dahili olarak "AnaKat_AltKat" şeklinde birleştirilip
// anahtar olarak kullanılıyor. Ad içinde "_" olursa iki farklı kategori çifti aynı
// anahtara denk gelebilir (örn. "A_B" + "C"  ==  "A" + "B_C"). Bu yüzden isimlerde
// "_" karakterine izin verilmiyor.
function kategoriAdiGecerliMi(ad) {
  const temizAd = String(ad || '').trim();
  if (!temizAd) {
    ozelBildirimGoster('Kategori/alan adı boş veya sadece boşluk olamaz.');
    return false;
  }
  if (temizAd.length > 40) {
    ozelBildirimGoster('Kategori/alan adı çok uzun (en fazla 40 karakter). Lütfen kısaltın.');
    return false;
  }
  if (temizAd.includes('_')) {
    ozelBildirimGoster('Kategori/alan adlarında alt çizgi (_) karakteri kullanılamaz. Lütfen farklı bir ad girin.');
    return false;
  }
  return true;
}

function anaKategoriEkle() {
  let val = document.getElementById('yeniAnaKategoriInput').value.trim();
  if (!val) return ozelBildirimGoster("Lütfen bir kategori adı yazın.");
  if (!kategoriAdiGecerliMi(val)) return;
  if (sablon[val]) return ozelBildirimGoster("Bu kategori zaten var.");
  sablon[val] = {};
  document.getElementById('yeniAnaKategoriInput').value = "";
  kaydetLocal();
  sablonListesiniCiz();
}

function altKategoriEkle() {
  let k1 = document.getElementById('anaKategoriSecici').value;
  let val = document.getElementById('yeniAltKategoriInput').value.trim();
  if (!k1) return ozelBildirimGoster("Önce bir ana kategori seçin veya ekleyin.");
  if (!val) return ozelBildirimGoster("Lütfen alt kategori adı yazın.");
  if (!kategoriAdiGecerliMi(val)) return;
  if (sablon[k1][val]) return ozelBildirimGoster("Bu alt kategori zaten var.");
  sablon[k1][val] = []; 
  document.getElementById('yeniAltKategoriInput').value = "";
  kaydetLocal();
  sablonListesiniCiz();
}

function alanEkle(k1, k2) {
  // Hızlı art arda tıklamada üst üste modal açılmasını önlemek için
  // önceden açık bir "yeni alan" modalı varsa kaldırılır.
  const oncekiModal = document.getElementById('yeniAlanModal');
  if (oncekiModal) oncekiModal.remove();

  const modal = document.createElement('div');
  modal.setAttribute('data-klavye-uyumlu', '1'); // bkz. script.js: klavyeIcinModallariAyarla
  modal.id = 'yeniAlanModal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex; align-items: flex-start;
    justify-content: center; padding-top: 15vh; z-index: 9999;
    overflow-y: auto;
  `;
  modal.innerHTML = `
    <div style="background:white; width:90%; max-width:340px; padding:20px; border-radius:14px; box-shadow:0 4px 20px rgba(0,0,0,0.25);">
      <h3 style="margin-top:0; color:#00897b;">➕ Yeni Alan</h3>
      <div style="font-size:13px; color:#666; margin-bottom:10px;">${guvenliMetin(k2)} altına eklenecek alan adı</div>
      <input id="yeniAlanInput" type="text" placeholder="Örn: Eş Doğum Tarihi" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:8px; font-size:14px; box-sizing:border-box;">
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:18px;">
        <button id="alanIptalBtn" style="background:#6b7280; color:white; border:none; padding:10px 16px; border-radius:8px; font-weight:bold; cursor:pointer;">İptal</button>
        <button id="alanKaydetBtn" style="background:#00897b; color:white; border:none; padding:10px 16px; border-radius:8px; font-weight:bold; cursor:pointer;">Ekle</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const input = modal.querySelector('#yeniAlanInput');

  setTimeout(() => {
    input.focus();
    input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 200);

  modal.querySelector('#alanIptalBtn').onclick = () => modal.remove();

  modal.querySelector('#alanKaydetBtn').onclick = () => {
    const alanAdi = input.value.trim();
    if (!alanAdi) { input.focus(); return; }
    if (!Array.isArray(sablon[k1][k2])) sablon[k1][k2] = [];
    if (sablon[k1][k2].includes(alanAdi)) return ozelBildirimGoster("Bu alan zaten eklenmiş.");
    sablon[k1][k2].push(alanAdi);
    kaydetLocal();
    sablonListesiniCiz();
    modal.remove();
    ozelBildirimGoster(`"${alanAdi}" alanı eklendi.`);
  };
}

function anaKategoriSil(k1) {
  pinIleKorunanIslemiCalistir(() => {
    ozelOnayGoster(`'${k1}' kategorisini silmek istediğinize emin misiniz? Bu kategoriye bağlı tüm personel verileri de silinecektir.`, (onaylandi) => {
      if (!onaylandi) return;
      let altKategoriler = sablon[k1] ? Object.keys(sablon[k1]) : [];
      delete sablon[k1];
      // Bu ana kategoriye bağlı alt kategorilerin tüm personellerdeki kayıtlı verilerini de
      // temizliyoruz. Aksi halde bu veriler depoda "hayalet" olarak kalır ve aynı isimle
      // kategori/alt kategori tekrar eklenirse silinmiş sanılan eski veriler geri gelir.
      altKategoriler.forEach(k2 => {
        let mainKey = `${k1}_${k2}`;
        personeller.forEach(p => {
          if (p.veriler && p.veriler[mainKey]) delete p.veriler[mainKey];
        });
      });
      kaydetLocal();
      sablonListesiniCiz();
    });
  });
}

function altKategoriSil(k1, k2) {
  pinIleKorunanIslemiCalistir(() => {
    ozelOnayGoster(`'${k2}' alt başlığını silmek istediğinize emin misiniz? Bu alt başlığa bağlı tüm personel verileri de silinecektir.`, (onaylandi) => {
      if (!onaylandi) return;
      delete sablon[k1][k2];
      // Bkz. anaKategoriSil: aynı "hayalet veri" sorununu burada da önlüyoruz.
      let mainKey = `${k1}_${k2}`;
      personeller.forEach(p => {
        if (p.veriler && p.veriler[mainKey]) delete p.veriler[mainKey];
      });
      kaydetLocal();
      sablonListesiniCiz();
    });
  });
}


// ========================================================================
// BİRLİK / GRUP / TİM YÖNETİMİ
// Anasayfa başlığının altındaki açılır menüyü besleyen Birlik/Grup/Tim
// listeleri ve personellerin bunlara atanması burada yönetilir. Üç kademe
// birbirinden BAĞIMSIZ düz listelerdir (bkz. script.js dosya başı); hangi
// kademelerin arayüzde görüneceğini "sistemModu" ('tim'|'grup'|'birlik') belirler.
// ========================================================================

function grupTimYapisiniKaydet() {
  try {
    localStorage.setItem('birlikListesi', JSON.stringify(birlikListesi));
    localStorage.setItem('grupListesi', JSON.stringify(grupListesi));
    localStorage.setItem('timListesi', JSON.stringify(timListesi));
    localStorage.setItem('sistemModu', sistemModu);
    localStorage.setItem('timGrupEslesmesi', JSON.stringify(timGrupEslesmesi));
    localStorage.setItem('grupBirlikEslesmesi', JSON.stringify(grupBirlikEslesmesi));
  } catch (e) {
    ozelBildirimGoster("Birlik/Grup/Tim yapısı kaydedilemedi! Hafıza dolu olabilir.");
  }
}

// Sistem modu değiştiğinde çalışır: hangi kademelerin arayüzde (ekleme
// kutucukları, liste, atama seçicileri) görüneceğini günceller. Önceden
// girilmiş veriler SİLİNMEZ — sadece o an aktif olmayan kademeler gizlenir.
function sistemModuDegisti(yeniMod) {
  if (!['tim', 'grup', 'birlik'].includes(yeniMod)) return;
  sistemModu = yeniMod;
  localStorage.setItem('sistemModu', sistemModu);
  grupTimListesiniCiz();
  bilgiNotunuGuncelleVeGoster();
  ayarlarGrupTimSeciciGuncelle();
}

function birlikEkle() {
  let input = document.getElementById('yeniBirlikInput');
  let val = input ? input.value.trim() : "";
  if (!val) return ozelBildirimGoster("Lütfen bir birlik adı yazın.");
  if (birlikListesi.includes(val)) return ozelBildirimGoster("Bu isimde bir birlik zaten var.");

  birlikListesi.push(val);
  if (input) input.value = "";
  grupTimYapisiniKaydet();
  grupTimListesiniCiz();
  bilgiNotunuGuncelleVeGoster();
  ayarlarGrupTimSeciciGuncelle();
  ozelBildirimGoster(`"${val}" birliği eklendi.`);
}

function grupEkle() {
  let input = document.getElementById('yeniGrupInput');
  let val = input ? input.value.trim() : "";
  if (!val) return ozelBildirimGoster("Lütfen bir grup adı yazın.");
  if (grupListesi.includes(val)) return ozelBildirimGoster("Bu isimde bir grup zaten var.");

  grupListesi.push(val);
  if (input) input.value = "";
  grupTimYapisiniKaydet();
  grupTimListesiniCiz();
  bilgiNotunuGuncelleVeGoster();
  ayarlarGrupTimSeciciGuncelle();
  ozelBildirimGoster(`"${val}" grubu eklendi.`);
}

function timEkle() {
  let input = document.getElementById('yeniTimInput');
  let val = input ? input.value.trim() : "";
  if (!val) return ozelBildirimGoster("Lütfen bir tim adı yazın.");
  if (timListesi.includes(val)) return ozelBildirimGoster("Bu isimde bir tim zaten var.");

  timListesi.push(val);
  if (input) input.value = "";
  grupTimYapisiniKaydet();
  grupTimListesiniCiz();
  bilgiNotunuGuncelleVeGoster();
  ayarlarGrupTimSeciciGuncelle();
  ozelBildirimGoster(`"${val}" timi eklendi.`);
}

// Aşağıdaki 3 çift (birlikDuzenle/grupDuzenle/timDuzenle ve birlikSil/grupSil/
// timSil) kasıtlı olarak birbirinden ayrı fonksiyonlardır (dinamik onclick'lerden
// çağrılabilmeleri için); üçü de AYNI deseni izler: ilgili düz listede ismi
// günceller/siler, o isme atanmış personellerin SADECE kendi alanını
// (birlik/grup/tim — diğer ikisine dokunmadan) günceller/temizler ve aktif
// filtreleri (anasayfa + Ayarlar) gerekirse yeni isimle günceller/sıfırlar.

function birlikDuzenle(eskiAd) {
  ozelPromptGoster("Yeni birlik adını girin:", eskiAd, (girilenDeger) => {
    if (girilenDeger === null) return;
    let yeniAd = girilenDeger.trim();
    if (yeniAd === "" || yeniAd === eskiAd) return;
    if (birlikListesi.includes(yeniAd)) return ozelBildirimGoster("Bu isimde bir birlik zaten var.");

    let idx = birlikListesi.indexOf(eskiAd);
    if (idx === -1) return;
    birlikListesi[idx] = yeniAd;

    personeller.forEach(p => { if (p.birlik === eskiAd) p.birlik = yeniAd; });

    // Bu birliğe eşleştirilmiş gruplar varsa (bkz. otomatikUstKademeleriUygula), onlar da yeni adı takip eder.
    Object.keys(grupBirlikEslesmesi).forEach(g => { if (grupBirlikEslesmesi[g] === eskiAd) grupBirlikEslesmesi[g] = yeniAd; });

    if (aktifGrupTimFiltre === `birlik:${eskiAd}`) {
      aktifGrupTimFiltre = `birlik:${yeniAd}`;
      localStorage.setItem('secilenGrupTim', aktifGrupTimFiltre);
    }
    if (ayarlarAktifGrupTimFiltre === `birlik:${eskiAd}`) {
      ayarlarAktifGrupTimFiltre = `birlik:${yeniAd}`;
      localStorage.setItem('ayarlarSecilenGrupTim', ayarlarAktifGrupTimFiltre);
    }

    kaydetLocal();
    grupTimYapisiniKaydet();
    grupTimListesiniCiz();
    bilgiNotunuGuncelleVeGoster();
    ayarlarGrupTimSeciciGuncelle();
    tumPersonelListeleriniYenile();
    ozelBildirimGoster("Birlik adı başarıyla güncellendi.");
  });
}

function grupDuzenle(eskiAd) {
  ozelPromptGoster("Yeni grup adını girin:", eskiAd, (girilenDeger) => {
    if (girilenDeger === null) return;
    let yeniAd = girilenDeger.trim();
    if (yeniAd === "" || yeniAd === eskiAd) return;
    if (grupListesi.includes(yeniAd)) return ozelBildirimGoster("Bu isimde bir grup zaten var.");

    let idx = grupListesi.indexOf(eskiAd);
    if (idx === -1) return;
    grupListesi[idx] = yeniAd;

    personeller.forEach(p => { if (p.grup === eskiAd) p.grup = yeniAd; });

    // Bu gruba eşleştirilmiş timler varsa yeni adı takip eder; bu grubun kendi
    // eşleştiği bir birlik varsa (grupBirlikEslesmesi anahtarı) o da taşınır.
    Object.keys(timGrupEslesmesi).forEach(t => { if (timGrupEslesmesi[t] === eskiAd) timGrupEslesmesi[t] = yeniAd; });
    if (grupBirlikEslesmesi[eskiAd] !== undefined) {
      grupBirlikEslesmesi[yeniAd] = grupBirlikEslesmesi[eskiAd];
      delete grupBirlikEslesmesi[eskiAd];
    }

    if (aktifGrupTimFiltre === `grup:${eskiAd}`) {
      aktifGrupTimFiltre = `grup:${yeniAd}`;
      localStorage.setItem('secilenGrupTim', aktifGrupTimFiltre);
    }
    if (ayarlarAktifGrupTimFiltre === `grup:${eskiAd}`) {
      ayarlarAktifGrupTimFiltre = `grup:${yeniAd}`;
      localStorage.setItem('ayarlarSecilenGrupTim', ayarlarAktifGrupTimFiltre);
    }

    kaydetLocal();
    grupTimYapisiniKaydet();
    grupTimListesiniCiz();
    bilgiNotunuGuncelleVeGoster();
    ayarlarGrupTimSeciciGuncelle();
    tumPersonelListeleriniYenile();
    ozelBildirimGoster("Grup adı başarıyla güncellendi.");
  });
}

function timDuzenle(eskiAd) {
  ozelPromptGoster("Yeni tim adını girin:", eskiAd, (girilenDeger) => {
    if (girilenDeger === null) return;
    let yeniAd = girilenDeger.trim();
    if (yeniAd === "" || yeniAd === eskiAd) return;
    if (timListesi.includes(yeniAd)) return ozelBildirimGoster("Bu isimde bir tim zaten var.");

    let idx = timListesi.indexOf(eskiAd);
    if (idx === -1) return;
    timListesi[idx] = yeniAd;

    personeller.forEach(p => { if (p.tim === eskiAd) p.tim = yeniAd; });

    // Bu timin kendi eşleştiği bir grup varsa (timGrupEslesmesi anahtarı) o da taşınır.
    if (timGrupEslesmesi[eskiAd] !== undefined) {
      timGrupEslesmesi[yeniAd] = timGrupEslesmesi[eskiAd];
      delete timGrupEslesmesi[eskiAd];
    }

    if (aktifGrupTimFiltre === `tim:${eskiAd}`) {
      aktifGrupTimFiltre = `tim:${yeniAd}`;
      localStorage.setItem('secilenGrupTim', aktifGrupTimFiltre);
    }
    if (ayarlarAktifGrupTimFiltre === `tim:${eskiAd}`) {
      ayarlarAktifGrupTimFiltre = `tim:${yeniAd}`;
      localStorage.setItem('ayarlarSecilenGrupTim', ayarlarAktifGrupTimFiltre);
    }

    kaydetLocal();
    grupTimYapisiniKaydet();
    grupTimListesiniCiz();
    bilgiNotunuGuncelleVeGoster();
    ayarlarGrupTimSeciciGuncelle();
    tumPersonelListeleriniYenile();
    ozelBildirimGoster("Tim adı başarıyla güncellendi.");
  });
}

function birlikSil(ad) {
  pinIleKorunanIslemiCalistir(() => {
    let atanmisSayisi = personeller.filter(p => p.birlik === ad).length;
    let mesaj = `"${ad}" birliğini silmek istediğinize emin misiniz?`;
    if (atanmisSayisi > 0) mesaj += `\nBu birliğe atanmış ${atanmisSayisi} personelin birlik ataması kaldırılacak.`;

    ozelOnayGoster(mesaj, (onaylandi) => {
      if (!onaylandi) return;
      birlikListesi = birlikListesi.filter(b => b !== ad);
      personeller.forEach(p => { if (p.birlik === ad) p.birlik = ""; });
      // Bu birliğe eşleştirilmiş grup varsa eşleşmeyi de kaldır (artık hedefi yok).
      Object.keys(grupBirlikEslesmesi).forEach(g => { if (grupBirlikEslesmesi[g] === ad) delete grupBirlikEslesmesi[g]; });
      if (aktifGrupTimFiltre === `birlik:${ad}`) { aktifGrupTimFiltre = ""; localStorage.setItem('secilenGrupTim', ""); }
      if (ayarlarAktifGrupTimFiltre === `birlik:${ad}`) { ayarlarAktifGrupTimFiltre = ""; localStorage.setItem('ayarlarSecilenGrupTim', ""); }
      kaydetLocal();
      grupTimYapisiniKaydet();
      grupTimListesiniCiz();
      bilgiNotunuGuncelleVeGoster();
      ayarlarGrupTimSeciciGuncelle();
      tumPersonelListeleriniYenile();
    });
  });
}

function grupSil(ad) {
  pinIleKorunanIslemiCalistir(() => {
    let atanmisSayisi = personeller.filter(p => p.grup === ad).length;
    let mesaj = `"${ad}" grubunu silmek istediğinize emin misiniz?`;
    if (atanmisSayisi > 0) mesaj += `\nBu gruba atanmış ${atanmisSayisi} personelin grup ataması kaldırılacak.`;

    ozelOnayGoster(mesaj, (onaylandi) => {
      if (!onaylandi) return;
      grupListesi = grupListesi.filter(g => g !== ad);
      personeller.forEach(p => { if (p.grup === ad) p.grup = ""; });
      // Bu grubun kendi eşleştiği birlik ve bu gruba eşleştirilmiş timler varsa temizle.
      delete grupBirlikEslesmesi[ad];
      Object.keys(timGrupEslesmesi).forEach(t => { if (timGrupEslesmesi[t] === ad) delete timGrupEslesmesi[t]; });
      if (aktifGrupTimFiltre === `grup:${ad}`) { aktifGrupTimFiltre = ""; localStorage.setItem('secilenGrupTim', ""); }
      if (ayarlarAktifGrupTimFiltre === `grup:${ad}`) { ayarlarAktifGrupTimFiltre = ""; localStorage.setItem('ayarlarSecilenGrupTim', ""); }
      kaydetLocal();
      grupTimYapisiniKaydet();
      grupTimListesiniCiz();
      bilgiNotunuGuncelleVeGoster();
      ayarlarGrupTimSeciciGuncelle();
      tumPersonelListeleriniYenile();
    });
  });
}

function timSil(ad) {
  pinIleKorunanIslemiCalistir(() => {
    let atanmisSayisi = personeller.filter(p => p.tim === ad).length;
    let mesaj = `"${ad}" timini silmek istediğinize emin misiniz?`;
    if (atanmisSayisi > 0) mesaj += `\nBu time atanmış ${atanmisSayisi} personelin tim ataması kaldırılacak.`;

    ozelOnayGoster(mesaj, (onaylandi) => {
      if (!onaylandi) return;
      timListesi = timListesi.filter(t => t !== ad);
      personeller.forEach(p => { if (p.tim === ad) p.tim = ""; });
      // Bu timin kendi eşleştiği bir grup varsa temizle.
      delete timGrupEslesmesi[ad];
      if (aktifGrupTimFiltre === `tim:${ad}`) { aktifGrupTimFiltre = ""; localStorage.setItem('secilenGrupTim', ""); }
      if (ayarlarAktifGrupTimFiltre === `tim:${ad}`) { ayarlarAktifGrupTimFiltre = ""; localStorage.setItem('ayarlarSecilenGrupTim', ""); }
      kaydetLocal();
      grupTimYapisiniKaydet();
      grupTimListesiniCiz();
      bilgiNotunuGuncelleVeGoster();
      ayarlarGrupTimSeciciGuncelle();
      tumPersonelListeleriniYenile();
    });
  });
}

// Ayarlar sayfasındaki Sistem Modu seçicisini, ekleme kutucuklarını, Birlik/Grup/Tim
// listesini ve personel atama seçicilerini o an aktif olan sistemModu'na göre çizer.
function grupTimListesiniCiz() {
  const container = document.getElementById('grupTimListesiContainer');
  const modSecici = document.getElementById('sistemModuSecici');
  const ekleAlani = document.getElementById('birlikGrupTimEkleAlani');
  if (!container) return;

  if (modSecici) modSecici.value = sistemModu;

  // --- Ekleme kutucukları (aktif moda göre, birbirinden bağımsız) ---
  if (ekleAlani) {
    let ekleHtml = '';
    if (sistemModu === 'birlik') {
      ekleHtml += `
        <div style="display: flex; gap: 8px; margin-top: 6px;">
          <input type="text" id="yeniBirlikInput" placeholder="Örn: 1. Birlik" style="flex: 1; padding: 10px; border: 1px solid #e5e7eb; border-radius: 10px;">
          <button onclick="birlikEkle()" style="background: #7c3aed; color: white; border: none; padding: 10px 14px; border-radius: 10px; font-weight: 600; cursor: pointer;">Birlik Ekle</button>
        </div>`;
    }
    if (sistemModu === 'birlik' || sistemModu === 'grup') {
      ekleHtml += `
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <input type="text" id="yeniGrupInput" placeholder="Örn: 1. Grup" style="flex: 1; padding: 10px; border: 1px solid #e5e7eb; border-radius: 10px;">
          <button onclick="grupEkle()" style="background: #1e88e5; color: white; border: none; padding: 10px 14px; border-radius: 10px; font-weight: 600; cursor: pointer;">Grup Ekle</button>
        </div>`;
    }
    ekleHtml += `
      <div style="display: flex; gap: 8px; margin-top: 8px;">
        <input type="text" id="yeniTimInput" placeholder="Örn: 1. Tim" style="flex: 1; padding: 10px; border: 1px solid #e5e7eb; border-radius: 10px;">
        <button onclick="timEkle()" style="background: #10b981; color: white; border: none; padding: 10px 14px; border-radius: 10px; font-weight: 600; cursor: pointer;">Tim Ekle</button>
      </div>`;
    ekleAlani.innerHTML = ekleHtml;
  }

  ataEkraniniGuncelle();
  ataPersonelListesiniCiz();
  topluTasiAlaniniCiz();

  // --- Mevcut Birlik/Grup/Tim listesi ---
  // eslesmeFn(ad): varsa bu ismin otomatik eşleştiği üst kademe adını döndürür (yoksa null).
  // Bir eşleşme varsa isim yanında "→ Hedef ✕" şeklinde gösterilir; ✕ sadece
  // eşleşmeyi kaldırır, ismin kendisini SİLMEZ.
  function listeKutusuOlustur(baslikEmoji, baslik, renk, liste, sayacFn, duzenleFn, silFn, eslesmeFn, eslesmeKaldirFn) {
    if (liste.length === 0) return '';
    let itemsHtml = liste.slice().sort((a, b) => a.localeCompare(b, 'tr')).map(ad => {
      let sayi = sayacFn(ad);
      let eslesenHedef = eslesmeFn ? eslesmeFn(ad) : null;
      let eslesmeHtml = eslesenHedef
        ? ` <span style="color:#999; font-size:10px;">→ ${guvenliMetin(eslesenHedef)} <button onclick="${eslesmeKaldirFn}('${oncTemizle(ad)}')" style="background:none; border:none; color:#e53935; cursor:pointer; font-size:10px; padding:0;" title="Otomatik eşleşmeyi kaldır">✕</button></span>`
        : '';
      return `
        <div style="display:flex; justify-content: space-between; align-items:center; margin-top:6px; padding-top:6px; border-top:1px dashed #ddd;">
          <span style="font-size:13px;">${guvenliMetin(ad)} <span style="color:#999; font-size:11px;">(${sayi} kişi)</span>${eslesmeHtml}</span>
          <span style="display:flex; gap:4px;">
            <button onclick="${duzenleFn}('${oncTemizle(ad)}')" style="background:none; border:none; color:${renk}; cursor:pointer; font-size:13px; padding:0 2px;" title="Düzenle">✏️</button>
            <button onclick="${silFn}('${oncTemizle(ad)}')" style="background:#e53935; border:none; color:white; cursor:pointer; font-size:11px; padding:4px 8px; border-radius:4px;">Sil</button>
          </span>
        </div>`;
    }).join('');
    return `
      <div style="background: #f9f9f9; padding: 8px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #e0e0e0;">
        <div style="font-weight:bold; color:${renk}; font-size:13px;">${baslikEmoji} ${guvenliMetin(baslik)}</div>
        ${itemsHtml}
      </div>`;
  }

  let html = '';
  if (sistemModu === 'birlik') {
    html += listeKutusuOlustur('🏛', 'Birlikler', '#7c3aed', birlikListesi,
      ad => personeller.filter(p => p.birlik === ad).length, 'birlikDuzenle', 'birlikSil');
  }
  if (sistemModu === 'birlik' || sistemModu === 'grup') {
    html += listeKutusuOlustur('👥', 'Gruplar', '#1e88e5', grupListesi,
      ad => personeller.filter(p => p.grup === ad).length, 'grupDuzenle', 'grupSil',
      sistemModu === 'birlik' ? (ad => grupBirlikEslesmesi[ad] || null) : null, 'grupBirlikEslesmesiniKaldir');
  }
  html += listeKutusuOlustur('🔹', 'Timler', '#059669', timListesi,
    ad => personeller.filter(p => p.tim === ad).length, 'timDuzenle', 'timSil',
    (sistemModu === 'birlik' || sistemModu === 'grup') ? (ad => timGrupEslesmesi[ad] || null) : null, 'timGrupEslesmesiniKaldir');

  container.innerHTML = html || '<div style="color: #888; font-style: italic; text-align: center; padding: 10px;">Henüz birlik/grup/tim eklenmemiş.</div>';
}

// Bir Tim'in otomatik eşleştiği Grubu (veya bir Grubun otomatik eşleştiği Birliği)
// kaldırır. Bu, sadece kuralı siler — Tim/Grup'un kendisi ya da o kademeye halihazırda
// atanmış personelin mevcut değeri ETKİLENMEZ; sadece BUNDAN SONRA o Time/Gruba
// atanacak yeni personel için otomatik doldurma durur.
function timGrupEslesmesiniKaldir(tim) {
  delete timGrupEslesmesi[tim];
  kaydetLocal();
  grupTimListesiniCiz();
  ozelBildirimGoster(`"${tim}" için otomatik grup eşleşmesi kaldırıldı.`);
}

function grupBirlikEslesmesiniKaldir(grup) {
  delete grupBirlikEslesmesi[grup];
  kaydetLocal();
  grupTimListesiniCiz();
  ozelBildirimGoster(`"${grup}" için otomatik birlik eşleşmesi kaldırıldı.`);
}

// "Personeli Ata" bölümündeki Birlik/Grup/Tim seçicilerini aktif sistemModu'na göre
// çizer. Seçiciler birbirinden BAĞIMSIZDIR (script.js'teki personelFiltreyeUyuyorMu
// ile aynı mantık): biri değiştiğinde diğerini filtrelemeye ÇALIŞMAZ, her biri kendi
// listesindeki TÜM isimleri gösterir ve "boş bırak" seçeneği içerir.
function ataEkraniniGuncelle() {
  const alan = document.getElementById('ataSeciciAlani');
  if (!alan) return;

  let html = '';
  if (sistemModu === 'birlik') {
    html += `<select id="ataBirlikSecici" style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 10px; margin-top: 6px;"><option value="">Birlik (boş bırak)</option></select>`;
  }
  if (sistemModu === 'birlik' || sistemModu === 'grup') {
    html += `<select id="ataGrupSecici" style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 10px; margin-top: 8px;"><option value="">Grup (boş bırak)</option></select>`;
  }
  html += `<select id="ataTimSecici" style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 10px; margin-top: 8px;"><option value="">Tim (boş bırak)</option></select>`;
  alan.innerHTML = html;

  let birlikSel = document.getElementById('ataBirlikSecici');
  if (birlikSel) {
    birlikListesi.slice().sort((a, b) => a.localeCompare(b, 'tr')).forEach(b => {
      let opt = document.createElement('option');
      opt.value = b; opt.innerText = b;
      birlikSel.appendChild(opt);
    });
  }
  let grupSel = document.getElementById('ataGrupSecici');
  if (grupSel) {
    grupListesi.slice().sort((a, b) => a.localeCompare(b, 'tr')).forEach(g => {
      let opt = document.createElement('option');
      opt.value = g; opt.innerText = g;
      grupSel.appendChild(opt);
    });
  }
  let timSel = document.getElementById('ataTimSecici');
  if (timSel) {
    timListesi.slice().sort((a, b) => a.localeCompare(b, 'tr')).forEach(t => {
      let opt = document.createElement('option');
      opt.value = t; opt.innerText = t;
      timSel.appendChild(opt);
    });
  }
}

// ------------------------------------------------------------------------
// VAR OLAN TİMLERİ GRUPLARA / GRUPLARI BİRLİKLERE TOPLU TAŞIMA
// Bu, Tim ile Grup (veya Grup ile Birlik) arasında KALICI bir bağlantı KURMAZ —
// Birlik/Grup/Tim listeleri hâlâ birbirinden bağımsızdır. Sadece o an seçilen
// Tim(ler)de kayıtlı olan TÜM personelin p.grup alanını tek seferde, toplu olarak
// hedef Gruba günceller (p.tim değerine dokunulmaz). Örn. sistemi Tim'den Grup'a
// geçirirken, "1. Tim" ve "2. Tim"deki herkesi tek tıkla "1. Gruba" taşımak için.
// Daha sonra bu Tim'e eklenecek YENİ bir personel otomatik olarak o Gruba dahil
// OLMAZ — bu araç yalnızca o anki personeli taşır, ileriye dönük bir kural kurmaz.
// ------------------------------------------------------------------------

function topluTasiAlaniniCiz() {
  const alan = document.getElementById('topluTasiAlani');
  if (!alan) return;

  let html = '';

  if ((sistemModu === 'grup' || sistemModu === 'birlik') && timListesi.length > 0 && grupListesi.length > 0) {
    let timCheckboxlar = timListesi.slice().sort((a, b) => a.localeCompare(b, 'tr')).map(t => `
      <label style="display:flex; align-items:center; gap:6px; padding:4px 2px; font-size:12px;">
        <input type="checkbox" class="timTasiCheckbox" value="${guvenliMetin(t)}"> ${guvenliMetin(t)}
      </label>`).join('');
    let grupOptions = grupListesi.slice().sort((a, b) => a.localeCompare(b, 'tr')).map(g => `<option value="${guvenliMetin(g)}">${guvenliMetin(g)}</option>`).join('');
    html += `
      <div style="border-top:1px dashed #ddd; padding-top:12px; margin-top:14px;">
        <label style="font-size:13px; font-weight:600; color:#4b5563;">Var Olan Timleri Gruplara Taşı:</label>
        <div style="font-size:11px; color:#888; margin-top:2px;">Seçtiğiniz Tim(ler)deki TÜM personel, Tim bilgisi korunarak seçtiğiniz Gruba atanır. Kalıcı bir bağlantı kurulmaz.</div>
        <div style="max-height:140px; overflow-y:auto; border:1px solid #e5e7eb; border-radius:10px; margin-top:8px; padding:6px;">
          ${timCheckboxlar}
        </div>
        <select id="timTasiHedefGrup" style="width:100%; padding:10px; border:1px solid #e5e7eb; border-radius:10px; margin-top:8px; box-sizing:border-box;">
          <option value="">Hedef Grubu Seçin</option>
          ${grupOptions}
        </select>
        <button onclick="timlerdenGruplaraTasi()" style="width:100%; margin-top:8px; background:#1e88e5; color:white; border:none; padding:10px 14px; border-radius:10px; font-weight:600; cursor:pointer;">Seçilen Timleri Gruba Taşı</button>
      </div>`;
  }

  if (sistemModu === 'birlik' && grupListesi.length > 0 && birlikListesi.length > 0) {
    let grupCheckboxlar = grupListesi.slice().sort((a, b) => a.localeCompare(b, 'tr')).map(g => `
      <label style="display:flex; align-items:center; gap:6px; padding:4px 2px; font-size:12px;">
        <input type="checkbox" class="grupTasiCheckbox" value="${guvenliMetin(g)}"> ${guvenliMetin(g)}
      </label>`).join('');
    let birlikOptions = birlikListesi.slice().sort((a, b) => a.localeCompare(b, 'tr')).map(b => `<option value="${guvenliMetin(b)}">${guvenliMetin(b)}</option>`).join('');
    html += `
      <div style="border-top:1px dashed #ddd; padding-top:12px; margin-top:14px;">
        <label style="font-size:13px; font-weight:600; color:#4b5563;">Var Olan Grupları Birliklere Taşı:</label>
        <div style="font-size:11px; color:#888; margin-top:2px;">Seçtiğiniz Grup(lar)daki TÜM personel, Grup bilgisi korunarak seçtiğiniz Birliğe atanır. Kalıcı bir bağlantı kurulmaz.</div>
        <div style="max-height:140px; overflow-y:auto; border:1px solid #e5e7eb; border-radius:10px; margin-top:8px; padding:6px;">
          ${grupCheckboxlar}
        </div>
        <select id="grupTasiHedefBirlik" style="width:100%; padding:10px; border:1px solid #e5e7eb; border-radius:10px; margin-top:8px; box-sizing:border-box;">
          <option value="">Hedef Birliği Seçin</option>
          ${birlikOptions}
        </select>
        <button onclick="gruplardanBirliklereTasi()" style="width:100%; margin-top:8px; background:#7c3aed; color:white; border:none; padding:10px 14px; border-radius:10px; font-weight:600; cursor:pointer;">Seçilen Grupları Birliğe Taşı</button>
      </div>`;
  }

  alan.innerHTML = html;
}

function timlerdenGruplaraTasi() {
  let secilenTimler = Array.from(document.querySelectorAll('.timTasiCheckbox:checked')).map(cb => cb.value);
  let hedefGrupSel = document.getElementById('timTasiHedefGrup');
  let hedefGrup = hedefGrupSel ? hedefGrupSel.value : "";

  if (secilenTimler.length === 0) return ozelBildirimGoster("Lütfen en az bir Tim seçin.");
  if (!hedefGrup) return ozelBildirimGoster("Lütfen hedef Grubu seçin.");

  let mesaj = `${secilenTimler.join(', ')} timlerindeki personel, "${hedefGrup}" grubuna atanacak ve bu eşleşme kalıcı olarak kaydedilecek (bundan sonra bu Timlere atanan YENİ personel de, Grubu boş bırakılırsa otomatik olarak bu Gruba düşecek). Onaylıyor musunuz?`;
  ozelOnayGoster(mesaj, (onaylandi) => {
    if (!onaylandi) return;
    let sayac = 0;
    personeller.forEach(p => {
      if (secilenTimler.includes(p.tim || "")) {
        p.grup = hedefGrup;
        sayac++;
      }
    });
    // Eşleşmeyi kalıcı olarak kaydet: bundan sonra bu Timlerden birine atanan
    // YENİ bir personel, Grubu boş bırakılırsa otomatik olarak bu Gruba düşer.
    secilenTimler.forEach(t => { timGrupEslesmesi[t] = hedefGrup; });

    kaydetLocal();
    grupTimListesiniCiz();
    bilgiNotunuGuncelleVeGoster();
    ayarlarGrupTimSeciciGuncelle();
    tumPersonelListeleriniYenile();
    ozelBildirimGoster(`${sayac} personel "${hedefGrup}" grubuna taşındı ve eşleşme kaydedildi.`);
  });
}

function gruplardanBirliklereTasi() {
  let secilenGruplar = Array.from(document.querySelectorAll('.grupTasiCheckbox:checked')).map(cb => cb.value);
  let hedefBirlikSel = document.getElementById('grupTasiHedefBirlik');
  let hedefBirlik = hedefBirlikSel ? hedefBirlikSel.value : "";

  if (secilenGruplar.length === 0) return ozelBildirimGoster("Lütfen en az bir Grup seçin.");
  if (!hedefBirlik) return ozelBildirimGoster("Lütfen hedef Birliği seçin.");

  let mesaj = `${secilenGruplar.join(', ')} gruplarındaki personel, "${hedefBirlik}" birliğine atanacak ve bu eşleşme kalıcı olarak kaydedilecek (bundan sonra bu Gruplara atanan YENİ personel de, Birliği boş bırakılırsa otomatik olarak bu Birliğe düşecek). Onaylıyor musunuz?`;
  ozelOnayGoster(mesaj, (onaylandi) => {
    if (!onaylandi) return;
    let sayac = 0;
    personeller.forEach(p => {
      if (secilenGruplar.includes(p.grup || "")) {
        p.birlik = hedefBirlik;
        sayac++;
      }
    });
    // Eşleşmeyi kalıcı olarak kaydet: bundan sonra bu Gruplardan birine atanan
    // YENİ bir personel, Birliği boş bırakılırsa otomatik olarak bu Birliğe düşer.
    secilenGruplar.forEach(g => { grupBirlikEslesmesi[g] = hedefBirlik; });

    kaydetLocal();
    grupTimListesiniCiz();
    bilgiNotunuGuncelleVeGoster();
    ayarlarGrupTimSeciciGuncelle();
    tumPersonelListeleriniYenile();
    ozelBildirimGoster(`${sayac} personel "${hedefBirlik}" birliğine taşındı ve eşleşme kaydedildi.`);
  });
}

// Ayarlar sayfasındaki "Personeli Grup / Tim'e Ata" bölümünde, arama kutusuna göre
// filtrelenmiş, onay kutulu (checkbox) personel listesini çizer. Seçimler
// ataSeciliPersonelIds içinde tutulur; arama yapılsa bile seçim kaybolmaz.
//
// Performans: Bu liste de anasayfadaki gibi sayfalanır (bkz. script.js'teki
// ANA_LISTE_SAYFA_BOYUTU). Arama kutusu boşken bile listede binlerce personel
// olabileceğinden, hepsi tek seferde değil, "Daha Fazla Göster" ile parça
// parça DOM'a basılır.
const ATA_LISTE_SAYFA_BOYUTU = 50;
let ataListeGosterilenSayisi = ATA_LISTE_SAYFA_BOYUTU;
let ataListeSonArama = null;

function ataPersonelListesiniCiz() {
  const liste = document.getElementById('ataPersonelListesi');
  const aramaInput = document.getElementById('ataPersonelAramaInput');
  if (!liste) return;

  let q = aramaInput ? aramaInput.value.toLowerCase().trim() : "";
  if (ataListeSonArama !== q) {
    ataListeGosterilenSayisi = ATA_LISTE_SAYFA_BOYUTU;
    ataListeSonArama = q;
  }

  let filtrelenmis = personeller
    .filter(p => (p.adSoyad || "").toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q))
    .slice()
    .sort((a, b) => (a.adSoyad || "").localeCompare(b.adSoyad || "", 'tr'));

  liste.innerHTML = "";
  if (filtrelenmis.length === 0) {
    liste.innerHTML = '<div style="color:#999; font-size:12px; text-align:center; padding:8px;">Personel bulunamadı.</div>';
  } else {
    filtrelenmis.slice(0, ataListeGosterilenSayisi).forEach(p => {
      let strId = String(p.id);
      let isChecked = ataSeciliPersonelIds.has(strId) ? "checked" : "";
      let grupTimMetni = personelBirlikGrupTimMetni(p);
      let etiket = grupTimMetni ? ` <span style="color:#0284c7;">(${guvenliMetin(grupTimMetni)})</span>` : '';
      let satir = document.createElement('label');
      satir.style.cssText = "display:flex; align-items:center; gap:8px; padding:6px 4px; font-size:13px; border-bottom:1px solid #f0f0f0; cursor:pointer;";
      satir.innerHTML = `
        <input type="checkbox" ${isChecked} onchange="ataPersonelSecimToggle('${oncTemizle(strId)}', this)">
        <span>${guvenliMetin(p.adSoyad)} — Sicil: ${guvenliMetin(strId)}${etiket}</span>
      `;
      liste.appendChild(satir);
    });

    if (filtrelenmis.length > ataListeGosterilenSayisi) {
      let kalan = filtrelenmis.length - ataListeGosterilenSayisi;
      let btnWrap = document.createElement('div');
      btnWrap.style.cssText = "text-align:center; padding:6px 2px 2px;";
      btnWrap.innerHTML = `<button class="daha-fazla-goster-btn" onclick="ataListeDahaFazlaGoster()" style="background:#f1f5f9; color:#1e88e5; border:1px solid #dbeafe; padding:8px 14px; border-radius:8px; font-weight:600; font-size:12px; cursor:pointer; width:100%;">⬇️ Daha Fazla Göster (${kalan} kişi kaldı)</button>`;
      liste.appendChild(btnWrap);
    }
  }

  ataSeciliSayisiniGuncelle();
}

// "Personeli Grup / Tim'e Ata" listesinde "Daha Fazla Göster" butonuna
// basıldığında bir sayfa daha (varsayılan 50 kişi) ekler.
function ataListeDahaFazlaGoster() {
  ataListeGosterilenSayisi += ATA_LISTE_SAYFA_BOYUTU;
  ataPersonelListesiniCiz();
}

function ataPersonelSecimToggle(id, checkbox) {
  let strId = String(id);
  if (checkbox.checked) {
    ataSeciliPersonelIds.add(strId);
  } else {
    ataSeciliPersonelIds.delete(strId);
  }
  ataSeciliSayisiniGuncelle();
}

function ataSeciliSayisiniGuncelle() {
  let el = document.getElementById('ataSeciliSayisi');
  if (el) el.innerText = ataSeciliPersonelIds.size;
}

// Seçili personelleri, atama ekranındaki (aktif moda göre görünen) seçicilerin
// değerlerine atar. Kademeler BAĞIMSIZDIR: sadece o an EKRANDA GÖRÜNEN (yani aktif
// moda dahil) seçiciler işleme alınır ve her biri kendi değerine ayarlanır — boş
// bırakılan bir seçici o kişinin ilgili alanını boşaltır. Ekranda hiç görünmeyen
// (aktif moda dahil olmayan) alanlara dokunulmaz.
function personeleGrupTimAta() {
  if (ataSeciliPersonelIds.size === 0) return ozelBildirimGoster("Lütfen en az bir personel seçin.");

  let birlikSel = document.getElementById('ataBirlikSecici');
  let grupSel = document.getElementById('ataGrupSecici');
  let timSel = document.getElementById('ataTimSecici');
  let birlik = birlikSel ? birlikSel.value : "";
  let grup = grupSel ? grupSel.value : "";
  let tim = timSel ? timSel.value : "";

  if (!birlik && !grup && !tim) return ozelBildirimGoster("Lütfen en az bir kademe (Birlik/Grup/Tim) seçin.");

  let sayac = 0;
  ataSeciliPersonelIds.forEach(id => {
    let p = personeller.find(x => String(x.id) === String(id));
    if (!p) return;
    if (birlikSel) p.birlik = birlik;
    if (grupSel) p.grup = grup;
    if (timSel) p.tim = tim;
    // Örn. sadece Tim seçilip Grup boş bırakıldıysa, o Tim için daha önce
    // kaydedilmiş bir eşleşme varsa Grubu (ve zincirleme Birliği) otomatik doldurur.
    otomatikUstKademeleriUygula(p);
    sayac++;
  });

  kaydetLocal();
  ataSeciliPersonelIds.clear();
  grupTimListesiniCiz();
  bilgiNotunuGuncelleVeGoster();
  ayarlarGrupTimSeciciGuncelle();
  tumPersonelListeleriniYenile();
  let atananlar = [birlik, grup, tim].filter(Boolean).join(' • ') || '(boş)';
  ozelBildirimGoster(`${sayac} personel "${atananlar}" olarak atandı.`);
}

function personelAtamasiniKaldir() {
  if (ataSeciliPersonelIds.size === 0) return ozelBildirimGoster("Lütfen en az bir personel seçin.");

  let sayac = 0;
  ataSeciliPersonelIds.forEach(id => {
    let p = personeller.find(x => String(x.id) === String(id));
    if (p) { p.birlik = ""; p.grup = ""; p.tim = ""; sayac++; }
  });

  kaydetLocal();
  ataSeciliPersonelIds.clear();
  grupTimListesiniCiz();
  bilgiNotunuGuncelleVeGoster();
  ayarlarGrupTimSeciciGuncelle();
  tumPersonelListeleriniYenile();
  ozelBildirimGoster(`${sayac} personelin Birlik/Grup/Tim ataması kaldırıldı.`);
}


// ========================================================================
// PIN KİLİDİ (Kritik işlemler için basit erişim koruması)
// ========================================================================
// Not: Bu gerçek anlamda güçlü bir güvenlik katmanı değildir; aynı cihazı/
// tarayıcıyı paylaşan kişiler arasında "Tüm Verileri Sıfırla" gibi kritik
// işlemlerin yanlışlıkla veya izinsiz tetiklenmesini engelleyen basit bir
// kilittir. PIN, düz metin olarak değil basit bir özet (hash) olarak saklanır.

function basitHashUret(metin) {
  let hash = 0;
  let str = String(metin || "");
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

function pinAyarliMi() {
  return !!localStorage.getItem('guvenlikPin');
}

// Ayarlar > Veri sekmesindeki PIN durumu metnini ve butonlarını günceller.
function pinDurumunuGoster() {
  let durumEl = document.getElementById('pinDurumYazisi');
  let belirleBtn = document.getElementById('pinBelirleBtn');
  let kaldirBtn = document.getElementById('pinKaldirBtn');
  if (!durumEl) return;

  if (pinAyarliMi()) {
    durumEl.innerHTML = '🔒 PIN koruması <b style="color:#15803d;">aktif</b>. "Tüm Verileri Sıfırla" gibi kritik işlemler artık PIN ile korunuyor.';
    if (belirleBtn) belirleBtn.innerText = "PIN Değiştir";
    if (kaldirBtn) kaldirBtn.style.display = "block";
  } else {
    durumEl.innerHTML = '🔓 PIN koruması kapalı. Kritik işlemler PIN sorulmadan yapılabilir.';
    if (belirleBtn) belirleBtn.innerText = "PIN Belirle";
    if (kaldirBtn) kaldirBtn.style.display = "none";
  }
}

function pinBelirle() {
  ozelPromptGoster("4-6 haneli yeni PIN girin:", "", (girilen) => {
    if (girilen === null) return;
    let pin = girilen.trim();
    if (!/^\d{4,6}$/.test(pin)) return ozelBildirimGoster("PIN sadece rakamlardan oluşmalı ve 4-6 haneli olmalı.");
    ozelPromptGoster("PIN'i onaylamak için tekrar girin:", "", (girilen2) => {
      if (girilen2 === null) return;
      if (girilen2.trim() !== pin) return ozelBildirimGoster("Girdiğiniz PIN'ler eşleşmedi. Lütfen tekrar deneyin.");
      localStorage.setItem('guvenlikPin', basitHashUret(pin));
      pinDurumunuGoster();
      ozelBildirimGoster("PIN başarıyla ayarlandı.");
    });
  });
}

function pinKaldir() {
  ozelPromptGoster("PIN korumasını kaldırmak için mevcut PIN'i girin:", "", (girilen) => {
    if (girilen === null) return;
    if (basitHashUret(girilen.trim()) !== localStorage.getItem('guvenlikPin')) {
      return ozelBildirimGoster("PIN yanlış.");
    }
    localStorage.removeItem('guvenlikPin');
    pinDurumunuGoster();
    ozelBildirimGoster("PIN koruması kaldırıldı.");
  });
}

// Kritik bir işlemi PIN kontrolünden geçirerek çalıştırır. PIN ayarlı değilse
// işlem doğrudan (sorgusuz) çalışır.
function pinIleKorunanIslemiCalistir(islemFn) {
  if (!pinAyarliMi()) return islemFn();
  ozelPromptGoster("Bu işlem için PIN girin:", "", (girilen) => {
    if (girilen === null) return;
    if (basitHashUret((girilen || "").trim()) !== localStorage.getItem('guvenlikPin')) {
      return ozelBildirimGoster("PIN yanlış. İşlem iptal edildi.");
    }
    islemFn();
  });
}

// ========================================================================
// VERİ YÖNETİMİ (Ayarlar > Veri sekmesi)
// ========================================================================

function tumVerileriSifirla() {
  pinIleKorunanIslemiCalistir(() => {
    ozelOnayGoster("Tüm verileriniz, şablonlarınız ve ayarlarınız kalıcı olarak silinecek. Bu işlemi onaylıyor musunuz?", (onaylandi) => {
      if (!onaylandi) return;
      // ÖNEMLİ DÜZELTME: Önceden localStorage.clear() kullanılıyordu. Bu, sayfanın
      // yüklendiği adres (domain) altında başka bir uygulamaya/sayfaya ait farklı
      // localStorage verisi olsaydı (örn. aynı sunucuda barındırılan başka bir araç),
      // onu da sessizce silerdi. Bunun yerine sadece bu uygulamaya ait anahtarlar
      // tek tek siliniyor. "theme" (koyu/aydınlık tercih) kasıtlı olarak KORUNUYOR;
      // bu bir görüntü tercihidir, personel verisi değildir. İsterseniz bu satırı
      // kaldırarak sıfırlamada temayı da aydınlığa döndürebilirsiniz.
      //
      // ÖNEMLİ DÜZELTME #2: Liste eksikti — "nobetTurSablonlari" (Nöbet panelinde
      // oluşturulan özel nöbet türü şablonları, GERÇEK kullanıcı verisidir) hiç
      // silinmiyordu; "Tüm verileriniz... kalıcı olarak silinecek" mesajına rağmen
      // bu şablonlar sıfırlama sonrası sessizce hayatta kalıyordu. Ayrıca arama
      // kutusu metinleri ve Ayarlar sayfasının grup/tim filtresi de birer "ayar"
      // kabul edilip listeye eklendi. "anaSayfaBilgiNotu" anahtarı ise kod
      // tabanının hiçbir yerinde yazılmadığı için (ölü kod) listeden kaldırıldı.
      localStorage.removeItem('personeller');
      localStorage.removeItem('sablon');
      localStorage.removeItem('grupTimYapisi');
      localStorage.removeItem('birlikListesi');
      localStorage.removeItem('grupListesi');
      localStorage.removeItem('timListesi');
      localStorage.removeItem('sistemModu');
      localStorage.removeItem('timGrupEslesmesi');
      localStorage.removeItem('grupBirlikEslesmesi');
      localStorage.removeItem('secilenGrupTim');
      localStorage.removeItem('nobetKayitlari');
      localStorage.removeItem('nobetTurSablonlari');
      localStorage.removeItem('aktifSiralama');
      localStorage.removeItem('aktifAramaMetni');
      localStorage.removeItem('ayarlarAramaMetni');
      localStorage.removeItem('ayarlarSecilenGrupTim');
      localStorage.removeItem('bildirimAktif');
      localStorage.removeItem('sonBildirimTarihi');
      localStorage.removeItem('guvenlikPin');
      // sessionStorage'daki ekran/gezinme geçmişi de temizlenir; aksi halde sayfa
      // yenilendiğinde artık var olmayan bir personelin kategori/form ekranına
      // dönülmeye çalışılıp boş/bozuk bir ekranla karşılaşılabiliyordu.
      sessionStorage.clear();

      if (typeof ozelBildirimGoster === 'function') {
        ozelBildirimGoster("Tüm veriler ve ayarlar sıfırlandı, sayfa yenileniyor...");
      }

      // İşlem bittikten yarım saniye sonra sayfayı yenile
      setTimeout(() => {
        location.reload();
      }, 500);
    });
  });
}
