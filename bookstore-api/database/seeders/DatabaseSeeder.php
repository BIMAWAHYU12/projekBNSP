<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Akun User
        $user = User::updateOrCreate(
            ['email' => 'user@bookstore.com'],
            [
                'name' => 'Bookstore User',
                'password' => 'password123',
            ]
        );
        $user->forceFill(['role' => 'user'])->save();

        // Akun Admin
        $admin = User::updateOrCreate(
            ['email' => 'admin@bookstore.com'],
            [
                'name' => 'Bookstore Admin',
                'password' => 'admin12345',
            ]
        );
        $admin->forceFill(['role' => 'admin'])->save();

        // Akun Super Admin
        $superAdmin = User::updateOrCreate(
            ['email' => 'superadmin@bookstore.com'],
            [
                'name' => 'Super Admin',
                'password' => 'superadmin12345',
            ]
        );
        $superAdmin->forceFill(['role' => 'super_admin'])->save();

        // Jalankan BookSeeder
        $this->call([
            BookSeeder::class,
        ]);
    }
}
