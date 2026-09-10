import type { APIRoute } from 'astro';
import { db } from '../../db';
import { kullanicilar } from '../../db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { jwtVerify } from 'jose';

export const prerender = false;

const JWT_SECRET = new TextEncoder().encode(import.meta.env.JWT_SECRET || 'gizli_anahtar_degistir_lutfen');

// --- YARDIMCI GÜVENLİK FONKSİYONU ---
async function rolKontrol(request: Request, izinVerilenRol: string) {
    try {
        const cookieStr = request.headers.get('cookie');
        if (!cookieStr) return false;
        
        const tokenMatch = cookieStr.match(/auth_token=([^;]+)/);
        if (!tokenMatch) return false;
        
        const token = tokenMatch[1];
        const { payload } = await jwtVerify(token, JWT_SECRET);
        
        // Eğer giren kişinin rolü, izin verilen role uymuyorsa reddet
        if (payload.rol !== izinVerilenRol) return false;
        
        return true;
    } catch (e) {
        return false;
    }
}

// 1. PERSONEL LİSTESİNİ GETİR
export const GET: APIRoute = async ({ request }) => {
    // GÜVENLİK KİLİDİ
    if (!await rolKontrol(request, 'yonetici')) {
        return new Response(JSON.stringify({ error: "Yetkisiz erişim! Sadece yöneticiler görebilir." }), { status: 403 });
    }

    try {
        const liste = await db.select({
            id: kullanicilar.id, kullaniciAdi: kullanicilar.kullaniciAdi,
            adSoyad: kullanicilar.adSoyad, rol: kullanicilar.rol
        }).from(kullanicilar);
        
        return new Response(JSON.stringify(liste), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

// 2. YENİ PERSONEL EKLE
export const POST: APIRoute = async ({ request }) => {
    // GÜVENLİK KİLİDİ
    if (!await rolKontrol(request, 'yonetici')) {
        return new Response(JSON.stringify({ error: "Yetkisiz erişim! Yeni personel ekleyemezsiniz." }), { status: 403 });
    }

    try {
        const body = await request.json();
        const hashedPassword = await bcrypt.hash(body.sifre, 10);
        
        await db.insert(kullanicilar).values({
            kullaniciAdi: body.kullaniciAdi,
            sifreHash: hashedPassword,
            rol: body.rol,
            adSoyad: body.adSoyad
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        if (error.message.includes('unique constraint')) return new Response(JSON.stringify({ error: "Bu kullanıcı adı zaten kullanılıyor!" }), { status: 400 });
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

// 3. PERSONEL SİL
export const DELETE: APIRoute = async ({ request }) => {
    // GÜVENLİK KİLİDİ
    if (!await rolKontrol(request, 'yonetici')) {
        return new Response(JSON.stringify({ error: "Yetkisiz erişim! Personel silemezsiniz." }), { status: 403 });
    }

    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');

        if (!id) return new Response(JSON.stringify({ error: "ID eksik!" }), { status: 400 });
        if (id === '1') return new Response(JSON.stringify({ error: "Ana yönetici hesabı silinemez!" }), { status: 403 });

        await db.delete(kullanicilar).where(eq(kullanicilar.id, parseInt(id)));
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};