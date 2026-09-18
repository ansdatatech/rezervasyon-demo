import type { APIRoute } from 'astro';
import { db } from '../../db';
import { sistemAyarlari } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { jwtVerify } from 'jose';

export const prerender = false;
const JWT_SECRET = new TextEncoder().encode(import.meta.env.JWT_SECRET || 'gizli_anahtar_degistir_lutfen');

export const GET: APIRoute = async () => {
    try {
        let ayar = await db.select().from(sistemAyarlari).limit(1);
        
        // Eğer tablo boşsa varsayılan saatleri oluştur
        if (ayar.length === 0) {
            const yeniAyar = await db.insert(sistemAyarlari).values({ baslangicSaati: 8, bitisSaati: 22 }).returning();
            ayar = yeniAyar;
        }
        
        return new Response(JSON.stringify(ayar[0]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: "Ayarlar çekilemedi." }), { status: 500 });
    }
};

export const PUT: APIRoute = async ({ request }) => {
    try {
        // Sadece yöneticiler saatleri değiştirebilir
        const cookieStr = request.headers.get('cookie');
        if (!cookieStr) return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
        const tokenMatch = cookieStr.match(/auth_token=([^;]+)/);
        const { payload } = await jwtVerify(tokenMatch![1], JWT_SECRET);
        if (payload.rol !== 'yonetici') return new Response(JSON.stringify({ error: "Sadece yöneticiler değiştirebilir!" }), { status: 403 });

        const body = await request.json();
        
        // İlgili ayarı güncelle (ID'si 1 olanı)
        await db.update(sistemAyarlari).set({
            baslangicSaati: parseInt(body.baslangicSaati),
            bitisSaati: parseInt(body.bitisSaati),
            alanSayisi: parseInt(body.alanSayisi) // YENİ EKLENEN SATIR
        }).where(eq(sistemAyarlari.id, body.id));

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: "Güncelleme başarısız." }), { status: 500 });
    }
};