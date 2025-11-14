function checkIsMobile() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isLandscape = width > height;

  // mobile fino a 1024px o landscape con altezza ridotta
  return width <= 1024 || (isLandscape && height <= 768);
}

const { createApp } = Vue;

const vueApp = createApp({
    data() {
        return {
            officialLinks: [],
            channels: [],
            loading: true,
            error: null,
            currentSection: 'favorites',
            currentTime: '',
            currentDate: '',
            favorites: {
                channels: [],
                programs: []
            },
            selectedChannel: null,
            selectedProgram: null,
            showBottomSheet: false,
            bottomSheetContent: null,
            showScheduleModal: false,
            showProgramDetailModal: false,
            searchQuery: '',
            showCookieBanner: false,
            cookiesAccepted: false,
			hideAiredMovies: true,
            epgOnlyFavorites: false,
            epgOnlyOnAir: false,
            epgOnlyEvening: false,
            EPG_EVENING_START: 20,
            EPG_EVENING_END: 24,
            EPG_PIXELS_PER_MINUTE: 4,
			isMobile: false,
            startY: 0,
            currentY: 0,
            isDragging: false,
        }
    },

    computed: {
        hasFavorites() {
            return this.favorites.channels.length > 0 || this.favorites.programs.length > 0;
        },

        favoriteChannels() {
            return this.channels.filter(channel => 
                this.favorites.channels.some(fav => fav.name === channel.name)
            );
        },

        favoriteProgramsWithInfo() {
            return this.favorites.programs.map(favProg => {
                const channel = this.channels.find(c => c.name === favProg.channelName);
                if (!channel) return null;

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const todayProgram = channel.programs.find(p => {
                    const start = this.utcToLocal(p.start);
                    return p.title === favProg.title && start.toDateString() === today.toDateString();
                });

                return {
                    ...favProg,
                    key: `${favProg.channelName}:${favProg.title}`,
                    channel: channel,
                    program: todayProgram,
                    todayProgram: (todayProgram == null || todayProgram == undefined) ? false : true
                };
            }).filter(Boolean);
        },

        channelsWithCurrentProgram() {
            return this.channels.filter(channel => this.getCurrentProgram(channel) !== null);
        },

        channelsWithEveningPrograms() {
            return this.channels.filter(channel => this.getEveningPrograms(channel).length > 0);
        },

        searchResults() {
            if (this.searchQuery.length < 3) return [];

            const results = [];
            const searchLower = this.searchQuery.toLowerCase();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            this.channels.forEach(channel => {
                if (channel.name.toLowerCase().includes(searchLower)) {
                    results.push({
                        type: 'channel',
                        channel: channel,
                        program: null,
                        key: `channel-${channel.id}`,
                        image: channel.logo,
                        title: channel.name,
						category: ''
                    });
                }

                channel.programs.forEach(program => {
                    if (program.title.toLowerCase().includes(searchLower)
					   || program.category?.toLowerCase().includes(searchLower)) {
                        const start = this.utcToLocal(program.start);
                        if (start.toDateString() === today.toDateString()) {
                            results.push({
                                type: 'program',
                                channel: channel,
                                program: program,
                                key: `program-${channel.id}-${program.start}`,
                                image: program.image ?? channel.logo,
                                title: program.title,
								category: program.category ?? ''
                            });
                        }
                    }
                });
            });

            return results;
        },

        allMovies() {
            let movies = [];
            this.channels.forEach(channel => {
                channel.programs.forEach(program => {
                    //aggiungi se ora di inizio superiore ad ora
                    const now = new Date();
					const endOfDay = new Date();
					endOfDay.setHours(24,0,0,0);// end of day
                    const startDate = this.utcToLocal(program.start);
					const endDate = this.utcToLocal(program.stop);

                    if(program.category?.toLowerCase() === 'film') {

                        // nascondo i film già finiti
                        if (this.hideAiredMovies && endDate && endDate < now) {
                            return;
                        }

						if (startDate > endOfDay) { //nascondo quelli che iniziano dopo mezzanotte
							return;
						}

                        // altrimenti includi
                        movies.push({
                            channel: JSON.parse(JSON.stringify(channel)),
                            program: JSON.parse(JSON.stringify(program)),
                        });
                        
                    }
                });
            });
            return movies;
        },

        timeSlotsAllDay() {
            const slots = [];
            const startH = new Date().getHours()-1;
            for (let hour = startH; hour <= 24; hour++) {
                slots.push(`${hour}:00`);
                slots.push(`${hour}:30`);
            }
            return slots;
        },

        timeSlotsEvening() {
            const slots = [];
            for (let hour = 20; hour <= 24; hour++) {
                slots.push(`${hour}:00`);
                slots.push(`${hour}:30`);
            }
            return slots;
        },

        epgChannels() {
            if (this.epgOnlyFavoritesChannels == true) {
                return this.favoriteChannels;
            }
            return this.channels;
        },

    }, // computed
    watch: {
        hideAiredMovies: 'saveFilters',
        epgOnlyFavorites: 'saveFilters',
        epgOnlyEvening(newVal) {
            if(newVal == true){
                this.epgOnlyOnAir = false;
            }
            this.saveFilters();
        },
        epgOnlyOnAir(newVal) {
            if(newVal == true){
                this.epgOnlyEvening = false;
            }
            this.saveFilters();
        }
    },
    methods: {
        async loadData() {
            this.loading = true;
            this.error = null;
            const originalUrl = 'https://www.emax83dev.it/api/epg';
            var response;

            try {
                // fetch local file
                response = await fetch('/data/channels.json');
                if (!response.ok) throw new Error('Direct fetch failed');
                
                this.officialLinks = await response.json();

            } catch (err) {
                console.error('Errore nel caricamento officialLinks:', err);
                this.officialLinks = [];
            }
            
            try {

                response = await fetch(originalUrl);
                if (!response.ok) throw new Error('Direct fetch failed');

            } catch (directError) {

                const corsProxies = [
                    `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`,
                    `https://corsproxy.io/?${encodeURIComponent(originalUrl)}`,
                    `https://cors-anywhere.herokuapp.com/${originalUrl}`,
                    '/api/epg', //local serverless function
                    '/data/list.json' //local static file
                ];
                
                for (const proxyUrl of corsProxies) {
                    try {
                        response = await fetch(proxyUrl);
                        if (response.ok) break;
                    } catch (e) {
                        console.log('Proxy failed:', e);
                    }
                }
            }

            if (!response || !response.ok) {
                throw new Error('Impossibile caricare i dati');
            }

            const jsonData = await response.json();
            
            this.channels = jsonData.map(item => ({
                id: item.id,
                name: item.name,
                epgName: item.epgName,
                logo: item.logo,
                playlist: item.m3uLink,
                externalUrl: this.officialLinks.find(link => link.epgName === item.name)?.externalUrl || "https://www.google.com/search?q=live+streaming+" + encodeURIComponent(item.name),
                programs: item.programs.map(program => ({
                    start: program.start,
                    stop: program.end,
                    title: program.title,
                    description: program.description,
                    category: program.category,
                    image: program.poster
                }))
            }));

            this.loading = false;
            this.autoOpenFirstChannel();
        },
        saveFilters(){
            try{
                const filters = {
                    hideAiredMovies: this.hideAiredMovies,
                    epgOnlyFavorites: this.epgOnlyFavorites,
                    epgOnlyOnAir: this.epgOnlyOnAir,
                    epgOnlyEvening: this.epgOnlyEvening,
                };

                localStorage.setItem('guidatv_settings', JSON.stringify(filters));
            }
            catch(err){
                console.error('saveFilters; Error: ', err);
            }
        },

        loadFilters(){
            try{
                var settings = {
                    hideAiredMovies: true,
                    epgOnlyFavorites: false,
                    epgOnlyOnAir: false,
                    epgOnlyEvening: false,
                };
                const stored = localStorage.getItem('guidatv_settings');
                if (stored) {
                    settings = JSON.parse(stored);
                }

                this.hideAiredMovies = settings.hideAiredMovies;
                this.epgOnlyFavorites = settings.epgOnlyFavorites;
                this.epgOnlyOnAir = settings.epgOnlyFavorites;
                this.epgOnlyEvening = settings.epgOnlyFavorites;
            }
            catch(err){
                console.error('loadFilters; Error: ', err);
            }
        },

        utcToLocal(utcDateStr) {
            const date = new Date(utcDateStr);
            return new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
        },

        formatTime(date) {
            date = new Date(date);
            return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        },

        updateCurrentTime() {
            const now = new Date();
            this.currentTime = this.formatTime(now);
            const giorni = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
            const mesi = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

            const giornoSettimana = giorni[now.getDay()];
            const giorno = now.getDate().toString().padStart(2, '0');
            const mese = mesi[now.getMonth()];
            const ore = now.getHours().toString().padStart(2, '0');
            const minuti = now.getMinutes().toString().padStart(2, '0');

            this.currentDate = `${giornoSettimana} ${giorno} ${mese} ${ore}:${minuti}`;
        },

        getTmdbLink(title){
            if(!title){
                return '#';
            }

            const url = 'https://www.themoviedb.org/search?query=' + encodeURIComponent(title);
            return url;
            
            /* da IMPLEMENTARE
            const apiKey = '<<TMDB_API_KEY>>'; // inserisci la tua chiave TMDB
            const url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(title)}&language=it-IT`;

            try {
                const response = await fetch(url);
                const data = await response.json();

                if (data.results && data.results.length > 0) {
                    const movie = data.results[0];
                    // ritorna link diretto alla pagina del film su TMDB
                    return `https://www.themoviedb.org/movie/${movie.id}`;
                } else {
                    return null;
                }
            } catch (error) {
                console.error('Errore TMDB:', error);
                return null;
            }
            */
        },

        getCurrentProgram(channel) {
            const now = new Date();
            return channel.programs.find(program => {
                const start = this.utcToLocal(program.start);
                const end = this.utcToLocal(program.stop);
                return now >= start && now < end;
            });
        },

       
        getEpgProgramStyle(program) {
            const start = this.utcToLocal(program.start);
            const end = this.utcToLocal(program.stop);
            
            // Base time: 20:00
            const baseTime = new Date(start);
            baseTime.setHours(20, 0, 0, 0);
            
            // Calculate minutes from 20:00
            const startMinutes = (start - baseTime) / 1000 / 60;
            const duration = (end - start) / 1000 / 60;
            
            // Each 30 min slot is 60px
            const pixelsPerMinute = 60 / 30;
            const top = startMinutes * pixelsPerMinute;
            const height = duration * pixelsPerMinute;
            
            return {
                top: `${top}px`,
                height: `${Math.max(height - 4, 30)}px` // Min height 30px, -4px for spacing
            };
        },

        getTodayPrograms(channel) {
            const today = new Date();
            const hh = today.getHours()-1;
            today.setHours(hh, 0, 0, 0);
            const endDay = new Date();
            endDay.setHours(23,59,59,999);
            return channel.programs
                .filter(program => {
                    const start = this.utcToLocal(program.start); // questi però sono UTC
                    const stop = this.utcToLocal(program.stop); //questi però sono UTC
                    return (stop > today && start < endDay);
                })
                .sort((a, b) => this.utcToLocal(a.start) - this.utcToLocal(b.start));
        },

         getEveningPrograms(channel) {
            const today = new Date();
            const startEvening = new Date();
            startEvening.setHours(20,0,0,0);
            const endEvening = new Date();
            endEvening.setHours(24,30,0,0);
            return channel.programs
                .filter(program => {
                    const start = this.utcToLocal(program.start);
                    const stop = this.utcToLocal(program.stop);
                    return (stop > startEvening && start < endEvening);
                })
                .sort((a, b) => this.utcToLocal(a.start) - this.utcToLocal(b.start));
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

        getProgress(program){
            if(!program) return 0;
            if (!program?.start || !program?.stop) return 0;

            const now = new Date();
            const start = new Date(program.start);
            const stop = new Date(program.stop);

            if (now <= start) return 0;
            if (now >= stop) return 100;

            const total = stop - start;
            const elapsed = now - start;
            return (elapsed / total) * 100;
        },

        isCurrentProgram(channel, program) {
            const current = this.getCurrentProgram(channel);
            return current?.title === program.title;
        },

        getProgramWidth(program){
            try {
                const today = new Date();
                const hh = today.getHours()-1;
                today.setHours(hh, 0, 0, 0);
                const endDay = new Date();
                endDay.setHours(24, 0, 0, 0);
                //hh è l'ora di inizio dell'epg.

                // timeslot = 30 minuti = 120px = 1minuto = 4px
                const start = this.utcToLocal(program.start);
                const stop = this.utcToLocal(program.stop);

                // differenza in millisecondi
                var diffMs = stop - start; //durata del programma.

                if(start < today & stop > today){
                    //devo togliere i minuti già trascorsi
                    diffMs = stop - today;
                }
                if (start < endDay & stop > endDay) {
                    //devo togliere i minuti oltre le 24
                    diffMs = endDay - start;
                }

                // conversione in minuti
                var diffMinutes = Math.floor(diffMs / 60000); 
                
                return (diffMinutes * 4) + 'px';

            }
            catch(err){
                console.log("getProgramWidth; Error: " + err.message);
                return '120px';
            }
        },

        getProgramHeight(program){
            try {
                // 30 minuti = 120px
                // qui si parte dalle 20:00 fino alle 24:00
                
                const today = new Date();
                today.setHours(20, 0, 0, 0);
                const endDay = new Date();
                endDay.setHours(24,30,0,0);
                //hh è l'ora di inizio dell'epg.

                // timeslot = 30 minuti = 120px = 1minuto = 4px
                const start = this.utcToLocal(program.start);
                const stop = this.utcToLocal(program.stop);

                // differenza in millisecondi
                var diffMs = stop - start;

                // se un programma inizia dopo le 20 ma prima delle 24
                // caso normale, non faccio nulla

                // se un programma è iniziato prima delle 20 ma termina dopo le 20
                if (start < today & stop > today) {
                    // differenza di minuti restanti
                    diffMs = stop - today;
                }

                // se un programma inizia prima delle 24 ma termina dopo le 24
                if (start < endDay & stop > endDay) {
                    // differenza di minuti visibili
                    diffMs = endDay - start;
                }

                // differenza da millisecondi in minuti
                var diffMinutes = Math.floor(diffMs / 60000);

                // devo l'altezza in pixels: 1 minuto = 4 pixel.
                var pixels = diffMinutes * 4;

                return pixels + 'px';                

            }
            catch(err){
                console.log("getProgramHeight; Error: " + err.message);
                return '120px';
            }
        },

        isFavoriteProgramScheduled(favorite){
            // Trova il canale
            const channel = this.channels.find(ch => ch.name === favorite.channelName);
            if (!channel || !channel.programs) return false;

            // Trova il programma con lo stesso titolo
            const program = channel.programs.find(p => p.title === favorite.title);
            if (program) {
                return true;
            }
            else{
                return false;
            }
        },

        isFavoriteProgramLive(favorite){
            // Trova il canale
            const channel = this.channels.find(ch => ch.name === favorite.channelName);
            if (!channel || !channel.programs) return false;

            // Trova il programma con lo stesso titolo
            const program = channel.programs.find(p => p.title === favorite.title);
            if (!program) return false;

            // Verifica se è attualmente in onda
            const now = new Date();
            const start = this.utcToLocal(program.start);
            const stop = this.utcToLocal(program.stop);

            return now >= start && now <= stop;
        },

        isProgramLive(program) {
            if (program){
                const now = new Date();
                const start = this.utcToLocal(program.start);
                const end = this.utcToLocal(program.stop);
                return now >= start && now < end;
            }
            return false;
        },

        loadFavorites() {
            try {
                var stored = localStorage.getItem('guidatv_favorites');
                if (stored) {
                    this.favorites = JSON.parse(stored);
                }
            } catch (e) {
                console.error('Error loading favorites:', e);
            }
        },

        saveFavorites() {
            try {
                localStorage.setItem('guidatv_favorites', JSON.stringify(this.favorites));
            } catch (e) {
                console.error('Error saving favorites:', e);
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
                });
            }
            this.saveFavorites();
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
        },

        removeFavoriteProgram(prog) {
            const index = this.favorites.programs.findIndex(p => 
                p.channelName === prog.channelName && p.title === prog.title
            );
            if (index > -1) {
                this.favorites.programs.splice(index, 1);
                this.saveFavorites();
            }
        },

        isFavoriteChannel(channel) {
            return this.favorites.channels.some(c => c.name === channel.name);
        },

        isFavoriteProgram(channel, program) {
            const key = `${channel.name}:${program.title}`;
            return this.favorites.programs.some(p => 
                `${p.channelName}:${p.title}` === key
            );
        },

        showNowPlaying(channel) {
            const currentProgram = this.getCurrentProgram(channel);
            if (!currentProgram) return;

            this.selectedChannel = channel;
            this.selectedProgram = currentProgram;
            this.showBottomSheet = true;
        },

        showEveningPrograms(channel) {
            this.selectedChannel = channel;
            this.showBottomSheet = true;
        },

        showProgramInModal(channel, program) {
            this.selectedChannel = channel;
            this.selectedProgram = program;
            this.showScheduleModal = false;
            this.showProgramDetailModal = true;
            this.showBottomSheet = true;
        },

        showChannelSchedule(channel) {
            this.selectedChannel = channel;
            this.selectedProgram = null;
            this.showScheduleModal = true;
            this.showProgramDetailModal = false;
        },

        openChannelDetail(channel) {
            const currentProgram = this.getCurrentProgram(channel);
            if (currentProgram) {
                this.showNowPlaying(channel);
            } else {
                this.showChannelSchedule(channel);
            }
        },

        handleSearchResultClick(result) {
             if(result.type == 'channel'){
                this.showChannelSchedule(result.channel);
            } else if (result.type == 'program'){
                this.showProgramInModal(result.channel, result.program);
            }
        },

        handleFavoriteChannelClick(channel){
            this.showChannelSchedule(channel);
        },

        handleFavoriteProgramClick(program) {
            if (program.todayProgram) {
                const sameTitlePrograms = program.channel.programs.filter(
                    item => item.title === program.title
                );
                var channel = program.channel;
                channel.programs = sameTitlePrograms;
                this.showChannelSchedule(channel);
                //this.showChannelSchedule(program.channel);

            } else {
                console.log(program);
                this.showProgramInModal(program.channel, program.program);
                //alert(`"${program.title}" non è programmato oggi su ${program.channelName}`);
            }
        },

        loadCookieConsent() {
            try {
                const stored = localStorage.getItem('guidatv_cookie_consent');
                if (!stored) {
                    setTimeout(() => {
                       this.showCookieBanner = true;
                        this.cookiesAccepted = false;
                    }, 1000);
                }
                else{
                    const opt = JSON.parse(stored);
                    this.showCookieBanner = opt.bannerVisible;
                    this.cookiesAccepted = opt.cookiesAccepted;
                }

                if(this.cookiesAccepted == true){
                    //carico gli script di trackind
                    this.loadTrackingScripts();
                }
            } catch (e) {
                console.error('Error loading cookie consent:', e);
            }
        },

        acceptCookies(accepted) {
            try {
                this.showCookieBanner = false;
                this.cookiesAccepted = accepted;
                localStorage.setItem('guidatv_cookie_consent', JSON.stringify({
                    bannerVisible: false,
                    cookiesAccepted: accepted
                }));

                this.loadCookieConsent();

            } catch (e) {
                console.error('Error saving cookie consent:', e);
            }
        },
        loadTrackingScripts(){
            try{

            }
            catch(err){
                console.error('loadTrackingScripts; Error saving cookie consent:', e);
            }
        },

        handleImageError(event) {
            const fallback = "/img/placeholder.png";
            if (event.target.src.includes(fallback)) return;
            event.target.src = fallback;
            //event.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%231a1f3a' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' font-size='14' fill='%230dcaf0' text-anchor='middle' dy='.3em'%3ETV%3C/text%3E%3C/svg%3E";
        },

        autoOpenFirstChannel() {
            if (this.hasFavorites) {
                this.currentSection = 'favorites';
            } else {
                this.currentSection = 'epg';
                setTimeout(() => {
                    const firstChannel = this.channelsWithCurrentProgram[0];
                    if (firstChannel) {
                        this.showNowPlaying(firstChannel);
                    }
                }, 500);
            }
        },
		updateDevice() {
      		this.isMobile = checkIsMobile();
  	    },
        startDrag(event) {
            this.isDragging = true;
            this.startY = event.touches[0].clientY;
        },
        onDrag(event) {
            if (!this.isDragging) return;
            this.currentY = event.touches[0].clientY;
            const diff = this.currentY - this.startY;
            if (diff > 0) {
            this.$refs.modal.style.transform = `translateY(${diff}px)`;
            this.$refs.modal.style.transition = "none";
            }
        },
        endDrag() {
            this.isDragging = false;
            const diff = this.currentY - this.startY;

            // Se trascinata abbastanza, chiudi
            if (diff > 100) {
                this.showBottomSheet=false;
            } else {
            // Ritorna alla posizione originale
            this.$refs.modal.style.transition = "transform 0.3s ease";
            this.$refs.modal.style.transform = "translateY(0)";
            }

            this.startY = 0;
            this.currentY = 0;
        },
    },
    mounted() {
		this.isMobile = checkIsMobile();

    window.addEventListener('resize', () => {
      this.isMobile = checkIsMobile();
    });
    window.addEventListener('orientationchange', () => {
      this.isMobile = checkIsMobile();
    });
        this.loadFavorites();
        this.loadCookieConsent();
        this.loadData();
        this.updateCurrentTime();
        setInterval(() => {
            this.updateCurrentTime();
        }, 1000);
    },
	beforeUnmount() {
    window.removeEventListener('resize', this.updateDevice);
    window.removeEventListener('orientationchange', this.updateDevice);
  },
}).mount('#app');

