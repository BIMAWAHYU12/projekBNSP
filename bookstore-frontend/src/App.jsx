
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import fotoBima from './assets/images/gambar.png';

import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  Navigate,
  useNavigate,
} from "react-router-dom";

import { useState, useEffect } from "react";
import api, { getCsrfCookie } from "./api/axios";
import "./App.css";

/* =====================================================
   KONSTANTA
===================================================== */

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80";

const ORDER_STATUSES = [
  "pending",
  "paid",
  "shipped",
  "completed",
];

const ALL_ROLES = ["user", "admin", "super_admin"];

const formatRupiah = (value) =>
  `Rp ${Number(value || 0).toLocaleString("id-ID")}`;

const getErrorMessage = (error) => {
  const errors = error.response?.data?.errors;

  if (errors) {
    return Object.values(errors).flat().join("\n");
  }

  return (
    error.response?.data?.message ||
    "Terjadi kesalahan. Silakan coba kembali."
  );
};

const getBookCategory = (book) => book.genre || "Umum";

const getStatusColor = (status) => {
  const colors = {
    pending: "warning",
    paid: "info",
    shipped: "primary",
    completed: "success",
  };

  return colors[status] || "secondary";
};

const getUserFromResponse = (response) => {
  return response.data?.user || response.data?.data || response.data;
};

/* =====================================================
   PROTECTED ROUTE
===================================================== */

function ProtectedRoute({
  children,
  allowedRoles = ALL_ROLES,
  user,
  loading,
}) {
  if (loading) {
    return <LoadingPage />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

/* =====================================================
   APP UTAMA
===================================================== */

function App() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("bookstore_cart")) || [];
    } catch {
      return [];
    }
  });

  const [cartLoading, setCartLoading] = useState(false);

  const isLoggedIn = !!currentUser;
  const currentRole = currentUser?.role || "guest";

  const isAdmin = ["admin", "super_admin"].includes(currentRole);

  const cartCount = cart.reduce(
    (total, item) => total + Number(item.quantity),
    0
  );

  // ==========================================
  // SIMPAN KERANJANG
  // ==========================================

  useEffect(() => {
    localStorage.setItem("bookstore_cart", JSON.stringify(cart));
  }, [cart]);

  // ==========================================
  // CEK SESSION
  // ==========================================

  useEffect(() => {
    checkAuth();
    fetchBooks();
  }, []);

  async function checkAuth() {
    try {
      const response = await api.get("/user");
      setCurrentUser(getUserFromResponse(response));
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthLoading(false);
    }
  }

  // ==========================================
  // AMBIL BUKU
  // ==========================================

  async function fetchBooks() {
    setLoading(true);

    try {
      const response = await api.get("/books");

      const data = response.data?.data || response.data;

      setBooks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Gagal mengambil buku:", error.response?.data || error);
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // LOGIN
  // ==========================================

  function handleLoginSuccess(user) {
    setCurrentUser(user);
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  async function handleLogout() {
    try {
      await api.post("/logout");

      setCurrentUser(null);
      setSelectedBook(null);

      alert("Berhasil logout!");
    } catch (error) {
      console.error("Logout gagal:", error.response?.data || error);
      alert(getErrorMessage(error));
    }
  }

  // ==========================================
  // TAMBAH BUKU
  // ==========================================

  async function addBook(formData) {
    try {
      await api.post("/books", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      await fetchBooks();

      alert("Buku berhasil ditambahkan!");
      return true;
    } catch (error) {
      console.error("Gagal menyimpan buku:", error.response?.data || error);
      alert(getErrorMessage(error));
      return false;
    }
  }

  // ==========================================
  // KERANJANG
  // ==========================================

  function addToCart(book) {
    if (Number(book.stock) <= 0) {
      alert("Maaf, stok buku sedang habis.");
      return;
    }

    setCart((current) => {
      const existing = current.find(
        (item) => item.id === book.id
      );

      if (existing) {
        if (existing.quantity >= Number(book.stock)) {
          alert("Jumlah melebihi stok yang tersedia.");
          return current;
        }

        return current.map((item) =>
          item.id === book.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          id: book.id,
          title: book.title,
          author: book.author,
          price: Number(book.price),
          stock: Number(book.stock),
          cover_image: book.cover_image,
          quantity: 1,
        },
      ];
    });

    alert(`${book.title} ditambahkan ke keranjang.`);
  }

  function updateCartQuantity(bookId, quantity) {
    const book = books.find(
      (item) => item.id === bookId
    );

    const maxStock = Number(book?.stock ?? 0);
    const newQuantity = Number(quantity);

    if (newQuantity < 1) return;

    if (newQuantity > maxStock) {
      alert(`Stok hanya tersedia ${maxStock} buku.`);
      return;
    }

    setCart((current) =>
      current.map((item) =>
        item.id === bookId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  }

  function removeFromCart(bookId) {
    setCart((current) =>
      current.filter((item) => item.id !== bookId)
    );
  }

  function clearCart() {
    setCart([]);
  }

  // ==========================================
  // CHECKOUT
  // ==========================================

  async function handleCheckout(shippingAddress) {
    if (!currentUser) {
      alert("Silakan login terlebih dahulu.");
      return false;
    }

    if (cart.length === 0) {
      alert("Keranjang masih kosong.");
      return false;
    }

    setCartLoading(true);

    try {
      const payload = {
        shipping_address: shippingAddress,
        items: cart.map((item) => ({
          book_id: item.id,
          quantity: item.quantity,
        })),
      };

      const response = await api.post("/orders", payload);

      clearCart();
      await fetchBooks();

      alert(
        response.data?.message ||
          "Pesanan berhasil dibuat!"
      );

      return true;
    } catch (error) {
      console.error(
        "Checkout gagal:",
        error.response?.data || error
      );

      alert(getErrorMessage(error));
      return false;
    } finally {
      setCartLoading(false);
    }
  }

  const roleBadgeColor =
    currentRole === "super_admin"
      ? "bg-danger"
      : currentRole === "admin"
      ? "bg-warning text-dark"
      : "bg-secondary";

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <BrowserRouter>
      <div className="d-flex flex-column min-vh-100">

        {/* NAVBAR */}

        <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm sticky-top">
          <div className="container-fluid px-4 px-lg-5">

            <Link to="/" className="navbar-brand fw-bold d-flex align-items-center">
              <span
                className="bg-primary text-white rounded-3 d-flex align-items-center justify-content-center me-2"
                style={{ width: 42, height: 42, fontSize: 20 }}
              >
                📖
              </span>
              Bookstore
            </Link>

            <button
              className="navbar-toggler"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#navbarMenu"
              aria-controls="navbarMenu"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon"></span>
            </button>

            <div className="collapse navbar-collapse" id="navbarMenu">

              <ul className="navbar-nav mx-auto mb-2 mb-lg-0">

                <NavItem to="/" end>Home</NavItem>
                <NavItem to="/book">Book</NavItem>

                <NavItem to="/cart">
                  Keranjang
                  {cartCount > 0 && (
                    <span className="badge bg-danger ms-1">
                      {cartCount}
                    </span>
                  )}
                </NavItem>

                {isLoggedIn && (
                  <NavItem to="/orders">Pesanan Saya</NavItem>
                )}

                {isAdmin && (
                  <NavItem to="/admin/orders">Kelola Pesanan</NavItem>
                )}

                <NavItem to="/team">Tentang Kami</NavItem>
                <NavItem to="/contact">Contact</NavItem>

              </ul>

              <div className="d-flex align-items-center gap-3 flex-wrap">

                {isLoggedIn && (
                  <span className={`badge ${roleBadgeColor}`}>
                    {currentRole.toUpperCase().replace("_", " ")}
                  </span>
                )}

                {!isLoggedIn ? (
                  <>
                    <Link to="/login" className="btn btn-outline-primary btn-sm px-3">
                      Login
                    </Link>

                    <Link to="/register" className="btn btn-primary btn-sm px-3">
                      Register
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="small text-muted">
                      {currentUser.name}
                    </span>

                    <button
                      className="btn btn-outline-danger btn-sm px-3"
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </>
                )}

              </div>
            </div>
          </div>
        </nav>

        {/* ROUTING */}

        <main className="flex-grow-1">
          <Routes>

            <Route
              path="/"
              element={
                <Home
                  books={books}
                  loading={loading}
                  onSelectBook={setSelectedBook}
                  onAddToCart={addToCart}
                />
              }
            />

            <Route
              path="/book"
              element={
                <Book
                  books={books}
                  loading={loading}
                  currentRole={currentRole}
                  isLoggedIn={isLoggedIn}
                  onAddBook={addBook}
                  onSelectBook={setSelectedBook}
                  onAddToCart={addToCart}
                />
              }
            />

            <Route
              path="/cart"
              element={
                <Cart
                  cart={cart}
                  onUpdateQuantity={updateCartQuantity}
                  onRemove={removeFromCart}
                />
              }
            />

            <Route
              path="/checkout"
              element={
                <ProtectedRoute
                  user={currentUser}
                  loading={authLoading}
                >
                  <Checkout
                    cart={cart}
                    loading={cartLoading}
                    onCheckout={handleCheckout}
                  />
                </ProtectedRoute>
              }
            />

            <Route
              path="/orders"
              element={
                <ProtectedRoute
                  user={currentUser}
                  loading={authLoading}
                >
                  <OrderHistory />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/orders"
              element={
                <ProtectedRoute
                  allowedRoles={["admin", "super_admin"]}
                  user={currentUser}
                  loading={authLoading}
                >
                  <AdminOrders />
                </ProtectedRoute>
              }
            />


            <Route path="/team" element={<Team />} />
            <Route path="/contact" element={<Contact />} />

            <Route
              path="/login"
              element={
                authLoading ? (
                  <LoadingPage />
                ) : currentUser ? (
                  <Navigate to="/" replace />
                ) : (
                  <Login setCurrentUser={handleLoginSuccess} />
                )
              }
            />

            <Route
              path="/register"
              element={
                authLoading ? (
                  <LoadingPage />
                ) : currentUser ? (
                  <Navigate to="/" replace />
                ) : (
                  <Register />
                )
              }
            />

            <Route path="*" element={<NotFound />} />

          </Routes>
        </main>

        {/* MODAL DETAIL BUKU */}

        {selectedBook && (
          <BookDetailModal
            book={selectedBook}
            onClose={() => setSelectedBook(null)}
            onAddToCart={addToCart}
          />
        )}

        {/* FOOTER */}

        <footer className="bg-dark text-white py-4 mt-auto">
          <div className="container-fluid px-4 px-lg-5">
            <div className="row align-items-center">

              <div className="col-md-6 text-center text-md-start">
                <h5 className="fw-bold mb-1">📖 Bookstore</h5>
                <p className="text-white-50 mb-0">
                  Temukan cerita baru, mulai perjalanan baru.
                </p>
              </div>

              <div className="col-md-6 text-center text-md-end mt-3 mt-md-0">
                <p className="text-white-50 mb-0">
                  © 2026 Bookstore. All Rights Reserved.
                </p>
              </div>

            </div>
          </div>
        </footer>

      </div>
    </BrowserRouter>
  );
}

/* =====================================================
   NAV ITEM
===================================================== */

function NavItem({ to, end = false, children }) {
  return (
    <li className="nav-item">
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          `nav-link px-3 ${
            isActive ? "active fw-bold text-primary" : ""
          }`
        }
      >
        {children}
      </NavLink>
    </li>
  );
}

/* =====================================================
   LOADING
===================================================== */

function LoadingPage() {
  return (
    <div className="container text-center py-5">
      <div className="spinner-border text-primary" />
      <p className="mt-3">Memuat data...</p>
    </div>
  );
}

/* =====================================================
   BOOK DETAIL MODAL
===================================================== */

function BookDetailModal({ book, onClose, onAddToCart }) {
  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content border-0 shadow-lg overflow-hidden">

          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title fw-bold">Detail Buku</h5>
            <button
              className="btn-close btn-close-white"
              onClick={onClose}
            />
          </div>

          <div className="modal-body p-4">
            <div className="row g-4 align-items-center">

              <div className="col-md-5 text-center">
                <img
                  src={book.cover_image || FALLBACK_IMAGE}
                  alt={book.title}
                  className="img-fluid rounded shadow w-100"
                  style={{ maxHeight: 400, objectFit: "cover" }}
                />
              </div>

              <div className="col-md-7">

                <span className="badge bg-primary-subtle text-primary mb-2">
                  {getBookCategory(book)}
                </span>

                <h2 className="fw-bold">{book.title}</h2>

                <p className="text-muted">
                  Oleh <strong className="text-dark">{book.author}</strong>
                </p>

                <p className="text-secondary" style={{ lineHeight: 1.7 }}>
                  {book.description}
                </p>

                <div className="p-3 bg-light rounded mb-3">
                  <div className="d-flex justify-content-between">
                    <div>
                      <small className="text-muted d-block">Harga</small>
                      <strong className="text-primary fs-4">
                        {formatRupiah(book.price)}
                      </strong>
                    </div>

                    <div className="text-end">
                      <small className="text-muted d-block">Stok</small>
                      <strong className="fs-5">
                        {book.stock ?? 0} pcs
                      </strong>
                    </div>
                  </div>
                </div>

                <button
                  className="btn btn-primary w-100"
                  disabled={Number(book.stock) <= 0}
                  onClick={() => onAddToCart(book)}
                >
                  <i className="bi bi-cart-plus me-2"></i>
                  {Number(book.stock) > 0
                    ? "Tambah ke Keranjang"
                    : "Stok Habis"}
                </button>

              </div>
            </div>
          </div>

          <div className="modal-footer bg-light">
            <button className="btn btn-secondary" onClick={onClose}>
              Tutup
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

/* =====================================================
   BOOK CARD
===================================================== */

function BookCard({ book, compact = false, onSelect, onAddToCart }) {
  return (
    <div className="col-md-6 col-lg-4">
      <div className="card border-0 shadow-sm h-100 overflow-hidden">

        <div
          onClick={() => onSelect(book)}
          style={{ cursor: "pointer" }}
        >
          <img
            src={book.cover_image || FALLBACK_IMAGE}
            alt={`Sampul ${book.title}`}
            className="card-img-top"
            style={{
              height: compact ? 280 : 350,
              objectFit: "cover",
            }}
          />
        </div>

        <div className="card-body p-4 d-flex flex-column">

          <span className="badge bg-primary-subtle text-primary mb-2 align-self-start">
            {getBookCategory(book)}
          </span>

          <h5
            className="fw-bold"
            role="button"
            onClick={() => onSelect(book)}
          >
            {book.title}
          </h5>

          <p className="text-muted mb-2">
            Oleh {book.author}
          </p>

          <p className="text-secondary flex-grow-1 small">
            {book.description}
          </p>

          <div className="d-flex justify-content-between align-items-center border-top pt-3 mt-2">
            <strong className="text-primary fs-5">
              {formatRupiah(book.price)}
            </strong>

            <small className="text-muted">
              Stok: {book.stock ?? 0}
            </small>
          </div>

          <div className="d-grid gap-2 mt-3">
            <button
              className="btn btn-primary"
              disabled={Number(book.stock) <= 0}
              onClick={() => onAddToCart(book)}
            >
              {Number(book.stock) > 0
                ? "🛒 Tambah ke Keranjang"
                : "Stok Habis"}
            </button>

            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => onSelect(book)}
            >
              Lihat Detail
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

/* =====================================================
   HOME
===================================================== */

function Home({ books, loading, onSelectBook, onAddToCart }) {
  return (
    <>
      <section
        className="bg-light"
        style={{
          minHeight: "calc(100vh - 75px)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div className="container-fluid px-4 px-lg-5 py-5">
          <div className="row align-items-center g-5">

            <div className="col-lg-6">

              <span className="badge bg-primary-subtle text-primary px-3 py-2 mb-4">
                ✨ Discover Your Next Story
              </span>

              <h1
                className="fw-bold mb-4"
                style={{
                  fontSize: "clamp(42px, 5vw, 72px)",
                  lineHeight: 1.08,
                }}
              >
                Temukan Buku
                <br />
                Favoritmu,
                <span className="text-primary"> Mulai Ceritamu.</span>
              </h1>

              <p className="lead text-secondary mb-4" style={{ maxWidth: 650, lineHeight: 1.8 }}>
                Selamat datang di Bookstore, platform digital
                untuk menjelajahi berbagai koleksi buku berkualitas
                dari penulis pilihan.
              </p>

              <div className="d-flex flex-wrap gap-3">
                <Link to="/book" className="btn btn-primary btn-lg px-4 py-3">
                  Jelajahi Buku
                </Link>

                <Link to="/team" className="btn btn-outline-dark btn-lg px-4 py-3">
                  Tentang Kami
                </Link>
              </div>

              <div className="row mt-5 g-4">
                <div className="col-4">
                  <h3 className="fw-bold">{books.length}</h3>
                  <p className="text-muted">Books</p>
                </div>

                <div className="col-4">
                  <h3 className="fw-bold">500+</h3>
                  <p className="text-muted">Readers</p>
                </div>

                <div className="col-4">
                  <h3 className="fw-bold">50+</h3>
                  <p className="text-muted">Authors</p>
                </div>
              </div>

            </div>

            <div className="col-lg-6">
              <img
                src="https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=1200&q=85"
                alt="Koleksi buku"
                className="img-fluid rounded-4 shadow-lg w-100"
                style={{
                  height: "min(70vh, 620px)",
                  minHeight: 420,
                  objectFit: "cover",
                }}
              />
            </div>

          </div>
        </div>
      </section>

      <section className="py-5 bg-light">
        <div className="container-fluid px-4 px-lg-5 py-4">

          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
            <div>
              <span className="text-primary fw-semibold">PILIHAN UNTUKMU</span>
              <h2 className="fw-bold mt-2">Buku Pilihan</h2>
            </div>

            <Link to="/book" className="btn btn-outline-primary">
              Lihat Semua
            </Link>
          </div>

          {loading ? (
            <LoadingPage />
          ) : books.length === 0 ? (
            <EmptyState message="Belum ada buku tersedia." />
          ) : (
            <div className="row g-4">
              {books.slice(0, 3).map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  compact
                  onSelect={onSelectBook}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          )}

        </div>
      </section>
    </>
  );
}

/* =====================================================
   BOOK
===================================================== */

function Book({
  books,
  loading,
  currentRole,
  isLoggedIn,
  onAddBook,
  onSelectBook,
  onAddToCart,
}) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("10");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);

  const canManageBooks = isLoggedIn && ["admin", "super_admin"].includes(currentRole);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canManageBooks) {
      alert("Anda tidak memiliki akses.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("author", author.trim());
    formData.append("genre", genre.trim());
    formData.append("price", price);
    formData.append("stock", stock);
    formData.append("description", description.trim());
    if (imageFile) formData.append("cover_image", imageFile);

    setSubmitting(true);
    const success = await onAddBook(formData);
    setSubmitting(false);

    if (success) {
      setTitle("");
      setAuthor("");
      setGenre("");
      setPrice("");
      setStock("10");
      setDescription("");
      setImageFile(null);
      setShowForm(false);
    }
  }

  return (
    <section className="py-5 bg-light min-vh-100">
      <div className="container py-4">
        <div className="text-center mb-4">
          <span className="text-primary fw-semibold">OUR COLLECTION</span>
          <h1 className="fw-bold mt-2">Koleksi Buku</h1>
          <p className="text-muted">
            {canManageBooks ? "Kelola koleksi dengan menambahkan buku langsung dari halaman ini." : "Jelajahi koleksi buku dan temukan bacaan favoritmu."}
          </p>
          {canManageBooks && (
            <button className="btn btn-primary mt-2" onClick={() => setShowForm(!showForm)}>
              {showForm ? "Tutup Form" : "+ Tambah Buku"}
            </button>
          )}
        </div>

        {canManageBooks && showForm && (
          <div className="row justify-content-center mb-5">
            <div className="col-lg-8">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">
                  <h4 className="fw-bold mb-4">Tambah Buku Baru</h4>
                  <form onSubmit={handleSubmit}>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">Judul Buku *</label>
                        <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} required />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Author *</label>
                        <input className="form-control" value={author} onChange={(e) => setAuthor(e.target.value)} required />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Genre *</label>
                        <input className="form-control" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Contoh: Pemrograman" required />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Harga *</label>
                        <input type="number" min="0" className="form-control" value={price} onChange={(e) => setPrice(e.target.value)} required />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label">Stok *</label>
                        <input type="number" min="0" className="form-control" value={stock} onChange={(e) => setStock(e.target.value)} required />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Deskripsi *</label>
                        <textarea className="form-control" rows="4" value={description} onChange={(e) => setDescription(e.target.value)} required />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Sampul Buku</label>
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="form-control" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                        <small className="text-muted">Format JPG, PNG, WEBP. Maksimal 2 MB.</small>
                      </div>
                      <div className="col-12">
                        <button className="btn btn-primary" type="submit" disabled={submitting}>
                          {submitting ? "Menyimpan..." : "Simpan Buku"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="fw-bold mb-0">Semua Buku</h4>
          <span className="badge bg-primary">{books.length} Buku</span>
        </div>

        {loading ? <LoadingPage /> : books.length === 0 ? <EmptyState message="Belum ada buku tersedia." /> : (
          <div className="row g-4">
            {books.map((book) => (
              <BookCard key={book.id} book={book} onSelect={onSelectBook} onAddToCart={onAddToCart} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* =====================================================
   KERANJANG BELANJA
===================================================== */

function Cart({ cart, onUpdateQuantity, onRemove }) {
  const navigate = useNavigate();

  const total = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );

  return (
    <section className="py-5 bg-light min-vh-100">
      <div className="container py-4">

        <div className="mb-4">
          <span className="text-primary fw-semibold">SHOPPING CART</span>
          <h1 className="fw-bold mt-2">Keranjang Belanja</h1>
          <p className="text-muted">
            Periksa buku yang ingin Anda pesan sebelum checkout.
          </p>
        </div>

        {cart.length === 0 ? (
          <div className="card border-0 shadow-sm text-center p-5">
            <div className="display-3 mb-3">🛒</div>
            <h4 className="fw-bold">Keranjang masih kosong</h4>
            <p className="text-muted">
              Yuk, temukan buku favoritmu terlebih dahulu.
            </p>
            <button
              className="btn btn-primary mx-auto"
              onClick={() => navigate("/book")}
            >
              Jelajahi Buku
            </button>
          </div>
        ) : (
          <div className="row g-4">

            <div className="col-lg-8">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-0">

                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="d-flex flex-wrap align-items-center gap-3 p-3 border-bottom"
                    >
                      <img
                        src={item.cover_image || FALLBACK_IMAGE}
                        alt={item.title}
                        style={{
                          width: 85,
                          height: 110,
                          objectFit: "cover",
                        }}
                        className="rounded"
                      />

                      <div className="flex-grow-1">
                        <h6 className="fw-bold mb-1">{item.title}</h6>
                        <small className="text-muted">{item.author}</small>
                        <div className="text-primary fw-bold mt-2">
                          {formatRupiah(item.price)}
                        </div>
                      </div>

                      <div>
                        <label className="small text-muted d-block">
                          Jumlah
                        </label>

                        <input
                          type="number"
                          min="1"
                          max={item.stock}
                          className="form-control"
                          style={{ width: 85 }}
                          value={item.quantity}
                          onChange={(e) =>
                            onUpdateQuantity(item.id, e.target.value)
                          }
                        />
                      </div>

                      <div className="text-end">
                        <strong className="d-block">
                          {formatRupiah(item.price * item.quantity)}
                        </strong>

                        <button
                          className="btn btn-sm btn-outline-danger mt-2"
                          onClick={() => onRemove(item.id)}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}

                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body p-4">

                  <h5 className="fw-bold mb-4">Ringkasan Belanja</h5>

                  <div className="d-flex justify-content-between mb-3">
                    <span className="text-muted">Jumlah buku</span>
                    <strong>
                      {cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </strong>
                  </div>

                  <div className="d-flex justify-content-between mb-3">
                    <span className="text-muted">Subtotal</span>
                    <strong>{formatRupiah(total)}</strong>
                  </div>

                  <hr />

                  <div className="d-flex justify-content-between mb-4">
                    <strong>Total</strong>
                    <strong className="text-primary fs-5">
                      {formatRupiah(total)}
                    </strong>
                  </div>

                  <button
                    className="btn btn-primary w-100 py-2"
                    onClick={() => navigate("/checkout")}
                  >
                    Lanjut Checkout
                  </button>

                  <button
                    className="btn btn-outline-secondary w-100 mt-2"
                    onClick={() => navigate("/book")}
                  >
                    Lanjut Belanja
                  </button>

                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </section>
  );
}

/* =====================================================
   CHECKOUT
===================================================== */

function Checkout({ cart, loading, onCheckout }) {
  const [shippingAddress, setShippingAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const total = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );

  async function handleSubmit(e) {
    e.preventDefault();

    if (shippingAddress.trim().length < 10) {
      alert("Alamat pengiriman minimal 10 karakter.");
      return;
    }

    setSubmitting(true);

    const success = await onCheckout(shippingAddress.trim());

    setSubmitting(false);

    if (success) {
      navigate("/orders", { replace: true });
    }
  }

  if (cart.length === 0) {
    return (
      <section className="container py-5 text-center">
        <h3 className="fw-bold">Keranjang kosong</h3>
        <p className="text-muted">
          Tambahkan buku sebelum melakukan checkout.
        </p>
        <Link to="/book" className="btn btn-primary">
          Cari Buku
        </Link>
      </section>
    );
  }

  return (
    <section className="py-5 bg-light min-vh-100">
      <div className="container py-4">

        <h1 className="fw-bold mb-2">Checkout</h1>
        <p className="text-muted mb-4">
          Lengkapi alamat pengiriman untuk menyelesaikan pesanan.
        </p>

        <div className="row g-4">

          <div className="col-lg-7">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">

                <h5 className="fw-bold mb-4">
                  Informasi Pengiriman
                </h5>

                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="form-label fw-semibold">
                      Nama Penerima
                    </label>

                    <input
                      className="form-control"
                      value={""}
                      placeholder={undefined}
                      readOnly
                    />
                    <small className="text-muted">
                      Nama akun: { /* diisi dari akun login */ }
                    </small>
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-semibold">
                      Alamat Lengkap *
                    </label>

                    <textarea
                      className="form-control"
                      rows="5"
                      placeholder="Masukkan alamat lengkap, nomor rumah, RT/RW, kelurahan, kecamatan, kota, dan kode pos..."
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      required
                      minLength={10}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-100 py-2"
                    disabled={submitting || loading}
                  >
                    {submitting ? "Memproses Pesanan..." : "Buat Pesanan"}
                  </button>
                </form>

              </div>
            </div>
          </div>

          <div className="col-lg-5">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">

                <h5 className="fw-bold mb-3">Ringkasan Pesanan</h5>

                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="d-flex justify-content-between gap-3 border-bottom py-3"
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <small className="text-muted d-block">
                        {item.quantity} × {formatRupiah(item.price)}
                      </small>
                    </div>

                    <strong>
                      {formatRupiah(item.price * item.quantity)}
                    </strong>
                  </div>
                ))}

                <div className="d-flex justify-content-between mt-4">
                  <strong>Total Pembayaran</strong>
                  <strong className="text-primary fs-5">
                    {formatRupiah(total)}
                  </strong>
                </div>

                <p className="small text-muted mt-3 mb-0">
                  Status awal pesanan adalah pending. Pembayaran
                  belum terintegrasi dengan payment gateway.
                </p>

              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

/* =====================================================
   RIWAYAT PESANAN USER
===================================================== */

function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/orders");
      const data = response.data?.data || response.data;

      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Gagal mengambil pesanan:", error.response?.data || error);
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="py-5 bg-light min-vh-100">
      <div className="container py-4">

        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
          <div>
            <span className="text-primary fw-semibold">ORDER HISTORY</span>
            <h1 className="fw-bold mt-2">Pesanan Saya</h1>
            <p className="text-muted mb-0">
              Pantau status dan riwayat pembelian buku Anda.
            </p>
          </div>

          <button
            className="btn btn-outline-primary"
            onClick={fetchOrders}
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <LoadingPage />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchOrders} />
        ) : orders.length === 0 ? (
          <EmptyState message="Anda belum memiliki pesanan." />
        ) : (
          <div className="row g-4">

            {orders.map((order) => (
              <div className="col-12" key={order.id}>
                <div className="card border-0 shadow-sm">
                  <div className="card-body p-4">

                    <div className="d-flex justify-content-between flex-wrap gap-3 mb-3">
                      <div>
                        <small className="text-muted">Nomor Pesanan</small>
                        <h5 className="fw-bold mb-0">
                          #ORD-{order.id}
                        </h5>
                      </div>

                      <div className="text-end">
                        <small className="text-muted d-block">Status</small>
                        <span className={`badge bg-${getStatusColor(order.status)} text-dark`}>
                          {String(order.status).toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <hr />

                    {order.items?.map((item) => (
                      <div
                        key={item.id}
                        className="d-flex justify-content-between gap-3 py-2"
                      >
                        <div>
                          <strong>
                            {item.book?.title || "Buku tidak tersedia"}
                          </strong>
                          <small className="text-muted d-block">
                            {item.quantity} × {formatRupiah(item.price)}
                          </small>
                        </div>

                        <strong>
                          {formatRupiah(item.quantity * item.price)}
                        </strong>
                      </div>
                    ))}

                    <hr />

                    <div className="row g-3">
                      <div className="col-md-7">
                        <small className="text-muted">Alamat Pengiriman</small>
                        <p className="mb-0">{order.shipping_address}</p>
                      </div>

                      <div className="col-md-5 text-md-end">
                        <small className="text-muted">Total Pesanan</small>
                        <h5 className="fw-bold text-primary">
                          {formatRupiah(order.total_price)}
                        </h5>
                      </div>
                    </div>

                    <small className="text-muted">
                      Tanggal: {order.created_at
                        ? new Date(order.created_at).toLocaleString("id-ID")
                        : "-"}
                    </small>

                  </div>
                </div>
              </div>
            ))}

          </div>
        )}

      </div>
    </section>
  );
}

/* =====================================================
   ADMIN MENGELOLA PESANAN
===================================================== */

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);

    try {
      const response = await api.get("/orders");
      const data = response.data?.data || response.data;

      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Gagal mengambil pesanan:", error.response?.data || error);
      alert(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(orderId, status) {
    if (!ORDER_STATUSES.includes(status)) return;

    setUpdatingId(orderId);

    try {
      const response = await api.put(
        `/orders/${orderId}/status`,
        { status }
      );

      const updatedOrder = response.data?.data;

      setOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? { ...order, ...(updatedOrder || {}), status }
            : order
        )
      );

      alert("Status pesanan berhasil diperbarui.");
    } catch (error) {
      console.error("Gagal mengubah status:", error.response?.data || error);
      alert(getErrorMessage(error));
      await fetchOrders();
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="py-5 bg-light min-vh-100">
      <div className="container py-4">

        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
          <div>
            <span className="text-primary fw-semibold">ORDER MANAGEMENT</span>
            <h1 className="fw-bold mt-2">Manajemen Pesanan</h1>
            <p className="text-muted mb-0">
              Periksa pesanan pelanggan dan perbarui statusnya.
            </p>
          </div>

          <button
            className="btn btn-outline-primary"
            onClick={fetchOrders}
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <LoadingPage />
        ) : orders.length === 0 ? (
          <EmptyState message="Belum ada pesanan masuk." />
        ) : (
          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">

              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">

                  <thead className="table-dark">
                    <tr>
                      <th className="p-3">Pesanan</th>
                      <th>Pelanggan</th>
                      <th>Detail Buku</th>
                      <th>Total</th>
                      <th>Alamat</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>

                        <td className="p-3">
                          <strong>#ORD-{order.id}</strong>
                          <small className="d-block text-muted">
                            {order.created_at
                              ? new Date(order.created_at).toLocaleDateString("id-ID")
                              : "-"}
                          </small>
                        </td>

                        <td>
                          <strong>{order.user?.name || "Pelanggan"}</strong>
                          <small className="d-block text-muted">
                            {order.user?.email || "-"}
                          </small>
                        </td>

                        <td>
                          {order.items?.map((item) => (
                            <div key={item.id} className="small mb-1">
                              {item.book?.title || "Buku dihapus"} × {item.quantity}
                            </div>
                          ))}
                        </td>

                        <td className="fw-bold text-primary">
                          {formatRupiah(order.total_price)}
                        </td>

                        <td style={{ minWidth: 180 }}>
                          <small>{order.shipping_address}</small>
                        </td>

                        <td style={{ minWidth: 150 }}>
                          <select
                            className="form-select form-select-sm"
                            value={order.status}
                            disabled={updatingId === order.id}
                            onChange={(e) =>
                              updateStatus(order.id, e.target.value)
                            }
                          >
                            {ORDER_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status.toUpperCase()}
                              </option>
                            ))}
                          </select>

                          {updatingId === order.id && (
                            <small className="text-muted">
                              Memperbarui...
                            </small>
                          )}
                        </td>

                      </tr>
                    ))}
                  </tbody>

                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}

/* =====================================================
   TEAM
===================================================== */

function Team() {
  return (
    <section className="py-5 bg-light min-vh-100">
      <div className="container py-4">

        <div className="text-center mb-5">
          <span className="text-primary fw-semibold">TENTANG KAMI</span>
          <h1 className="fw-bold mt-2">
            Mengenal Lebih Dekat Bookstore Platform
          </h1>
          <p className="text-muted mx-auto" style={{ maxWidth: 700 }}>
            Platform toko buku digital modern yang memudahkan
            pembaca menemukan literatur terbaik dan memberikan
            sistem manajemen inventaris yang terintegrasi.
          </p>
        </div>

        <div className="row g-5 align-items-center mb-5">

          <div className="col-lg-6">
            <div className="card border-0 shadow-sm p-4 h-100">
              <h3 className="fw-bold text-primary mb-3">
                📖 Latar Belakang & Tujuan
              </h3>

              <p className="text-secondary" style={{ lineHeight: 1.8 }}>
                Bookstore hadir sebagai solusi digital untuk
                memudahkan proses pencarian, pemesanan, dan
                pengelolaan buku. Aplikasi ini dikembangkan
                menggunakan Laravel REST API dan React SPA.
              </p>

              <p className="text-secondary mb-0" style={{ lineHeight: 1.8 }}>
                Sistem menerapkan autentikasi berbasis session
                Sanctum dan Role-Based Access Control untuk
                membedakan hak akses pengguna.
              </p>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="card border-0 shadow-sm p-4 h-100 bg-primary text-white">
              <h3 className="fw-bold mb-3">🎯 Visi & Misi Kami</h3>

              <h5 className="fw-bold text-warning">Visi</h5>
              <p>
                Menjadi platform toko buku digital yang mudah
                digunakan dan terpercaya.
              </p>

              <h5 className="fw-bold text-warning">Misi</h5>
              <ul className="mb-0">
                <li>Menyediakan katalog buku berkualitas.</li>
                <li>Memudahkan proses pemesanan buku.</li>
                <li>Menerapkan keamanan sistem modern.</li>
                <li>Menyediakan pengelolaan pesanan yang terintegrasi.</li>
              </ul>
            </div>
          </div>

        </div>

        <div className="text-center mb-4">
          <h2 className="fw-bold">Tim Pengembang Sistem</h2>
          <p className="text-muted">
            Di balik perancangan dan pengembangan aplikasi Bookstore.
          </p>
        </div>

        <div className="row g-4 justify-content-center">
          <div className="col-md-6 col-lg-4">
            <div className="card border-0 shadow-sm h-100 text-center p-4">
              <img
                src={fotoBima}
                alt="Bima"
                className="rounded-circle mx-auto mb-3 shadow"
                style={{ width: 130, height: 130, objectFit: "cover" }}
              />

              <h4 className="fw-bold mb-1">Bima</h4>
              <span className="text-primary fw-semibold small mb-3">
                Lead Full-Stack Developer
              </span>

              <p className="text-secondary small">
                Bertanggung jawab atas perancangan database MySQL,
                Laravel REST API, sistem keamanan RBAC, serta
                integrasi frontend React SPA.
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

/* =====================================================
   LOGIN
===================================================== */

function Login({ setCurrentUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setSubmitting(true);

    try {
      await getCsrfCookie();

      const response = await api.post("/login", {
        email,
        password,
      });

      const user = getUserFromResponse(response);

      if (!user || !user.id) {
        throw new Error("Data user tidak ditemukan dari respons login.");
      }

      setCurrentUser(user);

      alert("Login berhasil!");

      navigate("/", { replace: true });
    } catch (error) {
      console.error("Login gagal:", error.response?.data || error);
      alert(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="py-5 bg-light min-vh-100 d-flex align-items-center">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-5">

            <div className="card border-0 shadow-sm p-4">
              <div className="text-center mb-4">
                <span
                  className="bg-primary text-white rounded-3 d-inline-flex align-items-center justify-content-center mb-2"
                  style={{ width: 50, height: 50, fontSize: 24 }}
                >
                  📖
                </span>

                <h3 className="fw-bold">Login ke Bookstore</h3>
                <p className="text-muted small">
                  Masukkan akun Anda untuk melanjutkan.
                </p>
              </div>

              <form onSubmit={handleLogin}>
                <div className="mb-3">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="form-label">Password *</label>
                  <input
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100 py-2 mb-3"
                  disabled={submitting}
                >
                  {submitting ? "Memproses..." : "Login"}
                </button>

                <div className="text-center">
                  <small className="text-muted">
                    Belum punya akun?{" "}
                    <Link to="/register" className="fw-semibold text-decoration-none">
                      Register di sini
                    </Link>
                  </small>
                </div>
              </form>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

/* =====================================================
   REGISTER
===================================================== */

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();

    if (password !== passwordConfirmation) {
      alert("Konfirmasi password tidak sama.");
      return;
    }

    setSubmitting(true);

    try {
      await getCsrfCookie();

      await api.post("/register", {
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });

      alert("Registrasi berhasil! Silakan login.");

      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Registrasi gagal:", error.response?.data || error);
      alert(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="py-5 bg-light min-vh-100 d-flex align-items-center">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-5">

            <div className="card border-0 shadow-sm p-4">
              <div className="text-center mb-4">
                <span
                  className="bg-primary text-white rounded-3 d-inline-flex align-items-center justify-content-center mb-2"
                  style={{ width: 50, height: 50, fontSize: 24 }}
                >
                  ✨
                </span>

                <h3 className="fw-bold">Buat Akun Baru</h3>
                <p className="text-muted small">
                  Daftar untuk mulai menjelajahi koleksi buku.
                </p>
              </div>

              <form onSubmit={handleRegister}>
                <div className="mb-3">
                  <label className="form-label">Nama Lengkap *</label>
                  <input
                    className="form-control"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Password *</label>
                  <input
                    type="password"
                    className="form-control"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="form-label">Konfirmasi Password *</label>
                  <input
                    type="password"
                    className="form-control"
                    minLength={8}
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100 py-2 mb-3"
                  disabled={submitting}
                >
                  {submitting ? "Memproses..." : "Register Akun"}
                </button>

                <div className="text-center">
                  <small className="text-muted">
                    Sudah punya akun?{" "}
                    <Link to="/login" className="fw-semibold text-decoration-none">
                      Login di sini
                    </Link>
                  </small>
                </div>
              </form>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

/* =====================================================
   CONTACT
===================================================== */

function Contact() {
  function handleContactSubmit(e) {
    e.preventDefault();

    alert(
      "Terima kasih! Pesan Anda telah dikirim ke tim pengelola Bookstore."
    );

    e.target.reset();
  }

  return (
    <section className="py-5 bg-light min-vh-100">
      <div className="container py-4">

        <div className="text-center mb-5">
          <span className="text-primary fw-semibold">BUTUH BANTUAN?</span>
          <h1 className="fw-bold mt-2">Hubungi Kami</h1>
          <p className="text-muted">
            Kami siap menjawab pertanyaan seputar layanan dan koleksi buku.
          </p>
        </div>

        <div className="row g-5 justify-content-center">

          <div className="col-lg-5">
            <div className="card border-0 shadow-sm p-4 h-100">
              <h4 className="fw-bold mb-4">Informasi Kontak</h4>

              <p className="text-secondary">
                Silakan hubungi kami melalui saluran di bawah ini.
              </p>

              <div className="mb-3">
                <strong>📍 Alamat:</strong>
                <br />
                <span className="text-muted">
                  Jl. Margonda Raya No. 45, Depok, Jawa Barat
                </span>
              </div>

              <div className="mb-3">
                <strong>📧 Email:</strong>
                <br />
                <span className="text-muted">
                  support@bookstore-bnsp.test
                </span>
              </div>

              <div className="mb-3">
                <strong>📞 Telepon:</strong>
                <br />
                <span className="text-muted">
                  +62 812-3456-7890
                </span>
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="card border-0 shadow-sm p-4">
              <h4 className="fw-bold mb-4">Kirim Pesan</h4>

              <form onSubmit={handleContactSubmit}>
                <div className="mb-3">
                  <label className="form-label">Nama Lengkap *</label>
                  <input className="form-control" required />
                </div>

                <div className="mb-3">
                  <label className="form-label">Email *</label>
                  <input type="email" className="form-control" required />
                </div>

                <div className="mb-3">
                  <label className="form-label">Pesan *</label>
                  <textarea className="form-control" rows="4" required />
                </div>

                <button className="btn btn-primary px-4 py-2">
                  Kirim Pesan
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

/* =====================================================
   EMPTY & ERROR STATE
===================================================== */

function EmptyState({ message }) {
  return (
    <div className="card border-0 shadow-sm text-center p-5">
      <div className="display-4 mb-3">📚</div>
      <h5 className="fw-bold">{message}</h5>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="alert alert-danger">
      <p className="mb-2">{message}</p>
      <button className="btn btn-sm btn-outline-danger" onClick={onRetry}>
        Coba Lagi
      </button>
    </div>
  );
}

/* =====================================================
   NOT FOUND
===================================================== */

function NotFound() {
  return (
    <div className="container py-5 text-center">
      <h1 className="fw-bold">404 - Halaman Tidak Ditemukan</h1>
      <p className="text-muted">
        Halaman yang Anda cari tidak tersedia.
      </p>
      <Link to="/" className="btn btn-primary mt-3">
        Kembali ke Home
      </Link>
    </div>
  );
}

export default App;
