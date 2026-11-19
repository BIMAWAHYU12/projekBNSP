<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Book;

class BookSeeder extends Seeder
{
    public function run(): void
    {
        // Buku pertama
        Book::updateOrCreate(
            ['title' => 'Belajar Laravel & React untuk Pemula'],
            [
                'author' => 'Developer BNSP',
                'genre' => 'Pemrograman',
                'description' => 'Panduan lengkap membangun aplikasi web modern dengan Laravel API dan React SPA.',
                'price' => 150000,
                'stock' => 10,
            ]
        );

        // Buku kedua
        Book::updateOrCreate(
            ['title' => 'Mastering Tailwind CSS'],
            [
                'author' => 'UI/UX Expert',
                'genre' => 'Desain',
                'description' => 'Cara cepat mendesain antarmuka web yang profesional dan responsif.',
                'price' => 125000,
                'stock' => 15,
            ]
        );
    }
}
