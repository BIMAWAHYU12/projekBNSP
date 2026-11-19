<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class BookController extends Controller
{
    // Menampilkan daftar buku dan pencarian
    public function index(Request $request)
    {
        $query = Book::query();

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('author', 'like', "%{$search}%")
                  ->orWhere('genre', 'like', "%{$search}%");
            });
        }

        return response()->json(
            $query->latest()->paginate(12)
        );
    }

    // Menampilkan detail buku
    public function show(Book $book)
    {
        return response()->json($book);
    }

    // Menambahkan buku
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title'       => 'required|string|max:255',
            'author'      => 'required|string|max:255',
            'genre'       => 'required|string|max:100',
            'description' => 'required|string',
            'price'       => 'required|numeric|min:0',
            'stock'       => 'required|integer|min:0',
            'cover_image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        if ($request->hasFile('cover_image')) {
            $path = $request->file('cover_image')
                ->store('covers', 'public');

            $validated['cover_image'] = asset('storage/' . $path);
        }

        $book = Book::create($validated);

        return response()->json([
            'message' => 'Buku berhasil ditambahkan!',
            'data' => $book
        ], 201);
    }

    // Menghapus buku
    public function destroy(Book $book)
    {
        if ($book->cover_image) {
            $relativePath = str_replace(
                asset('storage/'),
                '',
                $book->cover_image
            );

            Storage::disk('public')->delete($relativePath);
        }

        $book->delete();

        return response()->json([
            'message' => 'Buku berhasil dihapus'
        ]);
    }
}
