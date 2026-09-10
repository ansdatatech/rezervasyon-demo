import type { APIRoute } from 'astro';
import { db } from '../../db';
import { musteriler } from '../../db/schema';
import { ilike } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const query = url.searchParams.get('q');

        if (!query || query.length < 2) return new Response(JSON.stringify([]));

        // İsme göre arama yapıyoruz (Büyük/Küçük harf duyarsız - ilike)
        const sonuclar = await db.select().from(musteriler).where(ilike(musteriler.adSoyad, `%${query}%`)).limit(5);
        
        return new Response(JSON.stringify(sonuclar), { status: 200 });
    } catch (error) {
        return new Response(JSON.stringify([]), { status: 500 });
    }
};