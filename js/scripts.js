const app = {
            data: null,
            currentSection: 'favorites',
            searchModal: null,
            playerModal: null,
            scheduleModal: null,
            hls: null,
            favorites: {
                channels: [],
                programs: []
            },
            cookieConsent: {
                bannerVisible: true,
                cookiesAccepted: false
            },
            officialLinks:[],

            async init() {
                this.searchModal = new bootstrap.Modal(document.getElementById('searchModal'));
                this.playerModal = new bootstrap.Modal(document.getElementById('playerModal'));
                this.scheduleModal = new bootstrap.Modal(document.getElementById('scheduleModal'));
                
                // Carica i preferiti dal localStorage
                this.loadFavorites();
                
                // Carica e mostra cookie banner se necessario
                this.loadCookieConsent();
                this.showCookieBanner();
                
                await this.loadData();
                this.updateTime();
                setInterval(() => this.updateTime(), 1000);
                
                document.getElementById('searchInput').addEventListener('input', (e) => {
                    this.search(e.target.value);
                });
            },

            // Gestione Cookie Consent
            loadCookieConsent() {
                try {
                    const stored = localStorage.getItem('guidatv_cookie_consent');
                    if (stored) {
                        this.cookieConsent = JSON.parse(stored);
                    }
                } catch (e) {
                    console.error('Errore caricamento cookie consent:', e);
                    this.cookieConsent = {
                        bannerVisible: true,
                        cookiesAccepted: false
                    };
                }
            },

            saveCookieConsent() {
                try {
                    localStorage.setItem('guidatv_cookie_consent', JSON.stringify(this.cookieConsent));
                } catch (e) {
                    console.error('Errore salvataggio cookie consent:', e);
                }
            },

            showCookieBanner() {
                // Mostra il banner solo se non è stato ancora accettato
                if (this.cookieConsent.bannerVisible) {
                    setTimeout(() => {
                        document.getElementById('cookieBanner').classList.add('show');
                    }, 1000);
                }
            },

            acceptCookies(acceptAll = false) {

                console.log("acceptCookies: " + acceptAll);

                this.cookieConsent.bannerVisible = false;
                this.cookieConsent.cookiesAccepted = acceptAll;
                this.saveCookieConsent();
                
                // Nascondi il banner
                document.getElementById('cookieBanner').classList.remove('show');
                
                // Se l'utente ha accettato tutto, carica gli script di profilazione
                if (acceptAll) {
                    this.loadTrackingScripts();
                }
            },

            loadTrackingScripts() {
                /**
                 * FUNZIONE PER CARICARE SCRIPT DI PROFILAZIONE
                 * Questa funzione viene chiamata solo se l'utente accetta tutti i cookie
                 * 
                 * Esempio di script da caricare:
                 * - Google Analytics
                 * - Facebook Pixel
                 * - Hotjar
                 * - Altri script di tracciamento
                 */
                
                console.log('✅ Utente ha accettato tutti i cookie - Carico script di profilazione');
                
                // ESEMPIO: Google Analytics
                /*
                (function() {
                    const script = document.createElement('script');
                    script.async = true;
                    script.src = 'https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID';
                    document.head.appendChild(script);
                    
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', 'GA_MEASUREMENT_ID');
                })();
                */
                
                // ESEMPIO: Facebook Pixel
                /*
                (function() {
                    !function(f,b,e,v,n,t,s)
                    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                    n.queue=[];t=b.createElement(e);t.async=!0;
                    t.src=v;s=b.getElementsByTagName(e)[0];
                    s.parentNode.insertBefore(t,s)}(window, document,'script',
                    'https://connect.facebook.net/en_US/fbevents.js');
                    fbq('init', 'YOUR_PIXEL_ID');
                    fbq('track', 'PageView');
                })();
                */
                
                // ESEMPIO: Hotjar
                /*
                (function(h,o,t,j,a,r){
                    h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                    h._hjSettings={hjid:YOUR_HOTJAR_ID,hjsv:6};
                    a=o.getElementsByTagName('head')[0];
                    r=o.createElement('script');r.async=1;
                    r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                    a.appendChild(r);
                })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
                */
                
                // Aggiungi qui i tuoi script di profilazione
            },

            // Gestione Preferiti
            loadFavorites() {
                try {
                    const stored = localStorage.getItem('guidatv_favorites');
                    if (stored) {
                        this.favorites = JSON.parse(stored);
                    }
                } catch (e) {
                    console.error('Errore caricamento preferiti:', e);
                    this.favorites = { channels: [], programs: [] };
                }
            },

            saveFavorites() {
                try {
                    localStorage.setItem('guardatv_favorites', JSON.stringify(this.favorites));
                } catch (e) {
                    console.error('Errore salvataggio preferiti:', e);
                }
            },

            toggleFavoriteChannel(channel) {
                const index = this.favorites.channels.findIndex(c => c.name === channel.name);
                if (index > -1) {
                    this.favorites.channels.splice(index, 1);
                } else {
                    this.favorites.channels.push({
                        name: channel.name,
                        logo: channel.logo,
                        playlist: channel.playlist
                    });
                }
                this.saveFavorites();
                this.renderFavoritesSection();
            },

            toggleFavoriteProgram(channel, program) {
                const key = `${channel.name}:${program.title}`;
                const index = this.favorites.programs.findIndex(p => 
                    `${p.channelName}:${p.title}` === key
                );
                
                if (index > -1) {
                    this.favorites.programs.splice(index, 1);
                } else {
                    this.favorites.programs.push({
                        channelName: channel.name,
                        channelLogo: channel.logo,
                        title: program.title,
                        category: program.category
                    });
                }
                this.saveFavorites();
                this.renderFavoritesSection();
            },

            isFavoriteChannel(channelName) {
                return this.favorites.channels.some(c => c.name === channelName);
            },

            isFavoriteProgram(channelName, programTitle) {
                const key = `${channelName}:${programTitle}`;
                return this.favorites.programs.some(p => 
                    `${p.channelName}:${p.title}` === key
                );
            },

            renderFavoritesSection() {
                const hasChannels = this.favorites.channels.length > 0;
                const hasPrograms = this.favorites.programs.length > 0;
                
                document.getElementById('favoritesEmpty').style.display = 
                    (!hasChannels && !hasPrograms) ? 'block' : 'none';
                
                // Render canali preferiti
                if (hasChannels) {
                    document.getElementById('favoriteChannelsContainer').style.display = 'block';
                    const container = document.getElementById('favoriteChannels');
                    container.innerHTML = '';
                    
                    this.favorites.channels.forEach(favChannel => {
                        const channel = this.data.channels.find(c => c.name === favChannel.name);
                        if (!channel) return;
                        
                        const currentProgram = this.getCurrentProgram(channel);
                        
                        const card = document.createElement('div');
                        card.className = 'favorite-card';
                        card.innerHTML = `
                            <button class="remove-favorite" onclick="event.stopPropagation(); app.toggleFavoriteChannel({name: '${channel.name.replace(/'/g, "\\'")}', logo: '${channel.logo}', playlist: '${channel.playlist}'})">
                                <i class="bi bi-x"></i>
                            </button>
                            <img src="${channel.logo}" alt="${channel.name}" class="channel-logo" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%231a1f3a%22 width=%22100%22 height=%22100%22/><text x=%2250%%22 y=%2250%%22 font-size=%2214%22 fill=%22%230dcaf0%22 text-anchor=%22middle%22 dy=%22.3em%22>TV</text></svg>'">
                            <div class="channel-name">${channel.name}</div>
                            ${currentProgram ? `<small class="text-muted">Ora: ${currentProgram.title.substring(0, 20)}...</small>` : ''}
                        `;
                        card.onclick = () => {
                            if (currentProgram) {
                                this.showNowPlaying(channel, currentProgram);
                            } else {
                                this.showChannelSchedule(channel);
                            }
                        };
                        container.appendChild(card);
                    });
                } else {
                    document.getElementById('favoriteChannelsContainer').style.display = 'none';
                }
                
                // Render programmi preferiti
                if (hasPrograms) {
                    document.getElementById('favoriteProgramsContainer').style.display = 'block';
                    const container = document.getElementById('favoritePrograms');
                    container.innerHTML = '';
                    
                    this.favorites.programs.forEach(favProgram => {
                        const channel = this.data.channels.find(c => c.name === favProgram.channelName);
                        if (!channel) return;
                        
                        // Cerca il programma nella programmazione odierna
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        const todayProgram = channel.programs.find(p => {
                            const start = this.utcToLocal(p.start);
                            return p.title === favProgram.title && 
                                   start.toDateString() === today.toDateString();
                        });
                        
                        const card = document.createElement('div');
                        card.className = 'favorite-card';
                        card.innerHTML = `
                            <button class="remove-favorite" onclick="event.stopPropagation(); app.toggleFavoriteProgram({name: '${favProgram.channelName.replace(/'/g, "\\'")}'}, {title: '${favProgram.title.replace(/'/g, "\\'")}', category: '${favProgram.category || ''}'})">
                                <i class="bi bi-x"></i>
                            </button>
                            <img src="${favProgram.channelLogo}" alt="${favProgram.channelName}" style="width: 60px; height: 60px; object-fit: contain; margin: 0 auto; display: block;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><rect fill=%22%231a1f3a%22 width=%2260%22 height=%2260%22/><text x=%2250%%22 y=%2250%%22 font-size=%2212%22 fill=%22%230dcaf0%22 text-anchor=%22middle%22 dy=%22.3em%22>TV</text></svg>'">
                            <div class="mt-2 fw-bold text-center" style="font-size: 0.9rem;">${favProgram.title}</div>
                            <small class="text-muted d-block text-center">${favProgram.channelName}</small>
                            ${todayProgram ? 
                                `<small class="d-block text-center mt-1" style="color: var(--primary-color);">
                                    <i class="bi bi-clock"></i> ${this.formatTime(this.utcToLocal(todayProgram.start))}
                                </small>` :
                                `<small class="not-scheduled d-block text-center mt-1">Oggi non programmato</small>`
                            }
                        `;
                        card.onclick = () => {
                            if (todayProgram) {
                                this.showChannelSchedule(channel);
                            } else {
                                alert(`"${favProgram.title}" non è programmato oggi su ${favProgram.channelName}`);
                            }
                        };
                        container.appendChild(card);
                    });
                } else {
                    document.getElementById('favoriteProgramsContainer').style.display = 'none';
                }
            },

            async loadData() {
                try {
                    // Prova prima con CORS proxy
                    let response;
                    //const originalUrl = 'https://tvit.leicaflorianrobert.dev/epg/list.json';
                    //const originalUrl = 'https://www.emax83dev.it/api/epg';
                    //const originalUrl = 'https://localhost:7031/api/epg';
                    const originalUrl = '/api/epg';
                    
                    // Lista di CORS proxy da provare in ordine
                    const corsProxies = [
                        `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`,
                        `https://corsproxy.io/?${encodeURIComponent(originalUrl)}`,
                        `https://cors-anywhere.herokuapp.com/${originalUrl}`
                    ];
                    
                    // Prova prima senza proxy
                    try {
                        response = await fetch(originalUrl);
                        if (!response.ok) throw new Error('Direct fetch failed');
                    } catch (directError) {
                        console.log('Tentativo diretto fallito, uso CORS proxy...');
                        
                        // Prova con i proxy in sequenza
                        for (const proxyUrl of corsProxies) {
                            try {
                                response = await fetch(proxyUrl);
                                if (response.ok) {
                                    console.log('CORS proxy riuscito:', proxyUrl);
                                    break;
                                }
                            } catch (proxyError) {
                                console.log('Proxy fallito, provo il prossimo...');
                            }
                        }
                    }
                    
                    if (!response || !response.ok) {
                        throw new Error('Impossibile caricare i dati');
                    }
                    
                    const jsonData = await response.json();
                    document.getElementById('loading').style.display = 'none';


                    // Adatta la struttura dati dal formato API al formato interno
                    this.data = {
                        channels: jsonData.map(item => ({
                            id: item.id,
                            name: item.name,
                            epgName: item.epgName,
                            logo: item.logo,
                            playlist: item.m3uLink,
                            playUrl: '',
                            programs: item.programs.map(program => ({
                                start: program.start,
                                stop: program.end,
                                title: program.title,
                                description: program.description,
                                category: program.category,
                                image: program.poster
                            }))
                        }))
                    };

                    try {
                        response = await fetch('/data/channels.json');
                        if (!response.ok) throw new Error('Direct fetch failed');

                        this.officialLinks = await response.json();
                    } catch (err) {
                        console.error('Errore nel caricamento officialLinks:', err);
                        this.officialLinks = [];
                    }
                    
                    // Assicurati che this.data contenga i canali della guida TV
                    this.data.forEach(channel => {
                        const found = this.officialLinks.find(item => {
                            // Confronta per id o nome, a seconda di cosa hai nella guida
                            return (
                            item.id?.toLowerCase() === channel.id?.toLowerCase() ||
                            item.epgName?.toLowerCase() === channel.name?.toLowerCase()
                            );
                        });
                        if (found) {
                            // 🎯 Se trovato, assegna l'URL ufficiale
                            channel.playUrl = found.playUrl;
                        } else {
                            // 🔍 Se non trovato, costruisci link Google di fallback
                            const query = encodeURIComponent(`${channel.name} diretta`);
                            channel.playUrl = `https://www.google.com/search?q=${query}`;
                        }
                    });


                    this.renderNowSection();
                    this.renderEveningSection();
                    this.renderChannelsGrid();
                    
                    // Auto-apri il primo canale nella sezione "Ora in Onda"
                    this.autoOpenFirstChannel();
                } catch (error) {
                    console.error('Errore caricamento dati:', error);
                    document.getElementById('loading').innerHTML = `
                        <div class="text-center">
                            <p class="text-danger mb-3">
                                <i class="bi bi-exclamation-triangle fs-1"></i><br>
                                Errore nel caricamento dei dati
                            </p>
                            <p class="text-muted">Problema CORS - I dati non possono essere caricati dal server esterno.</p>
                            <button class="btn btn-primary mt-3" onclick="location.reload()">
                                <i class="bi bi-arrow-clockwise"></i> Riprova
                            </button>
                        </div>
                    `;
                }
            },

            autoOpenFirstChannel() {
                console.log('🚀 Auto-apertura...');
                
                // Se ci sono preferiti, mostra la sezione preferiti
                if (this.favorites.channels.length > 0 || this.favorites.programs.length > 0) {
                    console.log('✨ Mostro sezione Preferiti');
                    this.showSection('favorites');
                    return;
                }
                
                // Altrimenti vai su "Ora in Onda"
                console.log('📺 Mostro sezione Ora in Onda');
                this.showSection('now');
                
                // Trova il primo canale con programma corrente
                if (!this.data || !this.data.channels || this.data.channels.length === 0) return;
                
                for (const channel of this.data.channels) {
                    const currentProgram = this.getCurrentProgram(channel);
                    if (currentProgram) {
                        // Piccolo delay per permettere il rendering
                        setTimeout(() => {
                            this.showNowPlaying(channel, currentProgram);
                        }, 500);
                        break;
                    }
                }
            },

            utcToLocal(utcDateStr) {
                const date = new Date(utcDateStr);
                return new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
            },

            formatTime(date) {
                return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            },

            formatDate(date) {
                return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
            },

            getCurrentProgram(channel) {
                const now = new Date();
                return channel.programs.find(program => {
                    const start = this.utcToLocal(program.start);
                    const end = this.utcToLocal(program.stop);
                    return now >= start && now < end;
                });
            },

            getEveningPrograms(channel) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                return channel.programs.filter(program => {
                    const start = this.utcToLocal(program.start);
                    const hour = start.getHours();
                    const isSameDay = start.toDateString() === today.toDateString();
                    return isSameDay && hour >= 20 && hour < 23;
                });
            },

            calculateProgress(program) {
                const now = new Date();
                const start = this.utcToLocal(program.start);
                const end = this.utcToLocal(program.stop);
                const total = end - start;
                const elapsed = now - start;
                return Math.min(100, Math.max(0, (elapsed / total) * 100));
            },

            getDuration(program) {
                const start = this.utcToLocal(program.start);
                const end = this.utcToLocal(program.stop);
                const minutes = Math.round((end - start) / 60000);
                return `${minutes} min`;
            },

            updateTime() {
                const now = new Date();
                document.getElementById('currentTime').textContent = this.formatTime(now);
            },

            showSection(section) {
                console.log('📍 Cambio sezione:', section);
                this.currentSection = section;
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
                document.querySelectorAll('.btn-nav').forEach(btn => btn.classList.remove('active'));
                
                const sectionMap = {
                    'favorites': 'favoritesSection',
                    'now': 'nowSection',
                    'evening': 'eveningSection',
                    'channels': 'channelsSection'
                };
                
                document.getElementById(sectionMap[section]).classList.add('active');
                
                // Attiva il bottone corrispondente
                const buttons = document.querySelectorAll('.btn-nav');
                buttons.forEach(btn => {
                    if (btn.getAttribute('onclick')?.includes(`'${section}'`)) {
                        btn.classList.add('active');
                    }
                });
            },

            renderNowSection() {
                const container = document.getElementById('nowChannels');
                container.innerHTML = '';
                
                if (!this.data || !this.data.channels) {
                    console.error('❌ Nessun dato disponibile');
                    return;
                }
                
                this.data.channels.forEach(channel => {
                    const currentProgram = this.getCurrentProgram(channel);
                    if (!currentProgram) return;
                    
                    const card = document.createElement('div');
                    card.className = 'channel-card';
                    card.innerHTML = `
                        <img src="${channel.logo}" alt="${channel.name}" class="channel-logo" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%231a1f3a%22 width=%22100%22 height=%22100%22/><text x=%2250%%22 y=%2250%%22 font-size=%2214%22 fill=%22%230dcaf0%22 text-anchor=%22middle%22 dy=%22.3em%22>TV</text></svg>'">
                        <div class="channel-name">${channel.name}</div>
                    `;
                    card.onclick = () => this.showNowPlaying(channel, currentProgram);
                    container.appendChild(card);
                });
                console.log('✅ Renderizzati', container.children.length, 'canali in "Ora in Onda"');
            },

            renderEveningSection() {
                const container = document.getElementById('eveningChannels');
                container.innerHTML = '';
                
                if (!this.data || !this.data.channels) return;
                
                this.data.channels.forEach(channel => {
                    const eveningPrograms = this.getEveningPrograms(channel);
                    if (eveningPrograms.length === 0) return;
                    
                    const card = document.createElement('div');
                    card.className = 'channel-card';
                    card.innerHTML = `
                        <img src="${channel.logo}" alt="${channel.name}" class="channel-logo" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%231a1f3a%22 width=%22100%22 height=%22100%22/><text x=%2250%%22 y=%2250%%22 font-size=%2214%22 fill=%22%230dcaf0%22 text-anchor=%22middle%22 dy=%22.3em%22>TV</text></svg>'">
                        <div class="channel-name">${channel.name}</div>
                    `;
                    card.onclick = () => this.showEveningPrograms(channel, eveningPrograms);
                    container.appendChild(card);
                });
                console.log('✅ Renderizzati', container.children.length, 'canali in "Stasera"');
            },

            renderChannelsGrid() {
                const container = document.getElementById('channelsGrid');
                container.innerHTML = '';
                
                if (!this.data || !this.data.channels) return;
                
                this.data.channels.forEach(channel => {
                    const card = document.createElement('div');
                    card.className = 'channel-grid-item';
                    card.innerHTML = `
                        <img src="${channel.logo}" alt="${channel.name}" class="channel-logo" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%231a1f3a%22 width=%22100%22 height=%22100%22/><text x=%2250%%22 y=%2250%%22 font-size=%2214%22 fill=%22%230dcaf0%22 text-anchor=%22middle%22 dy=%22.3em%22>TV</text></svg>'">
                        <div class="channel-name">${channel.name}</div>
                    `;
                    card.onclick = () => this.showChannelSchedule(channel);
                    container.appendChild(card);
                });
                console.log('✅ Renderizzati', container.children.length, 'canali nella griglia');
            },

            showNowPlaying(channel, program) {
                const progress = this.calculateProgress(program);
                const start = this.utcToLocal(program.start);
                const isFavChannel = this.isFavoriteChannel(channel.name);
                const isFavProgram = this.isFavoriteProgram(channel.name, program.title);
                
                const content = `
                    <div class="text-center mb-3">
                        <img src="${channel.logo}" alt="${channel.name}" style="width: 100px;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%231a1f3a%22 width=%22100%22 height=%22100%22/><text x=%2250%%22 y=%2250%%22 font-size=%2214%22 fill=%22%230dcaf0%22 text-anchor=%22middle%22 dy=%22.3em%22>TV</text></svg>'">
                        <div class="d-flex justify-content-center align-items-center gap-2 mt-2">
                            <h4>${channel.name}</h4>
                            <button class="favorite-btn ${isFavChannel ? 'active' : ''}" 
                                    onclick="app.toggleFavoriteChannel({name: '${channel.name.replace(/'/g, "\\'")}', logo: '${channel.logo}', playlist: '${channel.playlist}'}); app.closeBottomSheet(); app.showNowPlaying({name: '${channel.name.replace(/'/g, "\\'")}', logo: '${channel.logo}', playlist: '${channel.playlist}', programs: []}, ${JSON.stringify(program).replace(/'/g, "\\'")});"
                                    title="Aggiungi canale ai preferiti">
                                <i class="bi bi-star"></i>
                            </button>
                        </div>
                    </div>
                    <div class="program-card">
                        ${program.image ? `<img src="${program.image}" class="program-image" onerror="this.style.display='none'">` : ''}
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h3 class="program-title">${program.title}</h3>
                            <button class="favorite-btn ${isFavProgram ? 'active' : ''}" 
                                    onclick="app.toggleFavoriteProgram({name: '${channel.name.replace(/'/g, "\\'")}', logo: '${channel.logo}'}, {title: '${program.title.replace(/'/g, "\\'")}', category: '${program.category || ''}'}); app.closeBottomSheet(); app.showNowPlaying({name: '${channel.name.replace(/'/g, "\\'")}', logo: '${channel.logo}', playlist: '${channel.playlist}', programs: []}, ${JSON.stringify(program).replace(/'/g, "\\'")});"
                                    title="Aggiungi programma ai preferiti">
                                <i class="bi bi-star"></i>
                            </button>
                        </div>
                        <div class="program-time">
                            <i class="bi bi-clock"></i> ${this.formatTime(start)} • ${this.getDuration(program)}
                        </div>
                        ${program.category ? `<span class="program-genre">${program.category}</span>` : ''}
                        ${program.description ? `<p class="mt-3">${program.description}</p>` : ''}
                        <div class="mt-3">
                            <div class="progress" style="height: 8px;">
                                <div class="progress-bar" role="progressbar" style="width: ${progress}%"></div>
                            </div>
                            <small class="text-muted">${Math.round(progress)}% completato</small>
                        </div>
                        <button class="btn btn-primary mt-3 w-100" onclick="app.playChannel('${channel.name}')">
                            <i class="bi bi-play-fill"></i> Guarda Online
                        </button>
                    </div>
                `;
                
                this.openBottomSheet(content);
            },

            showEveningPrograms(channel, programs) {
                const content = `
                    <div class="text-center mb-3">
                        <img src="${channel.logo}" alt="${channel.name}" style="width: 100px;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%231a1f3a%22 width=%22100%22 height=%22100%22/><text x=%2250%%22 y=%2250%%22 font-size=%2214%22 fill=%22%230dcaf0%22 text-anchor=%22middle%22 dy=%22.3em%22>TV</text></svg>'">
                        <h4 class="mt-2">${channel.name}</h4>
                        <p class="text-muted">Programmazione Serale</p>
                    </div>
                    <div class="evening-programs">
                        ${programs.map(program => {
                            const start = this.utcToLocal(program.start);
                            return `
                                <div class="evening-program-card">
                                    <div class="program-time">
                                        <i class="bi bi-clock"></i> ${this.formatTime(start)}
                                    </div>
                                    <h5 class="program-title" style="font-size: 1.1rem;">${program.title}</h5>
                                    <div class="text-muted small mb-2">Durata: ${this.getDuration(program)}</div>
                                    ${program.category ? `<span class="program-genre">${program.category}</span>` : ''}
                                    ${program.description ? `<p class="mt-2 small">${program.description.substring(0, 100)}...</p>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <button class="btn btn-primary mt-3 w-100" onclick="app.playChannel('${channel.name}')">
                        <i class="bi bi-play-fill"></i> Guarda Online
                    </button>
                `;
                
                this.openBottomSheet(content);
            },

            showChannelSchedule(channel) {
                const scheduleContent = document.getElementById('scheduleContent');
                document.getElementById('scheduleChannelName').textContent = channel.name;
                
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const todayPrograms = channel.programs.filter(program => {
                    const start = this.utcToLocal(program.start);
                    return start.toDateString() === today.toDateString();
                }).sort((a, b) => {
                    return this.utcToLocal(a.start) - this.utcToLocal(b.start);
                });
                
                scheduleContent.innerHTML = `
                    <div class="text-center mb-4">
                        <img src="${channel.logo}" alt="${channel.name}" style="width: 80px;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%231a1f3a%22 width=%22100%22 height=%22100%22/><text x=%2250%%22 y=%2250%%22 font-size=%2214%22 fill=%22%230dcaf0%22 text-anchor=%22middle%22 dy=%22.3em%22>TV</text></svg>'">
                        <button class="btn btn-primary mt-3" onclick="app.playChannel('${channel.name}'">
                            <i class="bi bi-play-fill"></i> Guarda Online
                        </button>
                    </div>
                    ${todayPrograms.map(program => {
                        const start = this.utcToLocal(program.start);
                        const now = new Date();
                        const isNow = this.getCurrentProgram(channel)?.title === program.title;
                        
                        return `
                            <div class="program-card ${isNow ? 'border-primary' : ''}">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <h5 class="program-title" style="font-size: 1.1rem;">${program.title}</h5>
                                        <div class="program-time">
                                            <i class="bi bi-clock"></i> ${this.formatTime(start)} • ${this.getDuration(program)}
                                        </div>
                                    </div>
                                    ${isNow ? '<span class="badge bg-danger">IN ONDA</span>' : ''}
                                </div>
                                ${program.category ? `<span class="program-genre">${program.category}</span>` : ''}
                                ${program.description ? `<p class="mt-2 mb-0 small">${program.description}</p>` : ''}
                            </div>
                        `;
                    }).join('')}
                `;
                
                this.scheduleModal.show();
            },

            openBottomSheet(content) {
                document.getElementById('bottomSheetContent').innerHTML = content;
                document.getElementById('bottomSheet').classList.add('show');
                document.getElementById('bottomSheetBackdrop').classList.add('show');
            },

            closeBottomSheet() {
                document.getElementById('bottomSheet').classList.remove('show');
                document.getElementById('bottomSheetBackdrop').classList.remove('show');
            },

            playChannel(channelName) {
                let channel = this.data.filter((ch) => {
                    return (ch.name == channelName);
                });
                /*
                <a v-if="channel.playUrl"
                :href="channel.playUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-primary mt-2 w-100">
                <i class="bi bi-box-arrow-up-right"></i> Guarda sul sito ufficiale
                </a>
                */
            },

            openSearch() {
                this.searchModal.show();
                document.getElementById('searchInput').focus();
            },

            search(query) {
                const resultsContainer = document.getElementById('searchResults');
                
                if (!query || query.length < 2) {
                    resultsContainer.innerHTML = '<p class="text-muted">Inserisci almeno 2 caratteri per cercare</p>';
                    return;
                }
                
                const results = [];
                const searchLower = query.toLowerCase();
                
                this.data.channels.forEach(channel => {
                    // Cerca nel nome del canale
                    if (channel.name.toLowerCase().includes(searchLower)) {
                        results.push({
                            type: 'channel',
                            channel: channel,
                            match: channel.name
                        });
                    }
                    
                    // Cerca nei programmi
                    channel.programs.forEach(program => {
                        if (program.title.toLowerCase().includes(searchLower)) {
                            const start = this.utcToLocal(program.start);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            
                            if (start.toDateString() === today.toDateString()) {
                                results.push({
                                    type: 'program',
                                    channel: channel,
                                    program: program,
                                    match: program.title
                                });
                            }
                        }
                    });
                });
                
                if (results.length === 0) {
                    resultsContainer.innerHTML = '<p class="text-muted">Nessun risultato trovato</p>';
                    return;
                }
                
                resultsContainer.innerHTML = results.slice(0, 20).map(result => {
                    if (result.type === 'channel') {
                        return `
                            <div class="search-result" onclick="app.searchModal.hide(); app.showChannelSchedule(${JSON.stringify(result.channel).replace(/"/g, '&quot;')})">
                                <div class="d-flex align-items-center">
                                    <img src="${result.channel.logo}" style="width: 50px; height: 50px; object-fit: contain; margin-right: 15px; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 5px;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22><rect fill=%22%231a1f3a%22 width=%2250%22 height=%2250%22/><text x=%2250%%22 y=%2250%%22 font-size=%2212%22 fill=%22%230dcaf0%22 text-anchor=%22middle%22 dy=%22.3em%22>TV</text></svg>'">
                                    <div>
                                        <div class="fw-bold">${result.channel.name}</div>
                                        <small class="text-muted"><i class="bi bi-tv"></i> Canale</small>
                                    </div>
                                </div>
                            </div>
                        `;
                    } else {
                        const start = this.utcToLocal(result.program.start);
                        return `
                            <div class="search-result" onclick="app.searchModal.hide(); app.showChannelSchedule(${JSON.stringify(result.channel).replace(/"/g, '&quot;')})">
                                <div class="d-flex align-items-center">
                                    <img src="${result.channel.logo}" style="width: 50px; height: 50px; object-fit: contain; margin-right: 15px; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 5px;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2250%22><rect fill=%22%231a1f3a%22 width=%22100%22 height=%22100%22/><text x=%2250%%22 y=%2250%%22 font-size=%2212%22 fill=%22%230dcaf0%22 text-anchor=%22middle%22 dy=%22.3em%22>TV</text></svg>'">
                                    <div class="flex-grow-1">
                                        <div class="fw-bold">${result.program.title}</div>
                                        <small class="text-muted">
                                            <i class="bi bi-tv"></i> ${result.channel.name} • 
                                            <i class="bi bi-clock"></i> ${this.formatTime(start)}
                                        </small>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                }).join('');
            }
        };

        // Initialize app when DOM is ready
        document.addEventListener('DOMContentLoaded', () => {
            app.init();
        });

        /* IMPLEMENTAZIONE VUE JS. MAN MANO SPOSTARE IL CODICE IN VUEJS */
        const vueApp = Vue.createApp({
            data() {
                return {
                    dataTV: null,
                    channels: [],
                    currentSection: 'now',
                    favorites: { channels: [], programs: [] },
                    loading: true,
                    currentTime: ''
                };
            },
            computed: {
                hasFavorites() {
                    return this.favorites.channels.length > 0;
                },
                liveChannels() {
                    if (!this.dataTV) return [];
                    return this.dataTV.channels.filter(ch => this.getCurrentProgram(ch));
                },
                eveningChannels() {
                    if (!this.dataTV) return [];
                    return this.dataTV.channels.filter(ch => this.getEveningPrograms(ch).length);
                }
            },
            async mounted() {
                this.updateTime();
                setInterval(this.updateTime, 1000);
                this.loadFavorites();
                await this.loadData();
            },
            methods: {
                async loadData() {
                    try {
                        const response = await fetch('https://www.emax83dev.it/api/epg');
                        if(!response.ok){
                            const error = await response.error();
                            console.log(error);
                            return;
                        }
                        
                        const jsonData = await response.json();
                        this.dataTV = {
                            channels: jsonData.map(item => ({
                                name: item.name,
                                logo: item.logo,
                                playlist: item.m3uLink,
                                playUrl: '',
                                programs: item.programs.map(p => ({
                                    start: p.start, stop: p.end, title: p.title, category: p.category
                                }))
                            }))
                        };
                        this.officialLinks=[];
                        let resp2 = await fetch('/data/channels.json');
                        if(!resp2.ok){
                            const error = await response.error();
                            console.log(error);
                            return;
                        }

                        this.officialLinks = await resp2.json();
                        // Assicurati che this.data contenga i canali della guida TV
                        this.dataTV.forEach(channel => {
                            const found = this.officialLinks.find(item => {
                                // Confronta per id o nome, a seconda di cosa hai nella guida
                                return (
                                item.id?.toLowerCase() === channel.id?.toLowerCase() ||
                                item.epgName?.toLowerCase() === channel.name?.toLowerCase()
                                );
                            });
                            if (found) {
                                // 🎯 Se trovato, assegna l'URL ufficiale
                                channel.playUrl = found.playUrl;
                            } else {
                                // 🔍 Se non trovato, costruisci link Google di fallback
                                const query = encodeURIComponent(`${channel.name} diretta`);
                                channel.playUrl = `https://www.google.com/search?q=${query}`;
                            }
                        });


                    } catch (e) {
                        console.error('Errore caricamento:', e);
                    } finally {
                        this.loading = false;
                    }
                },
                updateTime() {
                    const now = new Date();
                    this.currentTime = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                },
                showSection(section) {
                    this.currentSection = section;
                },
                utcToLocal(utcDateStr) {
                    const date = new Date(utcDateStr);
                    return new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
                },
                getCurrentProgram(channel) {
                    const now = new Date();
                    return channel.programs.find(p => {
                        const start = this.utcToLocal(p.start);
                        const end = this.utcToLocal(p.stop);
                        return now >= start && now < end;
                    });
                },
                getEveningPrograms(channel) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return channel.programs.filter(p => {
                        const start = this.utcToLocal(p.start);
                        return start.getHours() >= 20 && start.getHours() < 23 && start.toDateString() === today.toDateString();
                    });
                },
                loadFavorites() {
                    const stored = localStorage.getItem('guidatv_favorites');
                    if (stored) this.favorites = JSON.parse(stored);
                },
                saveFavorites() {
                    localStorage.setItem('guidatv_favorites', JSON.stringify(this.favorites));
                },
                toggleFavoriteChannel(channel) {
                    const idx = this.favorites.channels.findIndex(c => c.name === channel.name);
                    if (idx > -1) this.favorites.channels.splice(idx, 1);
                    else this.favorites.channels.push(channel);
                    this.saveFavorites();
                },
                isFavoriteChannel(name) {
                    return this.favorites.channels.some(c => c.name === name);
                },
                onImgError(e) {
                    e.target.src = '/img/guidatv-logo.png';
                }
            }
        });
        vueApp.mount('#app');