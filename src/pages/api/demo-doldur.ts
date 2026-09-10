import type { APIRoute } from 'astro';
import { db } from '../../db';
import { rezervasyonlar, musteriler } from '../../db/schema';

export const prerender = false;

export const GET: APIRoute = async () => {
    try {
        // 1. ESKİ VERİLERİ TEMİZLE (Sıfırdan Başlıyoruz)
        await db.delete(rezervasyonlar);
        await db.delete(musteriler);

        // 2. SABİT MÜŞTERİ (CRM) LİSTESİ OLUŞTUR (Aynı kişiler tekrar tekrar gelsin diye)
        const musteriListesi = [
            { adSoyad: "Ahmet Yılmaz", telefon: "05321112233" },
            { adSoyad: "Ayşe Kaya", telefon: "05554445566" },
            { adSoyad: "Mehmet Demir", telefon: "05447778899" },
            { adSoyad: "Fatma Çelik", telefon: "05051234567" },
            { adSoyad: "Mustafa Şahin", telefon: "05339998877" },
            { adSoyad: "Zeynep Öztürk", telefon: "05423334455" },
            { adSoyad: "Caner Yıldız", telefon: "05546667788" }
        ];

        // Müşterileri hafızaya ekle
        await db.insert(musteriler).values(musteriListesi);

        // 3. REZERVASYONLARI ÜRET (Telefon bilgisiyle birlikte)
        const saatler = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];
        const turler = ["Genel Rezervasyon", "Genel Rezervasyon", "Özel Ders"];
        const notlarList = ["sahinbingol", "sekreter", "antrenor"];

        const eklenecekKayitlar = [];
        const mevcutKombinasyonlar = new Set();
        const bugun = new Date();

        // 150 Adet Rastgele Kayıt
        for (let i = 0; i < 150; i++) {
            const randomGunFarki = Math.floor(Math.random() * 30); // Son 30 gün
            const islemTarihi = new Date(bugun);
            islemTarihi.setDate(bugun.getDate() - randomGunFarki);

            const yil = islemTarihi.getFullYear();
            const ay = String(islemTarihi.getMonth() + 1).padStart(2, '0');
            const gun = String(islemTarihi.getDate()).padStart(2, '0');
            const tarihStr = `${yil}-${ay}-${gun}`;

            const saat = saatler[Math.floor(Math.random() * saatler.length)];
            const kort = Math.floor(Math.random() * 4) + 1;

            const anahtar = `${tarihStr}_${saat}_${kort}`;

            if (!mevcutKombinasyonlar.has(anahtar)) {
                mevcutKombinasyonlar.add(anahtar);
                
                // Müşteriler listesinden rastgele birini seç
                const secilenMusteri = musteriListesi[Math.floor(Math.random() * musteriListesi.length)];

                eklenecekKayitlar.push({
                    alanId: kort,
                    tarih: tarihStr,
                    saat: saat,
                    kisiAdi: secilenMusteri.adSoyad,
                    telefon: secilenMusteri.telefon, // Artık numaraları da veritabanına işliyoruz
                    rezervasyonTuru: turler[Math.floor(Math.random() * turler.length)],
                    notlar: notlarList[Math.floor(Math.random() * notlarList.length)]
                });
            }
        }

        // Veritabanına toplu gönderim
        if (eklenecekKayitlar.length > 0) {
            await db.insert(rezervasyonlar).values(eklenecekKayitlar);
        }

        return new Response(JSON.stringify({ 
            success: true, 
            mesaj: "Süper! Eski veriler silindi. CRM hafızası ve Telefon numaraları ile birlikte yepyeni 150 kayıt oluşturuldu." 
        }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};