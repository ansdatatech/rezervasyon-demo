import type { APIRoute } from 'astro';
import { db } from '../../db';
import { kullanicilar } from '../../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

export const prerender = false;

// Güvenlik anahtarı (Normalde bu da .env içine konur)
const SECRET = new TextEncoder().encode("cok-gizli-super-sifre-12345"); 

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const body = await request.json();
        const { kullaniciAdi, sifre } = body;

        // 1. Kullanıcıyı veritabanında bul
        const user = await db.select().from(kullanicilar).where(eq(kullanicilar.kullaniciAdi, kullaniciAdi)).limit(1);

        if (user.length === 0) {
            return new Response(JSON.stringify({ error: "Kullanıcı bulunamadı" }), { status: 401 });
        }

        // 2. Kriptolu şifreyi doğrula
        const isMatch = await bcrypt.compare(sifre, user[0].sifreHash);
        if (!isMatch) {
            return new Response(JSON.stringify({ error: "Hatalı şifre" }), { status: 401 });
        }

        // 3. JWT (Güvenli Oturum Token'ı) Oluştur
        const token = await new SignJWT({ id: user[0].id, kullaniciAdi: user[0].kullaniciAdi, rol: user[0].rol })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('24h') // Oturum 24 saat geçerli
            .sign(SECRET);

        // 4. Token'ı Tarayıcı Çerezlerine (Cookie) kaydet
        cookies.set('auth_token', token, {
            httpOnly: true, // JavaScript ile çalınmayı engeller (XSS koruması)
            path: '/',
            secure: true,
            maxAge: 60 * 60 * 24 
        });

        return new Response(JSON.stringify({ success: true, user: user[0].kullaniciAdi }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};