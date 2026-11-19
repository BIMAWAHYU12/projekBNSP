<?php

namespace App\Http\Controllers\Api;


use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    // Membuat pesanan baru
    public function store(Request $request)
    {
        $validated = $request->validate([
            'shipping_address' => 'required|string|min:10',
            'items' => 'required|array|min:1',
            'items.*.book_id' => [
                'required',
                'integer',
                'distinct',
                'exists:books,id',
            ],
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        $order = DB::transaction(function () use ($request, $validated) {
            $totalPrice = 0;
            $orderItems = [];

            foreach ($validated['items'] as $item) {
                // Kunci data buku selama transaksi agar stok tidak
                // digunakan bersamaan oleh pesanan lain.
                $book = Book::whereKey($item['book_id'])
                    ->lockForUpdate()
                    ->firstOrFail();

                $quantity = $item['quantity'];

                if ($book->stock < $quantity) {
                    throw ValidationException::withMessages([
                        'items' => [
                            "Stok buku {$book->title} tidak mencukupi. Stok tersedia: {$book->stock}.",
                        ],
                    ]);
                }

                $subtotal = (float) $book->price * $quantity;
                $totalPrice += $subtotal;

                $orderItems[] = [
                    'book_id' => $book->id,
                    'quantity' => $quantity,
                    'price' => $book->price,
                ];

                // Kurangi stok
                $book->decrement('stock', $quantity);
            }

            // Simpan pesanan utama
            $order = Order::create([
                'user_id' => $request->user()->id,
                'total_price' => $totalPrice,
                'status' => 'pending',
                'shipping_address' => $validated['shipping_address'],
            ]);

            // Simpan detail pesanan
            foreach ($orderItems as $item) {
                $order->items()->create($item);
            }

            return $order;
        });

        return response()->json([
            'message' => 'Pesanan berhasil dibuat!',
            'data' => $order->load('items.book'),
        ], 201);
    }

    // Menampilkan daftar pesanan
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Order::with('items.book', 'user:id,name,email')
            ->latest();

        // User biasa hanya melihat pesanannya sendiri
        if (!in_array($user->role, ['admin', 'super_admin'], true)) {
            $query->where('user_id', $user->id);
        }

        return response()->json($query->paginate(10));
    }

    // Menampilkan detail pesanan
    public function show(Request $request, Order $order)
    {
        $user = $request->user();

        // User biasa tidak boleh melihat pesanan milik orang lain
        if (
            !in_array($user->role, ['admin', 'super_admin'], true)
            && $order->user_id !== $user->id
        ) {
            return response()->json([
                'message' => 'Anda tidak memiliki akses ke pesanan ini.',
            ], 403);
        }

        return response()->json([
            'data' => $order->load('items.book', 'user:id,name,email'),
        ]);
    }

    // Admin dan super admin memperbarui status pesanan
    public function updateStatus(Request $request, Order $order)
    {
        $validated = $request->validate([
            'status' => [
                'required',
                Rule::in(['pending', 'paid', 'shipped', 'completed']),
            ],
        ]);

        $order->update([
            'status' => $validated['status'],
        ]);

        return response()->json([
            'message' => 'Status pesanan berhasil diperbarui.',
            'data' => $order->load('items.book'),
        ]);
    }
}
