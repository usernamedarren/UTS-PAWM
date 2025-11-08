import express from 'express'
// Import DB so it initializes on server start (connects to Railway when DATABASE_URL is present)
import db from './db.js'
import path, { dirname } from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const app = express()
const PORT = process.env.PORT || 5003

// Global handlers to log unexpected errors and process exit reasons during local debugging.
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION', err && (err.stack || err))
})
process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION', reason && (reason.stack || reason))
})
process.on('exit', (code) => {
    console.log('PROCESS EXIT', code)
})

// Get the file path from the URL of the current module
const __filename = fileURLToPath(import.meta.url)
// Get the directory name from the file path
const __dirname = dirname(__filename)

// Middleware
app.use(express.json())
// If a request targets a top-level image file (e.g. /logo-inverse.png) but the file
// actually lives in `public/assets`, this middleware will serve it from there.
app.use((req, res, next) => {
    // Only consider requests for common static image file types at the project root
    if (!req.path || req.path.startsWith('/assets') || req.path.startsWith('/src') ) return next()
    const ext = path.extname(req.path).toLowerCase()
    const imageExts = ['.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp', '.gif']
    if (!imageExts.includes(ext)) return next()

    // Map to public/assets/<basename>
    const fileName = path.basename(req.path)
    const assetPath = path.join(__dirname, '../public/assets', fileName)
    if (fs.existsSync(assetPath)) {
        return res.sendFile(assetPath)
    }
    return next()
})
// NOTE: Jangan taruh express.static di sini karena akan menangkap request '/' dan langsung
// mengirim index.html mentah (placeholder kosong) sebelum kita sempat inject komponen.
// Kita pindahkan ke bawah SETELAH route yang merender halaman.

// Serving up the HTML file from the /public directory
// Server-side page assembler: reads index.html and injects component HTML
async function loadComponentHtml(name) {
    const p = path.join(__dirname, '../public/components', name)
    try {
        return await fs.promises.readFile(p, 'utf8')
    } catch (e) {
        console.warn('Component not found:', name, e && e.message)
        return ''
    }
}

function renderCapsterCards(capster) {
    if (!Array.isArray(capster) || capster.length === 0) {
        return '<p class="muted">Belum ada data capster.</p>'
    }
    return capster.map((c, idx) => {
        const name = c.name || ''
        const alias = c.alias || ''
        const description = c.description || ''
        const insta = c.instaAcc || c.insta || ''
        const imgSrc = c.image_url || c.image || `/assets/capster-${(idx % 3) + 1}.png`
        const delay = (idx + 1) * 0.1
        return `
          <article class="capster-card fade-in-up" style="animation-delay: ${delay}s">
            <figure>
              <img src="${imgSrc}" alt="Foto Capster ${escapeHtml(name)}">
            </figure>
            <div class="capster-info">
              <h4>${escapeHtml(name)} ${alias ? `<span>a.k.a ${escapeHtml(alias)}</span>` : ''}</h4>
              <p>${escapeHtml(description)}</p>
              <div class="capster-social">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                <span>@${escapeHtml(insta)}</span>
              </div>
            </div>
          </article>
        `
    }).join('')
}

function escapeHtml(s){
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
}

async function assemblePage(sectionToScroll) {
    const indexPath = path.join(__dirname, '../public', 'index.html')
    let html = await fs.promises.readFile(indexPath, 'utf8')

    // load components in parallel
    const compNames = {
        splash: 'splash.html',
        navbar: 'navbar.html',
        footer: 'footer.html',
        loginModal: 'loginModal.html',
        registerModal: 'registerModal.html',
        hairPricelistModal: 'hairPricelistModal.html',
        specialPricelistModal: 'specialPricelistModal.html',
        home: 'home.html',
        about: 'about.html',
        services: 'services.html',
        capster: 'capster.html',
        testimonial: 'testimonial.html',
        book: 'book.html'
    }

    const comps = await Promise.all(Object.values(compNames).map(n => loadComponentHtml(n)))
    const compMap = {}
    let i = 0
    for (const k of Object.keys(compNames)) {
        compMap[k] = comps[i++] || ''
    }

    // For capster, inject server-side capster cards
    try {
        const capster = await db.getCapsters()
        const cards = renderCapsterCards(capster)
        // replace inner div of capster component
        compMap.capster = compMap.capster.replace(/<div\s+id="capster-list"[\s\S]*?<\/div>/i, `<div id="capster-list" class="capster-grid">${cards}</div>`)
    } catch (e) {
        console.warn('Failed to render capster cards on server:', e && e.message)
    }

    // Replace placeholders in index.html
    html = html.replace('<div id="navbar-placeholder"></div>', compMap.navbar)
    html = html.replace('<div id="footer-placeholder"></div>', compMap.footer)
    html = html.replace('<div id="modals-placeholder"></div>', (compMap.loginModal || '') + (compMap.registerModal || '') + (compMap.hairPricelistModal || '') + (compMap.specialPricelistModal || ''))
    html = html.replace('<div id="home-placeholder"></div>', compMap.home)
    html = html.replace('<div id="about-placeholder"></div>', compMap.about)
    html = html.replace('<div id="services-placeholder"></div>', compMap.services)
    html = html.replace('<div id="capster-placeholder"></div>', compMap.capster)
    html = html.replace('<div id="testimonial-placeholder"></div>', compMap.testimonial)
    html = html.replace('<div id="book-placeholder"></div>', compMap.book)

    // Inject splash screen at the very start of <body>, plus a small script signaling SSR
    const marker = '<body>'
    const splash = compMap.splash || ''
    // Replace Supabase placeholders in index.html after assembly
    const supaUrl = process.env.SUPABASE_URL || ''
    const supaAnon = process.env.SUPABASE_ANON_KEY || ''
    html = html.replace('%SUPABASE_URL%', supaUrl).replace('%SUPABASE_ANON_KEY%', supaAnon)
    const script = `\n<script>window.__serverRendered=true;window.__initialSection=${sectionToScroll?`'${sectionToScroll}'`:'null'};</script>\n`
    html = html.replace(marker, marker + '\n' + splash + script)

    return html
}

// Mount API routes (kept in src/routes)
import capsterRoutes from './routes/capsterRoutes.js'
import accountsRoutes from './routes/accountsRoutes.js'
import servicesRoutes from './routes/servicesRoutes.js'
import appointmentsRoutes from './routes/appointmentsRoutes.js'
import authRoutes from './routes/authRoutes.js'

app.use('/api', capsterRoutes)
app.use('/api', accountsRoutes)
app.use('/api', servicesRoutes)
app.use('/api', appointmentsRoutes)
app.use('/api', authRoutes)

// Serve pages server-side so routing doesn't rely on main.js
app.get('/', async (req, res) => {
    try {
        const page = await assemblePage(null)
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        return res.send(page)
    } catch (e) {
        console.error('Failed to serve page /', e)
        return res.status(500).send('Server error')
    }
})

const sections = ['about','services','capster','testimonial','book']
for (const sec of sections) {
    app.get('/' + sec, async (req, res) => {
        try {
            const page = await assemblePage(sec)
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            return res.send(page)
        } catch (e) {
            console.error('Failed to serve page /' + sec, e)
            return res.status(500).send('Server error')
        }
    })
}

// In Vercel serverless, we don't start a listener. Vercel sets VERCEL=1.
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server has started on port: ${PORT}`)
    })
}

// Setelah semua server-side rendering route dipasang, baru serve static assets.
// Ini memastikan request ke '/' memakai assemblePage, bukan file mentah.
app.use(express.static(path.join(__dirname, '../public')))
app.use('/assets', express.static(path.join(__dirname, '../public/assets')))

// Export handler for Vercel Serverless Functions
export default function handler(req, res) {
    return app(req, res)
}