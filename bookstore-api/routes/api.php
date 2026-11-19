
<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookController;
use App\Http\Controllers\Api\OrderController;

/*
|--------------------------------------------------------------------------
| PUBLIC AUTH ROUTES
|--------------------------------------------------------------------------
*/

// Register
Route::post('/register', [AuthController::class, 'register'])
    ->middleware('throttle:5,1');

// Login
Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:5,1');


/*
|--------------------------------------------------------------------------
| PUBLIC BOOK ROUTES
|--------------------------------------------------------------------------
*/

// Melihat semua buku
Route::get('/books', [BookController::class, 'index']);

// Melihat detail buku
Route::get('/books/{book}', [BookController::class, 'show']);


/*
|--------------------------------------------------------------------------
| AUTHENTICATED ROUTES
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {

    /*
    |--------------------------------------------------------------------------
    | AUTHENTICATION
    |--------------------------------------------------------------------------
    */

    // Logout
    Route::post('/logout', [AuthController::class, 'logout']);

    // Mendapatkan informasi user login
    Route::get('/user', [AuthController::class, 'user']);


    /*
    |--------------------------------------------------------------------------
    | ORDER ROUTES - USER
    |--------------------------------------------------------------------------
    */

    // Membuat pesanan baru
    Route::post('/orders', [OrderController::class, 'store']);

    // Melihat daftar pesanan
    Route::get('/orders', [OrderController::class, 'index']);

    // Melihat detail pesanan
    Route::get('/orders/{order}', [OrderController::class, 'show']);


    /*
    |--------------------------------------------------------------------------
    | ADMIN & SUPER ADMIN ROUTES
    |--------------------------------------------------------------------------
    */

    Route::middleware('role:admin,super_admin')->group(function () {

        // Menambahkan buku
        Route::post('/books', [BookController::class, 'store']);

        // Menghapus buku
        Route::delete('/books/{book}', [BookController::class, 'destroy']);

        // Mengubah status pesanan
        Route::put('/orders/{order}/status', [
            OrderController::class,
            'updateStatus'
        ]);

    });

});
