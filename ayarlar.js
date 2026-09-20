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
// GRUP / TİM YÖNETİMİ
// Anasayfa başlığının altındaki açılır menüyü besleyen grup/tim yapısı ve
// personellerin bu gruplara/timlere atanması burada yönetilir.
// ========================================================================

function grupTimYapisiniKaydet() {
  try {
    localStorage.setItem('grupTimYapisi', JSON.stringify(grupTimYapisi));
  } catch (e) {
    ozelBildirimGoster("Grup/Tim yapısı kaydedilemedi! Hafıza dolu olabilir.");
  }
}

function grupEkle() {
  let input = document.getElementById('yeniGrupInput');
  let val = input ? input.value.trim() : "";
  if (!val) return ozelBildirimGoster("Lütfen bir grup adı yazın.");
  if (grupTimYapisi[val]) return ozelBildirimGoster("Bu isimde bir grup zaten var.");

  grupTimYapisi[val] = [];
  if (input) input.value = "";
  grupTimYapisiniKaydet();
  grupTimListesiniCiz();
  bilgiNotunuGuncelleVeGoster();
  ayarlarGrupTimSeciciGuncelle();
  ozelBildirimGoster(`"${val}" grubu eklendi.`);
}

function timEkle() {
  let grupSel = document.getElementById('grupSeciciTimIcin');
  let grup = grupSel ? grupSel.value : "";
  let input = document.getElementById('yeniTimInput');
  let val = input ? input.value.trim() : "";

  if (!grup) return ozelBildirimGoster("Önce bir grup seçin veya ekleyin.");
  if (!val) return ozelBildirimGoster("Lütfen bir tim adı yazın.");
  if (!Array.isArray(grupTimYapisi[grup])) grupTimYapisi[grup] = [];
  if (grupTimYapisi[grup].includes(val)) return ozelBildirimGoster("Bu isimde bir tim zaten bu grupta var.");

  grupTimYapisi[grup].push(val);
  if (input) input.value = "";
  grupTimYapisiniKaydet();
  grupTimListesiniCiz();
  bilgiNotunuGuncelleVeGoster();
  ayarlarGrupTimSeciciGuncelle();
  ozelBildirimGoster(`"${val}" timi "${grup}" grubuna eklendi.`);
}

// Bir grubun adını değiştirir: grupTimYapisi'ndeki anahtarı yeniler, o gruba
// atanmış personellerin p.grup alanını günceller ve aktif filtre bu grubu
// gösteriyorsa filtreyi de yeni adla günceller.
function grupDuzenle(eskiAd) {
  ozelPromptGoster("Yeni grup adını girin:", eskiAd, (girilenDeger) => {
    if (girilenDeger === null) return; // İptal edildi
    let yeniAd = girilenDeger.trim();
    if (yeniAd === "" || yeniAd === eskiAd) return;
    if (grupTimYapisi[yeniAd]) return ozelBildirimGoster("Bu isimde bir grup zaten var.");

    grupTimYapisi[yeniAd] = grupTimYapisi[eskiAd];
    delete grupTimYapisi[eskiAd];

    personeller.forEach(p => {
      if (p.grup === eskiAd) p.grup = yeniAd;
    });

    if (aktifGrupTimFiltre && aktifGrupTimFiltre.split('||')[0] === eskiAd) {
      aktifGrupTimFiltre = `${yeniAd}||${aktifGrupTimFiltre.split('||')[1]}`;
      localStorage.setItem('secilenGrupTim', aktifGrupTimFiltre);
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

// Bir timin adını değiştirir: grupTimYapisi içindeki listeyi günceller, o time
// atanmış personellerin p.tim alanını günceller ve aktif filtreyi de gerekirse yeniler.
function timDuzenle(grup, eskiAd) {
  ozelPromptGoster("Yeni tim adını girin:", eskiAd, (girilenDeger) => {
    if (girilenDeger === null) return;
    let yeniAd = girilenDeger.trim();
    if (yeniAd === "" || yeniAd === eskiAd) return;
    if (!Array.isArray(grupTimYapisi[grup])) return;
    if (grupTimYapisi[grup].includes(yeniAd)) return ozelBildirimGoster("Bu isimde bir tim zaten bu grupta var.");

    let index = grupTimYapisi[grup].indexOf(eskiAd);
    if (index === -1) return;
    grupTimYapisi[grup][index] = yeniAd;

    personeller.forEach(p => {
      if (p.grup === grup && p.tim === eskiAd) p.tim = yeniAd;
    });

    if (aktifGrupTimFiltre === `${grup}||${eskiAd}`) {
      aktifGrupTimFiltre = `${grup}||${yeniAd}`;
      localStorage.setItem('secilenGrupTim', aktifGrupTimFiltre);
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

function grupSil(grup) {
  pinIleKorunanIslemiCalistir(() => {
    let timSayisi = (grupTimYapisi[grup] || []).length;
    let atanmisSayisi = personeller.filter(p => p.grup === grup).length;
    let mesaj = `"${grup}" grubunu ve içindeki ${timSayisi} timi silmek istediğinize emin misiniz?`;
    if (atanmisSayisi > 0) mesaj += `\nBu gruba atanmış ${atanmisSayisi} personelin grup/tim ataması kaldırılacak.`;

    ozelOnayGoster(mesaj, (onaylandi) => {
      if (!onaylandi) return;
      delete grupTimYapisi[grup];
      personeller.forEach(p => {
        if (p.grup === grup) { p.grup = ""; p.tim = ""; }
      });
      if (aktifGrupTimFiltre && aktifGrupTimFiltre.split('||')[0] === grup) {
        aktifGrupTimFiltre = "";
        localStorage.setItem('secilenGrupTim', "");
      }
      kaydetLocal();
      grupTimYapisiniKaydet();
      grupTimListesiniCiz();
      bilgiNotunuGuncelleVeGoster();
      ayarlarGrupTimSeciciGuncelle();
      tumPersonelListeleriniYenile();
    });
  });
}

function timSil(grup, tim) {
  pinIleKorunanIslemiCalistir(() => {
    let atanmisSayisi = personeller.filter(p => p.grup === grup && p.tim === tim).length;
    let mesaj = `"${grup}" grubundaki "${tim}" timini silmek istediğinize emin misiniz?`;
    if (atanmisSayisi > 0) mesaj += `\nBu time atanmış ${atanmisSayisi} personelin tim ataması kaldırılacak.`;

    ozelOnayGoster(mesaj, (onaylandi) => {
      if (!onaylandi) return;
      grupTimYapisi[grup] = (grupTimYapisi[grup] || []).filter(t => t !== tim);
      personeller.forEach(p => {
        if (p.grup === grup && p.tim === tim) { p.tim = ""; }
      });
      if (aktifGrupTimFiltre === `${grup}||${tim}`) {
        aktifGrupTimFiltre = "";
        localStorage.setItem('secilenGrupTim', "");
      }
      kaydetLocal();
      grupTimYapisiniKaydet();
      grupTimListesiniCiz();
      bilgiNotunuGuncelleVeGoster();
      ayarlarGrupTimSeciciGuncelle();
      tumPersonelListeleriniYenile();
    });
  });
}

// Ayarlar sayfasındaki grup/tim listesini ve ilgili seçim kutularını
// (tim eklemek için grup seçici, personel atama için grup/tim/personel seçiciler) çizer.
function grupTimListesiniCiz() {
  const container = document.getElementById('grupTimListesiContainer');
  const timGrupSecici = document.getElementById('grupSeciciTimIcin');
  const ataGrupSecici = document.getElementById('ataGrupSecici');
  if (!container) return;

  // Gruplar her zaman alfabetik sırayla gösterilir (eklenme sırasına göre değil).
  let grupAdlari = Object.keys(grupTimYapisi).sort((a, b) => a.localeCompare(b, 'tr'));

  if (timGrupSecici) {
    let mevcutSecim = timGrupSecici.value;
    timGrupSecici.innerHTML = "";
    if (grupAdlari.length === 0) {
      timGrupSecici.innerHTML = '<option value="">Önce grup ekleyin</option>';
    } else {
      grupAdlari.forEach(g => {
        let opt = document.createElement('option');
        opt.value = g; opt.innerText = g;
        timGrupSecici.appendChild(opt);
      });
      if (grupAdlari.includes(mevcutSecim)) timGrupSecici.value = mevcutSecim;
    }
  }

  if (ataGrupSecici) {
    let mevcutSecim = ataGrupSecici.value;
    ataGrupSecici.innerHTML = '<option value="">Grup Seçin</option>';
    grupAdlari.forEach(g => {
      let opt = document.createElement('option');
      opt.value = g; opt.innerText = g;
      ataGrupSecici.appendChild(opt);
    });
    if (grupAdlari.includes(mevcutSecim)) ataGrupSecici.value = mevcutSecim;
    ataTimSeciciDoldur();
  }

  ataPersonelListesiniCiz();

  container.innerHTML = "";
  if (grupAdlari.length === 0) {
    container.innerHTML = '<div style="color: #888; font-style: italic; text-align: center; padding: 10px;">Henüz grup eklenmemiş.</div>';
    return;
  }

  grupAdlari.forEach(grup => {
    // Timler de kendi grubu içinde alfabetik sırayla listelenir.
    let timler = (grupTimYapisi[grup] || []).slice().sort((a, b) => a.localeCompare(b, 'tr'));
    let box = document.createElement('div');
    box.style.cssText = "background: #f9f9f9; padding: 8px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #e0e0e0;";

    let timlerHtml = timler.map(tim => {
      let sayi = personeller.filter(p => p.grup === grup && p.tim === tim).length;
      return `
        <div style="display:flex; justify-content: space-between; align-items:center; margin-left:10px; margin-top:6px; padding-top:4px; border-top:1px dashed #ddd;">
          <span style="font-size:13px;">• ${guvenliMetin(tim)} <span style="color:#999; font-size:11px;">(${sayi} kişi)</span></span>
          <span style="display:flex; gap:4px;">
            <button onclick="timDuzenle('${oncTemizle(grup)}', '${oncTemizle(tim)}')" style="background:none; border:none; color:#1e88e5; cursor:pointer; font-size:12px; padding:0;" title="Düzenle">✏️</button>
            <button onclick="timSil('${oncTemizle(grup)}', '${oncTemizle(tim)}')" style="background:#e53935; border:none; color:white; cursor:pointer; font-size:10px; padding:3px 6px; border-radius:4px;">Sil</button>
          </span>
        </div>
      `;
    }).join("") || '<div style="color:#999; margin-left:10px; margin-top:4px; font-size:11px;">Bu grupta henüz tim yok</div>';

    let grupToplam = personeller.filter(p => p.grup === grup).length;
    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; font-weight:bold; color:#1e88e5;">
        <span>👥 ${guvenliMetin(grup)} <span style="color:#999; font-weight:normal; font-size:11px;">(${grupToplam} kişi)</span></span>
        <span style="display:flex; gap:4px;">
          <button onclick="grupDuzenle('${oncTemizle(grup)}')" style="background:none; border:none; color:#1e88e5; cursor:pointer; font-size:13px; padding:0 2px;" title="Düzenle">✏️</button>
          <button onclick="grupSil('${oncTemizle(grup)}')" style="background:#e53935; border:none; color:white; cursor:pointer; font-size:11px; padding:4px 8px; border-radius:4px;">Sil</button>
        </span>
      </div>
      ${timlerHtml}
    `;
    container.appendChild(box);
  });
}

// "Personeli Grup / Tim'e Ata" bölümündeki Grup seçimi değiştiğinde,
// Tim seçim kutusunu sadece o gruba ait timlerle, alfabetik sırayla doldurur.
function ataTimSeciciDoldur() {
  const ataGrupSecici = document.getElementById('ataGrupSecici');
  const ataTimSecici = document.getElementById('ataTimSecici');
  if (!ataGrupSecici || !ataTimSecici) return;

  let grup = ataGrupSecici.value;
  ataTimSecici.innerHTML = '<option value="">Tim Seçin</option>';
  (grupTimYapisi[grup] || []).slice().sort((a, b) => a.localeCompare(b, 'tr')).forEach(tim => {
    let opt = document.createElement('option');
    opt.value = tim; opt.innerText = tim;
    ataTimSecici.appendChild(opt);
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
      let etiket = p.grup ? ` <span style="color:#0284c7;">(${guvenliMetin(p.grup)}${p.tim ? ' - ' + guvenliMetin(p.tim) : ''})</span>` : '';
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

function personeleGrupTimAta() {
  let grup = document.getElementById('ataGrupSecici').value;
  let tim = document.getElementById('ataTimSecici').value;

  if (ataSeciliPersonelIds.size === 0) return ozelBildirimGoster("Lütfen en az bir personel seçin.");
  if (!grup || !tim) return ozelBildirimGoster("Lütfen grup ve tim seçin.");

  let sayac = 0;
  ataSeciliPersonelIds.forEach(id => {
    let p = personeller.find(x => String(x.id) === String(id));
    if (p) { p.grup = grup; p.tim = tim; sayac++; }
  });

  kaydetLocal();
  ataSeciliPersonelIds.clear();
  grupTimListesiniCiz();
  bilgiNotunuGuncelleVeGoster();
  ayarlarGrupTimSeciciGuncelle();
  tumPersonelListeleriniYenile();
  ozelBildirimGoster(`${sayac} personel "${grup} - ${tim}" timine atandı.`);
}

function personelAtamasiniKaldir() {
  if (ataSeciliPersonelIds.size === 0) return ozelBildirimGoster("Lütfen en az bir personel seçin.");

  let sayac = 0;
  ataSeciliPersonelIds.forEach(id => {
    let p = personeller.find(x => String(x.id) === String(id));
    if (p) { p.grup = ""; p.tim = ""; sayac++; }
  });

  kaydetLocal();
  ataSeciliPersonelIds.clear();
  grupTimListesiniCiz();
  bilgiNotunuGuncelleVeGoster();
  ayarlarGrupTimSeciciGuncelle();
  tumPersonelListeleriniYenile();
  ozelBildirimGoster(`${sayac} personelin grup/tim ataması kaldırıldı.`);
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
      localStorage.removeItem('personeller');
      localStorage.removeItem('sablon');
      localStorage.removeItem('anaSayfaBilgiNotu');
      localStorage.removeItem('grupTimYapisi');
      localStorage.removeItem('secilenGrupTim');
      localStorage.removeItem('nobetKayitlari');
      localStorage.removeItem('aktifSiralama');
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
