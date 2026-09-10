import type { APIRoute } from 'astro';
import { db } from '../../db';
import { kullanicilar } from '../../db/schema';
import bcrypt from 'bcryptjs';

export const prerender = false; 

export const GET: APIRoute = async () => {
    try {
        // Tüm şifreler "123456" olarak belirlendi
        const hashedPassword = await bcrypt.hash("123456", 10);
        
        // Çoklu kullanıcı ekleme (Bulk Insert)
        await db.insert(kullanicilar).values([
            {
                kullaniciAdi: "yonetici",
                sifreHash: hashedPassword,
                rol: "yonetici",
                adSoyad: "Sistem Yöneticisi" // Tüm yetkilere sahip
            },
            {
                kullaniciAdi: "sekreter",
                sifreHash: hashedPassword,
                rol: "sekreter",
                adSoyad: "Ön Büro Sekreteri" // İstatistik göremez, her yeri yönetir
            },
            {
                kullaniciAdi: "antrenor",
                sifreHash: hashedPassword,
                rol: "antrenor",
                adSoyad: "Ali Hoca" // Sadece kendi derslerini görür/ekler
            }
        ]);
        
        return new Response(JSON.stringify({ 
            success: true, 
            message: "Rol tabanlı 3 yeni demo hesap başarıyla oluşturuldu! (yonetici, sekreter, antrenor)" 
        }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: "Hesaplar zaten var veya hata: " + error.message }), { status: 500 });
    }
};