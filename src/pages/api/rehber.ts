import type { APIRoute } from 'astro';
import { db } from '../../db';
import { musteriler } from '../../db/schema';
import { desc } from 'drizzle-orm';
import { jwtVerify } from 'jose';

export const prerender = false;
const JWT_SECRET = new TextEncoder().encode(import.meta.env.JWT_SECRET || 'gizli_anahtar_degistir_lutfen');

export const GET: APIRoute = async ({ request }) => {
    try {
        // Güvenlik: Sadece giriş yapmış kişiler görebilir
        const cookieStr = request.headers.get('cookie');
        if (!cookieStr) return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
        
        const tokenMatch = cookieStr.match(/auth_token=([^;]+)/);
        if (!tokenMatch) return new Response(JSON.stringify({ error: "Yetkisiz" }), { status: 401 });
        
        await jwtVerify(tokenMatch[1], JWT_SECRET);

        // Müşterileri son eklenenden geriye doğru çek
        const liste = await db.select().from(musteriler).orderBy(desc(musteriler.id));
        
        return new Response(JSON.stringify(liste), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: "Veri çekilemedi." }), { status: 500 });
    }
};