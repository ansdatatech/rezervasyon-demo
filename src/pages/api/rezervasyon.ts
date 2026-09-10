import type { APIRoute } from 'astro';
import { db } from '../../db';
import { rezervasyonlar, musteriler } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { jwtVerify } from 'jose';

export const prerender = false;

const JWT_SECRET = new TextEncoder().encode(import.meta.env.JWT_SECRET || 'gizli_anahtar_degistir_lutfen');

// --- KİMLİK OKUMA FONKSİYONU ---
// İsteği yapanın rolünü ve kullanıcı adını çözer
async function kimlikGetir(request: Request) {
    try {
        const cookieStr = request.headers.get('cookie');
        if (!cookieStr) return null;
        
        const tokenMatch = cookieStr.match(/auth_token=([^;]+)/);
        if (!tokenMatch) return null;
        
        const { payload } = await jwtVerify(tokenMatch[1], JWT_SECRET);
        return { rol: payload.rol, kullaniciAdi: payload.kullaniciAdi };
    } catch (e) {
        return null;
    }
}

// --- İLETİMERKEZİ SMS GÖNDERME FONKSİYONU ---
async function smsGonder(telefon: string, mesaj: string) {
    const SENDER_BASLIK = "KORT_REZ"; 
    const temizTelefon = telefon.replace(/\D/g, '');
    console.log(`\n📱 [SMS GÖNDERİLDİ - İletiMerkezi API]\n👤 Alıcı: ${temizTelefon}\n💬 Mesaj: ${mesaj}\n`);
    return true;
}

// 1. VERİ GETİRME (GET - Herkes görebilir, arayüzde biz sansürlüyoruz)
export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const istenenTarih = url.searchParams.get('tarih');
        if (!istenenTarih) return new Response(JSON.stringify({ error: "Tarih eksik!" }), { status: 400 });

        let kayitlar = istenenTarih === 'hepsi' 
            ? await db.select().from(rezervasyonlar) 
            : await db.select().from(rezervasyonlar).where(eq(rezervasyonlar.tarih, istenenTarih));

        return new Response(JSON.stringify(kayitlar), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

// 2. KAYIT EKLEME (POST)
export const POST: APIRoute = async ({ request }) => {
    // Herhangi bir giriş yapmış kullanıcı ekleyebilir
    const kimlik = await kimlikGetir(request);
    if (!kimlik) return new Response(JSON.stringify({ error: "Oturum süresi dolmuş." }), { status: 401 });

    try {
        const body = await request.json();

        // GÜVENLİK KİLİDİ: Çifte Rezervasyon Kontrolü
        const cakisiyorMu = await db.select().from(rezervasyonlar).where(
            and(eq(rezervasyonlar.tarih, body.tarih), eq(rezervasyonlar.saat, body.saat), eq(rezervasyonlar.alanId, parseInt(body.kortNo)))
        ).limit(1);

        if(cakisiyorMu.length > 0) {
            return new Response(JSON.stringify({ error: "Bu saat az önce başka biri tarafından dolduruldu. Lütfen sayfayı yenileyin." }), { status: 400 });
        }

        await db.insert(rezervasyonlar).values({
            alanId: parseInt(body.kortNo), tarih: body.tarih, saat: body.saat,
            kisiAdi: body.kisiAdi, telefon: body.telefon, 
            rezervasyonTuru: body.rezervasyonTuru, notlar: kimlik.kullaniciAdi // Kaydı kimin eklediğini token'dan alıyoruz (Güvenli)
        });

        if (body.telefon) {
            const mevcut = await db.select().from(musteriler).where(eq(musteriler.adSoyad, body.kisiAdi)).limit(1);
            if (mevcut.length === 0) await db.insert(musteriler).values({ adSoyad: body.kisiAdi, telefon: body.telefon });
            
            const smsMetni = `Sayın ${body.kisiAdi}, ${body.tarih} tarihi saat ${body.saat} için rezervasyonunuz başarıyla oluşturulmuştur.`;
            await smsGonder(body.telefon, smsMetni);
        }

        return new Response(JSON.stringify({ success: true, wpSent: !!body.telefon }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

// 3. KAYIT DÜZENLEME (PUT)
export const PUT: APIRoute = async ({ request }) => {
    const kimlik = await kimlikGetir(request);
    if (!kimlik) return new Response(JSON.stringify({ error: "Oturum süresi dolmuş." }), { status: 401 });

    try {
        const body = await request.json();
        
        // GÜVENLİK KİLİDİ: Eğer rol 'antrenor' ise, sadece kendi eklediği (notlar = kullaniciAdi) kayıtları düzenleyebilir.
        const guncellenecek = await db.select().from(rezervasyonlar).where(eq(rezervasyonlar.id, parseInt(body.id))).limit(1);
        if (guncellenecek.length === 0) return new Response(JSON.stringify({ error: "Kayıt bulunamadı!" }), { status: 404 });
        
        if (kimlik.rol === 'antrenor' && guncellenecek[0].notlar !== kimlik.kullaniciAdi) {
             return new Response(JSON.stringify({ error: "Sadece kendi oluşturduğunuz dersleri düzenleyebilirsiniz!" }), { status: 403 });
        }

        await db.update(rezervasyonlar).set({
            kisiAdi: body.kisiAdi, telefon: body.telefon, rezervasyonTuru: body.rezervasyonTuru
        }).where(eq(rezervasyonlar.id, parseInt(body.id)));

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

// 4. KAYIT SİLME (DELETE)
export const DELETE: APIRoute = async ({ request }) => {
    const kimlik = await kimlikGetir(request);
    if (!kimlik) return new Response(JSON.stringify({ error: "Oturum süresi dolmuş." }), { status: 401 });

    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        if (!id) return new Response(JSON.stringify({ error: "ID eksik!" }), { status: 400 });

        const silinecekKayit = await db.select().from(rezervasyonlar).where(eq(rezervasyonlar.id, parseInt(id))).limit(1);
        if (silinecekKayit.length === 0) return new Response(JSON.stringify({ success: true }), { status: 200 });
        const k = silinecekKayit[0];

        // GÜVENLİK KİLİDİ: Antrenör başkasının kaydını silemez.
        if (kimlik.rol === 'antrenor' && k.notlar !== kimlik.kullaniciAdi) {
            return new Response(JSON.stringify({ error: "Sadece kendi oluşturduğunuz dersleri iptal edebilirsiniz!" }), { status: 403 });
        }

        await db.delete(rezervasyonlar).where(eq(rezervasyonlar.id, parseInt(id)));
        
        if (k.telefon) {
            const iptalMetni = `Sayın ${k.kisiAdi}, ${k.tarih} tarihi saat ${k.saat} olan rezervasyonunuz iptal edilmiştir.`;
            await smsGonder(k.telefon, iptalMetni);
        }
        
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};