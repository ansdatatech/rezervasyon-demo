import type { APIRoute } from 'astro';
import { db } from '../../db';
import { kullanicilar } from '../../db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { jwtVerify } from 'jose';

export const prerender = false;
const JWT_SECRET = new TextEncoder().encode(import.meta.env.JWT_SECRET || 'gizli_anahtar_degistir_lutfen');

export const POST: APIRoute = async ({ request }) => {
    try {
        // 1. Token'dan kullanıcının kim olduğunu anla
        const cookieStr = request.headers.get('cookie');
        if (!cookieStr) return new Response(JSON.stringify({ error: "Oturum bulunamadı." }), { status: 401 });
        const tokenMatch = cookieStr.match(/auth_token=([^;]+)/);
        if (!tokenMatch) return new Response(JSON.stringify({ error: "Yetkisiz erişim." }), { status: 401 });
        
        const { payload } = await jwtVerify(tokenMatch[1], JWT_SECRET);
        const aktifKullaniciAdi = payload.kullaniciAdi as string;

        const body = await request.json();
        
        // 2. Veritabanından kullanıcıyı bul
        const kullanici = await db.select().from(kullanicilar).where(eq(kullanicilar.kullaniciAdi, aktifKullaniciAdi)).limit(1);
        if (kullanici.length === 0) return new Response(JSON.stringify({ error: "Kullanıcı bulunamadı." }), { status: 404 });

        // 3. Eski şifreyi doğrula
        const sifreDogruMu = await bcrypt.compare(body.eskiSifre, kullanici[0].sifreHash);
        if (!sifreDogruMu) return new Response(JSON.stringify({ error: "Mevcut şifrenizi yanlış girdiniz!" }), { status: 400 });

        // 4. Yeni şifreyi hashle ve kaydet
        const yeniSifreHash = await bcrypt.hash(body.yeniSifre, 10);
        await db.update(kullanicilar).set({ sifreHash: yeniSifreHash }).where(eq(kullanicilar.id, kullanici[0].id));

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: "İşlem başarısız oldu." }), { status: 500 });
    }
};