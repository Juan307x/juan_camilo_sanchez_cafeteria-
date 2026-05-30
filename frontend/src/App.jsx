import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

/* ═══════════════════════════════════════════════
   API
   ═══════════════════════════════════════════════ */
const BASE = window.location.hostname === 'localhost'
  ? '/api'
  : 'https://cafeteria-backend-irn6.onrender.com/api'

function getToken() { return localStorage.getItem('access_token') || '' }

async function req(path, opts = {}) {
  const token = getToken()
  const r = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
    ...opts,
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    const msg = e.error || e.detail || e.card_number?.[0] || e.cardholder_name?.[0] || e.cvv?.[0] || e.expiry_month?.[0] || e.non_field_errors?.[0] || JSON.stringify(e) || `Error ${r.status}`
    throw new Error(msg)
  }
  return r.json()
}

const api = {
  login:          async (email, p) => { const d = await req('/auth/login/', { method: 'POST', body: JSON.stringify({ email, password: p }) }); localStorage.setItem('access_token', d.access); return d.user },
  register:       async (data) => { const d = await req('/auth/register/', { method: 'POST', body: JSON.stringify(data) }); localStorage.setItem('access_token', d.access); return d.user },
  logout:         () => req('/auth/logout/', { method: 'POST' }),
  me:             () => req('/auth/me/'),
  products:       () => req('/products/'),
  categories:     () => req('/categories/'),
  timeslots:      () => req('/timeslots/'),
  orders:         () => req('/orders/'),
  createOrder:    (d) => req('/orders/', { method: 'POST', body: JSON.stringify(d) }),
  updateOrder:    (id, d) => req(`/orders/${id}/`, { method: 'PATCH', body: JSON.stringify(d) }),
  updateStock:    (id, s) => req(`/products/${id}/stock/`, { method: 'POST', body: JSON.stringify({ stock: s }) }),
  createProduct:  (d) => req('/products/create/', { method: 'POST', body: JSON.stringify(d) }),
  deleteProduct:  (id) => req(`/products/${id}/delete/`, { method: 'DELETE' }),
  favorites:      () => req('/favorites/'),
  toggleFav:      (id) => req(`/favorites/${id}/toggle/`, { method: 'POST' }),
  cards:          () => req('/cards/'),
  addCard:        (d) => req('/cards/add/', { method: 'POST', body: JSON.stringify(d) }),
  deleteCard:     (id) => req(`/cards/${id}/delete/`, { method: 'DELETE' }),
  setDefaultCard: (id) => req(`/cards/${id}/set-default/`, { method: 'PATCH' }),
  payOrder:       (id, d) => req(`/orders/${id}/pay/`, { method: 'POST', body: JSON.stringify(d) }),
  confirmCash:    (id) => req(`/orders/${id}/confirm-cash/`, { method: 'POST' }),
  getPayment:     (id) => req(`/orders/${id}/payment/`),
}

const fmt = (n) => Number(n).toFixed(2) + '€'

/* ═══════════════════════════════════════════════
   QR GENERATOR  (sin librerías externas)
   ═══════════════════════════════════════════════ */
function QRCode({ value, size = 200 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current || !value) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    // Usamos la URL de Google Charts QR API como fallback visual
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=2c1810&margin=10`
    img.onload = () => {
      canvas.width  = size
      canvas.height = size
      ctx.drawImage(img, 0, 0, size, size)
    }
    img.onerror = () => {
      // Fallback: dibujar QR simple con texto
      canvas.width  = size
      canvas.height = size
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, size, size)
      ctx.fillStyle = '#2c1810'
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('QR NO DISPONIBLE', size/2, size/2 - 10)
      ctx.font = '11px monospace'
      ctx.fillText('Sin conexión a internet', size/2, size/2 + 10)
      ctx.fillText(value, size/2, size/2 + 30)
    }
  }, [value, size])

  return (
    <canvas ref={canvasRef} width={size} height={size}
      style={{ borderRadius: 12, display: 'block' }} />
  )
}

/* ═══════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════ */
function detectBrand(num) {
  const n = num.replace(/\s/g, '')
  if (/^4/.test(n))       return { brand: 'Visa',       icon: '💳' }
  if (/^5[1-5]/.test(n))  return { brand: 'Mastercard', icon: '💳' }
  if (/^3[47]/.test(n))   return { brand: 'Amex',       icon: '💳' }
  if (/^6/.test(n))       return { brand: 'Discover',   icon: '💳' }
  return { brand: '', icon: '💳' }
}

function formatCardNumber(val) {
  return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}

/* ═══════════════════════════════════════════════
   TOAST + SPINNER
   ═══════════════════════════════════════════════ */
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3400); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      background: type === 'error' ? '#c0392b' : '#27ae60',
      color: '#fff', padding: '13px 28px', borderRadius: 14, fontSize: 14,
      fontWeight: 600, zIndex: 9999, boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
      maxWidth: '90vw', textAlign: 'center',
    }}>
      {message}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
      <div style={{ width: 42, height: 42, border: '3px solid #f0e6d3', borderTop: '3px solid #c0392b', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
    </div>
  )
}

/* ═══════════════════════════════════════════════
   MODAL QR  (para el alumno — muestra su QR)
   ═══════════════════════════════════════════════ */
function QRModal({ order, onClose }) {
  const qrData = order.code

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 24, padding: '32px 28px',
        maxWidth: 360, width: '100%', textAlign: 'center',
        boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 36, marginBottom: 4 }}>📱</div>
        <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: '#2c1810', marginBottom: 4 }}>Tu código QR</h3>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>Muéstralo en la cafetería para recoger tu pedido</p>

        <div style={{ background: '#fdf6ee', borderRadius: 16, padding: 20, marginBottom: 20, display: 'inline-block' }}>
          <QRCode value={qrData} size={200} />
        </div>

        <div style={{ background: '#fdf6ee', borderRadius: 12, padding: '14px 18px', marginBottom: 20, textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#888', fontSize: 13 }}>Pedido</span>
            <span style={{ fontWeight: 800, color: '#2c1810' }}>{order.code}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#888', fontSize: 13 }}>Total</span>
            <span style={{ fontWeight: 800, color: '#c0392b' }}>{fmt(order.total)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#888', fontSize: 13 }}>Recogida</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{order.time_slot_label}</span>
          </div>
        </div>

        <button onClick={onClose} style={s.btnPrimary}>Cerrar</button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   MODAL ESCÁNER QR  (para el admin)
   ═══════════════════════════════════════════════ */
function QRScannerModal({ onClose, onScanned, showToast }) {
  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const [error, setError]   = useState('')
  const [result, setResult] = useState(null)
  const [scanning, setScanning] = useState(true)

  useEffect(() => {
    let intervalId
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
        // Escaneo simulado — en producción usar jsQR o zxing
        // Por ahora abrimos la cámara y permitimos entrada manual
      })
      .catch(() => setError('No se pudo acceder a la cámara. Usa la entrada manual.'))

    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [])

  const handleManual = (code) => {
    if (!code.trim()) return
    try {
      // El código puede ser el JSON del QR o solo el código del pedido (#XXXXXX)
      let data
      if (code.startsWith('{')) {
        data = JSON.parse(code)
      } else {
        data = { code: code.trim() }
      }
      setResult(data)
      setScanning(false)
      onScanned(data)
    } catch {
      showToast('Código QR no válido', 'error')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: '28px 24px',
        maxWidth: 400, width: '100%',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: '#2c1810' }}>📷 Escanear QR</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>

        {/* Cámara */}
        {!error ? (
          <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 16, background: '#000', aspectRatio: '1' }}>
            <video ref={videoRef} autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {/* Marco de escaneo */}
            <div style={{
              position: 'absolute', inset: '20%',
              border: '3px solid #c0392b', borderRadius: 12,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
            }} />
            <div style={{
              position: 'absolute', bottom: 12, left: 0, right: 0,
              textAlign: 'center', color: 'white', fontSize: 12, fontWeight: 600,
            }}>
              Apunta la cámara al QR del cliente
            </div>
          </div>
        ) : (
          <div style={{ background: '#fdf0ee', borderRadius: 12, padding: 14, marginBottom: 16, color: '#c0392b', fontSize: 13 }}>
            📵 {error}
          </div>
        )}

        {/* Entrada manual como alternativa siempre disponible */}
        <div style={{ marginBottom: 16 }}>
          <label style={s.label}>O introduce el código manualmente</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input id="manual-code" style={{ ...s.input, marginBottom: 0, flex: 1 }}
              placeholder="Ej: #223269" onKeyDown={e => { if (e.key === 'Enter') handleManual(e.target.value) }} />
            <button onClick={() => handleManual(document.getElementById('manual-code').value)}
              style={{ ...s.btnPrimary, width: 'auto', padding: '11px 16px', marginBottom: 0, flexShrink: 0 }}>
              ✓
            </button>
          </div>
        </div>

        <button onClick={onClose} style={s.btnSecondary}>Cancelar</button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   LOGIN / REGISTER
   ═══════════════════════════════════════════════ */
function LoginPage({ onLogin, showToast }) {
  const [tab, setTab]             = useState('login')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [showPass, setShowPass]   = useState(false)

  const switchTab = (t) => { setTab(t); setError('') }

  const submitLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) { setError('Rellena todos los campos'); return }
    setLoading(true); setError('')
    try { onLogin(await api.login(email, password)) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const submitRegister = async (e) => {
    e.preventDefault()
    if (!firstName || !email || !password) { setError('Nombre, correo y contraseña son obligatorios'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true); setError('')
    try { onLogin(await api.register({ first_name: firstName, last_name: lastName, email, password })) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={s.loginWrap}>
      <div style={s.loginCard}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 52, marginBottom: 6 }}>☕</div>
          <h1 style={s.loginTitle}>Cafetería IES</h1>
          <p style={{ color: '#aaa', fontSize: 13, marginTop: 2 }}>Tu pedido, sin esperas</p>
        </div>

        <div style={{ display: 'flex', width: '100%', marginBottom: 22, background: '#f5ede4', borderRadius: 12, padding: 4 }}>
          {[['login', 'Iniciar sesión'], ['register', 'Crear cuenta']].map(([id, label]) => (
            <button key={id} onClick={() => switchTab(id)} style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: 10, cursor: 'pointer',
              fontWeight: 700, fontSize: 14, background: tab === id ? '#c0392b' : 'transparent',
              color: tab === id ? 'white' : '#888',
            }}>{label}</button>
          ))}
        </div>

        {error && (
          <div style={{ background: '#fdf0ee', border: '1px solid #e0b0a8', color: '#c0392b', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14, width: '100%' }}>
            ⚠️ {error}
          </div>
        )}

        {tab === 'login' && (
          <form onSubmit={submitLogin} style={{ width: '100%' }}>
            <label style={s.label}>Correo electrónico</label>
            <input style={s.input} type="email" value={email} autoFocus
              onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
            <label style={s.label}>Contraseña</label>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <input style={{ ...s.input, marginBottom: 0, paddingRight: 44 }}
                type={showPass ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#aaa' }}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
            <button style={{ ...s.btnPrimary, opacity: loading ? 0.7 : 1, marginTop: 4 }} type="submit" disabled={loading}>
              {loading ? 'Entrando…' : 'Iniciar sesión'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 13, color: '#aaa', marginTop: 12 }}>
              ¿No tienes cuenta?{' '}
              <span onClick={() => switchTab('register')} style={{ color: '#c0392b', cursor: 'pointer', fontWeight: 700 }}>Regístrate</span>
            </p>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={submitRegister} style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={s.label}>Nombre *</label>
                <input style={s.input} value={firstName} autoFocus onChange={e => setFirstName(e.target.value)} placeholder="Juan" />
              </div>
              <div>
                <label style={s.label}>Apellidos</label>
                <input style={s.input} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="García" />
              </div>
            </div>
            <label style={s.label}>Correo electrónico *</label>
            <input style={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
            <label style={s.label}>Contraseña *</label>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <input style={{ ...s.input, marginBottom: 0, paddingRight: 44 }}
                type={showPass ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#aaa' }}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
            <label style={s.label}>Confirmar contraseña *</label>
            <input style={{ ...s.input, borderColor: confirm && confirm !== password ? '#c0392b' : undefined }}
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repite la contraseña" />
            {confirm && confirm !== password && <div style={s.fieldError}>Las contraseñas no coinciden</div>}
            <button style={{ ...s.btnPrimary, opacity: loading ? 0.7 : 1, marginTop: 4 }} type="submit" disabled={loading}>
              {loading ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 13, color: '#aaa', marginTop: 12 }}>
              ¿Ya tienes cuenta?{' '}
              <span onClick={() => switchTab('login')} style={{ color: '#c0392b', cursor: 'pointer', fontWeight: 700 }}>Inicia sesión</span>
            </p>
          </form>
        )}

        {tab === 'login' && (
          <div style={{ marginTop: 18, padding: '12px 14px', background: '#fdf6ee', borderRadius: 10, width: '100%', borderLeft: '3px solid #c0392b' }}>
            <p style={{ fontSize: 11, color: '#aaa', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Cuentas de prueba</p>
            {[['👑 Admin', 'admin@cafeteria.es', 'admin123'], ['🎒 Alumno', 'alumno@cafeteria.es', 'alumno123']].map(([label, em, pw]) => (
              <div key={em} onClick={() => { setEmail(em); setPassword(pw) }}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', cursor: 'pointer', borderBottom: '1px solid #f0e6d3' }}>
                <span style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 12, color: '#aaa' }}>{em}</span>
              </div>
            ))}
            <p style={{ fontSize: 11, color: '#bbb', marginTop: 6, textAlign: 'center' }}>Haz clic para rellenar automáticamente</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   TOPBAR  (responsive)
   ═══════════════════════════════════════════════ */
function Topbar({ user, cartCount, view, setView, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navItems = [
    { id: 'menu',   label: '🍽️ Menú' },
    { id: 'orders', label: '📋 Pedidos' },
    { id: 'wallet', label: '💳 Tarjetas' },
    ...(user?.role === 'admin' ? [{ id: 'admin', label: '⚙️ Admin' }] : []),
  ]

  return (
    <header style={s.topbar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22 }}>☕</span>
        <span style={s.topbarTitle}>Cafetería IES</span>
      </div>

      {/* Nav desktop */}
      <nav style={{ ...s.topbarNav, display: 'flex' }} className="desktop-nav">
        {navItems.map(item => (
          <button key={item.id} onClick={() => setView(item.id)}
            style={{ ...s.navBtn, ...(view === item.id ? s.navBtnActive : {}) }}>
            {item.label}
          </button>
        ))}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {cartCount > 0 && (
          <button onClick={() => setView('cart')} style={s.cartBtn}>
            🛒 <span style={s.cartBadge}>{cartCount}</span>
          </button>
        )}
        {/* Usuario (solo en desktop) */}
        <div style={s.userChip} className="desktop-only">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#27ae60', display: 'inline-block' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#f5d49a' }}>{user?.first_name || user?.email?.split('@')[0]}</span>
          <span style={s.roleBadge}>{user?.role}</span>
        </div>
        <button onClick={onLogout} style={s.btnLogout} className="desktop-only">Salir</button>

        {/* Hamburger mobile */}
        <button onClick={() => setMenuOpen(!menuOpen)} className="mobile-only"
          style={{ background: 'none', border: 'none', color: '#f5d49a', fontSize: 24, cursor: 'pointer', padding: '4px 8px' }}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Menú mobile desplegable */}
      {menuOpen && (
        <div style={{
          position: 'absolute', top: 62, left: 0, right: 0,
          background: '#2c1810', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          zIndex: 200, padding: '12px 16px',
        }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setView(item.id); setMenuOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '12px 16px', border: 'none', borderRadius: 10, cursor: 'pointer',
                fontWeight: 700, fontSize: 15, marginBottom: 4,
                background: view === item.id ? '#c0392b' : 'transparent',
                color: view === item.id ? 'white' : '#c9a96e',
              }}>
              {item.label}
            </button>
          ))}
          <div style={{ borderTop: '1px solid #3d2415', marginTop: 8, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#f5d49a', fontSize: 13 }}>{user?.email}</span>
            <button onClick={() => { onLogout(); setMenuOpen(false) }} style={{ ...s.btnLogout, fontSize: 13 }}>Salir</button>
          </div>
        </div>
      )}
    </header>
  )
}

/* ═══════════════════════════════════════════════
   MENÚ
   ═══════════════════════════════════════════════ */
function MenuPage({ cart, setCart, showToast }) {
  const [products, setProducts]     = useState([])
  const [categories, setCategories] = useState([])
  const [favIds, setFavIds]         = useState(new Set())
  const [filter, setFilter]         = useState('Todos')
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([api.products(), api.categories(), api.favorites()])
      .then(([prods, cats, favs]) => {
        setProducts(prods); setCategories(cats)
        setFavIds(new Set(favs.map(f => f.product.id)))
      })
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  const toggleFav = useCallback(async (id) => {
    try {
      const res = await api.toggleFav(id)
      setFavIds(prev => { const n = new Set(prev); res.favorited ? n.add(id) : n.delete(id); return n })
    } catch (e) { showToast(e.message, 'error') }
  }, [])

  const addToCart = useCallback((product) => {
    if (product.stock <= 0) return
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id)
      return ex ? prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
                : [...prev, { ...product, qty: 1 }]
    })
    showToast(`${product.emoji} ${product.name} añadido`)
  }, [])

  const allFilters = useMemo(() => ['Todos', 'Saludable', ...categories.map(c => c.name)], [categories])
  const filtered   = useMemo(() => products.filter(p => {
    const ms = p.name.toLowerCase().includes(search.toLowerCase())
    const mf = filter === 'Todos' ? true : filter === 'Saludable' ? p.healthy : p.category_name === filter
    return ms && mf
  }), [products, search, filter])
  const favProducts = useMemo(() => products.filter(p => favIds.has(p.id)), [products, favIds])

  if (loading) return <Spinner />

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...s.input, flex: 1, minWidth: 180, maxWidth: 320, marginBottom: 0 }}
          value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar producto…" />
        <span style={{ color: '#888', fontSize: 13 }}>{filtered.length} productos</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 22 }}>
        {allFilters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ ...s.chip, ...(filter === f ? s.chipActive : {}) }}>
            {f === 'Saludable' ? '🥦 Saludable' : f}
          </button>
        ))}
      </div>
      {favProducts.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={s.sectionTitle}>⭐ Mis favoritos</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {favProducts.map(p => (
              <div key={p.id} onClick={() => addToCart(p)} style={s.favChip}>
                <span>{p.emoji}</span>
                <span style={{ fontSize: 13 }}>{p.name}</span>
                <span style={{ color: '#c0392b', fontWeight: 700, fontSize: 13 }}>{fmt(p.price)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {filtered.length === 0
        ? <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>No hay productos que coincidan.</p>
        : (
          <div style={s.grid}>
            {filtered.map(p => {
              const inCart = cart.find(i => i.id === p.id)?.qty || 0
              return (
                <div key={p.id} style={{ ...s.productCard, opacity: p.stock === 0 ? 0.55 : 1 }}>
                  <div style={{ fontSize: 42, marginBottom: 2 }}>{p.emoji}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, textAlign: 'center', color: '#2c1810', lineHeight: 1.3 }}>{p.name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', margin: '4px 0' }}>
                    {p.healthy && <span style={s.badgeGreen}>🥦 Saludable</span>}
                    {p.category_name && <span style={s.badgeGray}>{p.category_name}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: p.stock === 0 ? '#c0392b' : p.stock <= 5 ? '#e67e22' : '#888' }}>
                    {p.stock === 0 ? '❌ Agotado' : p.stock <= 5 ? `⚠️ Solo ${p.stock}` : `Stock: ${p.stock}`}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#c0392b', margin: '6px 0' }}>{fmt(p.price)}</div>
                  <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                    <button onClick={() => toggleFav(p.id)} style={s.btnFav}>{favIds.has(p.id) ? '★' : '☆'}</button>
                    <button onClick={() => addToCart(p)} disabled={p.stock === 0}
                      style={{ ...s.btnAdd, ...(p.stock === 0 ? { background: '#ccc', cursor: 'not-allowed' } : {}) }}>
                      {inCart > 0 ? `+1 (${inCart})` : '+ Añadir'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

/* ═══════════════════════════════════════════════
   CARRITO
   ═══════════════════════════════════════════════ */
function CartPage({ cart, setCart, showToast, setView, setPayingOrder }) {
  const [slots, setSlots]             = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [loading, setLoading]         = useState(false)

  useEffect(() => { api.timeslots().then(setSlots).catch(e => showToast(e.message, 'error')) }, [])

  const remove    = useCallback((id) => setCart(prev => prev.filter(i => i.id !== id)), [])
  const changeQty = useCallback((id, delta) => setCart(prev =>
    prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
  ), [])
  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart])

  const checkout = async () => {
    if (!selectedSlot) { showToast('Elige una franja horaria', 'error'); return }
    setLoading(true)
    try {
      const order = await api.createOrder({ time_slot_id: selectedSlot, items: cart.map(i => ({ product_id: i.id, quantity: i.qty })) })
      setCart([])
      setPayingOrder(order)
      setView('payment')
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoading(false) }
  }

  if (cart.length === 0) return (
    <div style={{ ...s.page, textAlign: 'center', paddingTop: 80 }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🛒</div>
      <p style={{ color: '#888', marginBottom: 24 }}>Tu carrito está vacío</p>
      <button onClick={() => setView('menu')} style={{ ...s.btnPrimary, maxWidth: 220, margin: '0 auto' }}>Ver menú</button>
    </div>
  )

  return (
    <div style={s.page}>
      <h2 style={s.pageTitle}>🛒 Tu pedido</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        {cart.map(item => (
          <div key={item.id} style={s.cartItem}>
            <span style={{ fontSize: 30 }}>{item.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#2c1810' }}>{item.name}</div>
              <div style={{ color: '#c0392b', fontWeight: 700 }}>{fmt(item.price * item.qty)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => changeQty(item.id, -1)} style={s.qtyBtn}>−</button>
              <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 800 }}>{item.qty}</span>
              <button onClick={() => changeQty(item.id, +1)} style={s.qtyBtn}>+</button>
            </div>
            <button onClick={() => remove(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: 20 }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'right', fontSize: 20, fontWeight: 800, color: '#2c1810', padding: '12px 0', borderTop: '2px solid #f0e6d3', marginBottom: 22 }}>
        Total: <span style={{ color: '#c0392b' }}>{fmt(total)}</span>
      </div>
      <h3 style={s.sectionTitle}>🕐 Franja de recogida</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 22 }}>
        {slots.map(slot => {
          const now = new Date()
          const [h, m] = (slot.start || '00:00').split(':').map(Number)
          const slotStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0)
          const isPast = slotStart <= now
          const isSelected = selectedSlot === slot.id
          return (
            <button key={slot.id}
              onClick={() => !isPast && setSelectedSlot(slot.id)}
              disabled={isPast}
              title={isPast ? 'Esta franja ya ha pasado' : ''}
              style={{
                ...s.slotBtn,
                ...(isSelected ? s.slotBtnActive : {}),
                ...(isPast ? { opacity: 0.38, cursor: 'not-allowed', background: '#f5f0eb', border: '2px solid #e0d3c8', color: '#bbb', textDecoration: 'line-through' } : {})
              }}>
              {slot.label}
              {isPast && <span style={{ display: 'block', fontSize: 10, fontWeight: 500, marginTop: 2, color: '#bbb' }}>ya pasó</span>}
            </button>
          )
        })}
      </div>
      <button onClick={checkout} disabled={loading || !selectedSlot}
        style={{ ...s.btnPrimary, opacity: (!selectedSlot || loading) ? 0.5 : 1 }}>
        {loading ? 'Procesando…' : `Ir a pagar · ${fmt(total)}`}
      </button>
      <button onClick={() => setView('menu')} style={s.btnSecondary}>← Seguir comprando</button>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   FORMULARIO TARJETA
   ═══════════════════════════════════════════════ */
function CardForm({ onSave, onCancel, showToast, saveLabel = 'Guardar tarjeta' }) {
  const [form, setForm]   = useState({ card_number: '', cardholder_name: '', expiry_month: '', expiry_year: '', cvv: '', alias: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (form.card_number.replace(/\s/g, '').length < 13) e.card_number = 'Número inválido'
    if (!form.cardholder_name.trim()) e.cardholder_name = 'Requerido'
    const mo = parseInt(form.expiry_month)
    if (!mo || mo < 1 || mo > 12) e.expiry_month = 'Mes inválido'
    if (!form.expiry_year || form.expiry_year.length < 2) e.expiry_year = 'Año inválido'
    if (!form.cvv || form.cvv.length < 3) e.cvv = 'CVV inválido'
    return e
  }

  const submit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    try {
      const card = await onSave({ card_number: form.card_number.replace(/\s/g, ''), cardholder_name: form.cardholder_name, expiry_month: form.expiry_month, expiry_year: form.expiry_year, cvv: form.cvv, alias: form.alias })
      return card
    } catch (err) { showToast(err.message, 'error') }
    finally { setSaving(false) }
  }

  const { brand } = detectBrand(form.card_number)

  return (
    <div style={{ background: '#fffaf5', border: '1.5px solid #f0e6d3', borderRadius: 16, padding: '20px 18px' }}>
      <div style={{ background: 'linear-gradient(135deg,#2c1810,#c0392b)', borderRadius: 14, padding: '16px 20px', marginBottom: 18, color: 'white', boxShadow: '0 6px 20px rgba(192,57,43,0.3)' }}>
        <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 8, letterSpacing: 2 }}>TARJETA DE PAGO</div>
        <div style={{ fontSize: 16, letterSpacing: 3, fontWeight: 700, marginBottom: 12, fontFamily: 'monospace' }}>{form.card_number || '•••• •••• •••• ••••'}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <div><div style={{ opacity: 0.6, fontSize: 9 }}>TITULAR</div><div style={{ fontWeight: 600 }}>{form.cardholder_name || 'NOMBRE APELLIDOS'}</div></div>
          <div style={{ textAlign: 'right' }}><div style={{ opacity: 0.6, fontSize: 9 }}>CADUCA</div><div style={{ fontWeight: 600 }}>{form.expiry_month ? form.expiry_month.padStart(2,'0') : 'MM'}/{form.expiry_year || 'YY'}</div></div>
          <div style={{ fontSize: 18 }}>{brand === 'Visa' ? '🔵' : brand === 'Mastercard' ? '🔴' : '💳'}<div style={{ fontSize: 9, textAlign: 'center', opacity: 0.8 }}>{brand}</div></div>
        </div>
      </div>
      <label style={s.label}>Número de tarjeta</label>
      <input style={{ ...s.input, letterSpacing: 2, ...(errors.card_number ? { borderColor: '#c0392b' } : {}) }}
        value={form.card_number} maxLength={19} placeholder="1234 5678 9012 3456"
        onChange={e => set('card_number', formatCardNumber(e.target.value))} />
      {errors.card_number && <div style={s.fieldError}>{errors.card_number}</div>}
      <label style={s.label}>Titular</label>
      <input style={{ ...s.input, ...(errors.cardholder_name ? { borderColor: '#c0392b' } : {}) }}
        value={form.cardholder_name} placeholder="NOMBRE APELLIDOS"
        onChange={e => set('cardholder_name', e.target.value.toUpperCase())} />
      {errors.cardholder_name && <div style={s.fieldError}>{errors.cardholder_name}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <label style={s.label}>Mes</label>
          <input style={{ ...s.input, ...(errors.expiry_month ? { borderColor: '#c0392b' } : {}) }} value={form.expiry_month} maxLength={2} placeholder="12" onChange={e => set('expiry_month', e.target.value.replace(/\D/g, ''))} />
          {errors.expiry_month && <div style={s.fieldError}>{errors.expiry_month}</div>}
        </div>
        <div>
          <label style={s.label}>Año</label>
          <input style={{ ...s.input, ...(errors.expiry_year ? { borderColor: '#c0392b' } : {}) }} value={form.expiry_year} maxLength={4} placeholder="2028" onChange={e => set('expiry_year', e.target.value.replace(/\D/g, ''))} />
          {errors.expiry_year && <div style={s.fieldError}>{errors.expiry_year}</div>}
        </div>
        <div>
          <label style={s.label}>CVV</label>
          <input style={{ ...s.input, ...(errors.cvv ? { borderColor: '#c0392b' } : {}) }} value={form.cvv} maxLength={4} placeholder="123" type="password" onChange={e => set('cvv', e.target.value.replace(/\D/g, ''))} />
          {errors.cvv && <div style={s.fieldError}>{errors.cvv}</div>}
        </div>
      </div>
      <label style={s.label}>Alias (opcional)</label>
      <input style={s.input} value={form.alias} placeholder="Ej: Mi Visa del banco" onChange={e => set('alias', e.target.value)} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={submit} disabled={saving} style={{ ...s.btnPrimary, flex: 1, marginBottom: 0, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Guardando…' : saveLabel}
        </button>
        {onCancel && <button onClick={onCancel} style={{ ...s.btnSecondary, flex: 0.5, marginBottom: 0 }}>Cancelar</button>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════
   PAGO
   ═══════════════════════════════════════════════ */
function PaymentPage({ order, showToast, setView, onPaymentDone }) {
  const [method, setMethod]             = useState('card')
  const [cards, setCards]               = useState([])
  const [selectedCard, setSelectedCard] = useState(null)
  const [showNewCard, setShowNewCard]   = useState(false)
  const [cashInput, setCashInput]       = useState('')
  const [loading, setLoading]           = useState(false)
  const [result, setResult]             = useState(null)
  const [confirmStep, setConfirmStep]   = useState(false)

  useEffect(() => {
    api.cards().then(list => {
      setCards(list)
      const def = list.find(c => c.is_default) || list[0]
      if (def) setSelectedCard(def.id)
      else setShowNewCard(true)
    }).catch(() => { setShowNewCard(true) })
  }, [])

  const handleAddCard = async (data) => {
    const card = await api.addCard({ ...data, is_default: cards.length === 0 })
    setCards(prev => [...prev, card])
    setSelectedCard(card.id)
    setShowNewCard(false)
    return card
  }

  const handleDeleteCard = async (id) => {
    await api.deleteCard(id)
    const updated = cards.filter(c => c.id !== id)
    setCards(updated)
    if (selectedCard === id) setSelectedCard(updated[0]?.id || null)
    showToast('Tarjeta eliminada')
  }

  const change = cashInput ? Math.max(0, parseFloat(cashInput) - parseFloat(order.total)) : null

  const pay = async () => {
    setLoading(true)
    try {
      let body
      if (method === 'card') {
        if (!selectedCard) { showToast('Guarda primero la tarjeta', 'error'); setLoading(false); return }
        body = { method: 'card', card_id: selectedCard }
      } else {
        if (!cashInput || parseFloat(cashInput) < parseFloat(order.total)) { showToast('El efectivo entregado es menor al total', 'error'); setLoading(false); return }
        body = { method: 'cash', cash_tendered: parseFloat(cashInput) }
      }
      const res = await api.payOrder(order.id, body)
      setResult(res)
    } catch (e) { showToast(e.message, 'error') }
    finally { setLoading(false) }
  }

  /* ── Pantalla de éxito ── */
  if (result) {
    const ord    = result.order || {}
    const p      = ord.payment || {}
    const isCard = p.method === 'card'
    const nowStr = new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

    /* ── Ticket de efectivo estilo KFC ── */
    if (!isCard) {
      const ticketRow = (label, value, bold) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px dashed #ccc' }}>
          <span style={{ fontSize: 12, color: '#444', fontFamily: 'monospace' }}>{label}</span>
          <span style={{ fontSize: 12, fontWeight: bold ? 800 : 600, color: bold ? '#2c1810' : '#555', fontFamily: 'monospace' }}>{value}</span>
        </div>
      )
      return (
        <div style={{ ...s.page, maxWidth: 420, textAlign: 'center' }}>
          {/* ticket wrapper con bordes dentados */}
          <div style={{ position: 'relative', background: 'white', borderRadius: '4px', boxShadow: '0 6px 32px rgba(0,0,0,0.18)', margin: '0 auto' }}>
            {/* cabecera roja */}
            <div style={{ background: '#c0392b', borderRadius: '4px 4px 0 0', padding: '20px 24px 16px', color: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>☕ CAFETERÍA</div>
              <div style={{ fontSize: 11, letterSpacing: 3, opacity: 0.85, fontFamily: 'monospace' }}>TICKET DE PEDIDO</div>
            </div>

            {/* borde dentado superior */}
            <div style={{ height: 14, background: `radial-gradient(circle at 50% 0, white 7px, transparent 7px) 0 0 / 14px 14px repeat-x, #c0392b` }} />

            {/* cuerpo del ticket */}
            <div style={{ padding: '18px 24px', fontFamily: 'monospace' }}>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 10, textAlign: 'center', letterSpacing: 1 }}>{nowStr}</div>

              {/* código grande */}
              <div style={{ background: '#fdf6ee', borderRadius: 8, padding: '12px 10px', marginBottom: 14, textAlign: 'center', border: '2px dashed #e0d3c8' }}>
                <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2, letterSpacing: 2 }}>Nº PEDIDO</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#c0392b', letterSpacing: 4 }}>{ord.code || '—'}</div>
              </div>

              {/* items */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: '#aaa', letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' }}>Artículos</div>
                {(ord.items || []).map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: '1px dotted #eee' }}>
                    <span style={{ fontSize: 12, color: '#333', fontFamily: 'monospace' }}>{it.quantity}x {it.product_emoji} {it.product_name}</span>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#555' }}>{fmt(it.price * it.quantity)}</span>
                  </div>
                ))}
              </div>

              {/* totales */}
              <div style={{ borderTop: '2px solid #333', paddingTop: 8, marginBottom: 12 }}>
                {ticketRow('ENTREGADO', fmt(p.cash_tendered || 0), false)}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', marginTop: 4, background: '#fdf6ee', borderRadius: 4, paddingLeft: 6, paddingRight: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#2c1810', fontFamily: 'monospace' }}>TOTAL</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#c0392b', fontFamily: 'monospace' }}>{fmt(ord.total || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 6px 0', background: '#e8f8f0', borderRadius: 4, marginTop: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#1a6e43', fontFamily: 'monospace' }}>CAMBIO</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: '#1a6e43', fontFamily: 'monospace' }}>{fmt(p.cash_change || 0)}</span>
                </div>
              </div>

              {/* franja de recogida */}
              <div style={{ border: '2px solid #c0392b', borderRadius: 8, padding: '10px 12px', marginBottom: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#c0392b', letterSpacing: 2, marginBottom: 2, fontWeight: 700 }}>⏰ FRANJA DE RECOGIDA</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#2c1810' }}>{ord.time_slot_label || '—'}</div>
              </div>

              {/* instrucción */}
              <div style={{ fontSize: 11, color: '#888', textAlign: 'center', lineHeight: 1.5, marginBottom: 10 }}>
                Muestra este ticket en la cafetería<br />y <strong>paga al recoger</strong> tu pedido 💵<br />
                <span style={{ color: '#8e44ad', fontWeight: 700 }}>El admin confirmará tu pago</span>
              </div>

              {/* ref */}
              <div style={{ fontSize: 9, color: '#ccc', textAlign: 'center', fontFamily: 'monospace', marginBottom: 4 }}>
                REF: {result.transaction_ref || p.transaction_ref || '—'}
              </div>
            </div>

            {/* borde dentado inferior */}
            <div style={{ height: 14, background: `radial-gradient(circle at 50% 100%, white 7px, transparent 7px) 0 100% / 14px 14px repeat-x, #f5f5f5` }} />
            <div style={{ background: '#f5f5f5', borderRadius: '0 0 4px 4px', padding: '12px 24px', borderTop: '1px dashed #ddd' }}>
              <div style={{ fontSize: 9, color: '#aaa', textAlign: 'center', fontFamily: 'monospace', letterSpacing: 1 }}>GRACIAS POR TU COMPRA • BUEN PROVECHO</div>
            </div>
          </div>

          <button onClick={() => { onPaymentDone(ord); setView('orders') }} style={{ ...s.btnPrimary, marginTop: 20 }}>Ver mis pedidos</button>
          <button onClick={() => { onPaymentDone(ord); setView('menu') }} style={s.btnSecondary}>Volver al menú</button>
        </div>
      )
    }

    /* ── Pantalla de éxito con QR (tarjeta) ── */
    return (
      <div style={{ ...s.page, maxWidth: 520, textAlign: 'center' }}>
        <div style={{ background: 'white', borderRadius: 24, padding: '36px 28px', boxShadow: '0 8px 40px rgba(0,0,0,0.1)', border: '1px solid #f0e6d3' }}>
          <div style={{ fontSize: 72, marginBottom: 6 }}>✅</div>
          <h2 style={{ ...s.pageTitle, marginBottom: 4 }}>¡Pago realizado!</h2>
          <p style={{ color: '#888', marginBottom: 24, fontSize: 14 }}>Tu pedido ha sido confirmado</p>

          {/* QR del pedido */}
          <div style={{ background: '#fdf6ee', borderRadius: 18, padding: '20px', marginBottom: 20, display: 'inline-block' }}>
            <QRCode value={ord.code} size={180} />
          </div>
          <p style={{ color: '#888', fontSize: 12, marginBottom: 20 }}>📱 Muestra este QR en la cafetería para recoger tu pedido</p>

          <div style={{ background: '#fdf6ee', borderRadius: 14, padding: '16px 18px', marginBottom: 20, textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#888', fontSize: 13 }}>Pedido</span>
              <span style={{ fontWeight: 800, color: '#2c1810' }}>{ord.code || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#888', fontSize: 13 }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: 17, color: '#c0392b' }}>{fmt(ord.total || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#888', fontSize: 13 }}>Método</span>
              <span style={{ fontWeight: 600 }}>{`💳 ${p.card_info?.brand} ****${p.card_info?.last4}`}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888', fontSize: 13 }}>Referencia</span>
              <span style={{ fontWeight: 600, fontSize: 11, color: '#555' }}>{result.transaction_ref || p.transaction_ref || '—'}</span>
            </div>
          </div>

          <div style={{ background: '#e8f8f0', borderRadius: 12, padding: '12px 16px', marginBottom: 22, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 22 }}>⏰</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: '#1a6e43', fontSize: 14 }}>Recogida: {ord.time_slot_label || '—'}</div>
              <div style={{ fontSize: 12, color: '#555' }}>Lleva el QR para recoger tu pedido</div>
            </div>
          </div>

          <button onClick={() => { onPaymentDone(ord); setView('orders') }} style={s.btnPrimary}>Ver mis pedidos</button>
          <button onClick={() => { onPaymentDone(ord); setView('menu') }} style={s.btnSecondary}>Volver al menú</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...s.page, maxWidth: 560 }}>
      <h2 style={s.pageTitle}>💳 Pagar pedido</h2>
      <div style={{ background: 'white', borderRadius: 16, padding: '16px 18px', marginBottom: 22, border: '1px solid #f0e6d3', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 700, color: '#2c1810' }}>Pedido {order.code}</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#c0392b' }}>{fmt(order.total)}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {order.items?.map(i => <span key={i.id} style={s.itemChip}>{i.product_emoji} {i.quantity}× {i.product_name}</span>)}
        </div>
      </div>

      <h3 style={{ ...s.sectionTitle, marginBottom: 10 }}>Método de pago</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
        {[['card','💳','Tarjeta'],['cash','💵','Efectivo']].map(([id, icon, label]) => (
          <button key={id} onClick={() => setMethod(id)} style={{ border: `2px solid ${method === id ? '#c0392b' : '#e0d3c8'}`, background: method === id ? '#fdf0ee' : 'white', borderRadius: 14, padding: '16px 10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 30 }}>{icon}</span>
            <span style={{ fontWeight: 700, color: method === id ? '#c0392b' : '#555' }}>{label}</span>
          </button>
        ))}
      </div>

      {method === 'card' && (
        <div>
          {cards.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ ...s.label, marginBottom: 8 }}>Tarjetas guardadas</label>
              {cards.map(card => (
                <div key={card.id} onClick={() => { setSelectedCard(card.id); setShowNewCard(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, border: `2px solid ${selectedCard === card.id ? '#c0392b' : '#e0d3c8'}`, background: selectedCard === card.id ? '#fdf0ee' : 'white', borderRadius: 14, padding: '12px 14px', cursor: 'pointer', marginBottom: 8 }}>
                  <div style={{ width: 42, height: 28, background: 'linear-gradient(135deg,#2c1810,#c0392b)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                    {card.card_brand.slice(0,4).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#2c1810', fontSize: 13 }}>{card.card_brand} ••••{card.card_last4}{card.is_default && <span style={{ ...s.badgeGreen, marginLeft: 6, fontSize: 10 }}>pred.</span>}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{card.cardholder_name} · {card.expiry_month}/{card.expiry_year}</div>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selectedCard === card.id ? '#c0392b' : '#ccc'}`, background: selectedCard === card.id ? '#c0392b' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selectedCard === card.id && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'white' }} />}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!showNewCard ? (
            <button onClick={() => { setShowNewCard(true); setSelectedCard(null) }}
              style={{ width: '100%', border: '2px dashed #e0d3c8', background: 'transparent', borderRadius: 14, padding: '13px', cursor: 'pointer', color: '#c0392b', fontWeight: 700, fontSize: 14, marginBottom: 18 }}>
              + Usar otra tarjeta
            </button>
          ) : (
            <div style={{ marginBottom: 18 }}>
              <CardForm onSave={handleAddCard} onCancel={() => { setShowNewCard(false); setSelectedCard(cards[0]?.id || null) }} showToast={showToast} saveLabel="Guardar y usar esta tarjeta" />
            </div>
          )}
        </div>
      )}

      {method === 'cash' && (
        <div style={{ background: 'white', borderRadius: 16, padding: '18px', border: '1px solid #f0e6d3', marginBottom: 18 }}>
          <label style={s.label}>Cantidad que entregas (€)</label>
          <input style={{ ...s.input, fontSize: 22, fontWeight: 800, textAlign: 'center', color: '#2c1810' }}
            type="number" min={order.total} step="0.50" value={cashInput}
            onChange={e => setCashInput(e.target.value)} placeholder={fmt(order.total)} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[order.total, Math.ceil(parseFloat(order.total)), Math.ceil(parseFloat(order.total)/5)*5, 20, 50]
              .filter((v,i,a) => a.indexOf(v)===i && v >= parseFloat(order.total)).slice(0,4)
              .map(v => (
                <button key={v} onClick={() => setCashInput(v.toFixed(2))}
                  style={{ border: `1.5px solid ${parseFloat(cashInput)===v ? '#c0392b' : '#e0d3c8'}`, background: parseFloat(cashInput)===v ? '#fdf0ee' : 'white', borderRadius: 10, padding: '7px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#2c1810' }}>
                  {fmt(v)}
                </button>
              ))}
          </div>
          {cashInput && parseFloat(cashInput) >= parseFloat(order.total) && (
            <div style={{ background: '#e8f8f0', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, color: '#555' }}>Tu cambio</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#27ae60' }}>{fmt(change)}</span>
            </div>
          )}
        </div>
      )}

      {method === 'card' ? (
        <button
          onClick={() => { if (!selectedCard) { showToast('Selecciona o guarda una tarjeta', 'error'); return } setConfirmStep(true) }}
          disabled={!selectedCard}
          style={{ ...s.btnPrimary, opacity: !selectedCard ? 0.5 : 1, fontSize: 16, padding: '15px' }}>
          💳 Pagar {fmt(order.total)}
        </button>
      ) : (
        <button onClick={pay} disabled={loading || !cashInput || parseFloat(cashInput) < parseFloat(order.total)}
          style={{ ...s.btnPrimary, opacity: loading ? 0.7 : 1, fontSize: 16, padding: '15px', background: loading ? '#888' : '#c0392b' }}>
          {loading ? 'Procesando…' : `💵 Pagar ${fmt(order.total)}`}
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 10 }}>
        <span style={{ fontSize: 14 }}>🔒</span>
        <span style={{ fontSize: 12, color: '#aaa' }}>Pago seguro</span>
      </div>

      {/* ── Modal de confirmación de tarjeta ── */}
      {confirmStep && (() => {
        const card = cards.find(c => c.id === selectedCard)
        return (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16,
          }} onClick={() => setConfirmStep(false)}>
            <div style={{
              background: 'white', borderRadius: 22, padding: '32px 26px',
              maxWidth: 380, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
            }} onClick={e => e.stopPropagation()}>
              <div style={{ textAlign: 'center', marginBottom: 22 }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🔐</div>
                <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: '#2c1810', marginBottom: 6 }}>Confirmar pago</h3>
                <p style={{ color: '#888', fontSize: 13 }}>¿Confirmas el cargo en tu tarjeta?</p>
              </div>

              {/* Resumen del cargo */}
              <div style={{ background: '#fdf6ee', borderRadius: 14, padding: '16px 18px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ color: '#888', fontSize: 13 }}>Pedido</span>
                  <span style={{ fontWeight: 700, color: '#2c1810' }}>{order.code}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ color: '#888', fontSize: 13 }}>Importe</span>
                  <span style={{ fontWeight: 800, fontSize: 20, color: '#c0392b' }}>{fmt(order.total)}</span>
                </div>
                {card && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid #f0e6d3' }}>
                    <div style={{ width: 38, height: 24, background: 'linear-gradient(135deg,#2c1810,#c0392b)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 8, fontWeight: 700, flexShrink: 0 }}>
                      {card.card_brand.slice(0,4).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#2c1810' }}>{card.card_brand} ••••{card.card_last4}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{card.cardholder_name}</div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => { setConfirmStep(false); pay() }}
                disabled={loading}
                style={{ ...s.btnPrimary, marginBottom: 10, opacity: loading ? 0.7 : 1, fontSize: 15, padding: '14px' }}>
                {loading ? 'Procesando…' : `✅ Sí, pagar ${fmt(order.total)}`}
              </button>
              <button onClick={() => setConfirmStep(false)} style={s.btnSecondary}>
                Cancelar
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   MIS TARJETAS
   ═══════════════════════════════════════════════ */
function WalletPage({ showToast }) {
  const [cards, setCards]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { api.cards().then(setCards).catch(e => showToast(e.message,'error')).finally(() => setLoading(false)) }, [])

  const handleAdd = async (data) => {
    const card = await api.addCard({ ...data, is_default: cards.length === 0 })
    setCards(prev => [...prev, card]); setShowForm(false); showToast('✅ Tarjeta guardada'); return card
  }
  const handleDelete = async (id) => { await api.deleteCard(id); setCards(prev => prev.filter(c => c.id !== id)); showToast('Tarjeta eliminada') }
  const handleSetDefault = async (id) => { await api.setDefaultCard(id); setCards(prev => prev.map(c => ({ ...c, is_default: c.id === id }))); showToast('Tarjeta predeterminada') }

  if (loading) return <Spinner />

  return (
    <div style={{ ...s.page, maxWidth: 560 }}>
      <h2 style={s.pageTitle}>💳 Mis tarjetas</h2>
      {cards.length === 0 && !showForm && <div style={{ textAlign: 'center', padding: '40px 0' }}><div style={{ fontSize: 60, marginBottom: 12 }}>💳</div><p style={{ color: '#888' }}>No tienes tarjetas guardadas</p></div>}
      {cards.map(card => (
        <div key={card.id} style={{ background: 'white', border: `2px solid ${card.is_default ? '#c0392b' : '#f0e6d3'}`, borderRadius: 16, padding: '16px 18px', marginBottom: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 52, height: 34, background: 'linear-gradient(135deg,#2c1810,#c0392b)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 700 }}>
              {card.card_brand.slice(0,4).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: '#2c1810' }}>{card.card_brand} ••••{card.card_last4}{card.is_default && <span style={{ ...s.badgeGreen, marginLeft: 8, fontSize: 10 }}>predeterminada</span>}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{card.cardholder_name} · {card.expiry_month}/{card.expiry_year}{card.alias && ` · ${card.alias}`}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {!card.is_default && <button onClick={() => handleSetDefault(card.id)} style={{ border: '1px solid #e0d3c8', background: 'white', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#555' }}>Pred.</button>}
              <button onClick={() => handleDelete(card.id)} style={{ border: '1px solid #f0d0cc', background: '#fdf0ee', borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: 11, color: '#c0392b', fontWeight: 600 }}>Eliminar</button>
            </div>
          </div>
        </div>
      ))}
      {showForm
        ? <CardForm onSave={handleAdd} onCancel={() => setShowForm(false)} showToast={showToast} />
        : <button onClick={() => setShowForm(true)} style={{ width: '100%', border: '2px dashed #e0d3c8', background: 'transparent', borderRadius: 14, padding: '15px', cursor: 'pointer', color: '#c0392b', fontWeight: 700, fontSize: 14 }}>+ Añadir tarjeta</button>
      }
    </div>
  )
}

/* ═══════════════════════════════════════════════
   MIS PEDIDOS  (con botón QR)
   ═══════════════════════════════════════════════ */
function OrdersPage({ showToast, setView, setPayingOrder }) {
  const [orders, setOrders]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [qrOrder, setQrOrder]     = useState(null)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => { api.orders().then(setOrders).catch(e => showToast(e.message,'error')).finally(() => setLoading(false)) }, [])

  const STATUS_LABEL = { pending: 'Pendiente de pago', cash_pending: '💵 Pagar en caja', paid: '✅ Pagado', ready: '🎉 Listo para recoger', delivered: 'Entregado', cancelled: 'Cancelado' }
  const STATUS_COLOR = { pending: '#e67e22', cash_pending: '#8e44ad', paid: '#27ae60', ready: '#2980b9', delivered: '#95a5a6', cancelled: '#c0392b' }

  const activeOrders    = orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled')
  const finishedOrders  = orders.filter(o => o.status === 'delivered' || o.status === 'cancelled')
  const visibleOrders   = showHistory ? finishedOrders : activeOrders

  if (loading) return <Spinner />

  const renderOrder = (o) => (
    <div key={o.id} style={{ ...s.orderCard, ...(o.status === 'delivered' || o.status === 'cancelled' ? { opacity: 0.7 } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'serif', fontSize: 18, fontWeight: 800, color: '#2c1810' }}>{o.code}</span>
        <span style={{ ...s.statusBadge, background: STATUS_COLOR[o.status] + '22', color: STATUS_COLOR[o.status] }}>{STATUS_LABEL[o.status]}</span>
        <span style={{ marginLeft: 'auto', color: '#c0392b', fontWeight: 800, fontSize: 17 }}>{fmt(o.total)}</span>
      </div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>🕐 {o.time_slot_label} · {new Date(o.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {o.items.map(i => <span key={i.id} style={s.itemChip}>{i.product_emoji} {i.quantity}× {i.product_name}</span>)}
      </div>
      {o.payment && (
        <div style={{ fontSize: 12, color: '#27ae60', fontWeight: 600, marginBottom: 10 }}>
          ✅ {o.payment.method === 'card' ? `Pagado con ${o.payment.card_info?.brand} ****${o.payment.card_info?.last4}` : 'Pagado en efectivo'}
          {o.payment.transaction_ref && <span style={{ color: '#aaa', fontWeight: 400, marginLeft: 6 }}>· {o.payment.transaction_ref}</span>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {o.status === 'pending' && (
          <button onClick={() => { setPayingOrder(o); setView('payment') }} style={{ ...s.btnPrimary, maxWidth: 180, marginBottom: 0, padding: '9px 14px', fontSize: 13 }}>
            💳 Pagar ahora
          </button>
        )}
        {o.status === 'cash_pending' && (
          <div style={{ background: '#f5eeff', border: '1.5px solid #8e44ad', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600, color: '#8e44ad' }}>
            💵 Paga en la cafetería al recoger tu pedido
          </div>
        )}
        {o.status !== 'pending' && o.status !== 'cancelled' && o.status !== 'delivered' && o.status !== 'cash_pending' && (
          <button onClick={() => setQrOrder(o)}
            style={{ background: '#2c1810', color: 'white', border: 'none', borderRadius: 10, padding: '9px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            📱 Ver QR
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ ...s.pageTitle, marginBottom: 0 }}>
          {showHistory ? '🕓 Historial' : '📋 Mis pedidos'}
        </h2>
        <button
          onClick={() => setShowHistory(h => !h)}
          style={{ border: '1.5px solid #e0d3c8', background: showHistory ? '#2c1810' : 'white', color: showHistory ? 'white' : '#888', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {showHistory ? '← Pedidos activos' : `🕓 Historial${finishedOrders.length > 0 ? ` (${finishedOrders.length})` : ''}`}
        </button>
      </div>

      {visibleOrders.length === 0
        ? <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 64, marginBottom: 12 }}>{showHistory ? '📂' : '📭'}</div>
            <p style={{ color: '#888' }}>{showHistory ? 'No hay pedidos entregados todavía' : 'No tienes pedidos activos'}</p>
            {!showHistory && <button onClick={() => setView('menu')} style={{ ...s.btnPrimary, maxWidth: 200, margin: '16px auto 0' }}>Ver menú</button>}
          </div>
        : visibleOrders.map(renderOrder)
      }
      {qrOrder && <QRModal order={qrOrder} onClose={() => setQrOrder(null)} />}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   ADMIN  (con escáner QR)
   ═══════════════════════════════════════════════ */
function AdminPage({ showToast }) {
  const [tab, setTab]             = useState('orders')
  const [orders, setOrders]       = useState([])
  const [products, setProducts]   = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showScanner, setShowScanner] = useState(false)
  const [scannedOrder, setScannedOrder] = useState(null)

  useEffect(() => {
    Promise.all([api.orders(), api.products(), api.categories()])
      .then(([o, p, c]) => { setOrders(o); setProducts(p); setCategories(c) })
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  const setStatus = async (id, status) => {
    try {
      const updated = await api.updateOrder(id, { status })
      setOrders(prev => prev.map(o => o.id === id ? updated : o))
      showToast('Estado actualizado')
    } catch (e) { showToast(e.message, 'error') }
  }

  const [showNewProduct, setShowNewProduct] = useState(false)
  const [newProduct, setNewProduct] = useState({ name: '', price: '', emoji: '🍽️', stock: 10, healthy: false, category: '' })
  const [savingProduct, setSavingProduct] = useState(false)

  const handleCreateProduct = async () => {
    if (!newProduct.name || !newProduct.price) { showToast('Nombre y precio son obligatorios', 'error'); return }
    setSavingProduct(true)
    try {
      const created = await api.createProduct({ ...newProduct, price: parseFloat(newProduct.price), stock: parseInt(newProduct.stock) || 0 })
      setProducts(prev => [...prev, created])
      setNewProduct({ name: '', price: '', emoji: '🍽️', stock: 10, healthy: false, category: '' })
      setShowNewProduct(false)
      showToast(`✅ "${created.name}" añadido al menú`)
    } catch (e) { showToast(e.message, 'error') }
    finally { setSavingProduct(false) }
  }

  const handleDeleteProduct = async (id, name) => {
    if (!window.confirm(`¿Eliminar "${name}" del menú?`)) return
    try {
      await api.deleteProduct(id)
      setProducts(prev => prev.filter(p => p.id !== id))
      showToast(`"${name}" eliminado del menú`)
    } catch (e) { showToast(e.message, 'error') }
  }

  const setStock = async (id, stock) => {
    try {
      const updated = await api.updateStock(id, stock)
      setProducts(prev => prev.map(p => p.id === id ? updated : p))
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleScanned = (data) => {
    // El QR ahora contiene solo el código del pedido (string simple)
    let code = data
    try { const parsed = JSON.parse(data); code = parsed.code || parsed } catch {}
    const found = orders.find(o => o.code === code)
    setShowScanner(false)
    if (found) {
      setScannedOrder(found)
      setTab('orders')
    } else {
      showToast(`Pedido ${code} no encontrado`, 'error')
    }
  }

  const STATUS_COLOR = { pending: '#e67e22', cash_pending: '#8e44ad', paid: '#27ae60', ready: '#2980b9', delivered: '#95a5a6', cancelled: '#c0392b' }
  const STATUS_LABEL = { pending: 'Pendiente', cash_pending: 'Pagar en caja', paid: 'Pagado', ready: 'Listo', delivered: 'Entregado', cancelled: 'Cancelar' }

  const confirmCash = async (id) => {
    try {
      const updated = await api.confirmCash(id)
      setOrders(prev => prev.map(o => o.id === id ? updated.order : o))
      showToast('✅ Pago en efectivo confirmado')
    } catch (e) { showToast(e.message, 'error') }
  }

  const stats = useMemo(() => ({
    total:     orders.length,
    pendiente: orders.filter(o => o.status === 'pending' || o.status === 'cash_pending').length,
    ingresos:  orders.filter(o => ['paid','ready','delivered'].includes(o.status)).reduce((s,o) => s + Number(o.total), 0),
    agotados:  products.filter(p => p.stock === 0).length,
  }), [orders, products])

  if (loading) return <Spinner />

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ ...s.pageTitle, marginBottom: 0 }}>⚙️ Administración</h2>
        <button onClick={() => setShowScanner(true)}
          style={{ background: '#2c1810', color: '#f5d49a', border: 'none', borderRadius: 12, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          📷 Escanear QR
        </button>
      </div>

      {/* Pedido escaneado resaltado */}
      {scannedOrder && (
        <div style={{ background: '#e8f8f0', border: '2px solid #27ae60', borderRadius: 16, padding: '16px 20px', marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: 18, color: '#2c1810' }}>📱 QR Escaneado: {scannedOrder.code}</span>
              <span style={{ marginLeft: 10, fontWeight: 600, color: '#27ae60' }}>· {scannedOrder.user_username}</span>
            </div>
            <button onClick={() => setScannedOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888' }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {scannedOrder.items?.map(i => <span key={i.id} style={s.itemChip}>{i.product_emoji} {i.quantity}× {i.product_name}</span>)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => { setStatus(scannedOrder.id, 'ready'); setScannedOrder(null) }}
              style={{ background: '#27ae60', color: 'white', border: 'none', borderRadius: 9, padding: '10px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
              ✅ Marcar como Listo
            </button>
            <button onClick={() => { setStatus(scannedOrder.id, 'delivered'); setScannedOrder(null) }}
              style={{ background: '#2980b9', color: 'white', border: 'none', borderRadius: 9, padding: '10px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
              📦 Marcar como Entregado
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 12, marginBottom: 26 }}>
        {[
          { label: 'Total pedidos', value: stats.total,          color: '#2980b9', icon: '📦' },
          { label: 'Pendientes',    value: stats.pendiente,      color: '#e67e22', icon: '⏳' },
          { label: 'Ingresos',      value: fmt(stats.ingresos),  color: '#27ae60', icon: '💰' },
          { label: 'Agotados',      value: stats.agotados,       color: '#c0392b', icon: '❌' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'white', borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', borderLeft: `4px solid ${stat.color}` }}>
            <div style={{ fontSize: 22 }}>{stat.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[['orders','📦 Pedidos'],['stock','🗃️ Stock']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ ...s.tabBtn, ...(tab===id ? s.tabBtnActive : {}) }}>{label}</button>
        ))}
      </div>

      {tab === 'orders' && (
        <div>
          {orders.length === 0 && <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>No hay pedidos todavía.</p>}
          {orders.map(o => (
            <div key={o.id} style={{ ...s.orderCard, ...(scannedOrder?.id === o.id ? { border: '2px solid #27ae60' } : {}), ...(o.status === 'cash_pending' ? { border: '2px solid #8e44ad', background: '#fdf8ff' } : {}) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'serif', fontSize: 17, fontWeight: 800, color: '#2c1810' }}>{o.code}</span>
                <span style={{ ...s.statusBadge, background: STATUS_COLOR[o.status] + '22', color: STATUS_COLOR[o.status] }}>{STATUS_LABEL[o.status]}</span>
                <span style={{ fontSize: 12, color: '#888' }}>👤 {o.user_username}</span>
                <span style={{ fontSize: 12, color: '#888' }}>🕐 {o.time_slot_label}</span>
                <span style={{ marginLeft: 'auto', color: '#c0392b', fontWeight: 800 }}>{fmt(o.total)}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {o.items.map(i => <span key={i.id} style={s.itemChip}>{i.product_emoji} {i.quantity}× {i.product_name}</span>)}
              </div>
              {o.payment && (
                <div style={{ fontSize: 12, color: o.status === 'cash_pending' ? '#8e44ad' : '#27ae60', fontWeight: 600, marginBottom: 8 }}>
                  {o.status === 'cash_pending' ? '⏳' : '✅'} {o.payment.method === 'card' ? `${o.payment.card_info?.brand} ****${o.payment.card_info?.last4}` : 'Efectivo'} · {o.payment.transaction_ref}
                  {o.payment.cash_tendered && <span style={{ marginLeft: 8, color: '#888', fontWeight: 400 }}>entrega {fmt(o.payment.cash_tendered)} · cambio {fmt(o.payment.cash_change)}</span>}
                </div>
              )}
              {/* Botón destacado para confirmar pago en efectivo */}
              {o.status === 'cash_pending' && (
                <button onClick={() => confirmCash(o.id)}
                  style={{ background: '#8e44ad', color: 'white', border: 'none', borderRadius: 9, padding: '10px 18px', cursor: 'pointer', fontWeight: 700, fontSize: 14, marginBottom: 10, width: '100%' }}>
                  💵 Confirmar pago en efectivo
                </button>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(STATUS_LABEL).map(([st, label]) => (
                  <button key={st} onClick={() => setStatus(o.id, st)}
                    style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: o.status===st ? STATUS_COLOR[st] : '#f0e6d3', color: o.status===st ? 'white' : '#555' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'stock' && (
        <div>
          {/* Botón añadir producto */}
          <button onClick={() => setShowNewProduct(v => !v)}
            style={{ width: '100%', background: showNewProduct ? '#f0e6d3' : '#2c1810', color: showNewProduct ? '#2c1810' : '#f5d49a', border: 'none', borderRadius: 12, padding: '13px', cursor: 'pointer', fontWeight: 700, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {showNewProduct ? '✕ Cancelar' : '+ Añadir nuevo producto'}
          </button>

          {/* Formulario nuevo producto */}
          {showNewProduct && (
            <div style={{ background: 'white', borderRadius: 16, padding: '20px', marginBottom: 16, border: '2px solid #c0392b', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
              <h3 style={{ ...s.sectionTitle, marginBottom: 16 }}>🆕 Nuevo producto</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={s.label}>Nombre *</label>
                  <input style={s.input} placeholder="Ej: Pizza margarita" value={newProduct.name}
                    onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label style={s.label}>Precio (€) *</label>
                  <input style={s.input} type="number" min="0" step="0.10" placeholder="2.50" value={newProduct.price}
                    onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} />
                </div>
                <div>
                  <label style={s.label}>Emoji</label>
                  <input style={s.input} placeholder="🍕" value={newProduct.emoji}
                    onChange={e => setNewProduct(p => ({ ...p, emoji: e.target.value }))} />
                </div>
                <div>
                  <label style={s.label}>Stock inicial</label>
                  <input style={s.input} type="number" min="0" placeholder="10" value={newProduct.stock}
                    onChange={e => setNewProduct(p => ({ ...p, stock: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={s.label}>Categoría</label>
                <select style={{ ...s.input, background: 'white' }} value={newProduct.category}
                  onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}>
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <input type="checkbox" id="healthy" checked={newProduct.healthy}
                  onChange={e => setNewProduct(p => ({ ...p, healthy: e.target.checked }))} style={{ width: 16, height: 16 }} />
                <label htmlFor="healthy" style={{ fontSize: 14, color: '#555', cursor: 'pointer' }}>🥗 Producto saludable</label>
              </div>
              <button onClick={handleCreateProduct} disabled={savingProduct}
                style={{ ...s.btnPrimary, opacity: savingProduct ? 0.6 : 1 }}>
                {savingProduct ? 'Guardando…' : '✅ Añadir al menú'}
              </button>
            </div>
          )}

          {/* Lista de productos */}
          <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 36px', padding: '12px 18px', background: '#2c1810', color: '#f5d49a', fontWeight: 700, fontSize: 13 }}>
              <span>Producto</span><span>Stock</span><span>Estado</span><span></span>
            </div>
            {products.map((p, idx) => {
              const color = p.stock === 0 ? '#c0392b' : p.stock <= 5 ? '#e67e22' : '#27ae60'
              return (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 36px', alignItems: 'center', padding: '11px 18px', borderBottom: idx < products.length-1 ? '1px solid #f0e6d3' : 'none', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.emoji} {p.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => setStock(p.id, p.stock-1)} style={s.qtyBtn}>−</button>
                    <input type="number" value={p.stock} min="0"
                      style={{ width: 40, textAlign: 'center', border: '1px solid #ddd', borderRadius: 6, padding: '3px', fontSize: 13, fontWeight: 700 }}
                      onChange={e => setStock(p.id, parseInt(e.target.value)||0)} />
                    <button onClick={() => setStock(p.id, p.stock+1)} style={s.qtyBtn}>+</button>
                  </div>
                  <span style={{ background: color+'22', color, borderRadius: 6, padding: '3px 7px', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
                    {p.stock === 0 ? 'Agotado' : p.stock <= 5 ? 'Bajo' : 'OK'}
                  </span>
                  <button onClick={() => handleDeleteProduct(p.id, p.name)}
                    title="Eliminar del menú"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: 18, padding: 0, lineHeight: 1 }}>
                    🗑️
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showScanner && <QRScannerModal onClose={() => setShowScanner(false)} onScanned={handleScanned} showToast={showToast} />}
    </div>
  )
}

/* ═══════════════════════════════════════════════
   APP PRINCIPAL
   ═══════════════════════════════════════════════ */
export default function App() {
  const [user, setUser]               = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [view, setView]               = useState('menu')
  const [cart, setCart]               = useState([])
  const [toast, setToast]             = useState(null)
  const [payingOrder, setPayingOrder] = useState(null)

  useEffect(() => { api.me().then(setUser).catch(() => {}).finally(() => setAuthLoading(false)) }, [])

  const showToast = useCallback((message, type = 'ok') => setToast({ message, type }), [])

  const handleLogout = async () => {
    await api.logout().catch(() => {})
    localStorage.removeItem('access_token')
    setUser(null); setCart([]); setView('menu')
  }

  const handlePaymentDone = useCallback(() => { setPayingOrder(null) }, [])

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#fdf6ee' }}>
      <Spinner />
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #fdf6ee; color: #2c1810; }
        @keyframes spin { to { transform: rotate(360deg); } }
        input, button { font-family: inherit; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #c0392b; border-radius: 3px; }
        button:hover { filter: brightness(1.06); }
        .desktop-nav { display: flex !important; }
        .desktop-only { display: flex !important; }
        .mobile-only { display: none !important; }
        @media (max-width: 700px) {
          .desktop-nav { display: none !important; }
          .desktop-only { display: none !important; }
          .mobile-only { display: flex !important; }
        }
      `}</style>

      {!user
        ? <LoginPage onLogin={setUser} showToast={showToast} />
        : (
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Topbar user={user} cartCount={cart.reduce((s,i) => s+i.qty, 0)} view={view} setView={setView} onLogout={handleLogout} />
            <main style={{ flex: 1 }}>
              {view === 'menu'    && <MenuPage cart={cart} setCart={setCart} showToast={showToast} />}
              {view === 'cart'    && <CartPage cart={cart} setCart={setCart} showToast={showToast} setView={setView} setPayingOrder={setPayingOrder} />}
              {view === 'orders'  && <OrdersPage showToast={showToast} setView={setView} setPayingOrder={setPayingOrder} />}
              {view === 'wallet'  && <WalletPage showToast={showToast} />}
              {view === 'payment' && payingOrder && <PaymentPage order={payingOrder} showToast={showToast} setView={setView} onPaymentDone={handlePaymentDone} />}
              {view === 'admin'   && user.role === 'admin' && <AdminPage showToast={showToast} />}
            </main>
          </div>
        )
      }
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </>
  )
}

/* ═══════════════════════════════════════════════
   ESTILOS
   ═══════════════════════════════════════════════ */
const s = {
  loginWrap:    { minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #c0392b 0%, #8b1a1a 50%, #2c1810 100%)', padding: 16 },
  loginCard:    { background: 'white', padding: '36px 30px', borderRadius: 20, width: 420, maxWidth: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  loginTitle:   { fontFamily: "'Playfair Display', serif", fontSize: 28, color: '#2c1810', marginBottom: 2 },
  topbar:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 62, background: '#2c1810', boxShadow: '0 3px 16px rgba(0,0,0,0.3)', position: 'sticky', top: 0, zIndex: 100, gap: 10, flexWrap: 'nowrap' },
  topbarTitle:  { fontFamily: "'Playfair Display', serif", color: '#f5d49a', fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap' },
  topbarNav:    { gap: 2, flex: 1, justifyContent: 'center', flexWrap: 'wrap' },
  navBtn:       { background: 'transparent', border: 'none', color: '#c9a96e', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' },
  navBtnActive: { background: '#c0392b', color: 'white' },
  cartBtn:      { background: '#c0392b', border: 'none', color: 'white', cursor: 'pointer', padding: '7px 12px', borderRadius: 8, fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' },
  cartBadge:    { background: '#f5d49a', color: '#2c1810', borderRadius: '50%', padding: '1px 6px', fontSize: 11, fontWeight: 800, marginLeft: 4 },
  userChip:     { alignItems: 'center', gap: 6, background: '#3d2415', borderRadius: 8, padding: '5px 10px' },
  roleBadge:    { background: '#c0392b', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' },
  btnLogout:    { background: 'transparent', border: '1px solid #c9a96e55', color: '#c9a96e', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' },
  page:         { maxWidth: 940, margin: '0 auto', padding: '24px 14px' },
  pageTitle:    { fontFamily: "'Playfair Display', serif", fontSize: 26, color: '#2c1810', marginBottom: 22 },
  sectionTitle: { fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#2c1810', marginBottom: 10 },
  chip:         { padding: '5px 12px', borderRadius: 999, border: '1.5px solid #e0d3c8', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#555' },
  chipActive:   { background: '#c0392b', color: 'white', border: '1.5px solid #c0392b' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 14 },
  productCard:  { background: 'white', borderRadius: 16, padding: '16px 12px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, border: '1px solid #f0e6d3' },
  badgeGreen:   { background: '#e8f8f0', color: '#27ae60', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700 },
  badgeGray:    { background: '#f0e6d3', color: '#7b5e52', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 600 },
  btnFav:       { background: '#fff8f0', border: '1.5px solid #f0e6d3', cursor: 'pointer', padding: '6px 9px', borderRadius: 8, fontSize: 17, flexShrink: 0 },
  btnAdd:       { flex: 1, background: '#c0392b', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '8px 4px', fontSize: 12, fontWeight: 700 },
  favChip:      { display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1.5px solid #f0e6d3', borderRadius: 12, padding: '9px 13px', cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' },
  cartItem:     { display: 'flex', alignItems: 'center', gap: 12, background: 'white', borderRadius: 14, padding: '13px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #f0e6d3' },
  qtyBtn:       { background: '#f0e6d3', border: 'none', cursor: 'pointer', width: 28, height: 28, borderRadius: 7, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  slotBtn:      { border: '2px solid #e0d3c8', background: 'white', borderRadius: 12, padding: '13px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#555' },
  slotBtnActive:{ border: '2px solid #c0392b', background: '#c0392b', color: 'white' },
  orderCard:    { background: 'white', borderRadius: 14, padding: '16px 20px', marginBottom: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #f0e6d3' },
  statusBadge:  { borderRadius: 7, padding: '3px 9px', fontSize: 12, fontWeight: 700 },
  itemChip:     { background: '#f0e6d3', color: '#2c1810', borderRadius: 7, padding: '3px 9px', fontSize: 12, fontWeight: 600 },
  tabBtn:       { padding: '8px 20px', borderRadius: 8, border: '2px solid #f0e6d3', background: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#555' },
  tabBtnActive: { border: '2px solid #c0392b', background: '#c0392b', color: 'white' },
  label:        { fontSize: 11, fontWeight: 700, color: '#7b5e52', marginBottom: 5, display: 'block', width: '100%', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input:        { width: '100%', padding: '11px 13px', border: '1.5px solid #e0d3c8', borderRadius: 10, fontSize: 14, marginBottom: 13, background: '#fffaf5', display: 'block' },
  errorBox:     { background: '#fdf0ee', border: '1px solid #e0b0a8', color: '#c0392b', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12, width: '100%' },
  fieldError:   { fontSize: 11, color: '#c0392b', marginTop: -9, marginBottom: 9 },
  btnPrimary:   { width: '100%', padding: '13px', background: '#c0392b', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 700, marginBottom: 8, display: 'block' },
  btnSecondary: { width: '100%', padding: '11px', background: '#f0e6d3', color: '#2c1810', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, marginBottom: 8 },
}
