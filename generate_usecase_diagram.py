import os
import pymupdf

def create_svg():
    W, H = 2250, 1480

    svg = []
    svg.append(f'''<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
    <defs>
        <!-- Background Gradient -->
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0a0f1d"/>
            <stop offset="40%" stop-color="#111827"/>
            <stop offset="100%" stop-color="#030712"/>
        </linearGradient>

        <!-- System Boundary Gradient -->
        <linearGradient id="sysBoxGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#172033" stop-opacity="0.95"/>
            <stop offset="100%" stop-color="#0d1527" stop-opacity="0.98"/>
        </linearGradient>

        <!-- Module Use Case Gradients -->
        <!-- 1. Kamera & Shoot (Blue / Cyan) -->
        <linearGradient id="ucCamera" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0369a1"/>
            <stop offset="100%" stop-color="#075985"/>
        </linearGradient>

        <!-- 2. Personalisasi & Styling (Purple / Violet) -->
        <linearGradient id="ucStyle" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#6d28d9"/>
            <stop offset="100%" stop-color="#5b21b6"/>
        </linearGradient>

        <!-- 3. Output & Sharing (Emerald / Teal) -->
        <linearGradient id="ucOutput" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#047857"/>
            <stop offset="100%" stop-color="#065f46"/>
        </linearGradient>

        <!-- 4. Autentikasi (Amber / Gold) -->
        <linearGradient id="ucAuth" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#b45309"/>
            <stop offset="100%" stop-color="#92400e"/>
        </linearGradient>

        <!-- 5. Admin & Security (Rose / Crimson) -->
        <linearGradient id="ucAdmin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#be123c"/>
            <stop offset="100%" stop-color="#9f1239"/>
        </linearGradient>

        <!-- Glow & Shadow Filters -->
        <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.6"/>
        </filter>
        <filter id="subtleShadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.4"/>
        </filter>

        <!-- Arrow Markers -->
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#94a3b8" />
        </marker>
        <marker id="arrowInclude" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
        </marker>
        <marker id="arrowExtend" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#c084fc" />
        </marker>
        <marker id="generalizeArrow" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
            <path d="M 0 1 L 13 7 L 0 13 z" fill="#1e293b" stroke="#38bdf8" stroke-width="2" />
        </marker>
    </defs>

    <!-- Canvas Background -->
    <rect width="{W}" height="{H}" fill="url(#bgGrad)"/>
    
    <!-- Tech Grid Background -->
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="0.7" stroke-opacity="0.5"/>
    </pattern>
    <rect width="{W}" height="{H}" fill="url(#grid)"/>

    <!-- ========================================== -->
    <!-- HEADER & TITLE                             -->
    <!-- ========================================== -->
    <g transform="translate(1125, 40)" text-anchor="middle">
        <text font-size="28" font-weight="900" fill="#f8fafc" letter-spacing="2">USE CASE DIAGRAM: SISTEM PHOTOBOOTH WEB</text>
        <text y="26" font-size="14" font-weight="500" fill="#94a3b8" letter-spacing="0.5">Arsitektur Fungsional Sistem Berbasis Web (Node.js Express + XAMPP MySQL / SQLite Fallback)</text>
    </g>

    <!-- ========================================== -->
    <!-- SYSTEM BOUNDARY BOX                        -->
    <!-- ========================================== -->
    <rect x="270" y="105" width="1550" height="1235" rx="22" fill="url(#sysBoxGrad)" stroke="#38bdf8" stroke-width="2" stroke-dasharray="8 5" filter="url(#dropShadow)"/>
    
    <!-- System Boundary Label Tag -->
    <g transform="translate(295, 135)">
        <rect x="0" y="-18" width="310" height="32" rx="8" fill="#0284c7" filter="url(#subtleShadow)"/>
        <text x="14" y="3" font-size="13.5" font-weight="700" fill="#ffffff" letter-spacing="0.8">SYSTEM: Photobooth Studio Web App</text>
    </g>

    <!-- Section Category Containers inside System Boundary -->
    <!-- Container 1: Modul Kamera & Pemotretan (Top Left) -->
    <rect x="300" y="160" width="455" height="355" rx="14" fill="#0b1329" stroke="#0284c7" stroke-width="1.2" stroke-opacity="0.5"/>
    <rect x="315" y="172" width="235" height="24" rx="6" fill="#0369a1" opacity="0.3"/>
    <text x="325" y="189" font-size="12" font-weight="800" fill="#38bdf8" letter-spacing="0.6">[MODUL 1] KAMERA &amp; PEMOTRETAN</text>

    <!-- Container 2: Modul Kustomisasi & Desain (Bottom Left) -->
    <rect x="300" y="535" width="455" height="485" rx="14" fill="#0b1329" stroke="#7c3aed" stroke-width="1.2" stroke-opacity="0.5"/>
    <rect x="315" y="547" width="230" height="24" rx="6" fill="#6d28d9" opacity="0.3"/>
    <text x="325" y="564" font-size="12" font-weight="800" fill="#c084fc" letter-spacing="0.6">[MODUL 2] KUSTOMISASI &amp; FRAME</text>

    <!-- Container 3: Modul Ekspor, QR & Galeri (Top Center) -->
    <rect x="785" y="160" width="475" height="425" rx="14" fill="#0b1329" stroke="#059669" stroke-width="1.2" stroke-opacity="0.5"/>
    <rect x="800" y="172" width="235" height="24" rx="6" fill="#047857" opacity="0.3"/>
    <text x="810" y="189" font-size="12" font-weight="800" fill="#34d399" letter-spacing="0.6">[MODUL 3] EKSPOR, QR &amp; GALERI</text>

    <!-- Container 4: Modul Autentikasi Pengguna (Bottom Center) -->
    <rect x="785" y="605" width="475" height="415" rx="14" fill="#0b1329" stroke="#d97706" stroke-width="1.2" stroke-opacity="0.5"/>
    <rect x="800" y="617" width="235" height="24" rx="6" fill="#b45309" opacity="0.3"/>
    <text x="810" y="634" font-size="12" font-weight="800" fill="#fbbf24" letter-spacing="0.6">[MODUL 4] AUTENTIKASI PENGGUNA</text>

    <!-- Container 5: Modul Administrasi & Keamanan (Right Column) -->
    <rect x="1290" y="160" width="505" height="860" rx="14" fill="#0b1329" stroke="#e11d48" stroke-width="1.2" stroke-opacity="0.5"/>
    <rect x="1305" y="172" width="280" height="24" rx="6" fill="#be123c" opacity="0.3"/>
    <text x="1315" y="189" font-size="12" font-weight="800" fill="#fb7185" letter-spacing="0.6">[MODUL 5] ADMINISTRASI &amp; KEAMANAN</text>
''')

    # Helper function for Use Case Ellipses
    def draw_uc(id_tag, cx, cy, rx, ry, grad_id, stroke_color, line1, line2=None):
        out = []
        out.append(f'<g id="{id_tag}" filter="url(#subtleShadow)">')
        out.append(f'  <ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#{grad_id})" stroke="{stroke_color}" stroke-width="1.8"/>')
        if line2:
            out.append(f'  <text x="{cx}" y="{cy-5}" font-size="12.5" font-weight="700" fill="#ffffff" text-anchor="middle">{line1}</text>')
            out.append(f'  <text x="{cx}" y="{cy+13}" font-size="11.5" font-weight="500" fill="#e2e8f0" text-anchor="middle">{line2}</text>')
        else:
            out.append(f'  <text x="{cx}" y="{cy+4}" font-size="12.5" font-weight="700" fill="#ffffff" text-anchor="middle">{line1}</text>')
        out.append('</g>')
        return '\n'.join(out)

    # Actor Stick Figure Function
    def draw_actor(x, y, name, role_desc, color="#f8fafc"):
        out = []
        out.append(f'<g transform="translate({x}, {y})" filter="url(#dropShadow)">')
        # Background pill for name
        out.append(f'  <rect x="-85" y="70" width="170" height="42" rx="8" fill="#1e293b" stroke="{color}" stroke-width="1.6"/>')
        out.append(f'  <text x="0" y="87" font-size="13" font-weight="700" fill="{color}" text-anchor="middle">{name}</text>')
        out.append(f'  <text x="0" y="103" font-size="10" font-weight="500" fill="#94a3b8" text-anchor="middle">{role_desc}</text>')
        # Head
        out.append(f'  <circle cx="0" cy="0" r="18" fill="#0f172a" stroke="{color}" stroke-width="2.8"/>')
        # Body
        out.append(f'  <line x1="0" y1="18" x2="0" y2="50" stroke="{color}" stroke-width="2.8" stroke-linecap="round"/>')
        # Arms
        out.append(f'  <line x1="-24" y1="28" x2="24" y2="28" stroke="{color}" stroke-width="2.8" stroke-linecap="round"/>')
        # Legs
        out.append(f'  <line x1="0" y1="50" x2="-20" y2="76" stroke="{color}" stroke-width="2.8" stroke-linecap="round"/>')
        out.append(f'  <line x1="0" y1="50" x2="20" y2="76" stroke="{color}" stroke-width="2.8" stroke-linecap="round"/>')
        out.append('</g>')
        return '\n'.join(out)

    # Database Server Node Icon
    def draw_db_server(x, y, name, subtext):
        out = []
        out.append(f'<g transform="translate({x}, {y})" filter="url(#dropShadow)">')
        out.append(f'  <rect x="-95" y="-60" width="190" height="120" rx="12" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>')
        out.append(f'  <text x="0" y="-36" font-size="10.5" font-weight="700" fill="#38bdf8" text-anchor="middle">&lt;&lt;secondary actor&gt;&gt;</text>')
        out.append(f'  <text x="0" y="-14" font-size="13.5" font-weight="800" fill="#ffffff" text-anchor="middle">{name}</text>')
        out.append(f'  <text x="0" y="4" font-size="11" font-weight="500" fill="#94a3b8" text-anchor="middle">{subtext}</text>')
        # DB Stack Graphic
        for cy in [20, 34, 48]:
            out.append(f'  <ellipse cx="0" cy="{cy}" rx="32" ry="6.5" fill="#0284c7" stroke="#38bdf8" stroke-width="1.2"/>')
        out.append('</g>')
        return '\n'.join(out)

    # ==========================================
    # USE CASES DEFINITION
    # ==========================================
    # Group 1: Kamera & Shoot
    svg.append(draw_uc("UC1", 440, 245, 115, 32, "ucCamera", "#38bdf8", "Mengambil Foto", "(Multi-shot Capture)"))
    svg.append(draw_uc("UC2", 665, 245, 75, 27, "ucCamera", "#38bdf8", "Countdown Timer", "(3s, 5s, 10s)"))
    svg.append(draw_uc("UC3", 440, 345, 105, 30, "ucCamera", "#38bdf8", "Retake / Ulangi Foto"))
    svg.append(draw_uc("UC4", 655, 345, 85, 27, "ucCamera", "#38bdf8", "Beralih Kamera", "(Front / Back)"))
    svg.append(draw_uc("UC_P1", 525, 445, 130, 28, "ucCamera", "#38bdf8", "Atur Sesi Multi-Shot", "(1, 2, 3, 4 Foto)"))

    # Group 2: Personalisasi & Styling
    svg.append(draw_uc("UC5", 525, 620, 140, 30, "ucStyle", "#c084fc", "Pilih Strip Layout & Grid", "(1x1, 2x2, 3-Strip, 4-Strip)"))
    svg.append(draw_uc("UC6", 525, 720, 145, 32, "ucStyle", "#c084fc", "Pilih Border & Slideshow", "(Color Picker / Slideshow)"))
    svg.append(draw_uc("UC7", 525, 820, 140, 30, "ucStyle", "#c084fc", "Terapkan Filter & Efek", "(B&W, Vintage, Cyber, Warm)"))
    svg.append(draw_uc("UC8", 525, 920, 140, 30, "ucStyle", "#c084fc", "Tambahkan Stiker & Teks", "(Emoji, Custom Caption, Date)"))

    # Group 3: Output, Sharing & Galeri
    svg.append(draw_uc("UC9", 1020, 240, 145, 30, "ucOutput", "#34d399", "Unduh Soft-File Hasil Foto", "(Format PNG Berkualitas Tinggi)"))
    svg.append(draw_uc("UC10", 1020, 330, 140, 30, "ucOutput", "#34d399", "Generate QR Code Soft-File", "(Akses Unduh via Smartphone)"))
    svg.append(draw_uc("UC11", 1020, 420, 130, 28, "ucOutput", "#34d399", "Cetak Foto Langsung", "(Printer Kiosk / Studio Strip)"))
    svg.append(draw_uc("UC12", 1020, 510, 140, 30, "ucOutput", "#34d399", "Simpan ke Galeri Studio", "(Katalog Foto & Pratinjau)"))

    # Group 4: Autentikasi Pengguna
    svg.append(draw_uc("UC13", 1020, 680, 135, 28, "ucAuth", "#fbbf24", "Registrasi Akun Baru", "(Validasi Sandi & Anti-XSS)"))
    svg.append(draw_uc("UC14", 1020, 770, 145, 32, "ucAuth", "#fbbf24", "Login ke Sistem Photobooth", "(Password, Google, Apple, Tamu)"))
    svg.append(draw_uc("UC15", 1020, 860, 130, 28, "ucAuth", "#fbbf24", "Ubah Password Akun"))
    svg.append(draw_uc("UC16", 1020, 950, 125, 28, "ucAuth", "#fbbf24", "Logout Sesi Pengguna"))

    # Group 5: Admin & Security
    svg.append(draw_uc("UC17", 1540, 240, 155, 32, "ucAdmin", "#fb7185", "Kelola Pengguna (RBAC)", "(Lihat User, Ganti Role, Hapus User)"))
    svg.append(draw_uc("UC18", 1540, 350, 150, 32, "ucAdmin", "#fb7185", "Moderasi Seluruh Galeri", "(Hapus Foto Melanggar Aturan)"))
    svg.append(draw_uc("UC19", 1540, 465, 155, 34, "ucAdmin", "#fb7185", "Monitoring Koneksi Database", "(XAMPP MySQL / SQLite Fallback)"))
    svg.append(draw_uc("UC20", 1540, 590, 155, 34, "ucAdmin", "#fb7185", "Proteksi Keamanan Sistem", "(Rate Limit, Magic Bytes, CSP)"))
    svg.append(draw_uc("UC21", 1540, 715, 145, 30, "ucAdmin", "#fb7185", "Cek Status Server (/health)", "(Node.js Runtime & Memory Cap)"))

    # ==========================================
    # ACTORS
    # ==========================================
    # Actor 1: Pengguna / Tamu (Left)
    svg.append(draw_actor(130, 540, "Pengguna / Tamu", "(User / Studio Guest)", color="#38bdf8"))

    # Actor 2: Administrator (Top Right)
    svg.append(draw_actor(2050, 250, "Administrator", "(Super Admin / Operator)", color="#fb7185"))

    # Actor 3: Database Server (Bottom Right)
    svg.append(draw_db_server(2050, 790, "XAMPP MySQL / SQLite", "Dual DB Engine (Port 3306)"))

    # Generalization line: Admin -> Pengguna (Admin inherits all user capabilities)
    svg.append('''
    <!-- Generalization: Admin inherits Pengguna -->
    <path d="M 1970 230 C 1800 65, 450 65, 160 490" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#generalizeArrow)"/>
    <g transform="translate(1500, 85)">
        <rect x="-95" y="-12" width="190" height="24" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="1.2"/>
        <text x="0" y="4" font-size="11" font-weight="700" fill="#38bdf8" text-anchor="middle">&lt;&lt;generalization&gt;&gt; (inherits User)</text>
    </g>
    ''')

    # ==========================================
    # ASSOCIATION LINES (Actor to Use Cases)
    # ==========================================
    svg.append('<!-- Association Lines: Pengguna to Modul 1 & 2 -->')
    user_direct_col1 = [
        (440 - 115, 245), # UC1
        (525 - 130, 445), # UC_P1
        (525 - 140, 620), # UC5
        (525 - 145, 720), # UC6
        (525 - 140, 820), # UC7
        (525 - 140, 920), # UC8
    ]
    for tx, ty in user_direct_col1:
        svg.append(f'<line x1="170" y1="565" x2="{tx}" y2="{ty}" stroke="#475569" stroke-width="1.8" opacity="0.85"/>')

    # Routing lines to Modul 3 & 4 via the clear corridor between Modul 1 and Modul 2 (around y=520)
    # This guarantees lines NEVER cross or intersect any use case ellipse!
    svg.append('<!-- Association Lines: Pengguna to Modul 3 & 4 via Central Clear Channel -->')
    user_channeled_col2 = [
        (1020 - 145, 240, 520, 240), # UC9
        (1020 - 130, 420, 520, 380), # UC11
        (1020 - 140, 510, 520, 510), # UC12
        (1020 - 135, 680, 525, 680), # UC13
        (1020 - 145, 770, 525, 770), # UC14
        (1020 - 130, 860, 525, 860), # UC15
        (1020 - 125, 950, 525, 950), # UC16
    ]
    for tx, ty, mid_y, end_ctrl_y in user_channeled_col2:
        # Smooth S-curve: (170, 565) -> (770, mid_y) -> (tx, ty)
        svg.append(f'<path d="M 170 565 C 500 {mid_y}, 740 {mid_y}, 770 {mid_y} S 840 {end_ctrl_y}, {tx} {ty}" fill="none" stroke="#475569" stroke-width="1.6" opacity="0.75"/>')

    # Association Lines: Admin to Admin Use Cases
    svg.append('<!-- Association Lines: Admin to Admin Use Cases -->')
    admin_links = [
        (1540 + 155, 240), # UC17
        (1540 + 150, 350), # UC18
        (1540 + 155, 465), # UC19
        (1540 + 155, 590), # UC20
        (1540 + 145, 715), # UC21
    ]
    for tx, ty in admin_links:
        svg.append(f'<line x1="1970" y1="280" x2="{tx}" y2="{ty}" stroke="#f43f5e" stroke-width="2" opacity="0.9"/>')

    # Association Lines: Database Server to DB Use Cases
    svg.append('<!-- Association Lines: Database Server to Data Use Cases -->')
    db_links = [
        (1020 + 140, 510), # UC12 (Simpan Foto)
        (1020 + 135, 680), # UC13 (Registrasi)
        (1020 + 145, 770), # UC14 (Login Verifikasi)
        (1020 + 130, 860), # UC15 (Ubah Sandi)
        (1540 + 155, 240), # UC17 (Kelola User DB)
        (1540 + 150, 350), # UC18 (Moderasi Foto DB)
        (1540 + 155, 465), # UC19 (Status Koneksi DB)
    ]
    for tx, ty in db_links:
        svg.append(f'<line x1="1955" y1="790" x2="{tx}" y2="{ty}" stroke="#0ea5e9" stroke-width="1.8" stroke-dasharray="5 3" opacity="0.85"/>')

    # ==========================================
    # INCLUDE & EXTEND RELATIONSHIPS
    # ==========================================
    # UC1 -> UC2 (<<include>>)
    svg.append('''
    <!-- UC1 <<include>> UC2 -->
    <line x1="555" y1="245" x2="588" y2="245" stroke="#38bdf8" stroke-width="2" stroke-dasharray="5 3" marker-end="url(#arrowInclude)"/>
    <g transform="translate(572, 232)">
        <rect x="-35" y="-10" width="70" height="18" rx="4" fill="#0f172a" stroke="#0284c7" stroke-width="0.8"/>
        <text x="0" y="3" font-size="9.5" font-weight="800" fill="#38bdf8" text-anchor="middle">&lt;&lt;include&gt;&gt;</text>
    </g>
    ''')

    # UC3 -> UC1 (<<extend>>)
    svg.append('''
    <!-- UC3 <<extend>> UC1 -->
    <line x1="440" y1="315" x2="440" y2="280" stroke="#c084fc" stroke-width="2" stroke-dasharray="5 3" marker-end="url(#arrowExtend)"/>
    <g transform="translate(440, 298)">
        <rect x="-35" y="-9" width="70" height="18" rx="4" fill="#0f172a" stroke="#7c3aed" stroke-width="0.8"/>
        <text x="0" y="3.5" font-size="9.5" font-weight="800" fill="#c084fc" text-anchor="middle">&lt;&lt;extend&gt;&gt;</text>
    </g>
    ''')

    # UC4 -> UC1 (<<extend>>)
    svg.append('''
    <!-- UC4 <<extend>> UC1 -->
    <path d="M 590 330 C 540 305, 500 285, 480 278" fill="none" stroke="#c084fc" stroke-width="2" stroke-dasharray="5 3" marker-end="url(#arrowExtend)"/>
    <g transform="translate(545, 305)">
        <rect x="-35" y="-9" width="70" height="18" rx="4" fill="#0f172a" stroke="#7c3aed" stroke-width="0.8"/>
        <text x="0" y="3.5" font-size="9.5" font-weight="800" fill="#c084fc" text-anchor="middle">&lt;&lt;extend&gt;&gt;</text>
    </g>
    ''')

    # UC10 -> UC9 (<<extend>>)
    svg.append('''
    <!-- UC10 <<extend>> UC9 -->
    <line x1="1020" y1="300" x2="1020" y2="273" stroke="#34d399" stroke-width="2" stroke-dasharray="5 3" marker-end="url(#arrow)"/>
    <g transform="translate(1020, 287)">
        <rect x="-35" y="-9" width="70" height="18" rx="4" fill="#0f172a" stroke="#059669" stroke-width="0.8"/>
        <text x="0" y="3.5" font-size="9.5" font-weight="800" fill="#34d399" text-anchor="middle">&lt;&lt;extend&gt;&gt;</text>
    </g>
    ''')

    # ==========================================
    # FOOTER & LEGEND (KETERANGAN)
    # ==========================================
    svg.append('''
    <!-- Legend Box in bottom left -->
    <g transform="translate(300, 1055)">
        <rect width="720" height="255" rx="14" fill="#0b1329" stroke="#334155" stroke-width="1.5"/>
        <text x="22" y="28" font-size="13.5" font-weight="800" fill="#f8fafc" letter-spacing="0.5">LEGENDA MODUL APLIKASI (BERDASARKAN WARNA)</text>
        
        <circle cx="36" cy="62" r="10" fill="#0284c7"/>
        <text x="58" y="66" font-size="12" fill="#cbd5e1"><tspan font-weight="700" fill="#38bdf8">Kamera &amp; Pemotretan:</tspan> Multi-shot capture, timer otomatis, retake foto &amp; ganti kamera</text>

        <circle cx="36" cy="102" r="10" fill="#7c3aed"/>
        <text x="58" y="106" font-size="12" fill="#cbd5e1"><tspan font-weight="700" fill="#c084fc">Kustomisasi &amp; Frame:</tspan> Grid strip 1x1-4x4, border slideshow, tema frame, filter warna, stiker</text>

        <circle cx="36" cy="142" r="10" fill="#059669"/>
        <text x="58" y="146" font-size="12" fill="#cbd5e1"><tspan font-weight="700" fill="#34d399">Ekspor, QR &amp; Galeri:</tspan> Soft-file PNG HD, QR Code download via smartphone, cetak foto langsung</text>

        <circle cx="36" cy="182" r="10" fill="#d97706"/>
        <text x="58" y="186" font-size="12" fill="#cbd5e1"><tspan font-weight="700" fill="#fbbf24">Autentikasi Pengguna:</tspan> Registrasi, login multi-metode (Google/Apple/Guest/Sandi), ganti password</text>

        <circle cx="36" cy="222" r="10" fill="#e11d48"/>
        <text x="58" y="226" font-size="12" fill="#cbd5e1"><tspan font-weight="700" fill="#fb7185">Administrasi &amp; Keamanan:</tspan> RBAC User, moderasi galeri, dual DB (XAMPP/SQLite), security hardening</text>
    </g>

    <!-- Legend Notasi Relasi UML -->
    <g transform="translate(1040, 1055)">
        <rect width="755" height="255" rx="14" fill="#0b1329" stroke="#334155" stroke-width="1.5"/>
        <text x="22" y="28" font-size="13.5" font-weight="800" fill="#f8fafc" letter-spacing="0.5">NOTASI &amp; HUBUNGAN STANDARD UML</text>

        <!-- Association Line -->
        <line x1="32" y1="62" x2="95" y2="62" stroke="#475569" stroke-width="2.2"/>
        <text x="115" y="66" font-size="12" fill="#cbd5e1"><tspan font-weight="700" fill="#f8fafc">Asosiasi (Association):</tspan> Interaksi langsung antara aktor manusia dan use case fungsional</text>

        <!-- Include -->
        <line x1="32" y1="102" x2="95" y2="102" stroke="#38bdf8" stroke-width="2" stroke-dasharray="5 3"/>
        <text x="115" y="106" font-size="12" fill="#cbd5e1"><tspan font-weight="700" fill="#38bdf8">&lt;&lt;include&gt;&gt;:</tspan> Use case sumber wajib mengeksekusi use case target (contoh: Timer saat Capture)</text>

        <!-- Extend -->
        <line x1="32" y1="142" x2="95" y2="142" stroke="#c084fc" stroke-width="2" stroke-dasharray="5 3"/>
        <text x="115" y="146" font-size="12" fill="#cbd5e1"><tspan font-weight="700" fill="#c084fc">&lt;&lt;extend&gt;&gt;:</tspan> Fungsionalitas opsional bersyarat (contoh: Retake foto jika user ingin mengulang)</text>

        <!-- Generalization -->
        <line x1="32" y1="182" x2="95" y2="182" stroke="#38bdf8" stroke-width="2" stroke-dasharray="5 3"/>
        <text x="115" y="186" font-size="12" fill="#cbd5e1"><tspan font-weight="700" fill="#e2e8f0">&lt;&lt;generalization&gt;&gt;:</tspan> Pewarisan wewenang (Admin mewarisi seluruh kemampuan Pengguna)</text>

        <!-- DB Sync -->
        <line x1="32" y1="222" x2="95" y2="222" stroke="#0ea5e9" stroke-width="2" stroke-dasharray="4 2"/>
        <text x="115" y="226" font-size="12" fill="#cbd5e1"><tspan font-weight="700" fill="#38bdf8">Sinkronisasi Basis Data:</tspan> Transaksi query CRUD asynchronous ke XAMPP MySQL / SQLite</text>
    </g>
    ''')

    # Copyright & Watermark Footer
    svg.append(f'''
    <g transform="translate(1125, 1390)" text-anchor="middle">
        <text font-size="14" font-weight="700" fill="#94a3b8">Photobooth Studio Web Application &bull; UML Use Case Diagram Architecture</text>
        <text y="22" font-size="13" font-weight="600" fill="#38bdf8">Designed &amp; Copyright &copy; by Nadif Ahmad Fahrial</text>
    </g>
    ''')

    svg.append('</svg>')
    return '\n'.join(svg)

def main():
    svg_content = create_svg()
    
    svg_path = "usecase_diagram.svg"
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"[OK] Saved SVG diagram: {svg_path}")

    # Render to High-Resolution PNG using PyMuPDF
    doc = pymupdf.open(svg_path)
    page = doc[0]
    
    # Scale 1.5 for ultra-crisp photo (3375x2220)
    mat = pymupdf.Matrix(1.5, 1.5)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    
    png_path = "usecase_diagram.png"
    pix.save(png_path)
    print(f"[OK] Rendered High-Resolution PNG Photo: {png_path} ({pix.width}x{pix.height})")

if __name__ == "__main__":
    main()

